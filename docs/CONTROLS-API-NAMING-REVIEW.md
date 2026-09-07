# `@rxc/controls` API Naming Review

**Status: proposal, nothing implemented.** A pre-publish pass over the whole public surface of
`@rxc/controls` — which includes all of `@rxc/controls-core`, re-exported wholesale — recording what
each export does and whether the name should change before the first published version. 69
top-level names, plus the members of the four interfaces that carry most of the day-to-day surface.

Verdicts are one of:

- **keep** — the name is right as it stands.
- **consider** — defensible, but a better name exists; churn may not be worth it.
- **rename** — the name misleads or collides; fix before publishing.

## The compat constraint is smaller than it looks

`packages/compat-controls` (published as `@react-typed-forms/core@5`) already imports almost
everything from `@rxc/controls` **under an alias** — `useControl as rxcUseControl`,
`Finput as RxcFinput`, and so on — and reimplements a few things itself (its `NotDefinedContext` is
a legacy lazy-singleton factory, unrelated to the context rxc exports). Renaming an aliased import
is a one-line edit per name.

Only **four** rxc names are re-exported through compat verbatim, so only four renames need an alias
added at that boundary:

```ts
// packages/compat-controls/src/index.ts
export { ControlContextProvider } from "@rxc/controls";
export { FormEditProvider, useFormEdit, type FormEditState } from "@rxc/controls";
```

One genuine pin: compat re-exports the `ControlChange` enum straight from core, so its *member*
names (`Value`, `Structure`, `Validate`, …) are legacy-visible. Everything else in the legacy
vocabulary — `Finput`, `useControlEffect`, `setInitialValue`, `controlGroup` — is produced by
compat's own adapter layer and stays published under the legacy package name no matter what the new
library calls it.

**Legacy familiarity is therefore not a reason to keep a name in `@rxc/*`.**

## Rename before publishing

Eleven names where the cost of leaving them is a misled reader or a latent bug, and the fix is a
mechanical rename. Ranked by payoff ÷ churn.

### 1. `WriteContext.setInitialValue` → `reset`

A trap, not a preference. `setInitialValue(c, v)` writes **both** the value and the baseline, while
`setInitialValueOnly` is the method that does what the first one's name says. Anyone reading a call
site guesses wrong. Make the pair:

- `reset(c, v)` — value + baseline, control left clean.
- `setInitialValue(c, v)` — baseline alone, control goes dirty if the two now differ.

and `setInitialValueOnly` disappears. Legacy's `control.setInitialValue()` already maps through
compat, which is where that meaning belongs.

### 2. `RenderControl` → `Reactive`

It takes no control and renders nothing of its own — it is the primitive subscription scope, and
every other render helper is built on it. `<Reactive>{(rc) => …}</Reactive>` says what it is.
(`TrackedScope` and `RenderScope` are the runners-up; `RenderControl` only makes sense as an
artefact of the legacy ambient-tracking model.)

### 3. `as` → `asControl`

A top-level export named `as` is a keyword-shaped landmine: it shadows badly, reads as syntax at the
call site, and lands in every consumer's autocomplete on the first character. It's a three-line
unsafe cast — give it a name that admits that.

### 4. `ReadContext.getValueRx` → `getTrackedValue`

`Rx` is the npm scope leaking into a method name, and it tells the reader nothing about the deep
per-field proxy they're getting. Rename its partner too: `unwrapValueProxy` → `controlFromValue`, so
the round trip reads as one pair rather than two unrelated helpers.

### 5. `Finput` / `Fselect` / `Fcheckbox` → `ControlInput` / `ControlSelect` / `ControlCheckbox`

The `F` prefix is inherited branding that a new reader cannot decode. Compat keeps the old spelling
for legacy apps, so the only cost of fixing it is in the new library's own docs.

### 6. `setFields` → `attachFields`

It links existing child controls into a parent — it does not set the values of fields, which is what
the name suggests next to `setValue`. The private helper it delegates to is already called
`attachFields`; promote that name.

### 7. `noopReadContext` → `untrackedRead`

"Noop" describes the implementation (a `ReadContext` whose tracking does nothing) rather than the use
(read current values without subscribing). `untrackedRead` — or `snapshotRead` — tells a caller when
to reach for it.

### 8. `useControls` / `Controls` → `useReactive` / `ReactiveScope`

The most-called function in the library returns no controls. It makes a component reactive: it hands
back the read tracker, the write batcher, and the boundary that closes the pass. `useReactive()`
names that, and `rc` still reads correctly as the destructured field. The type `Controls` is worse
than the hook — it sounds like a collection of controls and is in fact one component's render
session.

