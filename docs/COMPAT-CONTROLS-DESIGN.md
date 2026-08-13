# @rxc/compat-controls — Design

A drop-in replacement for the published `@react-typed-forms/core` (and its
re-exported `@astroapps/controls` surface), implemented on top of
`@rxc/controls-core` + `@rxc/controls`. Existing legacy consumers keep their
source unchanged — ambient `.value` reads, global transactions, the SWC
tracking plugin — while running on the new explicit-reactivity engine.

Reference legacy version: `@react-typed-forms/core@4.6.0` /
`@astroapps/controls@1.4.2`. The compat surface targets that release
(which includes `FormEditProvider` / `useFormEdit` / `useFormControlProps`).

## Goals

1. **Source-compatible**: a legacy app switches by aliasing the package (or
   renaming imports) — no code changes beyond the alias.
2. **Interoperable**: compat controls and new-API controls are the *same*
   objects. A control created via compat `newControl()` can be read through a
   new-API `rc`, passed to `@rxc/controls` components, and vice versa. This is
   what makes incremental migration possible: convert one component at a time.
3. **Contained**: every global lives in the compat package. `@rxc/controls-core`
   stays global-free; no changes to core semantics.

### Non-goals

- Bug-for-bug fidelity of legacy *timing* (transaction flush order, cleanup
  scheduling ticks). Semantics per `docs/CONTROL-SEMANTICS.md` are the target;
  legacy quirks that contradict it are not preserved.
- `ControlMetricsRegistry` / `getControlMetrics` / `printHeavyControls` and
  `unsafeFreezeCountEdit` — diagnostics and escape hatches with no new-engine
  analogue. Exported as no-op stubs so imports don't break.
- Legacy SSR uniqueId behavior *improvements* — compat uses a singleton
  context by default, so uniqueId sequences behave like legacy's module
  counter (see “Context & SSR”).

## How consumers adopt it

Two supported modes, both giving the full legacy import surface:

1. **Bundler/package alias** (zero source change):
   - npm/pnpm: `"@react-typed-forms/core": "npm:@rxc/compat-controls@^0.1"`
     (overrides/resolutions for transitive deps).
   - or webpack/vite `resolve.alias`, tsconfig `paths` for types.
2. **Import rename**: `@react-typed-forms/core` → `@rxc/compat-controls`.

The package also re-exports the *new* API (`useControls`, `createControlContext`,
`ReadContext`, …) under a `@rxc/compat-controls/next` subpath so a migrating
app can adopt new-style components file-by-file without adding a second
dependency edge.

> The legacy SWC plugin (`@astroapps/swc-controls-plugin`) injects
> `useComponentTracking()` calls that import from the legacy module specifier;
> under mode 1 the alias redirects those to compat automatically. Verify the
> plugin's emitted specifier during implementation; if it hardcodes
> `@react-typed-forms/core`, mode 2 consumers must keep the alias for that one
> specifier or disable the plugin per file.

## Architecture — three ambient bridges

The entire design reduces to three module-scoped bridges inside compat, each
mirroring a legacy global, each mapped onto an explicit-reactivity primitive:

```
legacy surface            compat bridge (module global)      new-engine primitive
─────────────────         ─────────────────────────────      ─────────────────────────
.value getters      ──▶   collectChange: (c, change)=>void   Map<ControlImpl, ControlChange>
(ambient tracking)        installed per render/compute            + SubscriptionReconciler

.value = x setters  ──▶   currentWc: WriteContextImpl|null   WriteContextImpl (context-free:
groupedChanges()          open → reuse, closed → open+flush   create → mutate → flush)

newControl()        ──▶   compatContext: ControlContext      createControlContext()
(no-context create)       singleton, swappable
```

Key enabling facts (verified against current source):

- `ControlChange` bit values are **identical** in legacy and new core, so
  subscription masks and listener change-bits carry over untouched.
- `WriteContextImpl` is **context-free**: `ControlContext.update()` is just
  `new WriteContextImpl(); cb(wc); wc.flush()`. Nothing per-context. So compat
  can transact on *any* control regardless of which context created it.
- `SubscriptionReconciler.reconcile(tracked: Map<ControlImpl, ControlChange>)`
  takes exactly the shape an ambient collector accumulates — compat doesn't
  need `TrackingReadContext` for component tracking at all.
- New `Control` already exposes non-reactive snapshots (`valueNow`,
  `errorNow`, `dirtyNow`, …), `fields`/`elementsNow` navigation, `meta`,
  `uniqueId`, and `subscribe(listener, mask)` where the listener signature
  `(control, change, wc)` is a compatible superset of legacy's
  `(control, change)`. There is **no** `elements` member on the new core —
  the name was deliberately freed up (renamed to `elementsNow`) so compat can
  define legacy `elements` without overriding anything.
