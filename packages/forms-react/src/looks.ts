/**
 * A name an implementation's theme resolves to its own styling — the
 * contract's whole say in how a boundary looks (`docs/FORMS-V2-LOOKS.md`).
 *
 * An app declares the names it has once, and a typo is then a compile error:
 *
 * ```ts
 * declare module "@rx-controls/forms-react" {
 *   interface FormLooks { card: true; compact: true }
 * }
 * ```
 *
 * With nothing declared, a look is any `string` — what the JSON loader and a
 * quick prototype use.
 *
 * @group Authoring
 */
export interface FormLooks {}

/**
 * The names a form may use for a look: the keys of {@link FormLooks}, or any
 * string while none is declared.
 *
 * @group Authoring
 */
export type LookName = keyof FormLooks extends never ? string : keyof FormLooks & string;

/**
 * One look or several. A list is layered in order — a later look over an
 * earlier — so an action can be `["primary", "wide"]`: the emphasis every
 * theme draws, and a look of the form's own over it.
 *
 * @group Implementations
 */
export type LookRef = string | readonly string[];

/**
 * The names in a {@link LookRef}, in layering order.
 *
 * @group Implementations
 */
export function lookNames(look: LookRef | undefined): readonly string[] {
  return look === undefined ? [] : typeof look === "string" ? [look] : look;
}

/** A length: a number is a logical unit (React Native's, and CSS's reference pixel). */
type Length = number | `${number}%`;

/**
 * The CSS that means the same on the web and on React Native: what a boundary's
 * `style` and `shellStyle` accept, and what an implementation may be handed
 * for a look it draws from portable CSS.
 *
 * The rule is React Native's own `style` semantics, which `react-native-web`
 * already implements: a number is a logical unit, a string a `%` or a colour,
 * `lineHeight` a length. Not in it, because it does not mean the same on both:
 * grid, selectors, media queries, `:hover`, `calc()`, `var()`, `whiteSpace`,
 * `display: block`.
 *
 * A colour is a literal, or a theme token as `$name` (`$accent`, `$danger/10`
 * for a tint) that the implementation's theme resolves.
 *
 * Text properties (`color`, `fontSize` …) follow the words: where the platform
 * does not cascade text style from a container, the implementation puts them
 * on the text — see {@link splitPortableStyle}.
 *
 * @group Authoring
 */
export interface PortableStyle {
  // flex layout
  display?: "flex" | "none";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: Length | "auto";
  alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  alignContent?: "flex-start" | "flex-end" | "center" | "stretch" | "space-between" | "space-around";
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  // box
  width?: Length | "auto";
  height?: Length | "auto";
  minWidth?: Length;
  minHeight?: Length;
  maxWidth?: Length;
  maxHeight?: Length;
  margin?: Length | "auto";
  marginTop?: Length | "auto";
  marginRight?: Length | "auto";
  marginBottom?: Length | "auto";
  marginLeft?: Length | "auto";
  marginHorizontal?: Length | "auto";
  marginVertical?: Length | "auto";
  padding?: Length;
  paddingTop?: Length;
  paddingRight?: Length;
  paddingBottom?: Length;
  paddingLeft?: Length;
  paddingHorizontal?: Length;
  paddingVertical?: Length;
  aspectRatio?: number;
  overflow?: "visible" | "hidden" | "scroll";
  position?: "relative" | "absolute";
  top?: Length;
  right?: Length;
  bottom?: Length;
  left?: Length;
  zIndex?: number;
  // surface
  backgroundColor?: string;
  opacity?: number;
  borderWidth?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderColor?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderStyle?: "solid" | "dotted" | "dashed";
  borderRadius?: number;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
  boxShadow?: string;
  // text
  color?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  fontStyle?: "normal" | "italic";
  fontFamily?: string;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: "left" | "right" | "center" | "justify";
  textDecorationLine?: "none" | "underline" | "line-through" | "underline line-through";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
}

/** The properties of {@link PortableStyle} that style words, not boxes. */
const TEXT_KEYS: ReadonlySet<string> = new Set([
  "color",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontFamily",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecorationLine",
  "textTransform",
]);

/**
 * Split a {@link PortableStyle} into what styles the container and what
 * styles the words. For an implementation whose text does not inherit from
 * its container (React Native): the box properties go on the `View`, the text
 * properties on the `Text` inside it. On the web the two stay together.
 *
 * @group Implementations
 */
