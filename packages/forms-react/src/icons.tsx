import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

/**
 * The icon names a form may use. An app declares the ones its icon set
 * draws, and a typo is then a compile error, as with {@link FormLooks}:
 *
 * ```ts
 * declare module "@rx-controls/forms-react" {
 *   interface FormIcons { "chevron-right": true; "circle-info": true }
 * }
 * ```
 *
 * With nothing declared, a name is any `string` — what the JSON loader and a
 * quick prototype use. The {@link ChromeIcon} names are always allowed, since
 * the implementations ask for them.
 *
 * @group Authoring
 */
export interface FormIcons {}

/**
 * The names an implementation asks for in its own chrome: the help button, the
 * date picker's button, a checkbox's tick, a disclosure's chevrons. Every
 * implementation's default set draws them (as the glyphs in
 * {@link chromeGlyph}), so a host's set restyles them by drawing the same
 * names. A theme may name any other icon for the same place.
 *
 * @group Implementations
 */
export type ChromeIcon =
  | "info"
  | "calendar"
  | "check"
  | "chevron-right"
  | "chevron-down"
  | "chevron-up";

const glyphs: Record<ChromeIcon, string> = {
  info: "\u24D8",
  calendar: "\u{1F4C5}",
  check: "\u2713",
  "chevron-right": "\u25B8",
  "chevron-down": "\u25BE",
  "chevron-up": "\u25B4",
};

/**
 * The character an implementation's default set draws a {@link ChromeIcon}
 * as, from the default family; `undefined` for any other name or family. A
 * default set draws only these, and nothing for a name it does not know.
 *
 * @group Implementations
 */
export function chromeGlyph(icon: IconRef): string | undefined {
  return icon.family === undefined && Object.hasOwn(glyphs, icon.name)
    ? glyphs[icon.name as ChromeIcon]
    : undefined;
}

/**
 * A name in {@link FormIcons}, or any string while none is declared.
 *
 * @group Authoring
 */
export type IconName =
  | (keyof FormIcons extends never ? string : keyof FormIcons & string)
  | ChromeIcon;

/**
 * An icon by name, with the family it belongs to. A family is the set's to
 * interpret — Font Awesome's `fa-regular` / `fa-solid`, Material's
 * `Material` — and a set that does not know it may draw the name from its
 * default family or decline. The JSON format's `IconReference` is this, its
 * `library` the family.
 *
 * @group Authoring
 */
export interface IconRef {
  /** The icon's name in its family: `chevron-right`, `circle-info`. */
  name: IconName;
  /** The family the name belongs to — absent for the default one, where the chrome names live. */
  family?: string;
}

/**
 * What an icon slot takes: an icon by name — `{ name: "check" }`,
 * `{ family: "fa-regular", name: "chevron-right" }` — drawn by the icon sets in
 * scope at the size and colour the look gives; or any node, placed as it is.
 * A string is words (a unit, `"@"`), styled as the icon's text, never a name.
 *
 * A node is given no size and no colour beyond what its text inherits, so on
 * React Native an element does not follow the look. Prefer a name.
 *
 * @group Authoring
 */
export type IconSpec = IconRef | ReactNode;

/**
 * Whether an icon slot holds an icon by name, rather than a node.
 *
 * @group Implementations
 */
export function isIconRef(icon: IconSpec): icon is IconRef {
  return (
    typeof icon === "object" &&
    icon !== null &&
    !isValidElement(icon) &&
    typeof (icon as { name?: unknown }).name === "string"
  );
}

/**
 * What a set is asked to draw: the icon, and the size and colour the
 * implementation resolved from the look, the tone and the theme around it —
 * the text style's `fontSize` and `color`, as legacy React Native's
 * `cssInterop` mapped them.
 *
 * On the web `size` and `color` may be left out, and the icon then follows
 * the CSS around it (`1em`, `currentColor`); React Native always passes both,
 * since nothing there inherits.
 *
 * @group Implementations
 */
export interface IconDrawArgs extends IconRef {
  /** The text size of the place, in logical units. */
  size?: number;
  /** The text colour of the place, a colour value. */
  color?: string;
}

/**
 * Draws icons by name. `undefined` declines — not this set's name or family —
 * and the next set out is asked, then the implementation's default set (its
 * glyphs). `null` draws nothing, on purpose.
 *
 * A set draws the icon only: it is not told whether the icon is decorative or
 * named, and adds no accessibility of its own — the implementation wraps it
 * (`aria-hidden`, or `role="img"` with an icon display's `accessibleName`).
 *
 * @group Authoring
 */
export type IconSet = (icon: IconDrawArgs) => ReactNode | undefined;

/**
 * `<FormIconsProvider set>`: an icon set for everything below it. Nested
 * providers are asked innermost first, falling through on `undefined`.
 *
 * @group Authoring
 */
export interface FormIconsProviderProps {
  /** The set, asked before the enclosing provider's. */
  set: IconSet;
  /** What it draws icons for. */
  children?: ReactNode;
}

const NO_SETS: readonly IconSet[] = [];
const IconSetsContext = createContext<readonly IconSet[]>(NO_SETS);

/**
 * An icon set for everything below, asked before the enclosing provider's.
 * Pass a stable function, so the region does not re-render every time.
 *
 * @group Authoring
 */
export function FormIconsProvider({ set, children }: FormIconsProviderProps): ReactNode {
  const parent = useContext(IconSetsContext);
  const sets = useMemo(() => [set, ...parent], [set, parent]);
  return <IconSetsContext.Provider value={sets}>{children}</IconSetsContext.Provider>;
}

/**
 * What an implementation calls to draw an icon slot: a name through the sets
 * in scope (innermost first, then `fallback`, the implementation's own default
 * set — given per call, so it can draw a glyph in the full text style of the
 * place), a node as it is — a string too, which the implementation still has
 * to put in its text element. `null` for no icon, or a name no set draws.
 *
 * @group Implementations
 */
export type DrawIcon = (
  icon: IconSpec,
  fallback: IconSet,
  style?: { size?: number; color?: string },
) => ReactNode;

/**
 * The {@link DrawIcon} for the icon sets in scope.
 *
 * @group Implementations
 */
export function useDrawIcon(): DrawIcon {
  const sets = useContext(IconSetsContext);
  return useCallback(
    (icon, fallback, style) => {
      if (!isIconRef(icon)) return icon;
      const args: IconDrawArgs = { name: icon.name, family: icon.family, ...style };
      for (const set of sets) {
        const drawn = set(args);
        if (drawn !== undefined) return drawn;
      }
      return fallback(args) ?? null;
    },
    [sets],
  );
}