- `ControlImpl`, `toImpl`, `WriteContextImpl`, `SubscriptionReconciler` are
  all available via `@rxc/controls-core/internal`, whose stated audience is
  exactly the compat packages.

### Bridge 1 — ambient reads (`collectChange`)

Legacy getters each do `collectChange?.(this, ControlChange.X)` then return
the value. Compat restores this verbatim:

```ts
// compat-internal module state
let collectChange: ChangeListenerFunc<any> | undefined;

export function setChangeCollector(c: ChangeListenerFunc<any> | undefined) {
  collectChange = c;                       // legacy export, same name
}
export function collectChanges<A>(listener: ChangeListenerFunc<any>, run: () => A): A {
  const prev = collectChange;
  collectChange = listener;
  try { return run(); } finally { collectChange = prev; }
}
```

Prototype getters (Bridge 1 consumers) report to the collector and return the
`*Now` snapshot — see “Patching Control” below.

**`useComponentTracking()`** is the React face of this bridge and the thing
that keeps the SWC plugin working. Per component instance:

```
tracked: Map<ControlImpl, ControlChange>   ← collector writes into this
reconciler: SubscriptionReconciler          ← listener → forceRender
start(): save prev collector, install ours, tracked.clear()
stop():  reconciler.reconcile(tracked), restore prev collector
```

`useComponentTracking()` calls `start()` during the hook, returns `stop` —
the plugin-injected `try { … } finally { stop() }` closes the window at the
end of the render body, synchronous with render, which is the same law
`useControls`/`rendered(…)` obeys (see `docs/RENDER-BOUNDARY.md`). Lifecycle
(alive/dead sweep across StrictMode remounts) goes through the compat
context's `reviveTracker`/`markTrackerDead`, exactly like `useControls`.

Save/restore (rather than set/clear) makes nesting safe: a legacy render
helper's callback runs under its own collector while the enclosing
component's window is conceptually open, mirroring how legacy behaved.

**The rc bridge** — the one non-obvious trick in the design. Several legacy
APIs take an ambient-reading closure (`useComputed(() => …)`,
`useControlEffect(compute, …)`, validator functions, render-helper callbacks)
that compat wants to delegate to the corresponding `@rxc/controls` hook, which
hands the closure an `rc` and tracks reads through it. The bridge converts
ambient reads into rc reads by installing a collector that *re-reads the same
facet through the rc*, which registers exactly that dependency:

```ts
function ambientToRc(rc: ReadContext): ChangeListenerFunc<any> {
  return (c, change) => {
    if (change & ControlChange.Value) rc.getValue(c);
    if (change & ControlChange.Valid) rc.isValid(c);
    if (change & ControlChange.Touched) rc.isTouched(c);
    if (change & ControlChange.Disabled) rc.isDisabled(c);
    if (change & ControlChange.Dirty) rc.isDirty(c);
    if (change & ControlChange.Error) rc.getError(c);
    if (change & ControlChange.InitialValue) rc.getInitialValue(c);
    if (change & ControlChange.Structure) rc.getElements(c as Control<unknown[]>);
  };
}

export function withAmbient<A>(rc: ReadContext, fn: () => A): A {
  return collectChanges(ambientToRc(rc), fn);
}
```

With `withAmbient`, every closure-taking legacy hook is a one-line adapter
over its `@rxc/controls` counterpart:

```ts
export function useComputed<V>(compute: () => V): Control<V> {
  return rxcUseComputed((rc) => withAmbient(rc, compute));
}
```

The double read (snapshot in the getter, tracked re-read in the collector) is
cheap — rc reads are Map inserts — and keeps `TrackingReadContext.track()`
private.

### Bridge 2 — ambient writes (`currentWc`)

All legacy mutation goes through one funnel:

```ts
let currentWc: WriteContextImpl | null = null;

export function runInWc<A>(fn: (wc: WriteContext) => A): A {
  if (currentWc) return fn(currentWc);          // nested → same transaction
  const wc = new WriteContextImpl();
  currentWc = wc;
  try { return fn(wc); } finally {
    currentWc = null;
    wc.flush();
  }
}
```

- Property setters and mutator methods: `c.value = x` →
  `runInWc((wc) => wc.setValue(c, x))`, etc.
- `groupedChanges(fn)` / `runTransaction(control, fn)`:
  `runInWc(() => fn())` — writes inside re-enter `runInWc`, land in the open
  wc, and flush once. Identical observable behavior to legacy's freeze
  counter for the supported cases.
