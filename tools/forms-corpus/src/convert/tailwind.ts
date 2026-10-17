import type { ClassLook, LookState, PortableStyle } from "@rx-controls/forms-react";

/** A native look part: a style, or a function of the element's state; `{ replace }` over the theme's own. */
export type NativePart =
  | PortableStyle
  | ((state: LookState) => PortableStyle)
  | { replace: PortableStyle | ((state: LookState) => PortableStyle) };
export type NativeLookOut = Partial<Record<keyof ClassLook, NativePart>>;

/**
 * Turning a legacy form's Tailwind (NativeWind) class strings into portable
 * styles — the converter's half that feeds the native looks table. It runs
 * offline, in tooling: the renderer never sees a class.
 *
 * It is a table of the utilities forms actually write, not a Tailwind
 * compiler: a token it does not know is reported once (development only) and
 * left out, which is the signal to add it here or to name it in the theme.
 *
 * - Spacing is Tailwind's scale (`gap-2` = 8) or an arbitrary value
 *   (`gap-[16px]` = 16, `p-[1rem]` = 16, `w-[50%]`). Whatever Tailwind writes in
 *   rem — the scale, the named text sizes and radii, `leading-N`, `[…rem]` — is
 *   at {@link TailwindOptions.rem}: NativeWind's is 14 on a device, so there
 *   `gap-2` is 7.
 * - Colours are theme tokens: `bg-accent` → `$accent`, `text-danger/10` →
 *   `$danger/10`; `[#E7E7E8]`, `white`, `black` and `transparent` are literal.
 * - Names that are not utilities (a host's typography classes — `body`,
 *   `title1`) come from {@link TailwindOptions.named}.
 * - Variants: `native:` applies, `web:` / `ios:` / `android:` by platform;
 *   `sm:` … `2xl:` and `min-[Npx]:` by the window's width, `active:`,
 *   `hover:`, `focus:`, `disabled:` by the element's state. A variant with no
 *   meaning on a device (`group-hover:`, an arbitrary selector) drops its
 *   utility. The `!` important marker is ignored: a look part already wins
 *   over the implementation's own — except against {@link TailwindOptions.base}.
 * - A merged part sits beside the host's own classes for that element
 *   ({@link TailwindOptions.base}), which on a device are the theme's. Where both
 *   set a property, CSS keeps the utility defined later in Tailwind's
 *   stylesheet, not the one written later — `flex-row` beside `flex-col` is a
 *   column — so the part gives way to a base utility that outranks it, unless
 *   it is `!important`.
 */
export interface TailwindOptions {
  /** `native` / `ios` / `android` apply; `web` does not. Default `native`. */
  platform?: "native" | "ios" | "android";
  /** Styles for class names that are not utilities, e.g. `body`, `title1`. */
  named?: Readonly<Record<string, PortableStyle>>;
  /** Called once per token that cannot be converted, with the reason. */
  onUnknown?: (token: string, why: string) => void;
  /**
   * The size of a rem in the host's renderer, which everything Tailwind
   * writes in rem scales by. Default 16, Tailwind's on the web; NativeWind
   * uses 14 on a device unless its `inlineRem` says otherwise.
   */
  rem?: number;
  /**
   * The classes the host's renderer itself gives the element this part
   * styles — ServiceTas's `layout.className` for the shell — which a merged
   * part sits beside. Not converted: the theme carries them. A property both
   * set is dropped from the part where the base utility comes later in
   * Tailwind's stylesheet. Leave it out for a `{ replace }` part.
   */
  base?: string;
}

const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };

/**
 * When a style holds, as data (so it can be written out as code): every
 * field present must be true. `minWidth` / `maxWidth` are the window's width
 * (`maxWidth` exclusive); the rest are {@link LookState} flags.
 */
export interface Cond {
  minWidth?: number;
  maxWidth?: number;
  pressed?: true;
  hovered?: true;
  focused?: true;
  disabled?: true;
  invalid?: true;
}

/** One converted token: its style, and the condition it holds under. */
export interface Piece {
  style: PortableStyle;
  when: Cond | undefined;
  /** The utility, with its variants and `!` gone. */
  utility?: string;
  /** Written with `!`. */
  important?: boolean;
  /** A host's own class ({@link TailwindOptions.named}): CSS's components layer, under every utility. */
  named?: boolean;
  /** Written with a variant (`native:`, `lg:`): later in Tailwind's stylesheet than the bare utility. */
  variant?: boolean;
}

