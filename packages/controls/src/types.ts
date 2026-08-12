/**
 * `@rxc/controls` — public types for the React adapter.
 *
 * See `docs/RENDER-BOUNDARY.md` for why the render boundary is an
 * explicit `rendered(…)` call rather than an HOC.
 */

import type { Key, ReactElement, ReactNode } from "react";
import type { Control, ControlValue, ReadContext } from "@rxc/controls-core";

declare const callRendered: unique symbol;

/**
 * The return type of a component that reads through a `ReadContext`.
 *
 * Only {@link Controls.rendered} can produce a value of this type, so a
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
 * What {@link useControls} hands back.
 *
 * `rc` is threaded into every reactive read (`rc.getValue(c)`,
 * `node.getState(rc)`, the `forms-react-core` controllers). `rendered` is
 * called exactly once, at each `return`, and never passed anywhere.
 */
export interface Controls {
  /** Tracks every read made during this render pass. */
  rc: ReadContext;
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
// The legacy `@react-typed-forms/core` equivalents (`RenderControl`,
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
// makes forgetting the boundary impossible here, unlike a `useControls`
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
 * Props for `RenderControl` — the primitive boundary the other helpers are
 * built from. Renders `children` in a subscription scope of its own, so reads
 * made inside it re-render only this boundary and not the calling component.
 */
export interface RenderControlProps {
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

/** The non-null values of a record of controls, as passed to `renderOptionally`. */
export type ValuesOfControls<A> = {
  [K in keyof A]: NonNullable<ControlValue<A[K]>>;
};
