import type { ComponentType, CSSProperties, ReactNode } from "react";
import type {
  Control,
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
   * DOM id for the input element. Wire it to your input's `id={...}` and
   * to `aria-describedby={`${id}-error`}` so the chrome's `<Label
   * htmlFor>` and `<Error id>` line up. Generated once per Field via
   * React's `useId()` — stable across SSR/hydration.
   */
  id: string;
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

// ── Layout / Visibility ──────────────────────────────────────────────

export interface LayoutProps {
  node: FormStateNode;
  label?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  inline?: boolean;
  className?: string;
  style?: CSSProperties;
}

export interface VisibilityProps {
  visible: boolean | null;
  children: ReactNode;
}

export type LayoutComponent = ComponentType<LayoutProps>;
export type VisibilityComponent = ComponentType<VisibilityProps>;

// ── Public component props ───────────────────────────────────────────

export interface FieldProps {
  node: FormStateNode;
  layout?: LayoutComponent;
  visibility?: VisibilityComponent;
  designMode?: boolean;
}

export interface FormOptions {
  customDisplays?: Record<string, ComponentType<{ data: DisplayData }>>;
}

export interface FormProps {
  /** Pre-built root FormStateNode (see `useFormStateNode` helper). */
  node: FormStateNode;
  registry?: import("./registry").FormRegistry;
  layout?: LayoutComponent;
  visibility?: VisibilityComponent;
  options?: FormOptions;
}

export interface UseFormStateNodeOptions {
  registry?: import("./registry").FormRegistry;
  schemaInterface?: SchemaInterface;
  clearHidden?: boolean;
  runAsync?: (fn: () => void) => void;
}

// Re-exports for callers building FormStateNodes themselves
export type { DataNode, FormNode };
export type { ControlContext } from "@rxc/controls-core";

// ── Read-context helper passed to matcher functions ──────────────────

export type { ReadContext };
