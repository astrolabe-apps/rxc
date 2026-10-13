import type { CSSProperties, ReactNode } from "react";
import type { ButtonProps, Theme, TypographyProps } from "@mui/material";
import { createLooksContext } from "@rx-controls/forms-html/shared";

/**
 * A style, or one computed from the MUI theme — what a group look gives
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
export interface MuiGroupLook {
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
export interface MuiLooks {
  /** A `TextDisplay`'s looks: props for MUI's `Typography`, over its own. */
  text?: Record<string, Pick<TypographyProps, "variant" | "color" | "sx">>;
  /** A group's looks: a style per element. */
  group?: Record<string, MuiGroupLook>;
  /**
   * An action's looks beyond `primary` / `secondary` / `link`, which MUI
   * draws as `contained` / `outlined` / `text`: props for MUI's `Button`. A
   * name given here for one of the three replaces it.
   */
  action?: Record<string, Pick<ButtonProps, "variant" | "color" | "size" | "sx">>;
  /** An `ImageDisplay`'s looks: a style on the image. */
  image?: Record<string, MuiStyle>;
  /** An `IconDisplay`'s looks: a style on the glyph, over its own size. */
  icon?: Record<string, MuiStyle>;
}

const { Provider, useLooks } = createLooksContext<MuiLooks>("MuiLooksProvider");

/**
 * The props of {@link MuiLooksProvider}.
 *
 * @group Theming
 */
export interface MuiLooksProviderProps {
  /** Looks for this region, merged over any enclosing provider's. */
  looks: MuiLooks;
  /** The region. */
  children: ReactNode;
}

/**
 * Name the form's looks for MUI, for a region of the app. Nests: a look
 * given replaces the one of the same name above it. Pass a module constant
 * or a memoised object, so the region does not re-resolve every render.
 *
 * @group Theming
 */
export function MuiLooksProvider(props: MuiLooksProviderProps): ReactNode {
  return <Provider {...props} />;
}

/** The looks in effect here. */
export const useMuiLooks: () => MuiLooks = useLooks;