### 9. `wrapWithControlsContext` → `withControlContext`

Same function, conventional HOC spelling, and it stops disagreeing with the singular
`ControlContext` it installs.

### 10. `UseControlSetup` → `UseControlOptions`

A type name with a hook name embedded in it is already awkward; `Setup` as a noun compounds it. If
`ControlSetup` also becomes `ControlOptions`, this is just `ControlOptions & { use?: … }`.

### 11. `ControlSetup.elems` → `.elements`, `.dontClearError` → `.keepErrors`

Inside one small options object: `fields` spelled out but `elems` abbreviated, and a negated boolean
whose double negative (`dontClearError: false`) nobody can read at a glance. Compat's `convertSetup`
already translates the legacy shape, so both are free.

## Judgement calls worth making now

Higher churn, real payoff.

### Three unrelated things are all called `*Context`

`ControlContext` is a tree owner and factory, `ReadContext` is a per-render dependency tracker,
`WriteContext` is a transaction. The shared suffix advertises a family that doesn't exist.

Recommendation: rename **`ControlContext` → `ControlTree`** (with `ControlTreeProvider` /
`useControlTree`) — it's the one users construct, provide, and hold, and "tree" is the word the docs
already use for it. Keep `ReadContext`: it's threaded like a context, and the `rc` convention is
load-bearing across the forms packages. `WriteContext` → `Transaction` reads beautifully at call
sites (`update(tx => tx.setValue(…))`) but `wc` is spelled out across four downstream packages —
worth doing only if we're renaming anyway.

### `ControlChange.All` does not mean all

It omits `Structure` and `Validate`. Defensible as "all state facets" but indefensible as a name — a
caller subscribing with `All` silently misses element insertions. Rename to `AllState`, or add the
two members and introduce a separate constant for the old set.

### `computed(ctx, target, fn)` is not what `computed` means anywhere else

Every signals library's `computed` *creates* the derived value; this one writes into a control you
already own. Either rename it `computeInto`, or give it the shape people expect
(`computed(ctx, fn): Control<V>`) and keep the write-into-target form as the lower-level call. The
React `useComputed` already has the expected shape, which makes the mismatch louder.

### `ComputedRef` / `EffectRef` aren't refs

In a React-adjacent package, `Ref` reads as `useRef`. They're disposable handles whose disposer is
called `cleanup()`. `ComputedHandle` / `EffectHandle` with `dispose()`, or a shared `Reaction` type,
would both be clearer than the status quo.

### `markTrackerDead` / `reviveTracker` are on the public `ControlContext`

These exist for React StrictMode's discard-and-remount cycle and are named after the
implementation's lazy sweep. Nothing outside `@rxc/controls` and `forms-react-core` should call
them. Move them to the `/internal` subpath (where `TrackingReadContext` and
`SubscriptionReconciler` already live), or at minimum rename to `releaseTracker` / `retainTracker`
so they read as refcounting rather than necromancy.

### `Control.fieldsNow` means something different from every other `*Now`

The `Now` suffix means "untracked" everywhere else — `elementsNow` still materializes children.
`fieldsNow` additionally means "only the ones already materialized", which is why every lookup is
`| undefined`. Call it `materializedFields` and the suffix stays honest.

While in there: `isNullNow` is the only state snapshot with an `is` prefix (`validNow`, `dirtyNow`,
`touchedNow` have none) — pick one and apply it to all nine.

### `renderOptionally` vs `RenderOptional`

Two names one capital letter apart doing different jobs — one is a component gating on a single
control, the other a callback factory gating on a record of them. Rename the function
`whenAllDefined`: it's the distinguishing behaviour, and it stops the pair from being a coin-flip in
autocomplete.

### `ensureSelectableValues` doesn't ensure anything the caller can see

It's a factory returning a `SelectionGroupSync`. `selectableValues(options, key)` or
`fromOptions(options, key)` describes the call. `SelectionGroupSync` itself would read better as
`SelectionBuilder` — it builds entries, it doesn't perform a sync.

### Small ones, same visit

