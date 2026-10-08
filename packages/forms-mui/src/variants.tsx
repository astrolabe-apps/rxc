import type { CSSProperties, ReactNode } from "react";
import type { ButtonProps, Theme, TypographyProps } from "@mui/material";
import { createVariantsContext } from "@rx-controls/forms-html/shared";

/**
 * A style, or one computed from the MUI theme — what a group variant gives
 * each of its elements.
 *
 * @group Theming
 */
export type MuiStyle = CSSProperties | ((theme: Theme) => CSSProperties);

/**
 * A group's named look: a style for each of its elements.
 *
 * @group Theming
 */
export interface MuiGroupVariant {
  /** The wrapper around title and body. */
  wrapper?: MuiStyle;
  /** The title. */
  title?: MuiStyle;
  /** The body. */
  body?: MuiStyle;
}

/**
 * What the form's named looks are under MUI — the form names a role
 * ("lead", "card", "quiet"), and this says what MUI draws for it.
 *
 * @group Theming
 */
export interface MuiVariants {
  /** A `TextDisplay`'s variants: props for MUI's `Typography`, over its own. */
  text?: Record<string, Pick<TypographyProps, "variant" | "color" | "sx">>;
  /** A group's variants: a style per element. */
  group?: Record<string, MuiGroupVariant>;
  /**
   * An action's variants beyond `primary` / `secondary` / `link`, which MUI
   * draws as `contained` / `outlined` / `text`: props for MUI's `Button`. A
   * name given here for one of the three replaces it.
   */
  action?: Record<string, Pick<ButtonProps, "variant" | "color" | "size" | "sx">>;
}

const { Provider, useVariants } = createVariantsContext<MuiVariants>("MuiVariantsProvider");

/**
 * The props of {@link MuiVariantsProvider}.
 *
 * @group Theming
 */
export interface MuiVariantsProviderProps {
  /** Looks for this region, merged over any enclosing provider's. */
  variants: MuiVariants;
  /** The region. */
  children: ReactNode;
}

/**
 * Name the form's looks for MUI, for a region of the app. Nests: a variant
 * given replaces the one of the same name above it. Pass a module constant
 * or a memoised object, so the region does not re-resolve every render.
 *
 * @group Theming
 */
export function MuiVariantsProvider(props: MuiVariantsProviderProps): ReactNode {
  return <Provider {...props} />;
}

/** The variants in effect here. */
export const useMuiVariants: () => MuiVariants = useVariants;
