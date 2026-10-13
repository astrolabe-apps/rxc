import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { ButtonProps, GlobalToken, Typography } from "antd";
import { NO_LOOK_STATE, type LookState } from "@rx-controls/forms-react";

type TextProps = ComponentProps<typeof Typography.Text>;
import { createLooksContext } from "@rx-controls/forms-html/shared";

/**
 * A style, or one computed from Ant's theme tokens and the look's state
 * (`width`, the window's, for a look that depends on the screen) — the same
 * `LookState` every implementation hands a look.
 *
 * @group Theming
 */
export type AntStyle = CSSProperties | ((token: GlobalToken, state: LookState) => CSSProperties);

/**
 * A `TextDisplay`'s named look: props for Ant's `Typography.Text`, and a style.
 *
 * @group Theming
 */
export interface AntTextLook
  extends Pick<TextProps, "type" | "strong" | "italic" | "underline" | "code" | "mark"> {
  /** Over the text's own style. */
  style?: AntStyle;
}

/**
 * A group's named look: a style for each of its elements.
 *
 * @group Theming
 */
export interface AntGroupLook {
  /** The wrapper around title and body. */
  wrapper?: AntStyle;
  /** The title. */
  title?: AntStyle;
  /** The body. */
  body?: AntStyle;
}

/**
 * A field's named look: a style for each of its elements. `control` is the
 * element the widget draws as its control (the input's frame, the select,
 * the option group, the value); `text` its own words (the input's text, an
 * option's label).
 *
 * @group Theming
 */
export interface AntFieldLook {
  /** The form item around label, control and message. */
  shell?: AntStyle;
  /** The label. */
  label?: AntStyle;
  /** The control. */
  control?: AntStyle;
  /** The control's text. */
  text?: AntStyle;
}

/**
 * An action's named look: props for Ant's `Button`, and a style.
 *
 * @group Theming
 */
export interface AntActionLook
  extends Pick<ButtonProps, "type" | "color" | "variant" | "danger" | "size" | "shape"> {
  /** Over the button's own style. */
  style?: AntStyle;
}

/**
 * What the form's named looks are under Ant — the form names a role
 * ("lead", "card", "quiet"), and this says what Ant draws for it.
 *
 * @group Theming
 */
export interface AntdLooks {
  /** A `TextDisplay`'s looks. */
  text?: Record<string, AntTextLook>;
  /** A group's looks. */
  group?: Record<string, AntGroupLook>;
  /** A field's looks: a style per element. */
  field?: Record<string, AntFieldLook>;
  /**
   * An action's looks beyond `primary` / `secondary` / `link`, which Ant
   * draws as its `primary` / `default` / `link` types. A name given here for
   * one of the three replaces it.
   */
  action?: Record<string, AntActionLook>;
  /** An `ImageDisplay`'s looks: a style on the image. */
  image?: Record<string, AntStyle>;
  /** An `IconDisplay`'s looks: a style on the glyph, over its own size. */
  icon?: Record<string, AntStyle>;
}

const { Provider, useLooks } = createLooksContext<AntdLooks>("AntdLooksProvider");

/**
 * The props of {@link AntdLooksProvider}.
 *
 * @group Theming
 */
export interface AntdLooksProviderProps {
  /** Looks for this region, merged over any enclosing provider's. */
  looks: AntdLooks;
  /** The region. */
  children: ReactNode;
}

/**
 * Name the form's looks for Ant, for a region of the app. Nests: a look
 * given replaces the one of the same name above it. Pass a module constant
 * or a memoised object, so the region does not re-resolve every render.
 *
 * @group Theming
 */
export function AntdLooksProvider(props: AntdLooksProviderProps): ReactNode {
  return <Provider {...props} />;
}

/** The looks in effect here. */
export const useAntdLooks: () => AntdLooks = useLooks;

/** A style, resolved against the tokens and the look's state. */
export function atToken(
  s: AntStyle | undefined,
  token: GlobalToken,
  state: LookState = NO_LOOK_STATE,
): CSSProperties | undefined {
  return typeof s === "function" ? s(token, state) : s;
}
