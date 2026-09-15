# @react-typed-forms/core v5 (compat) — Design

The v5 major of `@react-typed-forms/core`: the legacy v4 surface (including
its re-exported `@astroapps/controls`) reimplemented on top of
`@rx-controls/core` + `@rx-controls/react`, published under the legacy package
name. Existing legacy consumers keep their source unchanged — ambient
`.value` reads, global transactions, the SWC tracking plugin — while running
on the new explicit-reactivity engine. (Repo folder:
`packages/compat-controls`; designed under the working name
`@rx-controls/compat-controls`.)

Reference legacy version: `@react-typed-forms/core@4.6.0` /
`@astroapps/controls@1.4.2`. The compat surface targets that release
(which includes `FormEditProvider` / `useFormEdit` / `useFormControlProps`).

## Goals

1. **Source-compatible**: a legacy app switches by bumping
   `@react-typed-forms/core` to `^5.0.0` — no import changes, no code changes
   beyond the one-line root provider.
2. **Interoperable**: compat controls and new-API controls are the *same*
   objects. A control created via compat `newControl()` can be read through a
   new-API `rc`, passed to `@rx-controls/react` components, and vice versa. This is
   what makes incremental migration possible: convert one component at a time.
3. **Contained**: every global lives in the compat package. `@rx-controls/core`
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

The package is **published under the legacy name as its next major:
`@react-typed-forms/core@5.0.0`** (open question 1, resolved the strong
way). Migration is a plain semver-major bump — no aliasing, no import
renames, and the SWC tracking plugin keeps working because its injected
import specifier resolves to the same package name:

1. `@react-typed-forms/core`: `^4.x` → `^5.0.0`.
2. Mount `<ControlContextProvider value={getCompatContext()}>` at the app
   root so the React layer resolves a context (see Bridge 3).

In this repo the package lives at `packages/compat-controls` with
`"name": "@react-typed-forms/core"`. The legacy reference apps
(`legacy-demos`, `legacy-compare`) deliberately stay on the published 4.6
baseline: `decoupledLocalDependencies` in `rush.json` makes their `^4.6.0`
resolve from the registry instead of the workspace, and
`allowedAlternativeVersions` permits the two ranges to coexist.

The package also re-exports the *new* API (`useReactive`, `createControlContext`,
`ReadContext`, …) under a `@react-typed-forms/core/next` subpath so a
migrating app can adopt new-style components file-by-file without adding a
second dependency edge. (Not yet implemented — depending on `@rx-controls/react`
directly works too.)

> The legacy SWC plugin (`@astroapps/swc-controls-plugin`) injects
> `useComponentTracking()` calls importing from `@react-typed-forms/core` —
> which is exactly this package, so the plugin keeps working with no
> configuration at all. (This is the strongest argument for publishing under
> the legacy name.)

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
  all available via `@rx-controls/core/internal`, whose stated audience is
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
`useReactive`/`rendered(…)` obeys (see `docs/RENDER-BOUNDARY.md`). Lifecycle
(alive/dead sweep across StrictMode remounts) goes through the compat
context's `retainTracker`/`releaseTracker`, exactly like `useReactive`.

Save/restore (rather than set/clear) makes nesting safe: a legacy render
helper's callback runs under its own collector while the enclosing
component's window is conceptually open, mirroring how legacy behaved.

**The rc bridge** — the one non-obvious trick in the design. Several legacy
APIs take an ambient-reading closure (`useComputed(() => …)`,
`useControlEffect(compute, …)`, validator functions, render-helper callbacks)
that compat wants to delegate to the corresponding `@rx-controls/react` hook, which
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
over its `@rx-controls/react` counterpart:

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

Creation needs a context (`newControl`, `createControlGroup`, hook-created
controls). Compat owns a singleton:

```ts
let compatContext: ControlContext = createControlContext();
export function getCompatContext(): ControlContext;
export function setCompatContext(ctx: ControlContext): void;  // compat-only export
```

- `newControl(value, setup, initialValue?)` → `compatContext.newControl` (+
  `wc.setInitialValue` when the third arg is given — legacy constructs
  with `(value, initialValue)`, so the current value is untouched).