/** Tailwind 3's own order for the flex-direction utilities (one `flexDirection` each). */
const DIRECTION_ORDER = ["flex-row", "flex-row-reverse", "flex-col", "flex-col-reverse"];

/**
 * Where a utility comes in Tailwind's stylesheet against another setting the
 * same property, when that is known: the flex directions by Tailwind's table;
 * two values of one utility (`gap-2`, `gap-[16px]`) by the scale, an arbitrary
 * value after every named one. `undefined` when the two cannot be ranked.
 */
function stylesheetOrder(a: string, b: string): number | undefined {
  const da = DIRECTION_ORDER.indexOf(a);
  const db = DIRECTION_ORDER.indexOf(b);
  if (da >= 0 && db >= 0) return da - db;
  const split = (u: string) => /^(-?[a-z-]+?)-(\[.+\]|[\d.]+|px)$/.exec(u);
  const ma = split(a);
  const mb = split(b);
  if (!ma || !mb || ma[1] !== mb[1]) return undefined;
  // Two arbitrary values: an order not checked against Tailwind, so not ranked.
  if (ma[2]!.startsWith("[") && mb[2]!.startsWith("[")) return undefined;
  const rank = (v: string) => (v.startsWith("[") ? Infinity : v === "px" ? 0.25 : Number(v));
  const d = rank(ma[2]!) - rank(mb[2]!);
  return Number.isNaN(d) ? undefined : d;
}

/** Does the condition hold in this state? */
export function holds(c: Cond | undefined, s: LookState): boolean {
  if (!c) return true;
  return (
    (c.minWidth === undefined || s.width >= c.minWidth) &&
    (c.maxWidth === undefined || s.width < c.maxWidth) &&
    (!c.pressed || s.pressed) &&
    (!c.hovered || s.hovered) &&
    (!c.focused || s.focused) &&
    (!c.disabled || s.disabled) &&
    (!c.invalid || s.invalid)
  );
}

const FONT_SIZES: Record<string, [number, number]> = {
  xs: [12, 16],
  sm: [14, 20],
  base: [16, 24],
  lg: [18, 28],
  xl: [20, 28],
  "2xl": [24, 32],
  "3xl": [30, 36],
  "4xl": [36, 40],
  "5xl": [48, 48],
  "6xl": [60, 60],
  "7xl": [72, 72],
  "8xl": [96, 96],
  "9xl": [128, 128],
};

const WEIGHTS: Record<string, NonNullable<PortableStyle["fontWeight"]>> = {
  thin: "100",
  extralight: "200",
  light: "300",
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
  black: "900",
};

/** The size of a rem, as a factor of Tailwind's 16, while a class string converts. */
let remFactor = 1;
const rem = (n: number) => n * remFactor;

const RADII: Record<string, number> = {
  none: 0,
  sm: 2,
  "": 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  full: 9999,
};

const SHADOWS: Record<string, string> = {
  sm: "0 1px 2px 0 rgba(0,0,0,0.05)",
  "": "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",
  md: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
  lg: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
  xl: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
  "2xl": "0 25px 50px -12px rgba(0,0,0,0.25)",
  none: "none",
};

/**
 * Utilities with no meaning for layout or look on a device, dropped silently — and an icon
 * font's classes (`fa`, `fa-regular fa-gear`), which name a glyph the icon sets draw, not a style.
 */
const IGNORED =
  /^(@|fa|fa-.+|group|peer|text-nowrap|text-wrap|whitespace-.+|truncate|cursor-.+|select-.+|transition.*|duration-.+|ease-.+|pointer-events-.+|outline.*|ring.*|sr-only|appearance-.+|resize.*|list-.+|break-.+|align-.+|object-.+|decoration-.+|underline-offset-.+|animate-.+|web:.+|content-.+)$/;

const SIDES: Record<string, string[]> = {
  "": [""],
  x: ["Left", "Right"],
  y: ["Top", "Bottom"],
  t: ["Top"],
  r: ["Right"],
  b: ["Bottom"],
  l: ["Left"],
  s: ["Left"],
  e: ["Right"],
};

