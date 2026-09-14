"use client";

/**
 * Legacy components: the F-components re-exported from `@rx-controls/react`
 * (self-subscribing, same props) and the render helpers adapted from the
 * rc-taking rxc versions back to the legacy callback signatures via
 * `withAmbient`.
 */

import React, { createContext, useContext } from "react";
import type {
  Context,
  InputHTMLAttributes,
  Key,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import type { Control as CoreControl } from "@rx-controls/core";
import {
  ControlCheckbox as RxcFcheckbox,
  ControlInput as RxcFinput,
  ControlSelect as RxcFselect,
  RenderArrayElements as RxcRenderArrayElements,
  Reactive as RxcRenderControl,
  RenderElements as RxcRenderElements,
  RenderOptional as RxcRenderOptional,
} from "@rx-controls/react";
import { withAmbient } from "./ambient.js";
import { asLegacy } from "./patch.js";
import type { Control, ControlValue } from "./types.js";

// ── F-components (rxc implementations, legacy prop types) ───────────

export type FinputProps<V extends string | number> =
  InputHTMLAttributes<HTMLInputElement> & { control: Control<V> };

export function Finput<V extends string | number>(
  props: FinputProps<V>,
): ReactElement {
  return <RxcFinput {...(props as any)} />;
}

export type FselectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  control: Control<string | number | undefined>;
};

export function Fselect(props: FselectProps): ReactElement {
  return <RxcFselect {...(props as any)} />;
}

export type FcheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  control: Control<boolean | undefined | null>;
  type?: "checkbox" | "radio";
  notValue?: boolean;
};

export function Fcheckbox(props: FcheckboxProps): ReactElement {
  return <RxcFcheckbox {...(props as any)} />;
}

// ── NotDefinedContext (legacy lazy singleton factory) ────────────────

let _NotDefinedContext: Context<ReactNode> | null = null;

/** @noTrackControls */
export function NotDefinedContext(): Context<ReactNode> {
  if (!_NotDefinedContext) {
    _NotDefinedContext = createContext<ReactNode>(<></>);
  }
  return _NotDefinedContext;
}

// ── Render helpers ───────────────────────────────────────────────────

export type RenderControlProps =
  | { children: () => ReactNode }
  | { render: () => ReactNode };

/** A subscription scope of its own: ambient reads inside the callback
 * re-render this boundary, not the caller. */
export function RenderControl(props: RenderControlProps): ReactElement {
  const body = "children" in props ? props.children : props.render;
  return <RxcRenderControl>{(rc) => withAmbient(rc, body)}</RxcRenderControl>;
}

/**
 * Render once `control` holds a value, with the control narrowed. The
 * fallback comes from `notDefined`, else the legacy `NotDefinedContext()`.
 */
export function RenderOptional<V>({
  control,
  children,
  notDefined,
}: {
  control: Control<V | undefined | null> | null | undefined;
  children: (c: Control<V>) => ReactNode;
  notDefined?: ReactNode;
}): ReactElement {
  const ndc = useContext(NotDefinedContext());
  return (
    <RxcRenderOptional
      control={control as unknown as CoreControl<V | undefined | null>}
      notDefined={notDefined ?? ndc}
    >
      {(rc, c) => withAmbient(rc, () => children(asLegacy(c)))}
    </RxcRenderOptional>
  );
}

export interface RenderElementsProps<V> {
  control: Control<V[] | undefined | null>;
  children: (element: Control<V>, index: number, total: number) => ReactNode;
  notDefined?: ReactNode;
  empty?: ReactNode;
  container?: (children: ReactNode, elements: Control<V>[]) => ReactElement;
}

/** One nested scope per array element, keyed by `uniqueId`; the list itself
 * subscribes to structure only. */
export function RenderElements<V>({
  control,
  children,
  notDefined,
  empty,
  container,
}: RenderElementsProps<V>): ReactElement {
  const ndc = useContext(NotDefinedContext());
  return (
    <RxcRenderElements
      control={control as unknown as CoreControl<V[] | undefined | null>}
      notDefined={notDefined ?? ndc}
      empty={empty}
      container={
        container
          ? (kids, elements) =>
              container(kids, elements as unknown as Control<V>[])
          : undefined
      }
    >
      {(rc, element, index, total) =>
        withAmbient(rc, () => children(asLegacy(element), index, total))
      }
    </RxcRenderElements>
  );
}

export interface RenderArrayElementsProps<V> {
  array: V[] | undefined | null;
  children: (element: V, index: number, total: number) => ReactNode;
  notDefined?: ReactNode;
  empty?: ReactNode;
  getKey?: (element: V, index: number) => Key;
  container?: (children: ReactNode, elements: V[]) => ReactElement;
}

/**
 * Plain-array counterpart of {@link RenderElements}.
 *
 * The array itself is inert, but the callback is not: legacy code reads
 * controls ambiently inside it (and may call hooks such as `useComputed`),
 * so each element gets its own {@link RenderControl} scope. v4 did exactly
 * this — it mapped every element through a keyed `RenderControl` — and the
 * scope is load-bearing twice over. Without it the callback runs inline in
 * this component's render, where no tracking window is open: its reads
 * subscribe nothing and the element never re-renders (the schemas-html radio
 * renderer derives `checked` this way, so checked radios render unchecked
 * while the underlying control updates fine). It also keeps hooks called in
 * the callback owned by a per-element component, so a change in array length
 * cannot shift this component's hook order.
 */
export function RenderArrayElements<V>(
  props: RenderArrayElementsProps<V>,
): ReactElement {
  const ndc = useContext(NotDefinedContext());
  const { children, ...rest } = props;
  return (
    <RxcRenderArrayElements {...rest} notDefined={props.notDefined ?? ndc}>
      {(element, index, total) => (
        <RenderControl>{() => children(element, index, total)}</RenderControl>
      )}
    </RxcRenderArrayElements>
  );
}

type ValuesOfControls<A> = {
  [K in keyof A]: NonNullable<ControlValue<A[K]>>;
};

/**
 * Render once every control holds a non-null value. Returns a no-arg thunk
 * (legacy shape) whose ambient reads track in whatever scope invokes it —
 * compose with {@link RenderControl}.
 */
export function renderOptionally<A extends Record<string, Control<any>>>(
  controls: A,
  render: (v: ValuesOfControls<A>) => ReactNode,
  elseRender?: ReactNode,
): () => ReactNode {
  return () => {
    const values: Record<string, unknown> = {};
    let ready = true;
    for (const [key, control] of Object.entries(controls)) {
      const value = control.value;
      if (value != null) values[key] = value;
      else ready = false;
    }
    return ready ? render(values as ValuesOfControls<A>) : elseRender;
  };
}
