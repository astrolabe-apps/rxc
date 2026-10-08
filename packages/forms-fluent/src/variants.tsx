import type { CSSProperties, ReactNode } from "react";
import type { ButtonProps, TextProps } from "@fluentui/react-components";
import { createVariantsContext } from "@rx-controls/forms-html/shared";

/**
 * A `TextDisplay`'s named look: props for Fluent's `Text`, and a style —
 * Fluent's `tokens` and `typographyStyles` are CSS values, usable here as they
 * are.
 *
 * @group Theming
 */
export interface FluentTextVariant
  extends Pick<TextProps, "size" | "weight" | "italic" | "underline" | "font"> {
  /** Over the text's own style. */
  style?: CSSProperties;
}

/**
 * A group's named look: a style for each of its elements.
 *
 * @group Theming
 */
export interface FluentGroupVariant {
  /** The wrapper around title and body. */
  wrapper?: CSSProperties;
  /** The title. */
  title?: CSSProperties;
  /** The body. */
  body?: CSSProperties;
}

/**
 * An action's named look: props for Fluent's `Button`, and a style.
 *
 * @group Theming
 */
export interface FluentActionVariant extends Pick<ButtonProps, "appearance" | "shape" | "size"> {
  /** Over the button's own style. */
  style?: CSSProperties;
}

/**
 * What the form's named looks are under Fluent — the form names a role
 * ("lead", "card", "quiet"), and this says what Fluent draws for it.
 *
 * @group Theming
 */
export interface FluentVariants {
  /** A `TextDisplay`'s variants. */
  text?: Record<string, FluentTextVariant>;
  /** A group's variants. */
  group?: Record<string, FluentGroupVariant>;
  /**
   * An action's variants beyond `primary` / `secondary` / `link`, which
   * Fluent draws as its `primary` / `secondary` / `transparent` appearances.
   * A name given here for one of the three replaces it.
   */
  action?: Record<string, FluentActionVariant>;
}

const { Provider, useVariants } = createVariantsContext<FluentVariants>("FluentVariantsProvider");

/**
 * The props of {@link FluentVariantsProvider}.
 *
 * @group Theming
 */
export interface FluentVariantsProviderProps {
  /** Looks for this region, merged over any enclosing provider's. */
  variants: FluentVariants;
  /** The region. */
  children: ReactNode;
}

/**
 * Name the form's looks for Fluent, for a region of the app. Nests: a
 * variant given replaces the one of the same name above it. Pass a module
 * constant or a memoised object, so the region does not re-resolve every
 * render.
 *
 * @group Theming
 */
export function FluentVariantsProvider(props: FluentVariantsProviderProps): ReactNode {
  return <Provider {...props} />;
}

/** The variants in effect here. */
export const useFluentVariants: () => FluentVariants = useVariants;