/** A spacing / size value: the scale, an arbitrary `[…]`, a fraction or a keyword. */
function length(v: string): number | `${number}%` | "auto" | undefined {
  if (v === "auto") return "auto";
  if (v === "full") return "100%";
  if (v === "px") return 1;
  if (/^\d+(\.\d+)?$/.test(v)) return rem(Number(v) * 4);
  const frac = /^(\d+)\/(\d+)$/.exec(v);
  if (frac) return `${(Number(frac[1]) / Number(frac[2])) * 100}%` as `${number}%`;
  const arb = /^\[(-?\d+(?:\.\d+)?)(px|rem|%)?\]$/.exec(v);
  if (arb) {
    const n = Number(arb[1]);
    return arb[2] === "%" ? (`${n}%` as `${number}%`) : arb[2] === "rem" ? rem(n * 16) : n;
  }
  return undefined;
}

const num = (v: string): number | undefined => {
  const l = length(v);
  return typeof l === "number" ? l : undefined;
};

/** A colour: `[#hex]`, a keyword, or a theme token with an optional `/alpha`. */
function color(v: string): string | undefined {
  if (v === "white") return "#ffffff";
  if (v === "black") return "#000000";
  if (v === "transparent") return "transparent";
  const hex = /^\[(#[0-9a-fA-F]{3,8})\](?:\/(\d+))?$/.exec(v);
  if (hex) {
    if (hex[2] === undefined) return hex[1];
    return hex[1] + Math.round((Number(hex[2]) / 100) * 255).toString(16).padStart(2, "0");
  }
  if (/^[a-zA-Z][a-zA-Z0-9-]*(\/\d+)?$/.test(v)) return `$${v}`;
  return undefined;
}

/** One utility, without variants, as a style — or the reason it cannot be. */
function utility(
  u: string,
  named: Readonly<Record<string, PortableStyle>>,
): PortableStyle | string | null {
  if (u in named) return named[u];
  if (IGNORED.test(u)) return null;
  let m: RegExpExecArray | null;
  const exact: Record<string, PortableStyle> = {
    // NativeWind's `.flex` is `display: flex` alone: on a device the direction stays React
    // Native's column (LinkMastWizard's "@ flex gap-[16px]" stacks its buttons in the app).
    flex: { display: "flex" },
    hidden: { display: "none" },
    "flex-row": { flexDirection: "row" },
    "flex-col": { flexDirection: "column" },
    "flex-row-reverse": { flexDirection: "row-reverse" },
    "flex-col-reverse": { flexDirection: "column-reverse" },
    "flex-wrap": { flexWrap: "wrap" },
    "flex-nowrap": { flexWrap: "nowrap" },
    "flex-wrap-reverse": { flexWrap: "wrap-reverse" },
    "flex-1": { flex: 1 },
    "flex-auto": { flexGrow: 1, flexShrink: 1 },
    "flex-none": { flexGrow: 0, flexShrink: 0 },
    "flex-grow": { flexGrow: 1 },
    grow: { flexGrow: 1 },
    "flex-shrink": { flexShrink: 1 },
    shrink: { flexShrink: 1 },
    "flex-shrink-0": { flexShrink: 0 },
    "shrink-0": { flexShrink: 0 },
    "flex-grow-0": { flexGrow: 0 },
    "grow-0": { flexGrow: 0 },
    "items-start": { alignItems: "flex-start" },
    "items-end": { alignItems: "flex-end" },
    "items-center": { alignItems: "center" },
    "items-stretch": { alignItems: "stretch" },
    "items-baseline": { alignItems: "baseline" },
    "justify-start": { justifyContent: "flex-start" },
    "justify-end": { justifyContent: "flex-end" },
    "justify-center": { justifyContent: "center" },
    "justify-between": { justifyContent: "space-between" },
    "justify-around": { justifyContent: "space-around" },
    "justify-evenly": { justifyContent: "space-evenly" },
    "self-auto": { alignSelf: "auto" },
    "self-start": { alignSelf: "flex-start" },
    "self-end": { alignSelf: "flex-end" },
    "self-center": { alignSelf: "center" },
    "self-stretch": { alignSelf: "stretch" },
    "self-baseline": { alignSelf: "baseline" },
    absolute: { position: "absolute" },
    relative: { position: "relative" },
    "overflow-hidden": { overflow: "hidden" },
    "overflow-visible": { overflow: "visible" },
    "overflow-scroll": { overflow: "scroll" },
    italic: { fontStyle: "italic" },
    "not-italic": { fontStyle: "normal" },
    underline: { textDecorationLine: "underline" },
    "line-through": { textDecorationLine: "line-through" },
    "no-underline": { textDecorationLine: "none" },
    uppercase: { textTransform: "uppercase" },
    lowercase: { textTransform: "lowercase" },
    capitalize: { textTransform: "capitalize" },
    "normal-case": { textTransform: "none" },
    "text-left": { textAlign: "left" },
    "text-center": { textAlign: "center" },
    "text-right": { textAlign: "right" },
    "text-justify": { textAlign: "justify" },
    border: { borderWidth: 1 },
    "border-solid": { borderStyle: "solid" },
    "border-dashed": { borderStyle: "dashed" },
    "border-dotted": { borderStyle: "dotted" },
    "border-0": { borderWidth: 0 },
    "aspect-square": { aspectRatio: 1 },
    "aspect-video": { aspectRatio: 16 / 9 },
  };
  if (u in exact) return exact[u];

  // gap
  if ((m = /^gap(?:-([xy]))?-(.+)$/.exec(u))) {
    const n = num(m[2]);
    if (n === undefined) return "an unknown gap";
    return m[1] === "x" ? { columnGap: n } : m[1] === "y" ? { rowGap: n } : { gap: n };
  }
  // padding / margin
  if ((m = /^(-?)(p|m)([xytrblse]?)-(.+)$/.exec(u))) {
    const l = length(m[4]);
    if (l === undefined || (m[2] === "p" && l === "auto")) return "an unknown spacing value";
    const value = m[1] && typeof l === "number" ? -l : l;
    const prop = m[2] === "p" ? "padding" : "margin";
    const out: Record<string, unknown> = {};
    if (m[3] === "x" || m[3] === "y") out[`${prop}${m[3] === "x" ? "Horizontal" : "Vertical"}`] = value;
    else for (const side of SIDES[m[3]]) out[`${prop}${side}`] = value;
    return out as PortableStyle;
  }
  // sizes
  if ((m = /^(w|h|min-w|min-h|max-w|max-h|size)-(.+)$/.exec(u))) {
    const l = length(m[2]);
    if (l === undefined) return m[2] === "screen" ? "no viewport units" : "an unknown size";
    if (m[1] === "size") return { width: l, height: l };
    const prop = {
      w: "width",
      h: "height",
      "min-w": "minWidth",
      "min-h": "minHeight",
      "max-w": "maxWidth",
      "max-h": "maxHeight",
    }[m[1]]!;
    if (l === "auto" && !/^(w|h)$/.test(m[1])) return "auto is not a minimum or maximum";
    return { [prop]: l } as PortableStyle;
  }
  // inset
  if ((m = /^(inset|top|right|bottom|left)-(.+)$/.exec(u))) {
    const l = length(m[2]);
    if (l === undefined || l === "auto") return "an unknown offset";
    if (m[1] === "inset") return { top: l, right: l, bottom: l, left: l };
    return { [m[1]]: l } as PortableStyle;
  }
  if ((m = /^z-(?:(\d+)|\[(\d+)\])$/.exec(u))) return { zIndex: Number(m[1] ?? m[2]) };
  if ((m = /^opacity-(\d+)$/.exec(u))) return { opacity: Number(m[1]) / 100 };
  // borders
  if ((m = /^border-([trblxy])(?:-(\d+))?$/.exec(u))) {
    const w = m[2] === undefined ? 1 : Number(m[2]);
    const sides =
      m[1] === "x" ? ["Left", "Right"] : m[1] === "y" ? ["Top", "Bottom"] : SIDES[m[1]];
    return Object.fromEntries(sides.map((s) => [`border${s}Width`, w])) as PortableStyle;
  }
  if ((m = /^border-(\d+)$/.exec(u))) return { borderWidth: Number(m[1]) };
  if ((m = /^border-(.+)$/.exec(u))) {
    const c = color(m[1]);
    if (c) return { borderColor: c };
  }
  // radius
  if ((m = /^rounded(?:-(t|r|b|l|tl|tr|bl|br))?(?:-(.+))?$/.exec(u))) {
    const key = m[2] ?? "";
    const r = key in RADII ? (key === "none" || key === "full" ? RADII[key] : rem(RADII[key]!)) : num(key);
    if (r === undefined) return "an unknown radius";
    const corners: Record<string, string[]> = {
      "": ["borderRadius"],
      t: ["borderTopLeftRadius", "borderTopRightRadius"],
      r: ["borderTopRightRadius", "borderBottomRightRadius"],
      b: ["borderBottomLeftRadius", "borderBottomRightRadius"],
      l: ["borderTopLeftRadius", "borderBottomLeftRadius"],
      tl: ["borderTopLeftRadius"],
      tr: ["borderTopRightRadius"],
      bl: ["borderBottomLeftRadius"],
      br: ["borderBottomRightRadius"],
    };
    return Object.fromEntries(corners[m[1] ?? ""].map((k) => [k, r])) as PortableStyle;
  }
  // shadow
  if ((m = /^shadow(?:-(.+))?$/.exec(u))) {
    const key = m[1] ?? "";
    if (key in SHADOWS) return { boxShadow: SHADOWS[key] };
  }
  // text: size, then colour
  if ((m = /^text-(.+)$/.exec(u))) {
    const v = m[1];
    if (v in FONT_SIZES) return { fontSize: rem(FONT_SIZES[v][0]), lineHeight: rem(FONT_SIZES[v][1]) };
    const arb = /^\[(\d+(?:\.\d+)?)(px|rem)?\]$/.exec(v);
    if (arb) return { fontSize: arb[2] === "rem" ? rem(Number(arb[1]) * 16) : Number(arb[1]) };
    const c = color(v);
    if (c) return { color: c };
  }
  if ((m = /^font-(.+)$/.exec(u)) && m[1] in WEIGHTS) return { fontWeight: WEIGHTS[m[1]] };
  if ((m = /^leading-(.+)$/.exec(u))) {
    const n = /^\d+$/.test(m[1]) ? rem(Number(m[1]) * 4) : num(m[1]);
    if (n !== undefined) return { lineHeight: n };
  }
  if ((m = /^tracking-(.+)$/.exec(u))) {
    const em: Record<string, number> = { tighter: -0.8, tight: -0.4, normal: 0, wide: 0.4, wider: 0.8, widest: 1.6 };
    if (m[1] in em) return { letterSpacing: em[m[1]] };
    const n = num(m[1]);
    if (n !== undefined) return { letterSpacing: n };
  }
  // background
  if ((m = /^bg-(.+)$/.exec(u))) {
    const c = color(m[1]);
    if (c) return { backgroundColor: c };
  }
  return "an unknown utility";
}

/** What a variant prefix means: a condition, `true` always, `false` never. */
function variant(v: string, platform: string): Cond | boolean | undefined {
  if (v === "native") return platform !== "web";
  if (v === "web") return false;
  if (v === "ios" || v === "android") return platform === v;
  if (v in BREAKPOINTS) return { minWidth: BREAKPOINTS[v] };
  const min = /^min-\[(\d+)px\]$/.exec(v);
  if (min) return { minWidth: Number(min[1]) };
  const max = /^max-\[(\d+)px\]$/.exec(v);
  if (max) return { maxWidth: Number(max[1]) };
  if (v === "active") return { pressed: true };
  if (v === "hover") return { hovered: true };
  if (v === "focus" || v === "focus-within") return { focused: true };
  if (v === "disabled") return { disabled: true };
  if (v === "invalid" || v === "aria-invalid") return { invalid: true };
  return undefined;
}

function convertToken(
  token: string,
  o: { platform: string; named: Readonly<Record<string, PortableStyle>> },
  bad: (why: string) => void,
): Piece | undefined {
  const parts = token.split(/:(?![^[]*\])/);
  let utilityName = parts.pop()!.replace(/^!/, "");
  let when: Cond | undefined;
  for (const v of parts) {
    const r = variant(v, o.platform);
    if (r === undefined) {
      bad(`the variant "${v}" has no meaning on a device`);
      return undefined;
    }
    if (r === false) return undefined;
    if (r !== true) {
      when = { ...when, ...r };
      // two widths together: the narrower window of the two bounds
      if (when.minWidth !== undefined && r.minWidth !== undefined)
        when.minWidth = Math.max(when.minWidth, r.minWidth);
    }
  }
  const important = token.split(/:(?![^[]*\])/).pop()!.startsWith("!");
  if (utilityName.startsWith("-") && !/^-[pm]/.test(utilityName)) utilityName = utilityName.slice(1);
  const style = utility(utilityName.replace(/^!/, ""), o.named);
  if (style === null) return undefined;
  if (typeof style === "string") {
    bad(style);
    return undefined;
  }
  return {
    style,
    when,
    utility: utilityName.replace(/^!/, ""),
    important,
    named: utilityName.replace(/^!/, "") in o.named,
    variant: parts.length > 0,
  };
}

/** The classes as pieces, in the order written: each token's style and when it holds. */
export function tailwindPieces(classes: string, options: TailwindOptions = {}): Piece[] {
  const o = { platform: options.platform ?? "native", named: options.named ?? {} };
  const pieces: Piece[] = [];
  const outer = remFactor;
  remFactor = (options.rem ?? 16) / 16;
  try {
    for (const token of classes.split(/\s+/).filter(Boolean)) {
      const piece = convertToken(token, o, (why) => options.onUnknown?.(token, why));
      if (piece) pieces.push(piece);
    }
  } finally {
    remFactor = outer;
  }
  // CSS's precedence, not the order written (a look's classes come canonically sorted): the
  // host's own classes are its components layer, under every utility, and an `!important`
  // utility over the rest — `body-bold !text-accent` is the accent whichever comes first.
  // Within a layer, a variant's utility after the bare one, as Tailwind writes the stylesheet:
  // `pl-[16px] native:pl-[8px]` is 8 on a device whichever is written first.
  const layer = (p: Piece) => (p.important ? 2 : p.named ? 0 : 1);
  pieces.sort((a, b) => layer(a) - layer(b) || Number(!!a.variant) - Number(!!b.variant));
  return options.base ? givingWay(pieces, tailwindPieces(options.base, { ...options, base: undefined, onUnknown: undefined })) : pieces;
}

/** CSS's layers: the host's own classes (components), then utilities, then `!important` ones. */
const layerOf = (p: Piece) => (p.important ? 2 : p.named ? 0 : 1);

/**
 * The pieces, less each property the base outranks: a base class in a higher layer (a utility
 * over a host class, an important one over either), or in the same layer later in Tailwind's
 * stylesheet.
 */
function givingWay(pieces: Piece[], base: Piece[]): Piece[] {
  return pieces.map((p) => {
    if (p.when || !p.utility) return p;
    const style = { ...p.style } as Record<string, unknown>;
    for (const b of base) {
      if (b.when || !b.utility) continue;
      const above = layerOf(b) > layerOf(p);
      const later = layerOf(b) === layerOf(p) && (stylesheetOrder(b.utility, p.utility!) ?? 0) > 0;
      if (above || later) for (const k of Object.keys(b.style)) delete style[k];
    }
    return { ...p, style: style as PortableStyle };
  });
}

/**
 * The classes as a native look part: a style when no token depends on state
 * or the window, otherwise a function of {@link LookState} layering each token
 * that holds.
 */
export function tailwindToPart(classes: string, options: TailwindOptions = {}): NativePart {
  const pieces = tailwindPieces(classes, options);
  if (pieces.every((p) => !p.when)) return Object.assign({}, ...pieces.map((p) => p.style)) as PortableStyle;
  return (state: LookState) =>
    Object.assign({}, ...pieces.filter((p) => holds(p.when, state)).map((p) => p.style)) as PortableStyle;
}

/** A form's class look as a native look: every part converted. */
export function tailwindToLook(look: ClassLook, options: TailwindOptions = {}): NativeLookOut {
  const out: Record<string, NativePart> = {};
  for (const [part, value] of Object.entries(look)) {
    if (value === undefined) continue;
    if (typeof value === "object" && "replace" in value)
      out[part] = { replace: tailwindToPart(String(value.replace), options) as never };
    else out[part] = tailwindToPart(String(value), options);
  }
  return out as NativeLookOut;
}

const condExpr = (c: Cond): string =>
  [
    c.minWidth !== undefined && `s.width >= ${c.minWidth}`,
    c.maxWidth !== undefined && `s.width < ${c.maxWidth}`,
    c.pressed && "s.pressed",
    c.hovered && "s.hovered",
    c.focused && "s.focused",
    c.disabled && "s.disabled",
    c.invalid && "s.invalid",
  ]
    .filter(Boolean)
    .join(" && ");

/**
 * The classes as JavaScript source for a native look part: an object literal
 * when no token depends on state, else `(s) => ({ …base, …(cond ? {…} : {}) })`.
 * What the generated looks module is made of.
 */
export function tailwindPartCode(classes: string, options: TailwindOptions = {}): string {
  const pieces = tailwindPieces(classes, options);
  if (pieces.every((p) => !p.when)) return JSON.stringify(Object.assign({}, ...pieces.map((p) => p.style)));
  const spreads = pieces.map((p) =>
    p.when ? `...(${condExpr(p.when)} ? ${JSON.stringify(p.style)} : {})` : `...${JSON.stringify(p.style)}`,
  );
  return `(s) => ({ ${spreads.join(", ")} })`;
}