export function splitPortableStyle(style: PortableStyle | undefined): {
  box: PortableStyle;
  text: PortableStyle;
} {
  const box: Record<string, unknown> = {};
  const text: Record<string, unknown> = {};
  if (style)
    for (const [k, v] of Object.entries(style)) (TEXT_KEYS.has(k) ? text : box)[k] = v;
  return { box, text };
}

/**
 * What an implementation's look can depend on at the moment it is drawn.
 * State is data passed in, so a look never needs a variant a platform lacks
 * (`:active` on the web, a pressed callback on a device) — and a look that
 * wants a layout per screen size reads `width` rather than naming a
 * breakpoint:
 *
 * ```ts
 * control: (s) => ({ flexDirection: s.width >= 1024 ? "row" : "column" })
 * ```
 *
 * An implementation tracks `pressed`, `hovered` and `width` only for a look
 * part that is a function, so a look that asks for nothing costs nothing.
 *
 * @group Implementations
 */
export interface LookState {
  invalid: boolean;
  disabled: boolean;
  focused: boolean;
  /** The element is being pressed (a button held down). */
  pressed: boolean;
  /** A pointer is over the element. Never on a device with no pointer. */
  hovered: boolean;
  /**
   * The window's width, in logical units. `0` where it is not known — a
   * server render — so a look drawn there is the narrowest one, and a client
   * render that knows better replaces it after hydration.
   */
  width: number;
}

/** A state with nothing set. */
export const NO_LOOK_STATE: LookState = {
  invalid: false,
  disabled: false,
  focused: false,
  pressed: false,
  hovered: false,
  width: 0,
};

declare const process: { env: { NODE_ENV?: string } } | undefined;
// The literal `process.env.NODE_ENV`, so bundlers fold it (see CLAUDE.md).
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const warnedLooks = new Set<string>();

/**
 * Report a `look` an implementation's theme does not name, once per kind and
 * name, in development only. What every implementation calls when it draws
 * the base look instead.
 *
 * @param kind - what carries it: `field`, `group`, `action`, `display`
 * @param look - the name the form used
 * @group Implementations
 */
export function warnUnknownLook(kind: string, look: string): void {
  if (!IS_DEV) return;
  const key = kind + "\u0000" + look;
  if (warnedLooks.has(key)) return;
  warnedLooks.add(key);
  console.warn(
    `Forms v2: no ${kind} look "${look}" in this implementation's theme; drawing the base look. Name it in the theme's looks.`,
  );
}

const COLOR_KEYS: ReadonlySet<string> = new Set([
  "backgroundColor",
  "color",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
]);

const reportedColors = new Set<string>();

/** `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` and an alpha 0–1, as `rgba()`. */
function withAlpha(hex: string, alpha: number): string | undefined {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex);
  if (!m) return undefined;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  const a = h.length === 8 ? (n(6) / 255) * alpha : alpha;
  return `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${Math.round(a * 1000) / 1000})`;
}

/**
 * A colour in a {@link PortableStyle}: a literal as it is, or a theme token —
 * `$accent`, and `$accent/10` for that colour at 10% (a `#rgb` / `#rrggbb`
 * token) — resolved from the theme's `colors`. A token the theme lacks is
 * reported once, in development, and the colour left out (`undefined`).
 *
 * @group Implementations
 */
export function resolveColor(
  value: string,
  colors: Record<string, string>,
): string | undefined {
  if (!value.startsWith("$")) return value;
  const [name, tint] = value.slice(1).split("/");
  const base = colors[name];
  if (base === undefined) {
    if (IS_DEV && !reportedColors.has(name)) {
      reportedColors.add(name);
      console.warn(
        `Forms v2: no colour token "$${name}" in the theme's tokens.colors; the colour is left out.`,
      );
    }
    return undefined;
  }
  if (tint === undefined) return base;
  return withAlpha(base, Number(tint) / 100) ?? base;
}

/**
 * A {@link PortableStyle} with its colour tokens resolved against `colors`.
 *
 * @group Implementations
 */
export function resolveStyleTokens(
  style: PortableStyle,
  colors: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(style)) {
    if (COLOR_KEYS.has(k) && typeof v === "string") {
      const c = resolveColor(v, colors);
      if (c !== undefined) out[k] = c;
    } else out[k] = v;
  }
  return out;
}
