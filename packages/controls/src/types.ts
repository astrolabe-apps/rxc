/**
 * `@rxc/controls` — public types for the React adapter.
 *
 * See `docs/RENDER-BOUNDARY.md` for why the render boundary is an
 * explicit `rendered(…)` call rather than an HOC.
 */

import type { ReactElement, ReactNode } from "react";
import type { ReadContext } from "@rxc/controls-core";

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
