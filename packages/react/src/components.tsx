"use client";

import React, { createContext, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import { useReactive } from "./useReactive.js";
import type {
  RenderArrayElementsProps,
  ReactiveProps,
  RenderCallback,
  RenderElementsProps,
  RenderOptionalProps,
  Rendered,
  ControlValues,
} from "./types.js";

/**
 * Fallback content for a control that holds no value, supplied by an ancestor.
 *
 * Lets an app set one "loading" treatment (a spinner, a skeleton row) for a
 * whole subtree rather than passing `notDefined` to every helper.
 */
export const NotDefinedContext = createContext<ReactNode>(null);

/**
 * Provide the {@link NotDefinedContext} fallback to a subtree.
 *
 * The context object is exported too, for `useContext` in a custom helper,
 * but prefer this — it matches {@link FormEditProvider} and keeps callers out
 * of the raw `.Provider`.
 */
export function NotDefinedProvider({
  notDefined,
  children,
}: {
  notDefined: ReactNode;
  children: ReactNode;
}) {
  return (
    <NotDefinedContext.Provider value={notDefined}>
      {children}
    </NotDefinedContext.Provider>
  );
}

// ── Reactive ───────────────────────────────────────────────────

/**
 * Render `children` in a subscription scope of its own.
 *
 * This is the primitive the other helpers are built from, and it exists for
 * reactivity rather than for rendering: reads made through the `rc` handed to
 * the callback belong to *this* boundary, so a change re-renders only what is
 * inside it and leaves the calling component alone.
 *
 * ```tsx
 * <Reactive>{(rc) => <span>{rc.getValue(name)}</span>}</Reactive>
 * ```
 *
 * Name the parameter `rc` — it then shadows any enclosing `rc`, making it
 * impossible to read the wrong context by accident.
 *
 * The isolation covers reads the callback makes **itself**. Components in the
 * returned tree have their own contexts and are unaffected either way; and a
 * value read *before* the callback runs — in the caller's body, then closed
 * over — is tracked by the caller, so wrapping it here isolates nothing.
 */
export function Reactive({ children }: ReactiveProps): Rendered {
  const { rc, rendered } = useReactive();
  // `children(rc)` is evaluated before `rendered` is applied to its result,
  // so every read it made is tracked by the time the pass is reconciled.
  return rendered(children(rc));
}

// ── RenderElements ──────────────────────────────────────────────────

const defaultContainer = (children: ReactNode): ReactElement => (
  <>{children}</>
);

/**
 * Render one nested scope per element of an array control.
 *
 * This component subscribes only to the array's *structure*, so adding,
 * removing or reordering elements re-renders the list while a change within a
 * single element re-renders just that element's scope.
 *
 * Elements are keyed by `uniqueId`, which is allocated per `ControlContext`
 * rather than from a module global, so the key sequence is identical across
 * SSR and hydration.
 */
export function RenderElements<V>({
  control,
  children,
  notDefined,
  empty,
  container = defaultContainer,
}: RenderElementsProps<V>): Rendered {
  const { rc, rendered } = useReactive();
  const fallback = useContext(NotDefinedContext);

  if (control == null || rc.isNull(control)) {
    return rendered(<>{notDefined ?? fallback ?? empty}</>);
  }

  const elements = rc.getElements(control as Control<V[]>);
  const total = elements.length;
  const rows = total
    ? elements.map((element, index) => (
        <Reactive key={element.uniqueId}>
          {(rc) => children(rc, element, index, total)}
        </Reactive>
      ))
    : empty;
  return rendered(container(rows, elements));
}

// ── RenderOptional ──────────────────────────────────────────────────

/**
 * Render `children` only once `control` holds a value, handing the callback
 * the control narrowed to its non-null type.
 *
 * Subscribes to null-ness alone, so a change that doesn't cross the null
 * boundary re-renders the callback's scope rather than this one.
 */
export function RenderOptional<V>({
  control,
  children,
  notDefined,
}: RenderOptionalProps<V>): Rendered {
  const { rc, rendered } = useReactive();
  const fallback = useContext(NotDefinedContext);

  if (control == null || rc.isNull(control)) {
    return rendered(<>{notDefined ?? fallback}</>);
  }
  const defined = control as Control<V>;
  return rendered(
    <Reactive>{(rc) => children(rc, defined)}</Reactive>,
  );
}

/**
 * Render once every control in `controls` holds a non-null value, passing
 * their values as a record.
 *
 * Returns a {@link RenderCallback}, so it composes with any helper that takes
 * one:
 *
 * ```tsx
 * <Reactive>
 *   {whenAllDefined({ user, account }, ({ user, account }) => …, <Spinner />)}
 * </Reactive>
 * ```
 */
export function whenAllDefined<A extends Record<string, Control<any>>>(
  controls: A,
  render: (values: ControlValues<A>) => ReactNode,
  elseRender?: ReactNode,
): RenderCallback {
  return (rc) => {
    const values: Record<string, unknown> = {};
    let ready = true;
    for (const [key, control] of Object.entries(controls)) {
      const value = rc.getValue(control);
      if (value != null) values[key] = value;
      else ready = false;
    }
    return ready ? render(values as ControlValues<A>) : elseRender;
  };
}

// ── RenderArrayElements ─────────────────────────────────────────────

/**
 * Render each element of a plain array.
 *
 * The counterpart to {@link RenderElements} for values that aren't behind a
 * Control. There is nothing reactive to read, so the callback gets no `rc` and
 * this component opens no subscription scope — it is ordinary rendering, kept
 * here for symmetry.
 */
export function RenderArrayElements<V>({
  array,
  children,
  notDefined,
  empty,
  getKey = (_, i) => i,
  container = defaultContainer,
}: RenderArrayElementsProps<V>): ReactElement {
  const fallback = useContext(NotDefinedContext);
  if (array == null) return <>{notDefined ?? fallback ?? empty}</>;

  const total = array.length;
  const rows = total
    ? array.map((element, index) => (
        <React.Fragment key={getKey(element, index)}>
          {children(element, index, total)}
        </React.Fragment>
      ))
    : empty;
  return container(rows, array);
}