- `addAfterChangesCallback(cb)`: appends to the open wc's `afterChangesCbs`
  (creates a throwaway wc when none is open, matching legacy's "runs after
  current transaction settles").
- `runPendingChanges()`: no-op — the new engine has no cross-transaction
  pending queue; every `runInWc` flushes on exit. Legacy called this from a
  post-commit effect as a safety valve; compat keeps the export for source
  compatibility.

Because `WriteContextImpl` is context-free, this bridge works on controls from
*any* ControlContext — including ones a new-API host created — which is what
makes goal 2 (interop) hold for writes.

### Bridge 3 — the compat ControlContext

Creation needs a context (`newControl`, `controlGroup`, hook-created
controls). Compat owns a singleton:

```ts
let compatContext: ControlContext = createControlContext();
export function getCompatContext(): ControlContext;
export function setCompatContext(ctx: ControlContext): void;  // compat-only export
```

- `newControl(value, setup, initialValue?)` → `compatContext.newControl` (+
  `wc.setInitialValue` when the third arg is given).
- The React layer (`useControl` etc.) delegates to `@rxc/controls` hooks,
  which resolve their context from `ControlContextProvider`. Compat wraps
  `useControlContext` with a fallback: **provider if present, else the compat
  singleton** — legacy apps have no provider; mixed apps that mount a
  provider get coherent behavior with new-API components in the same tree.
  (Implementation: read the React context directly and default, rather than
  calling the throwing `useControlContext`.)
- Reads and writes are context-free (Bridges 1–2), so "wrong context" can
  only affect creation-time concerns: `uniqueId` sequences and tree equality
  (`_ctx.equals` — the default `deepEquals` everywhere in practice).

**SSR caveat**: a module singleton means uniqueId sequences continue across
requests instead of restarting per render pass, so `RenderElements` keys can
differ between server and client render of the same tree. This is exactly
legacy's module-counter behavior (legacy apps live with it); hosts that need
deterministic hydration call `setCompatContext(createControlContext())` per
request/root, or mount a `ControlContextProvider`. Document, don't solve.

## Patching Control

Runtime: `Object.defineProperty` on `ControlImpl.prototype` (from
`@rxc/controls-core/internal`), applied once at compat module load. Every
control in the process — whoever created it — gains the legacy members, which
is precisely what interop requires. The patch is additive except where noted.

Types: a monkey-patch is invisible to TypeScript, so compat exports **its own
`Control<V>` interface** — the new core members plus the legacy members —
and casts at the boundaries. All compat functions/hooks/components are typed
against it. New-core `Control`s flow in freely (the compat type is a
supertype structurally at runtime, enforced by the patch).

| Legacy member | Implementation |
|---|---|
| `value` get | collect `Value` → `valueNow` |
| `value` set | `runInWc(wc.setValue)` |
| `initialValue` get/set | collect `InitialValue` → `initialValueNow` / `wc.setInitialValue` |
| `error` get/set | collect `Error` → `errorNow` / `wc.setError(c,"default",e)` |
| `errors` get | collect `Error` → `errorsNow` |
| `valid` / `dirty` / `touched` / `disabled` / `isNull` get | collect respective bit → `*Now` |
| `touched` / `disabled` set | `runInWc(wc.setTouched / wc.setDisabled)` |
| `current` get | new `ControlPropertiesImpl(this)` — snapshot view over `*Now`, no collection (legacy contract) |
| `elements` get | collect `Structure` → `elementsNow` (the name is free on core — no override) |
| `fields` get | already present; legacy collects nothing here — leave untouched |
| `setValue(cb)` | `runInWc(wc.updateValue)` |
| `setValueAndInitial` / `setInitialValue` / `markAsClean` / `setTouched` / `setDisabled` / `setError` / `setErrors` / `clearErrors` | corresponding `wc.*` via `runInWc` |
| `validate()` | `runInWc((wc) => wc.validate(c))` |
| `isEqual(a,b)` | `toImpl(this)._ctx.equals` |
| `element` get/set | alias for `meta.element` |
| `lookupControl(path)` | core `lookupControl` |
| `meta`, `uniqueId`, `subscribe`, `unsubscribe` | already present and signature-compatible — untouched |
| `addCleanup(fn)` / `cleanup()` (CleanupScope) | compat-local: list on `meta[$cleanup]`; `cleanup()` drains it. `cleanupControl`/`createCleanupScope`/`addCleanup` free functions ride the same list |

Collisions audit: **zero overrides.** Every patched member is either absent
from core (`value`, `error`, `elements`, mutators) or already identical
(`subscribe`, `meta`, `fields`, `uniqueId`). Core renamed its element
accessor to `elementsNow` specifically to keep it that way — re-audit this
table against core whenever core's `Control` grows a member.

## The React layer

Thin adapters over `@rxc/controls`, using `withAmbient` for closures and the
provider-or-singleton context fallback. Signature deltas are all mechanical:

| Legacy export | Strategy |
|---|---|
| `useControl(init, setup&{use}, afterInit?)` | rxc `useControl` + call `afterInit` once on creation. Legacy `ControlSetup` extras (`elems`, `meta`, `afterCreate`, `dontClearError`, `equals`) — new core supports all but `equals`; per-control `equals` is dropped (context-level equality only) and documented |
| `useComputed` / `useCalculatedControl` | rxc `useComputed` + `withAmbient` |
| `useControlEffect(compute, onChange, initial?)` | rxc `useControlEffect` + `withAmbient`; `initial` passes through unchanged |
| `useValueChangeEffect(c, cb, debounce?, runInitial?)` | rxc `useControlEffect((rc) => rc.getValue(c), …)` + timer (the composition proven on the `/controls` demo) |
| `useValidator(c, v, key?)` | rxc `useValidator` with `(value, rc) => withAmbient(rc, () => v(value))` |
| `useAsyncValidator` | rxc `useAsyncValidator`; legacy `validCheckValue(control)` adapts to `(rc, c) => withAmbient(rc, () => check(c))` |
| `useControlGroup`, `usePreviousValue`, `useSelectableArray`, `ensureSelectableValues` | re-export rxc versions (signatures already match; `SelectionGroupSync` gained an optional `ctx` param — supertype) |
| `controlValues(…)` | compat-local: returns `() => …` reading via ambient getters — works inside any `withAmbient`-bridged compute |
| `useComponentTracking` / `useTrackedComponent` | Bridge 1 (see above) — the load-bearing pair |
| `useRefState`, `useDebounced` | port verbatim (pure React utilities) |
| `Finput` / `Fselect` / `Fcheckbox` | re-export rxc versions (same props incl. `notValue`; rxc ones are self-subscribing which legacy's also were via tracking) |
| `formControlProps(c)` | compat-local over ambient getters (legacy: reads collect into the caller's tracker) |
| `useFormControlProps(c)` | `rxcUseFormControlProps` needs an rc — compat version reads via ambient getters + `useFormEdit()` fold, one page of code |
| `FormEditProvider` / `useFormEdit` / `FormEditState` | re-export rxc versions (identical shape — verified against 4.6.0) |
| `RenderControl({children\|render})` | rxc `RenderControl` with `(rc) => withAmbient(rc, cb)` ; accept both prop names |
| `RenderOptional`, `RenderElements`, `RenderArrayElements`, `renderOptionally` | rxc versions, callback adapted: legacy signatures lack the leading `rc` — wrap with `withAmbient` and drop the param |
| `NotDefinedContext` | legacy declares it as a function returning the context — match whatever 4.6 actually exports (verify at implementation; rxc's is a plain context) |

## Non-React function surface

| Group | Disposition |
|---|---|
| `newControl`, `controlGroup` | Bridge 3 |
| `addElement`, `removeElement`, `updateElements`, `newElement` | `runInWc(wc.*)`; `newElement` = `addElement` at end returning the element control |
| `getElementIndex`, `getControlPath`, `lookupControl`, `setFields`, `ensureMetaValue`, `getMetaValue`, `clearMetaValue`, `deepEquals` | re-export core (`getMetaValue`/`clearMetaValue` are trivial meta wrappers if core lacks them) |
| `getCurrentFields`, `cloneFields`, `controlNotNull`, `notEmpty`, `delayedValue` | trivial compat-local ports |
| `updateComputedValue(c, compute)` | core `computed(ctx, c, (rc) => withAmbient(rc, compute))` — verify legacy's exact "recompute on read vs on change" contract during implementation |
| `groupedChanges`, `runTransaction`, `addAfterChangesCallback`, `runPendingChanges`, `setChangeCollector`, `collectChange`, `collectChanges`, `trackControlChange` | Bridges 1–2 |
| `createEffect`, `createSyncEffect`, `createScopedEffect`, `AsyncEffect`, `createAsyncEffect`, `SubscriptionTracker` | Phase C: `SubscriptionTracker` = Map + `SubscriptionReconciler` + ambient install/uninstall (the non-React half of `useComponentTracking`); effects build on it. `@rxc/compat-forms` needs these (legacy schemas' async tracking) |
| `trackedValue`, `unsafeRestoreControl`, `unwrapTrackedControl` | Phase C: port legacy proxy over compat getters; explicit `tracker` param maps to a collector. Prerequisite for `@rxc/compat-forms` and the editor |
| `addCleanup`, `cleanupControl`, `createCleanupScope`, `addDependent`, `withChildren` | Phase C: meta-backed cleanup list (see patch table); `addDependent`/`withChildren` need a semantics check against legacy source before porting |
| `getControlMetrics`, `getHeavyControls`, `getControlById`, `printControlMetrics`, `printHeavyControls`, `ControlMetricsRegistry`, `unsafeFreezeCountEdit` | no-op stubs (documented) |
| `ControlChange`, `ChangeListenerFunc`, `Subscription`, `ControlSetup`, `ControlValue`, `ControlFields`, `ControlElements`, `ControlProperties`, `FormControlProps`, `SelectionGroup` | type re-exports/re-declarations against the compat `Control` |

## Known divergences (document in README, don't paper over)

1. **Per-control `equals` in `ControlSetup`** — dropped (new core has
   context-level equality only). Rare in the wild; flag loudly.
2. **`runPendingChanges` is a no-op** — transactions always flush on exit.
3. **Cleanup timing** — legacy deferred tracker cleanup via `setTimeout(0)`;
   compat inherits the new context's 5s dead-tracker sweep. Observable only
   to code inspecting subscription counts.
4. **Listener extra arg** — subscribers get `(control, change, wc)`; legacy
   code using two params is unaffected, code doing `arguments.length` checks
   (none known) would see 3.
5. **Concurrent rendering** — the ambient collector is a module global set
   during render, same hazard legacy has. Compat is no *less* strict-safe
   than legacy; components ported to `useControls` become fully safe.
6. **Metrics/freeze-count APIs** — stubs.

## Testing strategy

1. **The `/controls` kitchen-sink page is the acceptance test.** Copy
   `apps/legacy-demos/app/controls/page.tsx` into a dev-app route (e.g.
   `/compat`) changing only the import to `@rxc/compat-controls` — it
   exercises every hook, component, mutator, and render helper with known
   behavior on both engines. It must behave identically to both `/controls`
   pages. (No SWC plugin in the dev app: the page relies on
   `useComponentTracking` injected manually or a `useTrackedComponent`
   wrapper — which doubles as the test for that pair.)
2. **Port the `@rxc/controls` test suites' assertions** against the compat
   surface where signatures overlap (binding layer, selectable array,
   validators, render helpers) — same behaviors through the legacy API.
3. **Unit-test the bridges directly**: collector nesting (save/restore),
   `runInWc` reentrancy + single flush, `withAmbient` facet mapping (each
   ControlChange bit → one rc subscription), prototype patch presence +
   `elements` Structure collection, interop (create in new context, mutate
   via compat, subscribe via legacy mask).
4. **SWC-plugin smoke test**: a page in `apps/legacy-demos` (which has the
   plugin) importing from compat via alias, verifying plugin-injected
   tracking works end-to-end.

## Phasing

- **Phase A — engine bridge (no React)**: compat `Control` type, prototype
  patch, Bridges 1–3, `newControl`/array ops/transactions/`collectChanges`,
  trivial function ports. Unit tests for the bridges.
- **Phase B — React surface**: `useComponentTracking`/`useTrackedComponent`,
  all hook adapters, F-components, render helpers, `formControlProps` /
  `useFormControlProps`, FormEdit re-exports. The `/compat` kitchen-sink page
  lands here and must reach parity.
- **Phase C — schemas prerequisites**: `trackedValue` + `SubscriptionTracker`
  + effects + cleanup scopes. Gate: whatever `@rxc/compat-forms`' first
  vertical slice needs. (`@astroapps/controls` deep-cuts like `addDependent`,
  `withChildren`, `delayedValue` verified against legacy source here.)

## Open questions

1. **Package export shape**: should compat *also* publish under the exact
   names `@react-typed-forms/core` (a stub package whose main re-exports
   compat) to make transitive-dependency aliasing unnecessary? Decide when
   first real consumer migrates.
2. **`NotDefinedContext`'s odd legacy typing** (function returning a context)
   — match the 4.6 runtime export exactly; check whether any consumer calls
   it vs uses it as a context.
3. **`useControlContext` fallback vs require-provider**: the design says
   provider-else-singleton. If mixed apps prove confusing (two roots, two
   contexts), consider a dev-mode warning when compat controls from different
   contexts meet in one tree.
