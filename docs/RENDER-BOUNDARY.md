# The Render Boundary

Authoritative reference for how a React component gets reactive reads in `@rxc/*`. **These
semantics are settled and must be preserved** — in particular the invariant in
[Why reconcile must stay in the render body](#why-reconcile-must-stay-in-the-render-body), which is
the one thing a well-meaning refactor is likely to break.

## The contract

```tsx
import { useControls, type Rendered } from "@rxc/controls";

function StarsRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useControls();
  const c = useTextInputController(rc, node);
  const theme = useHtmlTheme();
  if (!c.data) return rendered(null);      // ← every return path
  return rendered(<input className={theme.inputClass} value={c.value} />);
}
```

Three rules:

1. **Get `rc` from `useControls()`.** Everything reactive is read through it — `rc.getValue(c)`,
   `rc.getError(c)`, `node.getState(rc)`, `node.getChildren(rc)`, and every `forms-react-core`
   controller, which all take `rc` as their first argument.
2. **Wrap every return in `rendered(…)`.** Reads are only *tracked* during render; `rendered()` is
   what turns them into live subscriptions. Miss it on one path and the component renders correct
   output once, then never updates — see [Enforcement](#enforcement).
3. **Annotate the return type `Rendered`.** This is what makes a missed path a build error, reported
   at the offending `return`.

Components are ordinary function components. Hooks go at the top level, `memo`/`forwardRef`/generics
all work normally, and `react-hooks/rules-of-hooks` analyses them (`rush lint`).

`useControls()` takes no arguments. `rendered(node)` accepts any `ReactNode` — string, number,
fragment, array, `null` — and returns it unchanged.

`ControlContext` comes from `useControlContext()` (its `update` is a stable reference, safe in
dependency arrays). `useComputed(fn)` is a standalone hook.

## Why reconcile must stay in the render body

`rendered()` calls `reconciler.reconcile(rc.tracked)` then `rc.finalize()`, **synchronously, during
render**. JSX children are evaluated as arguments before the call, so every read in the returned
tree is already tracked by the time it runs.

Do not move this into an effect. React can defer passive effects into a scheduler callback, so the
component would sit on screen with **zero subscriptions** for potentially a frame or more, and any
write in that window is silently lost. The window is reachable in practice, not theoretical:
`useFormStateNode` builds the form-state tree via `effect`s during render, so a later child's render
can write a control an earlier child already read. Closing that gap would require a per-read value
snapshot compared at reconcile time — replacing a single bitmask OR in the hot path of a 500-field
form — plus a guaranteed extra render pass on mount. (`<Activity>` also unmounts effects while
preserving state, which would tear subscriptions down on hide.)

React provides no "end of render body" hook, which is why the boundary is an explicit call rather
than something the library can do for you. This is the same reason mobx-react-lite still ships
`observer()`.

## Enforcement

A missed `rendered(…)` fails **silently** — no crash, no visible error, just a component that stops
updating. Two defences.

### Primary: the `Rendered` type

```ts
declare const callRendered: unique symbol;
export type Rendered = ReactElement & { readonly [callRendered]: never };
```

Only `rendered()` can produce this, so a component annotated `): Rendered` cannot return raw JSX,
`null`, or a string:

```
error TS2322: Type 'Element' is not assignable to type 'Rendered'.
  Property '[callRendered]' is missing in type 'ReactElement<any, any>'
    but required in type '{ readonly [callRendered]: never; }'
```

Four details that are load-bearing if you ever touch this type:

- **The brand must be required.** `{ [callRendered]?: never }` lets raw JSX through — optional
  properties don't require presence, and excess-property checks only fire on fresh object literals.
- **Intersect with `ReactElement`, not `ReactNode`.** Both enforce correctly, but intersecting the
  9-member `ReactNode` union distributes, and TS then reports against an arbitrary member
  (*"not assignable to 'ReactPortal & …'. Property 'children' is missing"*) instead of naming the
  brand. The "is an element" claim is type-level only and never observable.
- **Name the brand symbol for the fix.** TS prints the declared identifier, so `callRendered` makes
  the message self-documenting. A `unique symbol` also can't be forged by a consumer.
- **Annotate explicitly; don't rely on the slot type.** `function X(…): Rendered` reports the error
  on the offending `return`. Contextual typing from a registry slot (`const X: DataRenderer = …`)
  blames the whole function assignment instead — much worse for a renderer with several returns.

Renderer slot types (`DataRenderer`, `GroupRenderer`, `DisplayRenderer`) are deliberately **not**
branded. The pure-layout renderers (`Flex`, `Grid`, `Inline`, `Standard`, `Contents`) read nothing
reactively and never call `useControls()`; branding the slot would force them to allocate a tracking
rc and reconciler purely to wrap a return.

### Backstop: the dev-mode guard

For anything the type can't reach — components that don't annotate a return type, and files outside
`tsconfig`'s `include` (i.e. **tests**, which is how `memoBenchmark.test.tsx` silently lost its
`rendered(…)` calls during the port):

```
[@rxc/controls] TextfieldRenderer (/…/Textfield.tsx:9:32) returned without calling rendered(…). …
```

The component names itself: identity is captured from the stack **during render**, once per
component instance, because the warning fires from a passive effect where the component's own frame
is long gone. (React 19's `captureOwnerStack()` works from an effect but reports the component's
*owner*, so it can't name the offender.) The frame scan skips past any consumer hook wrapping
`useControls`, taking the first PascalCase frame. De-duplicated by call site, so each offender warns
once per page load.

`apps/dev/src/app/renderboundary` demonstrates the failure modes live.

### Dev-only code must use the literal `process.env.NODE_ENV`

Both this guard and `overrideProxy`'s escaped-read warning gate on a module-scope constant:

```ts
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
```

The **literal, non-optional** `process.env.NODE_ENV` is required. Bundlers (webpack/Next
`DefinePlugin`, esbuild, vite) statically replace exactly that member expression, which folds the
constant to `false` and lets the guard be dead-code eliminated. Optional chaining
(`process?.env?.NODE_ENV`) is **not** matched — and when it isn't, webpack injects a `process`
browser shim instead, which evaluated to `true` and left both guards live in production bundles: a
stack capture per mounted component plus warnings naming minified identifiers. The `typeof` guard
covers unbundled browser ESM without blocking the fold; no `try`/`catch` is needed.

## Behaviour under throw / suspend

Degrades safely. After an unwind, `tracked` holds partial reads and `reconciler.subs` still holds the
*previous* render's set.

- **Stale, never missing.** `reconcile()` is the only mutator of `subs` and it didn't run, so the
  previous set persists — the over-subscription direction, at worst a spurious re-render.
- **No leak.** Nothing new was subscribed. An error boundary unmounting the subtree runs the effect
  teardown → `markTrackerDead` → sweep; a retry calls `reset()` and proceeds clean.
- **Suspense** is the case that actually happens, and it's the same story: the retry re-reads
  everything from scratch before calling `rendered(…)`, so the final state is correct.
- **Nothing needs `try`/`finally`** — the hook holds no ambient state to restore.
- **The dev guard stays silent.** A component that throws never commits its effects, so it can't cry
  wolf on a caught error.
- **`try`/`catch` fallbacks inside a renderer** are safe by construction: the branded return type
  forces the catch path through `rendered(…)` too.

Accepted wart: `rc.rendering` stays `true` until the next `reset()`, so `isFinalized` reports wrong
in that window and `overrideProxy`'s escaped-read warning won't fire. Spans throw → next render only.

## A subtlety worth knowing

Whether a missed `rendered(…)` on a *conditional* path is visible depends on which path the
component's **first** render took. Because `reconcile()` is the only thing that mutates the
subscription set, a subscription established on a good render **survives** every later render that
skips the boundary. Mount on the good path and the bug is completely invisible; mount on the bad path
and the component is dead on arrival — same code, same control, opposite outcomes. That asymmetry is
the reason this is enforced by a type rather than left to review or testing, and
`/renderboundary` in the dev app shows both cases side by side.

## React Compiler

Renderers are recognisable as components, so the compiler will compile them — and it cannot see that
the real reactive inputs are `rc.getValue()` reads. A reconciler-driven re-render with unchanged props
could return cached JSX, giving stale UI. This is the flip side of lint coverage: both hinge on being
recognisable as a component, so you can't have one without the other. Lint is on by default in every
consumer project and the compiler is opt-in with an escape hatch, so we take the lint.

If it ever matters: having `useControls()` return a **fresh `rc` identity per render** invalidates
the memo blocks that matter, since `rc` is an input to essentially every read. It costs an allocation
per render and forfeits legitimate memoisation, so `rc` is stable by default and `"use no memo"` is
the blunt answer.