| Now | Proposed | Why |
|---|---|---|
| `ChangeListenerFunc` | `ChangeListener` | The `Func` is noise. |
| `markAsClean` | `markClean` | Shorter, same meaning. |
| `afterChanges` | `afterFlush` | Runs after the transaction flushes, not after each change. |
| `getElementIndex` | `getElementPosition` | Returns `{ index, initialIndex }`, not an index. |
| `controlGroup` | `createControlGroup` | Matches `createControlContext`. |
| `ValuesOfControls` | `ControlValues` | Reads as a type, not a sentence. |
| `FormEditState.readonly` | `.readOnly` | The props bag it feeds already uses the DOM spelling; the mismatch is a silent typo waiting to happen. |
| `useControlEffect` | `useControlWatch` | It's a watch (`compute` + `onChange` + `initial`), not an effect — if we're willing to break the legacy echo. |

## Full inventory

### Core — the control tree

| Export | Kind | What it does | Verdict | Suggested |
|---|---|---|---|---|
| `Control<V>` | interface | A node in the value tree: untracked `*Now` snapshots, lazy `fields`/`elementsNow` navigation, `subscribe`, and a `meta` bag. | keep | — |
| `ControlValue<C>` | type | Extracts `V` out of a `Control<V>`. | keep | — |
| `ControlFields<V>` | type | Object-valued `V` mapped to a record of child controls, with nullability pushed onto each field. | keep | — |
| `ControlElements<V>` | type | Array-valued `V` mapped to `Control<A>[]`. | keep | — |
| `ControlSetup<V>` | interface | Creation-time options: `validator`, per-`fields` and per-`elems` setup, `afterCreate`, `meta`, `dontClearError`. | consider | `ControlOptions` (+ `elements`, `keepErrors`) |
| `ControlValidator<V>` | type | A sync value → message function, or `null` for none. | keep | — |
| `ControlChange` | enum | Subscription bitmask: `Value`, `InitialValue`, `Valid`, `Dirty`, `Touched`, `Disabled`, `Error`, `Structure`, `Validate`, `All`. | consider | keep the enum; `All` → `AllState` |
| `ChangeListenerFunc<V>` | type | Subscription callback: `(control, change, wc)`. | consider | `ChangeListener` |
| `Subscription` | type | The handle `subscribe` returns and `unsubscribe` takes. | keep | — |
| `ControlContext` | interface | Tree owner: `newControl`, `update`, tracker lifecycle, and the tree's `equals`. | consider | `ControlTree` |
| `createControlContext` | function | Builds one, optionally with a custom `equals`. | keep | — (follows the above) |
| `ControlContextOptions` | interface | `{ equals? }`. | keep | — |
| `ReadContext` | interface | The reactive read scope threaded everywhere as `rc`; reading through it registers a dependency. | keep | — |
| `WriteContext` | interface | The batched write scope handed to `update`; subscribers fire once at flush. | keep | `Transaction`, if renaming |
| `noopReadContext` | const | A `ReadContext` that returns current values and subscribes to nothing. | **rename** | `untrackedRead` |
| `unwrapValueProxy` | function | Recovers the `Control` behind a value returned by `getValueRx`. | **rename** | `controlFromValue` |
| `deepEquals` | function | Structural equality over plain objects/arrays, NaN-aware; the default tree `equals`. | keep | — |
| `computed` | function | Runs a tracked computation and writes the result into a *target* control, re-running on change. | consider | `computeInto` (or return the control) |
| `effect` | function | Same tracking machinery with no target — for side effects, with an optional cleanup return. | keep | — |
| `ComputedRef` | interface | `computed`'s handle: `replaceCompute`, `cleanup`, `alive`. | consider | `ComputedHandle` |
| `EffectRef` | interface | `effect`'s handle: `replaceEffect`, `cleanup`, `alive`. | consider | `EffectHandle` |
| `controlGroup` | function | Builds a parent control from existing child controls — attached, not copied, so values flow both ways. | consider | `createControlGroup` |
| `setFields` | function | Attaches or replaces fields on a control that may already have subscribers, inside a write batch. | **rename** | `attachFields` |
| `lookupControl` | function | Walks a `(string \| number)[]` path down to a descendant control. | keep | — |
| `getControlPath` | function | The inverse: a control's path up to an optional ancestor. | keep | — |
| `getElementIndex` | function | An element's `{ index, initialIndex }` within a parent array. | consider | `getElementPosition` |
| `ensureMetaValue` | function | Get-or-create a keyed slot in a control's `meta`, with a control factory handed to the initializer. | keep | — |
| `as` | function | Unchecked cast of `Control<unknown>` to `Control<V>`. | **rename** | `asControl` |

### `ReadContext` members

