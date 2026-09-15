/**
 * `@rx-controls/react` — public types for the React adapter.
 *
 * See `docs/RENDER-BOUNDARY.md` for why the render boundary is an
 * explicit `rendered(…)` call rather than an HOC.
 */

import type { Key, ReactElement, ReactNode } from "react";
import type {
  Control,
  ControlValue,
  ReadContext,
  WriteContext,
} from "@rx-controls/core";

declare const callRendered: unique symbol;

/**
 * The return type of a component that reads through a `ReadContext`.
 *
 * Only {@link ReactiveScope.rendered} can produce a value of this type, so a
 * component declared `(props) => Rendered` cannot return raw JSX (or `null`,
 * or a string) without going through the boundary call — which is what turns
 * "forgot to call `rendered(…)`, reactivity silently broken" into a build
 * error.
 *
 * Intersected with `ReactElement` (not `ReactNode`) purely for error-message
 * quality: intersecting the 9-member `ReactNode` union distributes, and TS
 * then reports against an arbitrary member instead of naming the missing
 * brand. `rendered()` still accepts any `ReactNode` — the "is an element"
 * claim is type-level only and never observable at runtime.
 *
 * Annotate renderers explicitly (`function Foo(…): Rendered`) rather than
 * relying on contextual typing from a registry slot type: the explicit form
 * reports the error on the offending `return`, the contextual form blames the
 * whole function.
 */
export type Rendered = ReactElement & { readonly [callRendered]: never };

/**
 * What {@link useReactive} hands back.
 *
 * `rc` is threaded into every reactive read (`rc.getValue(c)`,
 * `node.getState(rc)`, the `forms-react-core` controllers). `rendered` is
 * called exactly once, at each `return`, and never passed anywhere. `update`
 * is the write side — the ambient `ControlContext`'s own batching call.
 */
export interface ReactiveScope {
  /** Tracks every read made during this render pass. */
  rc: ReadContext;
  /**
   * Batch a set of writes against the ambient `ControlContext` — the same
   * `update` that `useControlContext()` exposes, so a component that both
   * reads and writes needs only one hook call:
   *
   * ```tsx
   * const { rc, rendered, update } = useReactive();
   * … onChange={(e) => update((wc) => wc.setValue(data, e.target.value))}
   * ```
   *
   * Subscribers run once after `cb` returns. Reads still go through `rc` —
   * reading inside `cb` (via the `WriteContext`) never subscribes. Anything
   * else off the context (`newControl`, tracker lifecycle) still comes from
   * `useControlContext()`.
   *
   * **Calling this from the render body is supported** — the "adjust derived
   * state while rendering" shape, the analogue of React's render-phase
   * `setState`. The write applies at once, so the rest of the body and every
   * descendant yet to render sees it.
   *
   * The write must **converge**: the component re-renders once to observe
   * it, and that pass must not produce a different value again. Writing a
   * plain derived value converges on its own — `setValue` bails on
   * `ControlContext.equals` before it touches a subscription, and the
   * default `deepEquals` means even a freshly-allocated object or array
   * literal settles on the second pass. An explicit
   * `if (rc.getValue(d) !== next)` is therefore optional (it costs the same
   * two passes either way). What does not converge is a value that genuinely
   * differs every pass — a counter, `Date.now()`, a random — and React stops
   * that with "Too many re-renders", exactly as it would an unguarded
   * render-phase `setState`. A `ControlContext` built with a
   * reference-equality `equals` puts fresh literals in that category too.
   *
   * Notification to components that have already committed is deferred out
   * of the render phase automatically — see "Writing from a render body" in
   * `docs/RENDER-BOUNDARY.md`.
   */
  update: (cb: (wc: WriteContext) => void) => void;
  /**
   * Close the render pass: turn everything read through `rc` into live
   * subscriptions, stop tracking, and return `node` unchanged.
   *
   * Must wrap **every** return path. JSX children are evaluated before the
   * call, so by the time it runs every read in the returned tree has already
   * been tracked.
   */
  rendered: <T extends ReactNode>(node: T) => Rendered;
}

