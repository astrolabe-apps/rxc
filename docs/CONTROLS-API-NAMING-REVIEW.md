# `@rxc/controls` API Naming Review

**Status: every verdict is decided. Nothing is implemented.**

A pre-publish pass over the whole public surface of `@rxc/controls` — which includes all of
`@rxc/controls-core`, re-exported wholesale — recording what each export does and whether the name
should change before the first published version. 69 top-level names, plus the members of the four
interfaces that carry most of the day-to-day surface.

Verdicts are one of:

- **keep** — the name is right as it stands.
- **accept** — decided: the suggested name wins. Not yet implemented.

The review originally sorted changes into `consider` (defensible, but a better name exists) and
`rename` (misleads or collides). Both buckets have since been accepted wholesale, so neither verdict
appears below any more — only `keep` and `accept`.

## Decisions taken

Reviewed and settled, in the order they were decided. Everything here still needs implementing.

**Accepted — every item that was previously `consider` (17):** `ControlSetup` → `ControlOptions`
(with `.elems` → `.elements`, `.dontClearError` → `.keepErrors`), `ControlChange.All` → `.AllState`,
`ChangeListenerFunc` → `ChangeListener`, `computed` → `computeInto`, `ComputedRef` →
`ComputedHandle`, `EffectRef` → `EffectHandle`, `controlGroup` → `createControlGroup`,
`getElementIndex` → `getElementPosition`, `markAsClean` → `markClean`, `afterChanges` →
`afterFlush`, `usePreviousValue` → `useValueWithPrevious`, `ensureSelectableValues` →
`selectableValues`, `SelectionGroupSync` → `SelectionBuilder`, `FormControlProps` split into
`{ props, errorText }`, `FormEditState.readonly` → `.readOnly`, `NotDefinedContext` gains a
`NotDefinedProvider`, `ValuesOfControls` → `ControlValues`.

**Accepted from the judgement calls:** `Control.fieldsNow` → `existingFields` (staying public), and
`markTrackerDead` / `reviveTracker` → `releaseTracker` / `retainTracker` (also staying public — see
their sections for why `/internal` was rejected for both).

**Rejected:** `useControlEffect` → `useControlWatch`. It is an effect, triggered by control changes,
and `effect` in `controls-core` already carries that exact meaning — see "What to leave alone".

**Accepted — the twelve `rename` items (17 exports):** `WriteContext.setInitialValue` → `reset`
with `setInitialValueOnly` → `setInitialValue`, `RenderControl` → `Reactive`, `as` → `asControl`,
`getValueRx` → `getTrackedValue` with `unwrapValueProxy` → `controlFromValue`, `isFinalized` →
`isTracking` (polarity flipped), `Finput`/`Fselect`/`Fcheckbox` (and their props types) →
`ControlInput`/`ControlSelect`/`ControlCheckbox`, `setFields` → `attachFields`, `noopReadContext` →
`untrackedRead`, `useControls`/`Controls` → `useReactive`/`ReactiveScope`,
`wrapWithControlsContext` → `withControlContext`, `UseControlSetup` → `UseControlOptions`, and
`renderOptionally` → `whenAllDefined`.

**The only deliberate no-op:** the `*Context` family complaint. Real, but every available fix is
worse — see its section.

**Nothing is implemented.** The whole surface change is one pre-publish break, to land with the
migration guide below.

## Also required: a legacy → `@rxc/controls` migration guide

Renaming the surface invalidates the mapping any legacy host would work from, so the rename lands
with a Rosetta-stone doc for `@react-typed-forms/core` → `@rxc/controls` — the controls-side sibling
of `docs/MIGRATION-FROM-LEGACY.md`, which covers only the schemas/renderer side.

Not yet scoped. The open question is the audience, and it changes the doc materially:

- **Legacy v4 → `@rxc/controls` direct**, for hosts porting properly rather than bumping to the
  compat package. Main event is ambient tracking → explicit `rc`/`wc`, on top of the name mapping.
- **Compat v5 → `@rxc/controls`**, for hosts already on `@react-typed-forms/core@5` who want to drop
  compat. Same ambient-to-explicit story, but they arrive having already changed nothing but a
  version number and one provider line.
- **Both in one doc**, legacy-v4 mapping as the main table plus a section on the compat stepping
  stone.

Note the compat package means no legacy host is *forced* through any of this, which is what makes
this a guide rather than a breaking-change notice.

## What a `ReadContext` actually is

