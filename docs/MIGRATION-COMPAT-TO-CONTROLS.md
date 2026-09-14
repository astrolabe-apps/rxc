# Migrating off `@react-typed-forms/core@5` onto `@rx-controls/react`

For a host already running the compat package (`@react-typed-forms/core@5`) that wants to drop it
and use `@rx-controls/react` directly.

**If you are still on v4, this is not your document.** Getting to v5 is a version bump plus one root
provider line — see [`packages/compat-controls/README.md`](../packages/compat-controls/README.md),
which also lists the six known behavioural divergences from v4. Come back here afterwards. Legacy
`@react-typed-forms/schemas` hosts want [`MIGRATION-FROM-LEGACY.md`](MIGRATION-FROM-LEGACY.md)
instead; the renderer stack is a separate port.

Nothing forces this migration. v5 is a supported package running on the same engine, and a
half-migrated tree works fine (see [Going incrementally](#going-incrementally)). The reasons to do
it are that explicit reads are safe under concurrent rendering, you stop needing the SWC plugin, and
the component that re-renders is the one that read the control rather than the one the ambient
collector happened to be pointed at.

## What compat is doing for you

Three ambient bridges, documented in [`COMPAT-CONTROLS-DESIGN.md`](COMPAT-CONTROLS-DESIGN.md).
Migrating means replacing each with the explicit thing it stands in for:

| Bridge | Compat | `@rx-controls/react` |
|---|---|---|
| **Reads** — a module-global `collectChange` that patched getters report to, so `c.value` subscribes whoever is rendering | `useComponentTracking()` (what the SWC plugin injects), `collectChanges`, `setChangeCollector` | A `ReadContext` (`rc`) threaded explicitly. `rc.getValue(c)` registers the dependency; the render pass closes with `rendered(…)` |
| **Writes** — a module-global `currentWc` that every setter funnels into | `c.value = x`, `groupedChanges`, `runTransaction`, `runInWc` | `update((wc) => …)`, from `useReactive()` or `useControlContext()` |
| **Context** — a singleton `ControlContext` so `newControl()` works at module scope | `getCompatContext()` | The `ControlContext` you already provide, read via `useControlContext()`, or `useControl()` which resolves it for you |

The read bridge is the one that changes how you write components. The other two are mechanical.

## Step 1 — the render boundary

This is the whole migration, per component. [`RENDER-BOUNDARY.md`](RENDER-BOUNDARY.md) is the
authoritative reference; the short version:

```tsx
// compat: ambient. The SWC plugin injects the tracking call, or you write it.
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

Every patched getter becomes a call on `rc`. The control handle itself is unchanged, so only the
read site moves.

| Compat | `@rx-controls/react` |
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

Untracked snapshots keep working and need no `rc`: `c.valueNow`, `c.initialValueNow`, `c.validNow`,
`c.dirtyNow`, `c.touchedNow`, `c.disabledNow`, `c.errorNow`, `c.errorsNow`, `c.elementsNow`. Reach
for these in event handlers and callbacks, where there is nothing to subscribe.

## Step 3 — writes

Mutation moves off the control and onto a `WriteContext` inside `update`. Get `update` from
`useReactive()` in a component, or `useControlContext().update` anywhere else.

| Compat | `@rx-controls/react` |
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

## Step 4 — hooks, components and helpers

Most hooks keep their names and gain an `rc` where they need one.

**Unchanged:** `useControl`, `useComputed`, `useControlEffect`, `useValidator`,
`useAsyncValidator`, `useControlGroup`, `useSelectableArray`, `useFormEdit`, `FormEditProvider`,
`ControlContextProvider`, `NotDefinedContext`, `deepEquals`, `ensureMetaValue`, `lookupControl`,
`getControlPath`, `RenderElements`, `RenderOptional`, `RenderArrayElements`, `SelectionGroup`.

**Renamed:**

| Compat | `@rx-controls/react` |
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
  a worked example), or keep these call sites on compat.
- **`notEmpty`** — a one-line validator helper. Inline it.
- **`controlValues(…)`** — read the controls directly through `rc` in your compute function.
- **`SubscriptionTracker`** — the explicit equivalent is a `ReadContext` plus a
  `SubscriptionReconciler` from `@rx-controls/core/internal`, which is not public API. If you are
  using this, say so before migrating.
- **The metrics and freeze-count APIs** — `getControlMetrics`, `getHeavyControls`,
  `getControlById`, `printControlMetrics`, `printHeavyControls`, `ControlMetricsRegistry`,
  `unsafeFreezeCountEdit`. Already no-op stubs in v5; simply delete the calls.
- **Per-control `equals` in `ControlSetup`** — already dropped in v5, and still absent. Equality is
  per-`ControlContext`.

## Going incrementally

A migrated and an unmigrated component can share a control, and a write through either API updates
both, so there is no big-bang cutover. While both are in the tree:

- Keep `<ControlContextProvider value={getCompatContext()}>` at the root. Both halves must resolve
  the same `ControlContext`, or module-scope `newControl()` controls and hook-created ones end up in
  different runtimes.
- Keep the SWC plugin installed until the last `useComponentTracking` is gone. It is what makes the
  ambient half work.
- `withAmbient(rc, fn)` and `ambientToRc` bridge in the other direction — they let ambient-style
  code run inside an explicit `rc`. Useful for a compute function you have not ported yet.
- **This is the window where a half-ported read is dangerous.** Compat's prototype patch is still
  installed, so `c.value` inside a component that has moved to `useReactive()` still compiles and
  still returns the right value — it just subscribes nobody, because the ambient collector is not
  set during an explicit render pass. Convert a component's reads in the same commit as its
  boundary. Once compat is gone the compiler catches these for you (see below), but not before.

Component-by-component in leaf-first order works well, since a leaf's reads are its own.

## When you are done

1. Remove the SWC plugin (`@astroapps/swc-controls-plugin`) from your build config.
2. Drop `@react-typed-forms/core` from `package.json`; add `@rx-controls/react`.
3. Keep the root `ControlContextProvider`, changing its value from `getCompatContext()` to a
   `createControlContext()` of your own. One per app (or per SSR request — that is what makes
   `uniqueId` sequences reproducible across render and hydration).
4. Typecheck. Any leftover ambient read is now a compile error, because `@rx-controls/react`'s `Control`
   declares no `.value`, `.touched`, `.dirty`, `.error` or `.elements` — those getters only ever
   existed as compat's prototype patch, and dropping the dependency takes them with it. The
   untracked `*Now` snapshots are the ones that legitimately survive.

That last step is the reason to finish rather than sit half-migrated indefinitely: while compat is
installed, a stale ambient read is silent, and the moment it is gone the compiler finds every one.
