# Migrating from `@react-typed-forms/core` to `@rx-controls/react`

For a host on `@react-typed-forms/core` — **either major, v4 or v5** — that wants to move onto
`@rx-controls/react` and drop the legacy package.

The guide is version-agnostic because the surface is. v5 is a reimplementation of the v4 API on the
new engine, so every name a v4 host actually uses exists in v5 unchanged; the only v4 exports v5
dropped are engine internals that v4 leaked by re-exporting `@astroapps/controls` wholesale
(`ControlImpl`, `ControlLogic`, `ArrayLogic`, `ObjectLogic`, `ParentLink`, `FieldsProxy`,
`InternalControl`, `Subscriptions`, `resolveSetup`, `getInternalMeta`, …). Every mapping table below
therefore reads the same on both majors. Where behaviour genuinely differs it is called out inline
as **v4 only** or **v5 only**.

This document covers the controls layer only. A host also using the legacy renderer stack
(`@react-typed-forms/schemas`) can keep it as-is and move just the engine underneath — see
[the compat README](../packages/compat-controls/README.md).

Nothing forces this migration. v5 is a supported package running on the same engine as
`@rx-controls/react`, and a half-migrated tree works fine (see
[Going incrementally](#going-incrementally)). The reasons to do it are that explicit reads are safe
under concurrent rendering, you stop needing the SWC plugin, and the component that re-renders is the
one that read the control rather than the one the ambient collector happened to be pointed at.

## Which major you are on

It changes one thing only: whether you can migrate **component by component**.

- **On v5** — you already have a `ControlContext` shared with `@rx-controls/react` (the root
  `<ControlContextProvider value={getCompatContext()}>`). Mixed trees work. Go incrementally.
- **On v4** — there is no way to hand v4's module-global singleton context to
  `@rx-controls/react`, so a mixed tree has two runtimes and module-scope `newControl()` controls
  land in the wrong one. Either migrate the whole tree in one go, or **bump to v5 first** — a semver
  bump plus one provider line, with imports unchanged
  ([compat README](../packages/compat-controls/README.md)) — and then work through this document
  incrementally.

Bumping to v5 first is the low-risk path for anything but a small app, and it is the only one that
lets you stop partway.

## What the ambient API is doing for you

Three ambient bridges. Migrating means replacing each with the explicit thing it stands in for.
(In v5 these are implemented by the compat package and documented in
[`COMPAT-CONTROLS-DESIGN.md`](COMPAT-CONTROLS-DESIGN.md); in v4 they are the engine's own design.
Either way the shape is the same.)

| Bridge | `@react-typed-forms/core` | `@rx-controls/react` |
|---|---|---|
| **Reads** — a module-global collector that patched getters report to, so `c.value` subscribes whoever is rendering | `useComponentTracking()` (what the SWC plugin injects), `collectChanges`, `setChangeCollector` | A `ReadContext` (`rc`) threaded explicitly. `rc.getValue(c)` registers the dependency; the render pass closes with `rendered(…)` |
| **Writes** — a module-global write context that every setter funnels into | `c.value = x`, `groupedChanges`, `runTransaction` | `update((wc) => …)`, from `useReactive()` or `useControlContext()` |
| **Context** — a singleton so `newControl()` works at module scope | v4: implicit, baked into the module. v5: `getCompatContext()` | The `ControlContext` you provide, read via `useControlContext()`, or `useControl()` which resolves it for you |

The read bridge is the one that changes how you write components. The other two are mechanical.

## Step 1 — the render boundary

This is the whole migration, per component. [`RENDER-BOUNDARY.md`](RENDER-BOUNDARY.md) is the
authoritative reference; the short version:

```tsx
// legacy: ambient. The SWC plugin injects the tracking call, or you write it.
function CountView() {
  const stop = useComponentTracking();
  try {
    return <span>{shared.fields.count.value}</span>;
  } finally {
    stop();
  }
}

// @rx-controls/react: explicit.
function CountView() {
  const { rc, rendered } = useReactive();
  return rendered(<span>{rc.getValue(shared.fields.count)}</span>);
}
```

Two rules that catch people:

- **Every return path must go through `rendered(…)`**, early returns included. The `Rendered` return
  type makes forgetting a compile error inside your own package; a dev-mode warning covers the cases
  the type cannot reach (test files, anything outside your `tsconfig` include).
- **Use the `rc` you were handed, never one closed over from an enclosing component.** A read
  through a stale `rc` does not throw: it returns the current value and registers nothing, so the
  component stops re-rendering. In dev a guard catches the common shape — reading an enclosing
  component's `rc` *during* another render pass can only be a captured context, so
  `@rx-controls/react` logs a `console.error` naming the offender (once per call site). It is not
  foolproof: outside a render pass the same read is indistinguishable from a legitimate untracked
  one (event handlers, refs and effects all read finalized contexts on purpose), so those stay
  silent, and the guard is compiled out of production builds entirely. The render helpers hand you
  a fresh `rc` per callback — name the parameter `rc` so it shadows the outer one, and the mistake
  becomes a scoping impossibility rather than something to be caught.

## Step 2 — reads

Every tracked getter becomes a call on `rc`. The control handle itself is unchanged, so only the
read site moves.

| `@react-typed-forms/core` | `@rx-controls/react` |
|---|---|
| `c.value` | `rc.getValue(c)` |
| `c.initialValue` | `rc.getInitialValue(c)` |
| `c.valid` / `c.dirty` / `c.touched` / `c.disabled` | `rc.isValid(c)` / `rc.isDirty(c)` / `rc.isTouched(c)` / `rc.isDisabled(c)` |
| `c.error` / `c.errors` | `rc.getError(c)` / `rc.getErrors(c)` |
| `c.elements` | `rc.getElements(c)` |
| `c.fields.name.value` | `rc.getValue(c.fields.name)` — `fields` navigation is not a tracked read |
| `trackedValue(c)` | `rc.getTrackedValue(c)` — same deep per-field proxy |
| `unsafeRestoreControl(v)` / `unwrapTrackedControl(v)` | `controlFromValue(v)` |
| `getCurrentFields(c)` | `c.existingFields` |

### Untracked snapshots

Reads that deliberately subscribe to nothing — event handlers, callbacks, anywhere there is no
render pass to attach to. **This is the one read mapping that differs between majors**, because v4
exposes only the `current` view and v5 added the `*Now` members alongside it.

| v4 | v5 | `@rx-controls/react` |
|---|---|---|
| `c.current.value` | `c.valueNow` | `c.valueNow` |
| `c.current.initialValue` | `c.initialValueNow` | `c.initialValueNow` |
| `c.current.valid` / `.dirty` / `.touched` / `.disabled` | `c.validNow` / `c.dirtyNow` / `c.touchedNow` / `c.disabledNow` | same as v5 |
| `c.current.error` / `.errors` | `c.errorNow` / `c.errorsNow` | `c.errorNow` / `c.errorsNow` |
| `c.current.elements` | `c.elementsNow` | `c.elementsNow` |
| `c.current.fields` | `c.existingFields` | `c.existingFields` |

So a v5 host's untracked reads carry over verbatim, while a v4 host rewrites `c.current.x` → `c.xNow`
as part of the port. `current` itself is **not** on the `@rx-controls/react` `Control`.

## Step 3 — writes

Mutation moves off the control and onto a `WriteContext` inside `update`. Get `update` from
`useReactive()` in a component, or `useControlContext().update` anywhere else.

| `@react-typed-forms/core` | `@rx-controls/react` |
|---|---|
| `c.value = x` | `update((wc) => wc.setValue(c, x))` |
| `c.setValue((v) => …)` | `update((wc) => wc.updateValue(c, (v) => …))` |
| `c.setValueAndInitial(v, i)` | `wc.setValueAndInitial(c, v, i)` |
| `c.setInitialValue(v)` | **`wc.reset(c, v)`** — legacy's method wrote value *and* baseline |
| `c.initialValue = v` | **`wc.setInitialValue(c, v)`** — baseline alone, so the control goes dirty |
| `c.markAsClean()` | `wc.markClean(c)` |
| `c.setTouched(t)` / `c.setDisabled(d)` | `wc.setTouched(c, t)` / `wc.setDisabled(c, d)` |
| `c.setError(k, m)` / `.setErrors(…)` / `.clearErrors()` | `wc.setError(c, k, m)` / `wc.setErrors(…)` / `wc.clearErrors(c)` |
| `addElement(c, v)` / `removeElement(c, e)` / `updateElements(c, fn)` | `wc.addElement(c, v)` / `wc.removeElement(c, e)` / `wc.updateElements(c, fn)` |
| `groupedChanges(fn)` / `runTransaction(c, fn)` | one `update((wc) => …)` — the batch *is* the transaction |
| `addAfterChangesCallback(cb)` | `wc.afterFlush(cb)` |
| `runPendingChanges()` | nothing — a batch always flushes on exit |

Note the two rows in bold. The legacy `setInitialValue(v)` method is `setValueAndInitial(v, v)` — a
reset — while the `initialValue` *setter* moves the baseline alone. Those two meanings now have two
honest names, and mixing them up is the one mistake here that compiles cleanly: `wc.setInitialValue`
does what the legacy *setter* did, not what the legacy *method* did.

`update` batches notification, not the writes themselves: values change immediately, subscribers
fire once at the end, and nothing rolls back if your callback throws (the writes it already made are
published, and the error rethrown). It does not nest — calling `update` from inside a listener opens
a separate batch that flushes inline. See section I of
[`CONTROL-SEMANTICS.md`](CONTROL-SEMANTICS.md).

> **v4 only.** `runPendingChanges()` really flushes in v4 (v5 already made it a no-op). If you have
> call sites that depend on a mid-transaction flush, unpick them before porting rather than during —
> `@rx-controls/react` has no equivalent, and the batch boundary is the only flush point.

## Step 4 — hooks, components and helpers

Most hooks keep their names and gain an `rc` where they need one.

**Unchanged:** `useControl`, `useComputed`, `useControlEffect`, `useValidator`,
`useAsyncValidator`, `useControlGroup`, `useSelectableArray`, `useFormEdit`, `FormEditProvider`,
`ControlContextProvider`, `NotDefinedContext`, `deepEquals`, `ensureMetaValue`, `lookupControl`,
`getControlPath`, `RenderElements`, `RenderOptional`, `RenderArrayElements`, `SelectionGroup`.

**Renamed:**

| `@react-typed-forms/core` | `@rx-controls/react` |
|---|---|
| `Finput` / `Fselect` / `Fcheckbox` | `ControlInput` / `ControlSelect` / `ControlCheckbox` |
| `RenderControl` | `Reactive` — it takes no control, and never did |
| `renderOptionally` | `whenAllDefined` |
| `usePreviousValue` | `useValueWithPrevious` — it returns a `Control<{ previous?, current }>`, exposing both |
| `ensureSelectableValues` | `selectableValues` |
| `SelectionGroupSync` | `SelectionBuilder` |
| `controlGroup` | `createControlGroup` |
| `setFields` | `attachFields` — it links child controls, it does not set values |
| `getElementIndex` | `getElementPosition` — it returns `{ index, initialIndex }` |
| `ChangeListenerFunc` | `ChangeListener` |
| `ControlSetup` | `ControlOptions`, with `elems` → `elements` and `dontClearError` → `keepErrors` |
| `ControlChange.All` | `ControlChange.AllState` — it omits `Structure` and `Validate`, so it never meant all |
| `createEffect` / `createSyncEffect` / `Effect` | `effect(ctx, fn)` |
| `updateComputedValue(c, compute)` | `computeInto(ctx, c, (rc) => …)` — same write-into-target shape, plus the context and an `rc` for the compute |

**Changed shape:** `useFormControlProps(rc, control)` returns `{ props, errorText }` rather than one
flat bag. Spread `props`; render `errorText` yourself. Watch for
`const { errorText, ...props } = …` — it still compiles and silently collects the wrong thing.

`useControlEffect` deliberately keeps its name: it is an effect triggered by control changes, which
is what `effect` means in this library too.

## What has no equivalent

Plan for these before starting; there is no drop-in.

- **`createAsyncEffect` / `AsyncEffect`** — abort-and-supersede async effects. Not in
  `@rx-controls/react`: `CONTROL-SEMANTICS.md` section L′ specifies an `asyncEffect`, but it was never
  implemented. Compose `effect` with your own `AbortController` (`forms-core`'s jsonata evaluator is
  a worked example), or keep these call sites on v5.
- **`notEmpty`** — a one-line validator helper. Inline it.
- **`controlValues(…)`** — read the controls directly through `rc` in your compute function.
- **`SubscriptionTracker`** — the explicit equivalent is a `ReadContext` plus a
  `SubscriptionReconciler` from `@rx-controls/core/internal`, which is not public API. If you are
  using this, say so before migrating.
- **Per-control `equals` in `ControlSetup`** — equality is per-`ControlContext` in the new engine.
  **v4 only:** v4 supports this and it fails *silently* if you miss it, so grep for `equals:` in a
  `ControlSetup` before starting. v5 hosts already dealt with this on the way in.
- **The metrics and freeze-count APIs** — `getControlMetrics`, `getHeavyControls`,
  `getControlById`, `printControlMetrics`, `printHeavyControls`, `ControlMetricsRegistry`,
  `unsafeFreezeCountEdit`. **v4 only** in the sense that they genuinely work there; v5 already
  reduced them to no-op stubs. Either way, delete the calls.
- **The engine internals v4 re-exported** — `ControlImpl`, `ControlLogic`, `ArrayLogic`,
  `ObjectLogic`, `ParentLink`, `FieldsProxy`, `InternalControl`, `Subscriptions`,
  `SubscriptionList`, `resolveSetup`, `getInternalMeta`, `ensureInternalMeta`, `ControlFlags`.
  **v4 only** — v5 already dropped them, and `@rx-controls/core/internal` exposes a deliberately
  smaller set. If you reach for these, say what for before migrating.

## Going incrementally

**Requires v5** — see [Which major you are on](#which-major-you-are-on). On v4, bump first.

A migrated and an unmigrated component can share a control, and a write through either API updates
both, so there is no big-bang cutover. While both are in the tree:

- Keep `<ControlContextProvider value={getCompatContext()}>` at the root. Both halves must resolve
  the same `ControlContext`, or module-scope `newControl()` controls and hook-created ones end up in
  different runtimes.
- Keep the SWC plugin installed until the last `useComponentTracking` is gone. It is what makes the
  ambient half work.
- `withAmbient(rc, fn)` and `ambientToRc` bridge in the other direction — they let ambient-style
  code run inside an explicit `rc`. Useful for a compute function you have not ported yet.
- **This is the window where a half-ported read is dangerous.** The prototype patch is still
  installed, so `c.value` inside a component that has moved to `useReactive()` still compiles and
  still returns the right value — it just subscribes nobody, because the ambient collector is not
  set during an explicit render pass. Convert a component's reads in the same commit as its
  boundary. Once the legacy package is gone the compiler catches these for you (see below), but not
  before.

Component-by-component in leaf-first order works well, since a leaf's reads are its own.

## When you are done

1. Remove the SWC plugin (`@astroapps/swc-controls-plugin`) from your build config.
2. Drop `@react-typed-forms/core` from `package.json`; add `@rx-controls/react`.
3. Provide a `ControlContext` of your own: `<ControlContextProvider value={createControlContext()}>`
   at the root. One per app (or per SSR request — that is what makes `uniqueId` sequences
   reproducible across render and hydration). On v5 this is the provider you already had, with
   `getCompatContext()` swapped for `createControlContext()`.
4. Typecheck. Any leftover ambient read is now a compile error, because `@rx-controls/react`'s `Control`
   declares no `.value`, `.touched`, `.dirty`, `.error`, `.elements` or `.current`. The untracked
   `*Now` snapshots are the ones that legitimately survive.

That last step is the reason to finish rather than sit half-migrated indefinitely: while the legacy
package is installed, a stale ambient read is silent, and the moment it is gone the compiler finds
every one.
