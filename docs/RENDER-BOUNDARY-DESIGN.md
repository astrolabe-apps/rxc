# Render Boundary Design

Redesign of the `@rxc/controls` React adapter: replace the `controls()` HOC with a plain hook
(`useControls()`) plus an explicit end-of-render call (`rendered(…)`), enforced by a branded
return type.

**Status:** design agreed, not yet implemented. The `Rendered` enforcement type is
**spike-verified** against TypeScript 5.8.3 + `@types/react` 19.1.17 — see
[Enforcing the boundary](#enforcing-the-boundary).

**Motivation:** `@rxc/*` is a published library whose primary extension point is *writing custom
renderers*. Today those renderers are callbacks passed to an HOC, which makes every hook inside
them a `react-hooks/rules-of-hooks` error in the consumer's own CI. See
[Why the current shape has to change](#why-the-current-shape-has-to-change).

---

## The constraint everything else follows from

`controls()` (`packages/controls/src/controls.tsx:50`) does five things. Only one of them requires
a wrapper:

| Job | Needs a render boundary? |
|---|---|
| Allocate a per-instance `TrackingReadContext` + `SubscriptionReconciler` | No — `useRef` |
| `rc.reset()` before the body | No — runs in render |
| Trigger re-render on notify | No — `useState` |
| Revive / mark-dead lifecycle | No — `useEffect` |
| **`reconciler.reconcile(rc.tracked)` + `rc.finalize()` *after* the body's reads** | **Yes** |

The tracked-reads model requires a moment that is *after every read this render made* and *before
React can process a change*. React provides no "end of render body" hook, which is why
mobx-react-lite still ships `observer()` a decade in. Any design either takes the body as a
callback (today) or asks the body to signal completion (this design).

Moving that step out of the render phase is not viable — see
[Rejected: bare hook + effect-time reconcile](#rejected-bare-hook--effect-time-reconcile).

---

## Why the current shape has to change

`rules-of-hooks` hardcodes `memo` and `forwardRef` as recognised wrappers and knows nothing about
custom HOCs, so hooks inside a `controls()` callback report *"React Hook cannot be called inside a
callback."* This lands on consumers, not us:

- `docs/MIGRATION-FROM-LEGACY.md:3` — the doc exists to port "a host (**or a custom renderer set**)".
- `:427` — "**Reactivity boundary is per-renderer.** Each renderer is a `controls()` component…"
- `:439` — hosts that wrapped legacy DOM primitives "**now need to provide a custom renderer for
  each affected control type**." A whole class of migrating host *must* write renderers.
- `eslint-config-next` ships `rules-of-hooks` as an **error**, and every app in this repo (and
  realistically every consumer) is Next.js.

So the documented migration path hands consumers red CI on their own source, with `eslint-disable`
as the only out.

One nuance: the rule falls back to naming heuristics, so a **named** PascalCase function expression
is analysed even as a call argument. `controls(function Home(…) {…})`
(`apps/dev/src/app/page.tsx:179`) is lintable; `controls("TextfieldRenderer", (…) => …)`
(`packages/forms/src/renderers/data/Textfield.tsx:8`) is not. The string-name overload is precisely
the form that defeats analysis.

CLAUDE.md licenses the change: *"Open for redesign: **Public API naming and surface**"* and *"No
deprecations — `@rxc/*` is pre-release… Just change the name / shape and update every call site."*

---

## The design

```tsx
function StarsRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useControls();
  const c = useTextInputController(rc, node);
  const theme = useHtmlTheme();
  if (!c.data) return rendered(null);
  return rendered(<input className={theme.inputClass} value={c.value} … />);
}
```

Ordinary function component. Hooks at top level. Lint analyses it normally.

```ts
// @rxc/controls
declare const callRendered: unique symbol;
export type Rendered = ReactElement & { readonly [callRendered]: never };

export interface Controls {
  rc: ReadContext;
  rendered: <T extends ReactNode>(node: T) => Rendered;
}

export function useControls(): Controls;
```

`ReactElement`, not `ReactNode`, and the brand symbol is named for the fix — both for error-message
quality, verified below. `rendered()` still accepts any `ReactNode` (string, number, fragment,
array, `null`); the "claims to be an element" fiction is type-level only and never observable.

`rendered(node)` calls `reconciler.reconcile(rc.tracked)`, then `rc.finalize()`, then returns its
argument unchanged. JSX children are evaluated as arguments *before* the call, so by the time it
runs, every read in the returned expression is already in `tracked`. **Reconcile stays synchronous
with the body** — same guarantee `controls()` gives, obtained from argument-evaluation order
instead of from a wrapper.

### Design decisions

**`{ rc, rendered }`, not `rc.rendered(…)`.** `rendered` is a React-render-lifecycle concern;
`ReadContext` is a core reactive primitive. Putting it on the interface forces `noopReadContext`
(`packages/controls-core/src/readContextImpl.ts:66`) to carry a meaningless identity function, and
the `TrackingReadContext`s that `computed`/`effect` create inside `controls-core` would expose a
method that makes no sense there — they call `reconcile()` themselves (`computed.ts:30`, `:76`).
The two also have different usage patterns: `rc` is threaded into every controller
(`useTextInputController(rc, node)`); `rendered` is used once, at the return, and never passed
anywhere.

**Hook named `useControls()`.** It returns more than a read context, the HOC is vacating the name,
it is the vocabulary the docs already use, and it makes `MIGRATION-FROM-LEGACY.md:427` close to a
one-word edit.

**Function named `rendered`.** Because it arrives via destructuring, consumers own brevity
(`const { rc, rendered: r } = useControls()`), so the library name optimises for clarity. Ruled out:

| Name | Problem |
|---|---|
| `render` | implies it *performs* the render |
| `commit` | React's commit phase — this runs during render |
| `flush` | `WriteContextImpl.flush()` |
| `track` / `tracked` | `TrackingReadContext.track()` (`readContextImpl.ts:130`) and the `tracked` Map |
| `node` | `FormStateNode`, plus the `node` prop on every renderer |
| `out` | already a common local (`evalExpression.ts:180`, `defaultValues.ts:24`) — consumers would shadow it |
| `done` / `end` / `seal` | short, but say nothing about *what* finished |

`output` and `finish` are viable; `rendered` wins on being teachable in one sentence ("wrap every
return in `rendered(…)` so your reads get subscribed"), reporting rather than commanding, and
having zero collisions in the tree. **The type name follows the function**, not the reverse — the
function appears at every consumer return, the type in a handful of slot signatures.

### What gets deleted

`controls()` and both overloads, `ControlsRender`, `ControlsContext`, `UpdateFn`, `UseComputed` —
`packages/controls/src/types.ts` essentially evaporates. Public surface becomes `useControls`,
`Rendered`, `useControlContext`, `useComputed`, `ControlContextProvider`.

Also folded in (independent cleanups the old ctx object was carrying):

- `update` came off `controlContext` behind a **fresh arrow allocated every render**
  (`controls.tsx:87`) — an unstable identity in dep arrays for no benefit. Consumers use
  `useControlContext().update`.
- `useComputed` was defined inside the per-render closure (`controls.tsx:90`), which hid the fact
  that it is order-dependent. It becomes a standalone exported hook. It is used **once** in the
  entire repo (`apps/dev/src/app/page.tsx:55`).
- The `controls(name, fn)` overload disappears — `displayName` derives from the function's own name.
- `React.FC<P>` (`controls.tsx:52`) no longer flattens generics or blocks `forwardRef`.
  `memo(controls(…))` at `Field.tsx:37` becomes `memo(function Field(…))`.

Measured call-site tally (`{ rc … }` destructures): 48 × `{ rc }`, 9 × `{ rc, update }`, 2 ×
`{ rc, reconciler }`, 2 one-offs using `controlContext` / `useComputed` — ~62 sites, all mechanical.

---

## Enforcing the boundary

The one genuine flaw: the boundary is per-return-path, and missing it fails **silently**.

```tsx
const c = useTextInputController(rc, node);   // already read node.getState(rc)
if (!c.data) return null;                      // ← no rendered() call
```

Those state reads are tracked but never subscribed, so nothing notifies the field when `data`
appears — it stays null forever. No crash, no warning. Live at **14 sites in
`packages/forms/src/renderers/data/`** alone (`Textfield.tsx:12`, `Array.tsx:32`, `Select.tsx:17`,
`Radio.tsx:28`, …) plus three return sites in `Field.tsx` (`:100`, `:110`, `:149`).

**Primary defence — make it a compile error.** The library owns the signatures consumers implement:

```ts
export type DataRenderer = (props: DataRendererProps) => Rendered;
```

Now `return null` and `return <div/>` both fail to compile; every path must go through
`rendered(…)`.

### Spike results (TS 5.8.3 / `@types/react` 19.1.17)

Verified green in every consumer position: explicit-annotation authoring form, contextual typing via
the slot type, `memo(…)`, JSX element position (`<StarsRenderer id="a" />`), children position,
direct call, assignability back to `ReactNode`, and `rendered()` applied to string / number /
fragment / array / `null` payloads. Raw JSX, bare `null`, and bare `string` returns are all
rejected.

Four findings that shaped the final shape:

1. **Use `ReactElement & brand`, not `ReactNode & brand`.** Both enforce correctly, but intersecting
   the 9-member `ReactNode` union distributes, and TS reports against an arbitrary member — the
   actual message for a forgotten `rendered()` was *"Type 'ReactElement<any, any>' is not assignable
   to type 'ReactPortal & …'. Property 'children' is missing"*, which mentions nothing relevant.
   `ReactElement &` gives one target and names the brand.
2. **Name the brand symbol for the fix.** TS prints the symbol's declared identifier, so
   `callRendered` makes the error self-documenting:
   ```
   error TS2322: Type 'Element' is not assignable to type 'Rendered'.
     Property '[callRendered]' is missing in type 'ReactElement<any, any>'
       but required in type '{ readonly [callRendered]: never; }'
   ```
   A `unique symbol` also can't be forged by a consumer, unlike a string-literal key.
3. **Annotate the return type explicitly** — `function StarsRenderer(…): Rendered`. This puts the
   error on the offending `return` line. Relying on contextual typing from the slot type
   (`const X: DataRenderer = …`) blames the *whole function assignment* instead, which is far worse
   for a renderer with several returns. This should be the documented authoring form.
4. **The brand must be required, confirmed empirically.** With `{ [brand]?: never }` a raw
   `return <div/>` compiles (optional properties don't require presence, and excess-property checks
   only fire on fresh object literals). Curiously `return null` is still rejected even when optional,
   because `null & {…}` reduces to `never` either way — so an optional brand fails exactly the
   common case.

Residual cost: one internal cast inside `rendered()`, these slots cannot be typed as `React.FC`, and
a determined consumer can cast around it. The `null` error message keeps an unhelpful second line
(*"Type 'null' is not assignable to type 'ReactElement<…>'"*) — the first line is correct and the
line number is exact, so this is cosmetic.

**Backstop — dev-mode guard.** Covers plain app components that call `useControls()` without
annotating a return type, where TS has nothing to check. Clear a flag in `reset()`, set it in
`rendered()`, check it in the hook's own effect — which still runs, because `useControls()` was
called before any early return:

```ts
useEffect(() => {
  if (!rc.didReconcile && process.env.NODE_ENV !== "production")
    console.error(`[@rxc/controls] ${name} returned without calling rendered(…) — reactive reads dropped`);
});
```

Fires on the offending component's first render, so it cannot reach production.

---

## Behaviour under throw / suspend

Degrades safely, and **identically to today's `controls()`** — reconcile is at end-of-body in both,
so a throw skips it either way. After an unwind: `tracked` holds partial reads, `reconciler.subs`
still holds the *previous* render's set, `rc.rendering` is still true.

- **Stale, never missing.** `reconcile()` is the only mutator of `subs` and it did not run, so the
  previous set persists — the over-subscription direction (at worst a spurious re-render).
- **No leak.** Nothing new was subscribed. Unmount by an error boundary runs the effect teardown →
  `markTrackerDead` → sweep. A retry calls `reset()` and proceeds clean.
- **Suspense** is the case that will actually happen, and it is the same story: the retry re-reads
  everything from scratch before calling `rendered(…)`, so the final state is correct.
- **Nothing needs `try`/`finally`** — the hook shape has no ambient state to restore. (A
  module-global "current rc" variant would have needed it; see rejected alternatives.)
- **The dev guard is silent on a throw.** A component that throws never commits its effects, so it
  cannot cry wolf on a caught error.
- **`try`/`catch` fallbacks inside a renderer** are safe by construction — the branded return type
  forces the catch path through `rendered(…)` too.

Known wart, accepted: `rc.rendering` stays `true` until the next `reset()`, so `isFinalized`
reports wrong in that window and the escaped-read warning at
`packages/forms-core/src/overrideProxy.ts:60` will not fire. Spans throw → next render only;
nothing legitimate reads there.

---

## Rejected alternatives

### Rejected: `useControls(render)` — hook that takes the body

Mechanically identical to the HOC, and **no lint gain**: hooks inside a callback are exactly what
`rules-of-hooks` flags. Residual benefits (generics, `forwardRef`) do not justify touching ~62 call
sites.

### Rejected: bare hook + effect-time reconcile

Structurally possible — the effect closure reads `rc.tracked` later, when the map is already
populated, so no end-of-body marker is needed. Prize would have been deleting the dead-tracker
machinery (`controlContextImpl.ts:20-77`), since you would only ever subscribe for committed
renders. Killed by:

- **The gap is render → *passive-effect flush***, not render → commit. React can defer passive
  effects into a scheduler callback, so the component sits on screen with **zero subscriptions** for
  potentially a frame or more. Every write in that window is silently lost.
- Closing it needs a per-read **snapshot** (values, plus element-array identity for `Structure` and
  the errors record for `Error`) compared at reconcile time, replacing a single bitmask OR
  (`readContextImpl.ts:130-140`) in the hot path of a 500-field form. The existing
  `subscribe(listener, current, mask)` baseline cannot help: `getChangeState`
  (`controlImpl.ts:439`) only reports Dirty/Valid/Disabled/Touched, while Value/Structure/Error are
  edge-triggered via `applyChange`.
- The gap is **reachable**, not theoretical: `useFormStateNode` builds the tree via `effect`s during
  render, so a later child's render can write a control an earlier child already read. The deferred
  `runAsync` queue exists because of this same ordering hazard.
- Guarantees an extra render pass on mount for any form with render-phase writes.
- `<Activity>` unmounts effects while preserving state, so effect-hosted subscriptions get torn down
  and re-established on show/hide.

StrictMode, notably, is *not* where this breaks — double-invoked bodies and double-invoked effects
both converge.

### Rejected: subscribe on access

Would remove the gap (subscription exists the instant you read), but:

- **Mask widening is unsafe in place.** `node.getState(rc)` reads value + error + disabled + touched
  off one control, so the mask grows mid-render. `changeState` is per-`SubscriptionList` and shared
  across every sub in it (`subscriptions.ts:48-78`), and the list is chosen by
  `canBeAdded(current, mask)` at subscribe time — OR-ing new bits into a sub's mask leaves them with
  no correct baseline, breaking the `nextCurrent ^ changeState` diff. Safe widening means
  unsubscribe + resubscribe 3–4× per control per render instead of once, batched. Subscribing to the
  full mask instead throws away the fine-grained masking the memo benchmark depends on.
- **Dedupe forces a boundary back in.** With no end-of-body marker you cannot distinguish
  StrictMode's second invocation from a second read, so you still need `tracked` as a dedupe key,
  cleared at body *start* — and if clearing also drops subscriptions, an abandoned render leaves the
  committed UI under-subscribed with nothing scheduled to fix it. The current invariant is that
  `reset()` touches only the tracked map, never live subscriptions, which swap atomically in
  `reconcile()`.
- Does not even buy the sweep deletion: a component that renders once and never commits has already
  subscribed with no effect to prune it.

### Rejected: `controls(Inner)` + module-level "current rc"

Keeps an HOC that invokes a *plain* single-arg component directly (as `controls.tsx:110` already
does), with `useReadContext()` reading a module slot. Gets lint coverage, but:

- Conflicts with CLAUDE.md core principle 1 (*"No globals — all state is explicit"*). `rc` becomes
  ambient where today it is a visible parameter.
- Needs `try`/`finally` around the inner call or a throw poisons the next component's reads.
- Calling `useReadContext()` outside a wrapper degrades from a *type* error to a runtime throw.

### Rejected: callable `rc` — `return rc(<div/>)`

Elegant (the return statement is the boundary, no global, no HOC), but `[[Call]]` cannot be added to
an existing object, leaving two implementations: a `Proxy` with an `apply` trap — which puts a trap
on the single hottest object in the system, paid on every `rc.getValue()` — or a closure
re-prototyped via `Object.setPrototypeOf(self, TrackingReadContext.prototype)`. The latter performs
fine, but a bare callable has **no autocomplete discoverability**, and the split object
(`{ rc, rendered }`) achieves the same boundary with none of the trickery.

---

## React Compiler

The change makes renderers recognisable as components, so the compiler will compile them — and it
cannot see that the real reactive inputs are `rc.getValue()` reads. Reconciler `setState` → wrapper
re-renders → same props → cached JSX → **stale UI**.

This is the flip side of lint coverage: both hinge on "is this recognisable as a component," so you
cannot have one without the other. Lint is on by default in every consumer project; the compiler is
opt-in per project with an escape hatch, so take the lint and document the caveat.

Lever if needed: have `useControls()` return a **fresh `rc` identity per render**. Because `rc` is
an input to essentially every read (`node.getState(rc)`, the controllers), that invalidates the
memo blocks that matter. Costs an allocation per render and forfeits legitimate memoisation, so
keep `rc` stable by default and document `"use no memo"` as the blunt answer.

---

## Migration plan

1. **Build the dev guard first**, in the same change. The 17 early-return sites will otherwise bite
   during the port itself.
2. Add `useControls`, `Rendered`, and the branded slot signatures to `@rxc/controls` /
   `@rxc/forms-react-core`. Promote `useComputed` to a standalone hook.
3. Port call sites (~62): drop the second parameter, add `const { rc, rendered } = useControls()`,
   wrap every return, and **give each renderer an explicit `: Rendered` return annotation** so
   missed paths are flagged at the `return` rather than at the function. The branded types make
   missed paths build errors.
4. Delete `controls()`, both overloads, and `packages/controls/src/types.ts`.
5. Update `docs/MIGRATION-FROM-LEGACY.md:140` and `:427`, which currently teach the two-arg shape.
6. Note the named-function-expression lint nuance is now moot — everything is a real component.

---

## Ecosystem note

No React support for this pattern is coming. The team's direction is compiler + immutable data, not
signals; `useSyncExternalStore` is snapshot-based and cannot express "subscribe to exactly the
controls this render touched"; and no "end of render" hook has ever been on the table — React
deliberately avoids render-phase lifecycles.

The [TC39 Signals proposal](https://github.com/tc39/proposal-signals) is the only thing that could
change the picture, and as of this writing the
[official tracker](https://github.com/tc39/proposals/blob/main/stage-1-proposals.md) still lists it
at **Stage 1**, last presented **June 2024** — effectively parked while the champions do
framework-integration prototyping. React is absent from its participating-framework list. (Beware
secondary sources claiming Stage 2 in late 2025; they are wrong.)
