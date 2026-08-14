"use client";

/**
 * Legacy components: the F-components re-exported from `@rxc/controls`
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
import type { Control as CoreControl } from "@rxc/controls-core";
import {
  Fcheckbox as RxcFcheckbox,
  Finput as RxcFinput,
  Fselect as RxcFselect,
  RenderArrayElements as RxcRenderArrayElements,
  RenderControl as RxcRenderControl,
  RenderElements as RxcRenderElements,
  RenderOptional as RxcRenderOptional,
} from "@rxc/controls";
import { withAmbient } from "./ambient";
import { asLegacy } from "./patch";
import type { Control, ControlValue } from "./types";

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

/** Plain-array counterpart — nothing reactive, kept for symmetry. */
export function RenderArrayElements<V>(
  props: RenderArrayElementsProps<V>,
): ReactElement {
  const ndc = useContext(NotDefinedContext());
  return (
    <RxcRenderArrayElements
      {...props}
      notDefined={props.notDefined ?? ndc}
    />
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
