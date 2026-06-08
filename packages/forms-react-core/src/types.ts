import type { ComponentType } from "react";
import type {
  ControlContext,
  ReadContext,
} from "@rxc/controls-core";
import type {
  DataNode,
  DisplayData,
  FormNode,
  FormStateNode,
  SchemaInterface,
} from "@rxc/forms-core";

// ── Renderer component types ─────────────────────────────────────────

export interface DataRendererProps {
  node: FormStateNode;
  /**
   * DOM/component id for the input element. Wire it to your input's
   * identifier and to the equivalent of `aria-describedby={`${id}-error`}`
   * on platforms that support it. Generated once per Field via React's
   * `useId()` — stable across SSR/hydration on the web.
   */
  id: string;
  /**
   * True when the Field is rendering in inline mode (e.g. inside an
   * `InlineGroupRenderer`), where the surrounding element is inline-level.
   * Renderers that emit a block element by default (e.g. DisplayOnly's
   * `<div>`) should switch to an inline element (`<span>`) to avoid
   * invalid nesting — mirroring the legacy `inline ? "span" : "div"` split.
   */
  inline?: boolean;
}

export interface GroupRendererProps {
  node: FormStateNode;
}

export interface ActionRendererProps {
  node: FormStateNode;
}

export interface DisplayRendererProps {
  node: FormStateNode;
  data: DisplayData;
}

export type DataRenderer = ComponentType<DataRendererProps>;
export type GroupRenderer = ComponentType<GroupRendererProps>;
export type ActionRenderer = ComponentType<ActionRendererProps>;
export type DisplayRenderer = ComponentType<DisplayRendererProps>;

// ── Match results (component + dispatch metadata) ────────────────────

export interface DataMatch {
  component: DataRenderer;
  hidesLabel?: boolean;
}

export interface GroupMatch {
  component: GroupRenderer;
  hidesLabel?: boolean;
}

export interface ActionMatch {
  component: ActionRenderer;
}

export interface DisplayMatch {
  component: DisplayRenderer;
}

// ── Platform-agnostic form options ───────────────────────────────────

export interface FormOptions {
  customDisplays?: Record<string, ComponentType<{ data: DisplayData }>>;
}

// ── useFormStateNode options ─────────────────────────────────────────

export interface UseFormStateNodeOptions {
  /** Registry providing matchers + schema extensions + child resolvers.
   * Required at this layer — platform packages (`@rxc/forms`) wrap this
   * with their own `useFormStateNode` that defaults to a platform
   * `defaultRegistry()`. */
  registry: import("./registry").FormRegistry;
  schemaInterface?: SchemaInterface;
  clearHidden?: boolean;
  runAsync?: (fn: () => void) => void;
}

// Re-exports for callers building FormStateNodes themselves
export type { DataNode, FormNode };
export type { ControlContext, ReadContext };
