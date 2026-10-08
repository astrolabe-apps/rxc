import type { ComponentProps, CSSProperties, ReactNode } from "react";
import type { ButtonProps, GlobalToken, Typography } from "antd";

type TextProps = ComponentProps<typeof Typography.Text>;
import { createVariantsContext } from "@rx-controls/forms-html/shared";

/**
 * A style, or one computed from Ant's theme tokens.
 *
 * @group Theming
 */
export type AntStyle = CSSProperties | ((token: GlobalToken) => CSSProperties);

/**
 * A `TextDisplay`'s named look: props for Ant's `Typography.Text`, and a style.
 *
 * @group Theming
 */
export interface AntTextVariant
  extends Pick<TextProps, "type" | "strong" | "italic" | "underline" | "code" | "mark"> {
  /** Over the text's own style. */
  style?: AntStyle;
}

/**
 * A group's named look: a style for each of its elements.
 *
 * @group Theming
 */
export interface AntGroupVariant {
  /** The wrapper around title and body. */
  wrapper?: AntStyle;
  /** The title. */
  title?: AntStyle;
  /** The body. */
  body?: AntStyle;
}

/**
 * An action's named look: props for Ant's `Button`, and a style.
 *
 * @group Theming
 */
export interface AntActionVariant
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
export interface AntdVariants {
  /** A `TextDisplay`'s variants. */
  text?: Record<string, AntTextVariant>;
  /** A group's variants. */
  group?: Record<string, AntGroupVariant>;
  /**
   * An action's variants beyond `primary` / `secondary` / `link`, which Ant
   * draws as its `primary` / `default` / `link` types. A name given here for
   * one of the three replaces it.
   */
  action?: Record<string, AntActionVariant>;
  /** An `ImageDisplay`'s variants: a style on the image. */
  image?: Record<string, AntStyle>;
}

const { Provider, useVariants } = createVariantsContext<AntdVariants>("AntdVariantsProvider");

/**
 * The props of {@link AntdVariantsProvider}.
 *
 * @group Theming
 */
export interface AntdVariantsProviderProps {
  /** Looks for this region, merged over any enclosing provider's. */
  variants: AntdVariants;
  /** The region. */
  children: ReactNode;
}

/**
 * Name the form's looks for Ant, for a region of the app. Nests: a variant
 * given replaces the one of the same name above it. Pass a module constant
 * or a memoised object, so the region does not re-resolve every render.
 *
 * @group Theming
 */
export function AntdVariantsProvider(props: AntdVariantsProviderProps): ReactNode {
  return <Provider {...props} />;
}

/** The variants in effect here. */
export const useAntdVariants: () => AntdVariants = useVariants;

/** A style, resolved against the tokens. */
export function atToken(s: AntStyle | undefined, token: GlobalToken): CSSProperties | undefined {
  return typeof s === "function" ? s(token) : s;
}