| Member | What it does | Verdict | Suggested |
|---|---|---|---|
| `getValue`, `getInitialValue` | Tracked reads of the two values. | keep | — |
| `isValid`, `isDirty`, `isTouched`, `isDisabled`, `isNull` | Tracked reads of one state facet each. | keep | — |
| `getError`, `getErrors` | First message, or the whole keyed map. | keep | — |
| `getElements` | Element controls of an array, tracking `Structure`. | keep | — |
| `trackValidate` | Reads nothing — adds `Validate` to the tracked mask so the computation re-runs on a `validate()` broadcast. | consider | `trackValidateRequests` (the odd one out: not a read) |
| `getValueRx` | A deep proxy over the value: each property access recurses into the child control, so reading `p.name` subscribes to `name` alone. | **rename** | `getTrackedValue` |
| `isFinalized` | True once the owning render pass has reconciled; late reads return values but register nothing. | keep | — |

### `WriteContext` members

| Member | What it does | Verdict | Suggested |
|---|---|---|---|
| `setValue`, `updateValue` | Write, or write from the current value. | keep | — |
| `setValueAndInitial` | Write value and baseline independently in one call. | keep | — |
| `setInitialValue` | Writes **both** value and baseline — a reset, leaving the control clean. | **rename** | `reset` |
| `setInitialValueOnly` | Moves the baseline alone, so the control becomes dirty if the two now differ. | **rename** | `setInitialValue` |
| `markAsClean` | Adopts the current value as the baseline. | consider | `markClean` |
| `setTouched`, `setDisabled` | Set a flag, cascading to children unless `notChildren`. | keep | — |
| `setError`, `setErrors`, `clearErrors` | Publish one keyed message, replace the map, or clear it. | keep | — |
| `validate` | Broadcasts a validate request through the subtree and reports validity. | keep | — |
| `addElement`, `removeElement`, `updateElements` | Array mutation by value, by index-or-control, or by rebuilding the element list. | keep | — |
| `setElementIncluded` | Set-valued membership toggle: when the members match the baseline in any order, the baseline itself is written back, so toggling off and on again leaves the control clean. | keep | — |
| `afterChanges` | Queues a callback to run after the transaction flushes. | consider | `afterFlush` |

### `ControlContext` members

| Member | What it does | Verdict | Suggested |
|---|---|---|---|
| `newControl` | Creates a control in this tree. | keep | — |
| `update` | Runs a write batch; subscribers fire once at the end. | keep | — |
| `equals` | The tree's value equality. | keep | — |
| `markTrackerDead`, `reviveTracker` | StrictMode-safe tracker lifecycle: mark dead for the lazy sweep, or cancel that. | **rename** | move to `/internal`, else `releaseTracker` / `retainTracker` |

### React — the render boundary

| Export | Kind | What it does | Verdict | Suggested |
|---|---|---|---|---|
| `useControls` | hook | Gives a component its `rc`, the ambient `update`, and `rendered`. The entry point to everything reactive. | **rename** | `useReactive` |
| `Controls` | interface | That hook's return type. | **rename** | `ReactiveScope` |
| `Rendered` | branded type | Return type only `rendered(…)` can produce, so forgetting the boundary is a compile error rather than silent dead reactivity. | keep | — |
| `ControlContextProvider`, `useControlContext` | component, hook | Put a `ControlContext` in React context; read it back. | keep | — (follows `ControlContext`) |
| `wrapWithControlsContext` | HOC | Wraps a component so it always renders under a given context — for call sites you don't own. | **rename** | `withControlContext` |
| `useControl` | hook | A control owned by this component, created once; `useState`-shaped, with a `use` escape hatch so an optional `control` prop needn't be a conditional hook. | keep | — |
| `UseControlSetup<V>` | type | `ControlSetup` plus that `use` field. | **rename** | `UseControlOptions` |
| `useComputed` | hook | A control whose value is derived from other controls, recomputed through its own tracking scope. | keep | — |
| `useControlEffect` | hook | Watch a computed value; run `onChange` when it actually changes, with configurable mount-time behaviour. Never re-renders the component. | consider | `useControlWatch` |
| `useValidator` | hook | Attaches a keyed validator for the component's lifetime; re-publishes on `validate()`, clears its key on unmount. | keep | — |
| `useAsyncValidator` | hook | Debounced, abortable async validation; stale results dropped, in-flight runs aborted on supersede. | keep | — |
| `useControlGroup` | hook | One group control over several independently owned controls, re-attaching when a member's identity changes. | keep | — |
| `usePreviousValue` | hook | A control holding `{ previous, current }` — so it exposes both, not just the previous one. | consider | `useValueWithPrevious` |
| `useSelectableArray` | hook | Exposes an array control as `{ selected, value }` groups, sharing the value controls with the original array and rewriting it as flags toggle. | keep | — |
| `ensureSelectableValues` | function | Builds the entry list for the above from a fixed option set — the multi-select checklist shape. | consider | `selectableValues` |
| `SelectionGroup<V>` | interface | `{ selected, value }`. | keep | — |
| `SelectionGroupSync<V>` | type | The entry-list builder signature. | consider | `SelectionBuilder` |

