import type { ComponentType, ReactNode } from "react";
import type {
  ControlContext,
  ReadContext,
} from "@rx-controls/core";
import type {
  ActionStyle,
  ControlDisableType,
  DataNode,
  DisplayData,
  FormNode,
  FormStateNode,
  IconPlacement,
  IconReference,
  SchemaInterface,
} from "@rx-controls/forms-core";

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

/**
 * Plain-props action renderer signature — mirrors legacy
 * `@react-typed-forms/schemas`'s `ActionRendererProps`. Renderers
 * receive the data they need to draw the button (id, text, icon,
 * style, current busy/disabled state) plus an `onClick` to invoke
 * when the user activates the button. The renderer is not aware of
 * any underlying `FormStateNode`; form-tree action controls are
 * adapted to this shape by `<Field>`'s action dispatch, and inline
 * actions (e.g. an Array renderer's Add / Edit / Remove buttons)
 * build the props directly.
 *
 * The renderer should NOT call `useActionHandler` itself — `onClick`
 * already encapsulates the dispatch + fallback chain. Hosts that
 * register a custom action renderer for a specific id (via
 * `matchActionId(id, MyRenderer)`) own the entire visual chrome but
 * inherit default click behavior by simply invoking `props.onClick`.
 */
export interface ActionRendererProps {
  actionId: string;
  actionText?: string;
  /** Invoked when the user activates the action. Encapsulates the
   *  outer-scope dispatch + the renderer's default fallback. */
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  icon?: IconReference | null;
  actionStyle?: ActionStyle | null;
  iconPlacement?: IconPlacement | null;
  /** `disableType` only meaningful for tree-defined action controls
   *  whose adapter ties busy state to a `FormStateNode`. Inline
   *  callers can leave this unset. */
  disableType?: ControlDisableType | null;
  styleClass?: string | null;
  textClass?: string | null;
  /**
   * Rendered content for nested children of an action-typed form
   * definition (`ActionControlDefinition.children`). Populated by the
   * adapter in `<Field>` from `node.getChildren(rc).map(<Field>)`;
   * inline callers (Add / Edit / Remove buttons etc.) typically omit
   * this. Custom action renderers — e.g. a dropdown button rendering
   * menu items, a confirmation popover with body content — read this
   * to render the nested form-defined content inside their chrome.
   * The default `ButtonAction` ignores it.
   */
  children?: ReactNode;
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
   * Required at this layer — platform packages (`@rx-controls/forms`) wrap this
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