- The React layer (`useControl` etc.) delegates to `@rx-controls/react` hooks,
  which resolve their context from `ControlContextProvider`. **Legacy apps
  add one line at the root**:
  `<ControlContextProvider value={getCompatContext()}>` (both names exported
  from this package). This is a deliberate, explicit migration step — no
  no-provider fallback exists, so `@rx-controls/react` stays free of ambient
  context globals. Using `getCompatContext()` as the value keeps
  module-level `newControl()` controls and hook-created controls in one
  context (one uniqueId sequence, one equality).
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
`@rx-controls/core/internal`), applied once at compat module load. Every
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
| `initialValue` get/set | collect `InitialValue` → `initialValueNow` / `wc.setInitialValue` (the setter moves the clean baseline alone) |
| `error` get/set | collect `Error` → `errorNow` / `wc.setError(c,"default",e)` |
| `errors` get | collect `Error` → `errorsNow` |
| `valid` / `dirty` / `touched` / `disabled` / `isNull` get | collect respective bit → `*Now` |
| `touched` / `disabled` set | `runInWc(wc.setTouched / wc.setDisabled)` |
| `current` get | new `ControlPropertiesImpl(this)` — snapshot view over `*Now`, no collection (legacy contract) |
| `elements` get | collect `Structure` → `elementsNow` (the name is free on core — no override) |
| `fields` get | already present; legacy collects nothing here — leave untouched |
| `setValue(cb)` | `runInWc(wc.updateValue)` |
| `setValueAndInitial` / `setInitialValue` / `markAsClean` / `setTouched` / `setDisabled` / `setError` / `setErrors` / `clearErrors` | corresponding `wc.*` via `runInWc`. Note the legacy `setInitialValue(v)` is shorthand for `setValueAndInitial(v, v)` — a **reset**, not a baseline move — so it maps to `wc.reset`. `wc.setInitialValue` now means the baseline move, which is what the legacy `initialValue` *setter* does; do not cross the two |
| `validate()` | `runInWc((wc) => wc.validate(c))` |
| `isEqual(a,b)` | `toImpl(this)._ctx.equals` |
| `element` get/set | alias for `meta.element` |
| `lookupControl(path)` | core `lookupControl` |
| `as<V2>()` | `return this` — type-level widening cast (`V extends V2 ? Control<V2> : never`), identical to legacy |
| `meta`, `uniqueId`, `subscribe`, `unsubscribe` | already present and signature-compatible — untouched |
| `addCleanup(fn)` / `cleanup()` (CleanupScope) | compat-local: list on `meta[$cleanup]`; `cleanup()` drains it. `cleanupControl`/`createCleanupScope`/`addCleanup` free functions ride the same list |

Collisions audit: **zero overrides.** Every patched member is either absent
from core (`value`, `error`, `elements`, mutators) or already identical
(`subscribe`, `meta`, `fields`, `uniqueId`). Core made two renames
specifically to keep it that way — the public element accessor became
`elementsNow`, and `ControlImpl`'s internal `validate(notify, wc)` became
`validateImpl` (matching the `setValueImpl` convention) so legacy
`control.validate()` could be patched without shadowing the method
`WriteContext.validate` dispatches to. The patch dev-asserts `!(name in
prototype)` per member on load — re-audit whenever core's `Control` grows a
member.

## The React layer

Thin adapters over `@rx-controls/react`, using `withAmbient` for closures and the
provider-or-singleton context fallback. Signature deltas are all mechanical:

| Legacy export | Strategy |
|---|---|
| `useControl(init, setup&{use}, afterInit?)` | rxc `useControl` + call `afterInit` once on creation. Legacy `ControlSetup` extras (`elems`, `meta`, `afterCreate`, `dontClearError`, `equals`) — new core supports `elems` (as `elements`), `meta` and `afterCreate`; per-control `equals` is dropped (context-level equality only) and documented; `dontClearError` maps to `keepErrors`, which the engine accepts but does not act on |
| `useComputed` / `useCalculatedControl` | rxc `useComputed` + `withAmbient` |
| `useControlEffect(compute, onChange, initial?)` | rxc `useControlEffect` + `withAmbient`; `initial` passes through unchanged |
| `useValueChangeEffect(c, cb, debounce?, runInitial?)` | rxc `useControlEffect((rc) => rc.getValue(c), …)` + timer (the composition proven on the `/controls` demo). The timer is deliberately **not** cancelled on unmount, because v4's `useDebounced` owned only a `useRef` and registered no cleanup — see the hook's doc comment |
| `useValidator(c, v, key?)` | rxc `useValidator` with `(value, rc) => withAmbient(rc, () => v(value))` |
| `useAsyncValidator` | rxc `useAsyncValidator`; legacy `validCheckValue(control)` adapts to `(rc, c) => withAmbient(rc, () => check(c))` |
| `useControlGroup`, `usePreviousValue`, `useSelectableArray`, `ensureSelectableValues` | re-export rxc versions (signatures already match; rxc's `SelectionBuilder` — legacy's `SelectionGroupSync` — gained an optional `ctx` param, a supertype) |
| `controlValues(…)` | compat-local: returns `() => …` reading via ambient getters — works inside any `withAmbient`-bridged compute |
| `useComponentTracking` / `useTrackedComponent` | Bridge 1 (see above) — the load-bearing pair |
| `useRefState`, `useDebounced` | port verbatim (pure React utilities) |
| `Finput` / `Fselect` / `Fcheckbox` | re-typed wrappers over rxc's `ControlInput` / `ControlSelect` / `ControlCheckbox` (same props incl. `notValue`; rxc ones are self-subscribing, which legacy's also were via tracking) |
| `formControlProps(c)` | compat-local over ambient getters (legacy: reads collect into the caller's tracker) |
| `useFormControlProps(c)` | `rxcUseFormControlProps` needs an rc — compat version reads via ambient getters + `useFormEdit()` fold, one page of code |
| `FormEditProvider` / `useFormEdit` / `FormEditState` | compat-local wrapper (`src/formEdit.tsx`). Was a verbatim re-export, until rxc renamed the flag `readonly` -> `readOnly` (the DOM spelling): 4.6.0 ships `readonly`, so compat owns the legacy spelling and maps it across. An import alias cannot do this — the rename is to a *member* |
| `RenderControl({children\|render})` | rxc `Reactive` with `(rc) => withAmbient(rc, cb)` ; accept both prop names |
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
| `createEffect`, `createSyncEffect`, `createScopedEffect`, `AsyncEffect`, `createAsyncEffect`, `SubscriptionTracker` | ✅ ported near-verbatim (`effects.ts`): `SubscriptionTracker` runs on the public per-control `subscribe`/`unsubscribe` (identical in the new engine — no reconciler needed); effects defer re-runs via `addAfterChangesCallback`, which coalesces to one run per transaction because `runInWc` keeps the ambient wc open through its own flush |
| `trackedValue`, `unsafeRestoreControl`, `unwrapTrackedControl` | ✅ ported verbatim (`trackedValue.ts`) over `current` + patched navigation; explicit `tracker` param, ambient collector default |
| `addCleanup`, `cleanupControl`, `createCleanupScope`, `addDependent`, `withChildren` | ✅ shipped (meta-backed cleanup list; `addDependent` = parent cleanup tears down child, legacy-verbatim) |
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
   `/compat`) — with the package published under the legacy name its
   imports stay byte-identical; only the root provider is added — it
   exercises every hook, component, mutator, and render helper with known
   behavior on both engines. It must behave identically to both `/controls`
   pages. (No SWC plugin in the dev app: the page relies on
   `useComponentTracking` injected manually or a `useTrackedComponent`
   wrapper — which doubles as the test for that pair.)