// ── Render helpers ──────────────────────────────────────────────────
//
// The legacy `@react-typed-forms/core` equivalents (`Reactive`,
// `RenderElements`, …) exist to narrow *subscription scope*, not to render
// anything: each is a component, so under the old ambient-tracking model the
// reads inside its callback attributed to it rather than to the caller.
//
// That need is unchanged here, but the mechanism is explicit. A callback that
// closed over the caller's `rc` would isolate nothing — its reads would land
// in the caller's tracked set (and, since the caller has already reconciled by
// the time children render, be dropped entirely). So every callback below is
// handed its **own** `rc`.
//
// The callback returns a plain `ReactNode`: the helper component owns the
// boundary and closes the pass itself (`rendered(children(rc))` — the argument
// evaluates first, so every read inside is tracked before reconciling). That
// makes forgetting the boundary impossible here, unlike a `useReactive`
// component, where it is only caught by the `Rendered` brand and the dev guard.
//
// Always name the parameter `rc`. It then shadows any enclosing `rc`, which
// makes reading the wrong one a scoping impossibility rather than a discipline
// problem. Renaming it is legal but opts out of that protection — the dev
// guard described in `docs/RENDER-BOUNDARY.md` is the backstop.

/**
 * A nested render pass with its own subscription scope.
 *
 * Receives a fresh {@link ReadContext}; the helper that invoked it reconciles
 * the reads made through it.
 */
export type RenderCallback = (rc: ReadContext) => ReactNode;

/**
 * Props for `Reactive` — the primitive boundary the other helpers are
 * built from. Renders `children` in a subscription scope of its own, so reads
 * made inside it re-render only this boundary and not the calling component.
 */
export interface ReactiveProps {
  children: RenderCallback;
}

/**
 * Props for `RenderOptional` — render only once a control holds a non-null
 * value, handing the callback the value-narrowed control.
 *
 * Subscribes to the null-ness facet alone (`rc.isNull`), so a value change
 * that doesn't cross the null boundary re-renders the callback's scope rather
 * than this one.
 */
export interface RenderOptionalProps<V> {
  control: Control<V | undefined | null> | null | undefined;
  children: (rc: ReadContext, control: Control<V>) => ReactNode;
  /** Rendered while the control is null/undefined. Defaults to the
   * surrounding `NotDefinedContext` value. */
  notDefined?: ReactNode;
}

/**
 * Props for `RenderElements` — one nested scope per array element.
 *
 * Elements are keyed by `Control.uniqueId`, which is allocated per
 * `ControlContext` rather than from a module global, so the key sequence is
 * identical across SSR and hydration.
 */
export interface RenderElementsProps<V> {
  control: Control<V[] | undefined | null>;
  children: (
    rc: ReadContext,
    element: Control<V>,
    index: number,
    total: number,
  ) => ReactNode;
  /** Rendered when the control itself is null/undefined. */
  notDefined?: ReactNode;
  /** Rendered when the array is present but empty. */
  empty?: ReactNode;
  /** Wraps the rendered elements — a list container, table body, etc. */
  container?: (children: ReactNode, elements: Control<V>[]) => ReactElement;
}

/**
 * Props for `RenderArrayElements` — the plain-array counterpart of
 * {@link RenderElementsProps}, for values that aren't behind a Control.
 *
 * There is nothing reactive to read, so the callback takes no `rc`.
 */
export interface RenderArrayElementsProps<V> {
  array: V[] | undefined | null;
  children: (element: V, index: number, total: number) => ReactNode;
  notDefined?: ReactNode;
  empty?: ReactNode;
  getKey?: (element: V, index: number) => Key;
  container?: (children: ReactNode, elements: V[]) => ReactElement;
}

/** The non-null values of a record of controls, as passed to `whenAllDefined`. */
export type ControlValues<A> = {
  [K in keyof A]: NonNullable<ControlValue<A[K]>>;
};
