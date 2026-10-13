import type { CSSProperties, ReactNode } from "react";
import type { ButtonProps, TextProps } from "@fluentui/react-components";
import { NO_LOOK_STATE, type LookState } from "@rx-controls/forms-react";
import { createLooksContext } from "@rx-controls/forms-html/shared";

/**
 * A style, or one computed from the look's state (`width`, the window's, for a
 * look that depends on the screen) — the same `LookState` every implementation
 * hands a look. Fluent's `tokens` are CSS values, usable as they are.
 *
 * @group Theming
 */
export type FluentStyle = CSSProperties | ((state: LookState) => CSSProperties);

/** A style resolved for a state. */
export function atState(s: FluentStyle | undefined, state: LookState = NO_LOOK_STATE): CSSProperties | undefined {
  return typeof s === "function" ? s(state) : s;
}

/**
 * A `TextDisplay`'s named look: props for Fluent's `Text`, and a style —
 * Fluent's `tokens` and `typographyStyles` are CSS values, usable here as they
 * are.
 *
 * @group Theming
 */
export interface FluentTextLook
  extends Pick<TextProps, "size" | "weight" | "italic" | "underline" | "font"> {
  /** Over the text's own style. */
  style?: FluentStyle;
}

/**
 * A group's named look: a style for each of its elements.
 *
 * @group Theming
 */
export interface FluentGroupLook {
  /** The wrapper around title and body. */
  wrapper?: FluentStyle;
  /** The title. */
  title?: FluentStyle;
  /** The body. */
  body?: FluentStyle;
}

/**
 * A field's named look: a style for each of its elements. `control` is the
 * element the widget draws as its control (the input's frame, the select, the
 * option group, the value); `text` its own words (the input's text, an
 * option's label).
 *
 * @group Theming
 */
export interface FluentFieldLook {
  /** The `Field` around label, control and message. */
  shell?: FluentStyle;
  /** The label. */
  label?: FluentStyle;
  /** The control. */
  control?: FluentStyle;
  /** The control's text. */
  text?: FluentStyle;
}

/**
 * An action's named look: props for Fluent's `Button`, and a style.
 *
 * @group Theming
 */
export interface FluentActionLook extends Pick<ButtonProps, "appearance" | "shape" | "size"> {
  /** Over the button's own style. */
  style?: FluentStyle;
}

/**
 * What the form's named looks are under Fluent — the form names a role
 * ("lead", "card", "quiet"), and this says what Fluent draws for it.
 *
 * @group Theming
 */
export interface FluentLooks {
  /** A `TextDisplay`'s looks. */
  text?: Record<string, FluentTextLook>;
  /** A group's looks. */
  group?: Record<string, FluentGroupLook>;
  /** A field's looks: a style per element. */
  field?: Record<string, FluentFieldLook>;
  /**
   * An action's looks beyond `primary` / `secondary` / `link`, which
   * Fluent draws as its `primary` / `secondary` / `transparent` appearances.
   * A name given here for one of the three replaces it.
   */
  action?: Record<string, FluentActionLook>;
  /** An `ImageDisplay`'s looks: a style on the image. */
  image?: Record<string, FluentStyle>;
  /** An `IconDisplay`'s looks: a style on the glyph, over its own size. */
  icon?: Record<string, FluentStyle>;
}

const { Provider, useLooks } = createLooksContext<FluentLooks>("FluentLooksProvider");

/**
 * The props of {@link FluentLooksProvider}.
 *
 * @group Theming
 */
export interface FluentLooksProviderProps {
  /** Looks for this region, merged over any enclosing provider's. */
  looks: FluentLooks;
  /** The region. */
  children: ReactNode;
}

/**
 * Name the form's looks for Fluent, for a region of the app. Nests: a
 * look given replaces the one of the same name above it. Pass a module
 * constant or a memoised object, so the region does not re-resolve every
 * render.
 *
 * @group Theming
 */
export function FluentLooksProvider(props: FluentLooksProviderProps): ReactNode {
  return <Provider {...props} />;
}

/** The looks in effect here. */
export const useFluentLooks: () => FluentLooks = useLooks;