Several verdicts below turn on this, and it is easy to get wrong: `ReadContext` is **the** reactive
read scope for the whole library, not a render-time dependency tracker. A React render is only one
of the things that opens one.

There is one implementation, `TrackingReadContext` (exported from `@rxc/controls-core/internal`),
and five callers construct one directly:

| Caller | Opens a scope for | Re-runs when |
|---|---|---|
| `useControls` — `packages/controls/src/useControls.tsx` | a component's render pass | a tracked facet changes → `forceRender` |
| `computed` — `controls-core/src/computed.ts` | a derived value written into a target control | a tracked facet changes → recompute |
| `effect` — `controls-core/src/computed.ts` | a side effect with optional cleanup | a tracked facet changes → re-run |
| `useValidator` — `packages/controls/src/useValidator.ts` | a validator, including cross-field reads | a tracked facet changes, or `validate()` broadcasts |
| `jsonataEval` — `forms-core/src/evalExpression.ts` | an async expression evaluated across `await` | a tracked facet changes → abort and re-run |

All five share one lifecycle:

```
reset()  →  reads register (control, facet) pairs in `tracked`  →  reconciler.reconcile(tracked)
```

`reconcile` diffs that map against the live subscriptions and adds, re-masks or drops each one. That
is the entire reactive engine, and render is not privileged in it — a component render is just the
one host whose re-run happens to be `forceRender`.

Two consequences for naming:

- **`ReadContext` is correctly named and stays** — it is the general read scope every reactive
  computation in the library is built on. `ReadScope` was considered and rejected: no gain, and
  `rc` is spelled out across five packages.
- **Anything whose name implies render is suspect.** `isFinalized` and the private `rendering` flag
  behind it are the live examples — see item 5 below.

## What a `WriteContext` is — and is not

The mirror of the section above, and the reason one tempting rename is rejected below.
`ControlContext.update` is the whole of it:

```ts
update(cb) { const wc = new WriteContextImpl(); cb(wc); wc.flush(); }
```

- **Writes apply immediately.** `setValueImpl` mutates `_value` on the spot; what is deferred is
  *notification*. `flush()` then drains `pending`, re-draining as listeners cause more, and finally
  runs the `afterChanges` callbacks (re-draining after those too).
- **No atomicity and no rollback.** Nothing is staged, so nothing can be undone. A throw inside
  `cb` leaves the writes it already made applied; `update` flushes in a `finally` and rethrows, so
  those writes are at least published rather than silently lost.
- **No nesting.** There is no ambient "currently open" write context: calling `ctx.update()` from
  inside a listener creates a *separate* `WriteContextImpl` that flushes to completion inline,
  part-way through the outer flush. It does not join the outer batch. Batching is therefore not
  compositional — see `docs/CONTROL-SEMANTICS.md` section I.
- **Listeners do join.** `runListeners(wc)` threads the wc down, so a listener writing through the
  wc it was handed lands in the same `pending` set and the outer drain loop picks it up. This is how
  the built-in `ControlSetup.validator` subscription republishes without forking a batch.

`packages/compat-controls` is the confirming case: `runInWc` maintains an ambient current-wc
*because core has no such thing*, and holds it open through its own flush to reproduce legacy's
single-storm semantics — which its comment notes the effects API depends on.

The naming consequence is in the `*Context` item below: **`WriteContext` → `Transaction` is
rejected**, not for churn but because it would be inaccurate.

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

## Rename before publishing — all accepted

