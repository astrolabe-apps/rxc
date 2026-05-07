import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { FormStateNode, SchemaInterface } from "@rxc/forms-core";
import type { FormRegistry } from "@rxc/forms-react-core";
import type { HtmlFormOptions } from "./theme";

// ── Layout / Visibility (HTML-shaped) ────────────────────────────────

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

export interface FormProps {
  /** Pre-built root FormStateNode (see `useFormStateNode` helper). */
  node: FormStateNode;
  registry?: FormRegistry;
  layout?: LayoutComponent;
  visibility?: VisibilityComponent;
  options?: HtmlFormOptions;
  /** Mark the entire form subtree as design-mode. Renderers and
   * adornments read this via `useDesignMode()`. */
  designMode?: boolean;
}

export interface UseFormStateNodeOptions {
  registry?: FormRegistry;
  schemaInterface?: SchemaInterface;
  clearHidden?: boolean;
  runAsync?: (fn: () => void) => void;
}