2. **Port the `@rx-controls/react` test suites' assertions** against the compat
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
  trivial function ports. Unit tests for the bridges. ✅ **Shipped** (40
  tests). Notes from implementation: `updateComputedValue` builds on core
  `computed()` (eager first run, torn down by `control.cleanup()`);
  `withChildren`/`addCleanup`/`cleanupControl`/`createCleanupScope` turned
  out trivial and shipped in A rather than C; `delayedValue` re-computes per
  read (legacy parity — no caching).
- **Phase B — React surface**: `useComponentTracking`/`useTrackedComponent`,
  all hook adapters, F-components, render helpers, `formControlProps` /
  `useFormControlProps`, FormEdit re-exports. The `/compat` kitchen-sink page
  lands here and must reach parity. ✅ **Shipped** (22 further tests + the
  dev-app `/compat` acceptance page). Notes: no no-provider fallback — legacy
  apps mount `<ControlContextProvider value={getCompatContext()}>` once at
  the root (open question 3, resolved); `NotDefinedContext` ported as the
  legacy lazy singleton-context factory; `useValueChangeEffect` composes its
  debounce without legacy's conditional-hook call; `controlValues`' single
  argument is always the record form (legacy contract).
- **Phase C — schemas prerequisites**: `trackedValue` + `SubscriptionTracker`
  + effects + cleanup scopes. ✅ **Shipped** (17 further tests; 79 total).
  Notes: `SubscriptionTracker`/`Effect`/`AsyncEffect` ported near-verbatim —
  they only ever needed the public control surface plus the ambient bridges.
  One Bridge-2 semantic fix fell out: `runInWc` now keeps the ambient wc
  open **through its own flush**, so writes and `addAfterChangesCallback`
  calls made from inside subscription listeners join the flushing
  transaction (its drain loops pick them up) — reproducing legacy's single
  listener storm per transaction, which is what makes an Effect's deferred
  re-run coalesce to once per `groupedChanges` batch.

## Open questions

1. ~~**Package export shape**~~ — resolved beyond the original question: the
   package *is* `@react-typed-forms/core@5.0.0`, not a stub or alias target.
   (The `@rx-controls/compat-controls` working name survives only as the repo folder
   `packages/compat-controls`.)
2. **`NotDefinedContext`'s odd legacy typing** (function returning a context)
   — match the 4.6 runtime export exactly; check whether any consumer calls
   it vs uses it as a context.
3. ~~**`useControlContext` fallback vs require-provider**~~ — resolved:
   provider required. A `setControlContextFallback` seam was prototyped in
   `@rx-controls/react` and removed — the one-line root
   `<ControlContextProvider value={getCompatContext()}>` is an acceptable
   migration step and keeps the React adapter free of module-global context
   state.