Twelve names where the cost of leaving them is a misled reader or a latent bug, and the fix is a
mechanical rename (item 5 additionally flips a boolean's polarity). Ranked by payoff ÷ churn.

Two want a careful eye rather than a sed: **item 1** reassigns an existing method name to a
different meaning, so a stale call site keeps compiling while doing the wrong thing, and **item 5**
inverts a boolean. Item 9 is the highest-churn of the batch.

### 1. `WriteContext.setInitialValue` → `reset`

A trap, not a preference. `setInitialValue(c, v)` writes **both** the value and the baseline, while
`setInitialValueOnly` is the method that does what the first one's name says. Anyone reading a call
site guesses wrong. Make the pair:

- `reset(c, v)` — value + baseline, control left clean.
- `setInitialValue(c, v)` — baseline alone, control goes dirty if the two now differ.

and `setInitialValueOnly` disappears. Legacy's `control.setInitialValue()` already maps through
compat, which is where that meaning belongs.

### 2. `RenderControl` → `Reactive`

It takes no control and renders nothing of its own — it opens a tracking scope for its callback, and
every other render helper is built on it. `<Reactive>{(rc) => …}</Reactive>` says what it is, and
pairs with `useReactive()` (item 9) as the same primitive at component rather than subtree
granularity. (`TrackedScope` and `RenderScope` are the runners-up; `RenderControl` only makes sense
as an artefact of the legacy ambient-tracking model, where a component was the only way to narrow a
subscription scope.)

### 3. `as` → `asControl`

A top-level export named `as` is a keyword-shaped landmine: it shadows badly, reads as syntax at the
call site, and lands in every consumer's autocomplete on the first character. It's a three-line
unsafe cast — give it a name that admits that.

### 4. `ReadContext.getValueRx` → `getTrackedValue`

`Rx` is the npm scope leaking into a method name, and it tells the reader nothing about the deep
per-field proxy they're getting: each property access recurses into the child control, so reading
`p.name` tracks `name` alone rather than the whole parent. `Tracked` is the right word for that, and
it is already the implementation's own vocabulary — `TrackingReadContext`, `tracked`,
`reconcile(tracked)`.

Rename its partner too: `unwrapValueProxy` → `controlFromValue`, so the round trip reads as one pair
rather than two unrelated helpers.

### 5. `ReadContext.isFinalized` → `isTracking` (polarity flipped)

Of the five callers above, **only** `useControls` ever calls `finalize()`. For `computed`, `effect`,
`useValidator` and `jsonataEval` the window never closes and `isFinalized` is permanently `false` —
so the name invites the conclusion that those scopes are somehow perpetually mid-render, which is
exactly the wrong model of the whole engine.

What the flag means is *this scope is still accepting tracked reads*. Say that: `isTracking`. The
positive sense also reads better at the one consumer — `forms-core/src/overrideProxy.ts:110` becomes
`if (!rc.isTracking) warnEscapedRead(p)`, and the escaped-read guard's whole point is "this read
registered nothing", which the positive form names directly.

Churn is one consumer plus the dev guard in `useControls.tsx`; the private field behind the flag is
already called `tracking`. The polarity flip makes this the one item here that isn't purely
mechanical, so it wants a careful eye rather than a sed.

### 6. `Finput` / `Fselect` / `Fcheckbox` → `ControlInput` / `ControlSelect` / `ControlCheckbox`

The `F` prefix is inherited branding that a new reader cannot decode. Compat keeps the old spelling
for legacy apps, so the only cost of fixing it is in the new library's own docs.

### 7. `setFields` → `attachFields`

It links existing child controls into a parent — it does not set the values of fields, which is what
the name suggests next to `setValue`. The private helper it delegates to is already called
`attachFields`; promote that name.

### 8. `noopReadContext` → `untrackedRead`

"Noop" describes the implementation rather than the use. Once `ReadContext` is understood as the
library's tracking read scope, its non-tracking variant has an obvious name: `untrackedRead`. That
also makes the pairing with `getTrackedValue` (item 4) and `isTracking` (item 5) consistent —
"tracked" becomes the one word the public surface uses for the concept, instead of the three it uses
today ("Rx", "noop", "finalized").

### 9. `useControls` / `Controls` → `useReactive` / `ReactiveScope`

The most-called function in the library returns no controls. What it does is bind a tracking scope
to a component: it opens one per render, hands back the `rc`, the ambient `update`, and the boundary
that reconciles and closes the scope.

Note what the justification is *not*: it isn't "this is what makes things reactive" — `computed`,
`effect` and validators are equally reactive without it. It is the component-scoped host for the
same primitive, which is exactly what `<Reactive>` (item 2) is at subtree granularity. Naming the
pair `useReactive()` / `<Reactive>` makes that relationship visible, and `rc` still reads correctly
as the destructured field.

The type `Controls` is worse than the hook — it sounds like a collection of controls and is in fact
one component's tracking scope.

This was the most contested item in the review, so the arguments against are worth keeping. It is
the most-called function in the library, and `useControls` has a defensible reading — "use controls
in this component" is true even though what comes back is a scope — which is a real case for
leaving the highest-churn name alone. **Putting the library name in it (`useRxc`) was considered and
rejected:** Recoil (`useRecoilValue`) and SWR (`useSWR`) are precedents, but those are product
names, whereas `rxc` is an npm scope — and this repo exists *because* that scope changed, from
`@astroapps/*` and `@react-typed-forms/*`. Encoding the current one in the library's most-called
function bets there is no third time, on the single name where being wrong costs most. It would also
sit badly beside item 4, which rejects `Rx` in `getValueRx` as scope leakage. Attribution is a
non-problem regardless: it already sits on the line above, in the import.

What decided it was the pairing with `<Reactive>` (item 2) — the same primitive at component and
subtree granularity, named so that relationship is visible. One residual cost, accepted: unlike
`useControls`, `useReactive` is a name other libraries use (ahooks ships one), so a host using both
will alias an import.

### 10. `wrapWithControlsContext` → `withControlContext`

Same function, conventional HOC spelling, and it stops disagreeing with the singular
`ControlContext` it installs.

### 11. `UseControlSetup` → `UseControlOptions`

A type name with a hook name embedded in it is already awkward; `Setup` as a noun compounds it. If
`ControlSetup` also becomes `ControlOptions`, this is just `ControlOptions & { use?: … }`.

### 12. `ControlSetup.elems` → `.elements`, `.dontClearError` → `.keepErrors`

Inside one small options object: `fields` spelled out but `elems` abbreviated, and a negated boolean
whose double negative (`dontClearError: false`) nobody can read at a glance. Compat's `convertSetup`
already translates the legacy shape, so both are free.

## Judgement calls — now made

Higher churn, or no code change at all — these needed a decision rather than a sed, and each section
below now records the one that was taken. All are accepted except two: the `*Context` family
complaint resolves to a deliberate no-op, and `renderOptionally` → `whenAllDefined` rides with the
still-open `rename` batch.

### Three unrelated things are all called `*Context`

`ControlContext` is a factory and runtime, `ReadContext` is a reactive read scope, `WriteContext`
is a transaction. The shared suffix advertises a family that doesn't exist.

**Recommendation: leave all three alone** — a no-op item, recorded because the complaint is real
even though every available fix is worse than the status quo.

Note in particular what a `ControlContext` is *not*: it is not a tree. It holds no controls at all —
its entire state is the `equals` policy, the `uniqueId` counter, and the dead-tracker set plus its
sweep timer. Nor is there one per tree: every dev-app page creates exactly one at module scope, and
each `useControl` / `newControl` call mints an independent root from it. One context, many unrelated
trees, so anything along the lines of `ControlTree` would misstate the cardinality. (The repo's own
wording invites that mistake — see the doc-comments item below.)

What it is, is a runtime: it allocates controls and ids, runs transactions, holds the equality
policy, and garbage-collects subscription trackers. `ControlRuntime` (with `ControlRuntimeProvider`
/ `useControlRuntime`) would be accurate if breaking the family resemblance is worth the churn —
but `ControlContext` is the one member of the trio whose name is already honest: it is ambient
configuration threaded through React context, which is what "context" means to a React developer.
The confusion is caused by the other two borrowing the suffix, and both of those are staying.

`ReadContext` stays because the `rc` convention is load-bearing across every downstream package and
`docs/RENDER-BOUNDARY.md`.

`WriteContext` stays too, and `Transaction` is the trap worth naming explicitly. It reads beautifully
at the call site — `update(tx => tx.setValue(…))` — and it would be a lie: there is no atomicity, no
rollback and no nesting (see the section above). A reader who trusts the name would reasonably expect
an inner `update` to join the outer batch, or a throw to leave the tree untouched; neither holds. If
the suffix ever does get broken, `WriteBatch` is the accurate name, because batched notification is
exactly and only what the type provides.

### The doc comments — done

Not a naming item, and independent of every rename above, so it has already landed on this branch.
Several comments described general machinery in the vocabulary of one caller, which is how a reader
arrives at either of the two wrong models this document argues against — that `ReadContext` is a
render-time thing, and that a `ControlContext` is a tree:

| Where | Said | Problem |
|---|---|---|
| `TrackingReadContext.rendering` | "the rc is in its 'rendering' window"; "flips it back to true for the next render" | Named for one of five callers. For the other four there is no render and no next one. |
| `TrackingReadContext.finalize()` | "Close the render window. Called by the React adapter's `rendered(…)`" | True, but reads as though every scope has a render window. |
| `ReadContext.isFinalized` (`types.ts`) | "past its render window (the wrapping component's `rendered(…)` has reconciled)" | The *public* interface, describing a flag four of five callers never set. |
| `ControlContext` (`types.ts`) | "tree-level configuration and factory"; `equals` "used for value comparison across this tree" | Means *applies to every control created here*; reads as *there is one tree here*. |
| `types.ts` trailing design notes | "A 'tracking' ReadContext implementation **would** record …  is TBD" | Both implementations shipped; the note read as though neither existed. |
| CLAUDE.md, settled semantics | "Tree-level equality via ControlContext" | Same as the `ControlContext` entry. |

Each now states the general contract first and names React as one caller. The private
`rendering` field is renamed `tracking` in the same change — internal to `TrackingReadContext`, no
API impact, and the public `isFinalized` is deliberately left alone since changing it is item 5's
decision to make.

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

### `markTrackerDead` / `reviveTracker` are named after the implementation

These exist for React StrictMode's discard-and-remount cycle, and they're named after the lazy
sweep that consumes them rather than what a caller is doing. **Rename to `releaseTracker` /
`retainTracker`** so they read as refcounting rather than necromancy.

**Moving them to `/internal` was considered and rejected.** Today's four callers are all
in-workspace (`useControls` ×2 and `useValidator` in `@rxc/controls`, `useComponentTracking` in
compat), which makes it tempting, and the public signature looks like a tell:

```ts
markTrackerDead(tracker: { alive: boolean; cleanup(): void }): void;
```

— structural precisely so the public interface needn't name `SubscriptionReconciler`, which lives in
`/internal`. But `ComputedRef` and `EffectRef` are public and satisfy that shape exactly, so the
methods are publicly *reachable and useful*: a consumer hand-rolling a StrictMode-safe hook over
`computed()` / `effect()` retains the handle on mount and releases it on unmount so React's
double-invoke doesn't tear down a live computation, which is exactly what `useValidator` does
internally. That's a supported use, not a leak.

Two things worth knowing before proposing `/internal` for anything else. First, it is a **published
subpath export**, not a visibility boundary:

```json
"./internal": { "types": "./lib/internal.d.ts", "default": "./lib/internal.js" }
```

It ships in the same tarball and any consumer can import from it; the privacy is the comment atop
`src/internal.ts` plus absence from the main entry point's autocomplete. Real documentation value,
no enforcement. Second, **an interface member cannot be moved to a subpath at all** — it has to be
deleted from the interface and re-exposed through the internal implementation handles that already
live there (`ControlContextInternal` for these, `toImpl(c)` for anything on `Control`). That is an
API break for the in-workspace callers rather than a re-export, which is why both candidates here
end up staying public under better names.

### `Control.fieldsNow` means something different from every other `*Now`

The `Now` suffix means "untracked" everywhere else — `elementsNow` still materializes children.
`fieldsNow` additionally means "only the ones already materialized", which is why every lookup is
`| undefined`. **Rename to `existingFields`:** the confusion is in the stem, not the suffix, and
"existing" is the word that justifies the `| undefined`. `fieldsSnapshot` was considered and
rejected — "snapshot" is what `Now` already conveys, so it distinguishes nothing from `elementsNow`
and still doesn't warn that a field may be absent. `materializedFields` is accurate (it is the
doc-comment's own word) but long, and note the length argument is weaker than it looks:
`existingFieldsNow` is exactly as many characters. Dropping `Now` is right here — there is no
tracked counterpart to disambiguate from, which is the suffix's only job.

Moving it off the public interface was weighed and dropped: every caller today is in-workspace, but
compat surfaces it through `getFields`, which is legacy-visible API, and a member cannot be moved to
a subpath anyway (see the tracker item below). It stays on `Control` under the new name.

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

## Full inventory

### Core — the control tree

| Export | Kind | What it does | Verdict | Suggested |
|---|---|---|---|---|
| `Control<V>` | interface | A node in the value tree: untracked `*Now` snapshots, lazy `fields`/`elementsNow` navigation, `subscribe`, and a `meta` bag. | keep | — |
| `ControlValue<C>` | type | Extracts `V` out of a `Control<V>`. | keep | — |
| `ControlFields<V>` | type | Object-valued `V` mapped to a record of child controls, with nullability pushed onto each field. | keep | — |
| `ControlElements<V>` | type | Array-valued `V` mapped to `Control<A>[]`. | keep | — |
| `ControlSetup<V>` | interface | Creation-time options: `validator`, per-`fields` and per-`elems` setup, `afterCreate`, `meta`, `dontClearError`. | accept | `ControlOptions` (+ `elements`, `keepErrors`) |
| `ControlValidator<V>` | type | A sync value → message function, or `null` for none. | keep | — |
| `ControlChange` | enum | Subscription bitmask: `Value`, `InitialValue`, `Valid`, `Dirty`, `Touched`, `Disabled`, `Error`, `Structure`, `Validate`, `All`. | accept | keep the enum; `All` → `AllState` |
| `ChangeListenerFunc<V>` | type | Subscription callback: `(control, change, wc)`. | accept | `ChangeListener` |
| `Subscription` | type | The handle `subscribe` returns and `unsubscribe` takes. | keep | — |
| `ControlContext` | interface | Factory and runtime: `newControl`, `update`, `uniqueId` allocation, tracker lifecycle, and the `equals` policy for every control it creates. Holds no controls. | keep | — (`ControlRuntime` if breaking the `*Context` family) |
| `createControlContext` | function | Builds one, optionally with a custom `equals`. | keep | — (follows the above) |
| `ControlContextOptions` | interface | `{ equals? }`. | keep | — |
| `ReadContext` | interface | The library's reactive read scope, threaded everywhere as `rc`; reading through it registers a `(control, facet)` dependency. Opened by render passes, `computed`, `effect`, validators and async expression evaluation alike. | keep | — |
| `WriteContext` | interface | The write scope handed to `update`. Writes apply immediately; notification is batched until `flush()`. No atomicity, rollback or nesting. | keep | — (`WriteBatch` if breaking the `*Context` family; **not** `Transaction`) |
| `noopReadContext` | const | A `ReadContext` that returns current values and subscribes to nothing. | accept | `untrackedRead` |
| `unwrapValueProxy` | function | Recovers the `Control` behind a value returned by `getValueRx`. | accept | `controlFromValue` |
| `deepEquals` | function | Structural equality over plain objects/arrays, NaN-aware; the default tree `equals`. | keep | — |
| `computed` | function | Opens a tracking scope, runs a computation, writes the result into a *target* control, and re-runs when a tracked facet changes. | accept | `computeInto` (or return the control) |
| `effect` | function | The same scope-plus-reconciler machinery with no target — for side effects, with an optional cleanup return. | keep | — |
| `ComputedRef` | interface | `computed`'s handle: `replaceCompute`, `cleanup`, `alive`. | accept | `ComputedHandle` |
| `EffectRef` | interface | `effect`'s handle: `replaceEffect`, `cleanup`, `alive`. | accept | `EffectHandle` |
| `controlGroup` | function | Builds a parent control from existing child controls — attached, not copied, so values flow both ways. | accept | `createControlGroup` |
| `setFields` | function | Attaches or replaces fields on a control that may already have subscribers, inside a write batch. | accept | `attachFields` |
| `lookupControl` | function | Walks a `(string \| number)[]` path down to a descendant control. | keep | — |
| `getControlPath` | function | The inverse: a control's path up to an optional ancestor. | keep | — |
| `getElementIndex` | function | An element's `{ index, initialIndex }` within a parent array. | accept | `getElementPosition` |
| `ensureMetaValue` | function | Get-or-create a keyed slot in a control's `meta`, with a control factory handed to the initializer. | keep | — |
| `as` | function | Unchecked cast of `Control<unknown>` to `Control<V>`. | accept | `asControl` |

### `ReadContext` members

| Member | What it does | Verdict | Suggested |
|---|---|---|---|
| `getValue`, `getInitialValue` | Tracked reads of the two values. | keep | — |
| `isValid`, `isDirty`, `isTouched`, `isDisabled`, `isNull` | Tracked reads of one state facet each. | keep | — |
| `getError`, `getErrors` | First message, or the whole keyed map. | keep | — |
| `getElements` | Element controls of an array, tracking `Structure`. | keep | — |
| `trackValidate` | Reads nothing — adds `Validate` to the tracked mask so the computation re-runs on a `validate()` broadcast. | keep | — (see note) |
| `getValueRx` | A deep proxy over the value: each property access recurses into the child control, so reading `p.name` tracks `name` alone. | accept | `getTrackedValue` |
| `isFinalized` | True once the scope has stopped accepting tracked reads. Only `useControls` ever closes a scope, so this is permanently `false` for `computed`, `effect`, validators and `jsonataEval`. | accept | `isTracking`, polarity flipped |

`trackValidate` is worth a note, since it looks like the odd one out — the only member that returns
nothing. It isn't: *tracking* is the primary thing every member of this interface does, and the
others merely also return a value. The name is accurate as it stands.

### `WriteContext` members

| Member | What it does | Verdict | Suggested |
|---|---|---|---|
| `setValue`, `updateValue` | Write, or write from the current value. | keep | — |
| `setValueAndInitial` | Write value and baseline independently in one call. | keep | — |
| `setInitialValue` | Writes **both** value and baseline — a reset, leaving the control clean. | accept | `reset` |
| `setInitialValueOnly` | Moves the baseline alone, so the control becomes dirty if the two now differ. | accept | `setInitialValue` |
| `markAsClean` | Adopts the current value as the baseline. | accept | `markClean` |
| `setTouched`, `setDisabled` | Set a flag, cascading to children unless `notChildren`. | keep | — |
| `setError`, `setErrors`, `clearErrors` | Publish one keyed message, replace the map, or clear it. | keep | — |
| `validate` | Broadcasts a validate request through the subtree and reports validity. | keep | — |
| `addElement`, `removeElement`, `updateElements` | Array mutation by value, by index-or-control, or by rebuilding the element list. | keep | — |
| `setElementIncluded` | Set-valued membership toggle: when the members match the baseline in any order, the baseline itself is written back, so toggling off and on again leaves the control clean. | keep | — |
| `afterChanges` | Queues a callback to run after the transaction flushes. | accept | `afterFlush` |

### `ControlContext` members

| Member | What it does | Verdict | Suggested |
|---|---|---|---|
| `newControl` | Creates a control in this tree. | keep | — |
| `update` | Runs a write batch; subscribers fire once at the end. | keep | — |
| `equals` | The tree's value equality. | keep | — |
| `markTrackerDead`, `reviveTracker` | StrictMode-safe tracker lifecycle: release a tracker to the lazy sweep, or retain it. Public by design — `ComputedRef`/`EffectRef` satisfy the parameter, so hand-rolled hooks over `computed`/`effect` use them. | accept | `releaseTracker` / `retainTracker` |

### React — the render boundary

| Export | Kind | What it does | Verdict | Suggested |
|---|---|---|---|---|
| `useControls` | hook | Opens a tracking scope per render and hands the component its `rc`, the ambient `update`, and the `rendered` boundary that reconciles and closes it. | accept | `useReactive` |
| `Controls` | interface | That hook's return type — one component's tracking scope, not a collection of controls. | accept | `ReactiveScope` |
| `Rendered` | branded type | Return type only `rendered(…)` can produce, so forgetting the boundary is a compile error rather than silent dead reactivity. | keep | — |
| `ControlContextProvider`, `useControlContext` | component, hook | Put a `ControlContext` in React context; read it back. | keep | — (follows `ControlContext`) |
| `wrapWithControlsContext` | HOC | Wraps a component so it always renders under a given context — for call sites you don't own. | accept | `withControlContext` |
| `useControl` | hook | A control owned by this component, created once; `useState`-shaped, with a `use` escape hatch so an optional `control` prop needn't be a conditional hook. | keep | — |
| `UseControlSetup<V>` | type | `ControlSetup` plus that `use` field. | accept | `UseControlOptions` |
| `useComputed` | hook | A control whose value is derived from other controls, recomputed through its own tracking scope. | keep | — |
| `useControlEffect` | hook | Runs a side effect when a computed value changes, with configurable mount-time behaviour. Never re-renders the component. | keep | — |
| `useValidator` | hook | Attaches a keyed validator for the component's lifetime; re-publishes on `validate()`, clears its key on unmount. | keep | — |
| `useAsyncValidator` | hook | Debounced, abortable async validation; stale results dropped, in-flight runs aborted on supersede. | keep | — |
| `useControlGroup` | hook | One group control over several independently owned controls, re-attaching when a member's identity changes. | keep | — |
| `usePreviousValue` | hook | A control holding `{ previous, current }` — so it exposes both, not just the previous one. | accept | `useValueWithPrevious` |
| `useSelectableArray` | hook | Exposes an array control as `{ selected, value }` groups, sharing the value controls with the original array and rewriting it as flags toggle. | keep | — |
| `ensureSelectableValues` | function | Builds the entry list for the above from a fixed option set — the multi-select checklist shape. | accept | `selectableValues` |
| `SelectionGroup<V>` | interface | `{ selected, value }`. | keep | — |
| `SelectionGroupSync<V>` | type | The entry-list builder signature. | accept | `SelectionBuilder` |

### React — binding to native inputs

| Export | Kind | What it does | Verdict | Suggested |
|---|---|---|---|---|
| `useFormControlProps` | hook | Turns a control into props for an `<input>`/`<select>`/`<textarea>`: value, change, blur-touches, disabled, error text, and a ref that parks the element on `meta.element`. | keep | — |
| `FormControlProps` | interface | That props bag. `errorText` is not a DOM prop and every caller destructures it out before spreading. | accept | keep the name; split `{ props, errorText }` |
| `FormEditProvider`, `useFormEdit` | component, hook | A presentation lock cascading over a subtree — readonly, or disabled while saving — folded in restriction-only, so it can add a lock but never re-enable a disabled control. | keep | — |
| `FormEditState` | interface | `{ readonly?, disabled? }`. | accept | `readonly` → `readOnly` |
| `Finput`, `Fselect`, `Fcheckbox` | components | Self-subscribing bound inputs: each opens its own render boundary, so typing re-renders only itself, and publishes the control's error as HTML5 custom validity. | accept | `ControlInput`, `ControlSelect`, `ControlCheckbox` |
| `FinputProps`, `FselectProps`, `FcheckboxProps` | types | Native element attributes plus `control` (and `notValue` for the checkbox's inverted mapping). | accept | follow the components |

### React — nested subscription scopes

| Export | Kind | What it does | Verdict | Suggested |
|---|---|---|---|---|
| `RenderControl` | component | Opens a tracking scope for its callback, so reads inside re-render only that subtree. Takes no control. | accept | `Reactive` |
| `RenderElements` | component | One nested scope per array element, subscribing only to the array's structure; keyed by `uniqueId`, which is per-context so SSR and hydration agree. | keep | — |
| `RenderOptional` | component | Renders once a control holds a value, handing the callback the narrowed control; subscribes to null-ness alone. | keep | — |
| `renderOptionally` | function | Returns a render callback that fires only when *every* control in a record is non-null, passing their values as a record. | accept | `whenAllDefined` |
| `RenderArrayElements` | component | The plain-array counterpart — nothing reactive, so no `rc` and no scope; kept for symmetry. | keep | — |
| `NotDefinedContext` | React context | Subtree-wide fallback for a control with no value, so `notDefined` needn't be passed to every helper. Exported as a raw context object. | accept | add `NotDefinedProvider`, matching FormEdit |
| `RenderCallback` | type | `(rc) => ReactNode` — the shape every helper callback takes. | keep | — |
| `RenderControlProps`, `RenderElementsProps`, `RenderOptionalProps`, `RenderArrayElementsProps` | types | Props for the four helpers. | keep | — (follow their components) |
| `ValuesOfControls<A>` | type | A record of controls mapped to their non-null values, as passed to `renderOptionally`. | accept | `ControlValues` |

## What to leave alone, deliberately

- **`rendered` / `Rendered`.** Distinctive, teachable, and the branded type is the enforcement
  mechanism — a renamed brand is a worse brand.
- **The `*Now` suffix.** It reads oddly at first and then never again, and it makes "untracked read"
  impossible to do by accident. Fix `fieldsNow` (→ `existingFields`) and the `isNullNow` outlier
  rather than the convention.
- **`ReadContext` and the `rc` parameter.** Threading a read scope explicitly *is* the design, and
  the name states it without claiming a host: render passes, `computed`, `effect`, validators and
  async evaluators all open one. `ReadScope` was weighed and dropped — no gain, and `rc` is spelled
  out across five packages plus `docs/RENDER-BOUNDARY.md`.
- **`useControlEffect`.** `useControlWatch` was proposed on the grounds that a source-plus-callback
  pair with an `initial` option is a watch rather than an effect. Rejected: `effect` in
  `controls-core` is already "a reactive effect that tracks dependencies via ReadContext and re-runs
  when any dependency changes — for side effects", and this hook is that same primitive with React
  owning the lifecycle. Renaming it would give the library two words for one concept. The two
  refinements over bare `effect` — the tracked `compute` is separate from the untracked `onChange`,
  and `onChange` fires only when the value actually differs per the tree's `equals` — narrow when
  the effect runs; they don't make it something other than an effect. "Effect" also already means
  "run a side effect in response to a change" to a React reader.
- **`setElementIncluded`.** Wordy, but it names the set semantics that make an unchecked-then-
  rechecked checklist come back clean — which is exactly the thing a caller needs to know.
- **The `/internal` subpath.** Right call, right name for what it holds — but note it is a published
  export with no enforcement, and it cannot hold an interface member. Neither of the two members
  proposed for it ends up moving.

---

Compiled from `packages/controls/src/index.ts`, `packages/controls-core/src/index.ts`, and the
declared interfaces in `packages/controls-core/src/types.ts`. Compat coupling checked against every
`@rxc/controls` import in `packages/compat-controls/src`.