### React — binding to native inputs

| Export | Kind | What it does | Verdict | Suggested |
|---|---|---|---|---|
| `useFormControlProps` | hook | Turns a control into props for an `<input>`/`<select>`/`<textarea>`: value, change, blur-touches, disabled, error text, and a ref that parks the element on `meta.element`. | keep | — |
| `FormControlProps` | interface | That props bag. `errorText` is not a DOM prop and every caller destructures it out before spreading. | consider | keep the name; split `{ props, errorText }` |
| `FormEditProvider`, `useFormEdit` | component, hook | A presentation lock cascading over a subtree — readonly, or disabled while saving — folded in restriction-only, so it can add a lock but never re-enable a disabled control. | keep | — |
| `FormEditState` | interface | `{ readonly?, disabled? }`. | consider | `readonly` → `readOnly` |
| `Finput`, `Fselect`, `Fcheckbox` | components | Self-subscribing bound inputs: each opens its own render boundary, so typing re-renders only itself, and publishes the control's error as HTML5 custom validity. | **rename** | `ControlInput`, `ControlSelect`, `ControlCheckbox` |
| `FinputProps`, `FselectProps`, `FcheckboxProps` | types | Native element attributes plus `control` (and `notValue` for the checkbox's inverted mapping). | **rename** | follow the components |

### React — nested subscription scopes

| Export | Kind | What it does | Verdict | Suggested |
|---|---|---|---|---|
| `RenderControl` | component | The primitive boundary: runs its callback with a fresh `rc`, so reads inside re-render only this scope. Takes no control. | **rename** | `Reactive` |
| `RenderElements` | component | One nested scope per array element, subscribing only to the array's structure; keyed by `uniqueId`, which is per-context so SSR and hydration agree. | keep | — |
| `RenderOptional` | component | Renders once a control holds a value, handing the callback the narrowed control; subscribes to null-ness alone. | keep | — |
| `renderOptionally` | function | Returns a render callback that fires only when *every* control in a record is non-null, passing their values as a record. | **rename** | `whenAllDefined` |
| `RenderArrayElements` | component | The plain-array counterpart — nothing reactive, so no `rc` and no scope; kept for symmetry. | keep | — |
| `NotDefinedContext` | React context | Subtree-wide fallback for a control with no value, so `notDefined` needn't be passed to every helper. Exported as a raw context object. | consider | add `NotDefinedProvider`, matching FormEdit |
| `RenderCallback` | type | `(rc) => ReactNode` — the shape every helper callback takes. | keep | — |
| `RenderControlProps`, `RenderElementsProps`, `RenderOptionalProps`, `RenderArrayElementsProps` | types | Props for the four helpers. | keep | — (follow their components) |
| `ValuesOfControls<A>` | type | A record of controls mapped to their non-null values, as passed to `renderOptionally`. | consider | `ControlValues` |

## What to leave alone, deliberately

- **`rendered` / `Rendered`.** Distinctive, teachable, and the branded type is the enforcement
  mechanism — a renamed brand is a worse brand.
- **The `*Now` suffix.** It reads oddly at first and then never again, and it makes "untracked read"
  impossible to do by accident. Fix `fieldsNow` and the `isNullNow` outlier rather than the
  convention.
- **`ReadContext` and the `rc` parameter.** Threading it explicitly *is* the design; both names
  carry that, and every downstream package plus `docs/RENDER-BOUNDARY.md` is built on the shorthand.
- **`setElementIncluded`.** Wordy, but it names the set semantics that make an unchecked-then-
  rechecked checklist come back clean — which is exactly the thing a caller needs to know.
- **The `/internal` subpath.** Right call, right name; it's where the tracker-lifecycle methods
  should join `TrackingReadContext` and `SubscriptionReconciler`.

---

Compiled from `packages/controls/src/index.ts`, `packages/controls-core/src/index.ts`, and the
declared interfaces in `packages/controls-core/src/types.ts`. Compat coupling checked against every
`@rxc/controls` import in `packages/compat-controls/src`.
