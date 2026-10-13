/*
 * The DOM building blocks the html implementation draws with that are not
 * html-specific: a region, an inline group, the chrome-less collection, the
 * wrapper a display sits in, and the no-transition visibility slot. Also on
 * the `@rx-controls/forms-html/shared` subpath, for sibling implementations
 * (forms-mui, forms-antd) that draw these parts as plain DOM too. Not public
 * API: no semver promise, and not in the generated reference.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import {
  combineClass,
  describedBy,
  fieldRequiredId,
  useFieldShell,
  type ClassValue,
  type CollectionRenderProps,
  type FormElementProps,
  type GroupRenderProps,
  type FlexLayout,
  type Tone,
  type VisibilityProps,
  warnUnknownLook,
  lookNames,
  useFormLooks,
  type LookRef,
  type PortableStyle,
  type LookState,
  NO_LOOK_STATE,
  resolveStyleTokens,
  splitPortableStyle,
  drawRichText,
  type RichTextParts,
  type RichTextRenderProps,
  type ImageDisplayRenderProps,
  getProp,
} from "@rx-controls/forms-react";
import { useReactive } from "@rx-controls/react";
import {
  defaultHtmlTheme,
  useHtmlTheme,
  type HtmlLookPart,
  type HtmlLook,
  type HtmlTheme,
} from "./theme.js";

/**
 * A `visibility` slot that mounts and unmounts at once, with no transition.
 *
 * @group Rendering
 */
export function DefaultVisibility({ visible, children }: VisibilityProps) {
  return visible ? <>{children}</> : null;
}

/**
 * The `form` slot: a `<form>`, so Enter in a field presses the form's
 * default button (an `<Action submit>`, drawn `type="submit"`, whose click
 * runs the submission and stops the native one). It adds no layout —
 * `display: contents` — and never submits natively. A submit event with no
 * submitter — a single-field form's Enter, a `requestSubmit()` — runs the
 * form's submission; one with a submitter is a stray `<button>` with no
 * `type` (which defaults to submit) and is only stopped. `noValidate`, so the
 * browser's own constraint bubbles never pre-empt the form's validation.
 *
 * @group Rendering
 */
export function FormElement({ onSubmit, children }: FormElementProps) {
  return (
    <form
      noValidate
      style={{ display: "contents" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!(e.nativeEvent as SubmitEvent).submitter) onSubmit();
      }}
    >
      {children}
    </form>
  );
}

/**
 * A `visibility` slot that holds its content mounted for the length of the
 * exit transition — the reason `visibility` is a slot rather than a ternary.
 * The wrapper is the theme's `visibility.fade`, marked `data-leaving` while
 * it leaves; with no CSS for it the content simply stays up that long. The
 * default in {@link htmlRenderers}.
 *
 * @group Rendering
 */
export function FadeVisibility({ visible, children }: VisibilityProps) {
  const [mounted, setMounted] = useState(visible);
  const last = useRef(children);
  if (visible) last.current = children;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [visible]);

  const fade = useHtmlTheme().visibility.fade;
  if (!visible && !mounted) return null;
  return (
    <div className={fade} data-leaving={visible ? undefined : ""}>
      {visible ? children : last.current}
    </div>
  );
}

/**
 * A group look as styles, per element — what an implementation whose looks
 * are runtime tokens (MUI, Ant, Fluent) resolves a look to.
 */
export interface GroupLookStyle {
  /** On the wrapper around title and body. */
  wrapper?: CSSProperties;
  /** On the title. */
  title?: CSSProperties;
  /** On the body. */
  body?: CSSProperties;
}

/** Two styles, the second over the first; `undefined` when neither. */
function withStyle(
  a: CSSProperties | undefined,
  b: CSSProperties | undefined,
): CSSProperties | undefined {
  return a && b ? { ...a, ...b } : (a ?? b);
}

/** A look's parts as ordered layers: each part's value from every look named, earliest first. */
export type LayeredLook = { [P in LookPartName]?: HtmlLookPart[] };

/** The parts of a look. */
export type LookPartName = keyof HtmlLook;

const LOOK_PARTS: readonly LookPartName[] = [
  "shell",
  "control",
  "text",
  "label",
  "labelText",
  "icon",
  "entry",
  "selected",
  "notSelected",
];

/**
 * A look's parts, from the theme's `looks` (the form's under them), for the
 * boundary `kind` — `undefined` for no look. A list of names is layered
 * earliest first, part by part. A name the theme does not know is reported
 * once in development, unless `styled`: the implementation resolves it to
 * styles of its own.
 */
export function lookParts(
  kind: string,
  look: LookRef | undefined,
  looks: HtmlTheme["looks"],
  styled?: boolean,
): LayeredLook | undefined {
  let layered: LayeredLook | undefined;
  for (const name of lookNames(look)) {
    const parts = looks[name];
    if (!parts) {
      if (!styled) warnUnknownLook(kind, name);
      continue;
    }
    layered ??= {};
    for (const k of LOOK_PARTS) {
      const v = parts[k];
      if (v !== undefined) (layered[k] ??= []).push(v);
    }
  }
  return layered;
}

/**
 * The entry for the last of a look's names that `table` holds, without a word
 * about the rest. A library implementation's looks are its own props, which
 * do not layer the way classes do, so the later look wins whole.
 */
export function pickLook<T>(
  look: LookRef | undefined,
  table: Record<string, T> | undefined,
): T | undefined {
  let found: T | undefined;
  for (const name of lookNames(look)) {
    const v = table?.[name];
    if (v !== undefined) found = v;
  }
  return found;
}

/**
 * {@link pickLook}, reporting in development each name that none of `table`,
 * `understood` (the three emphases an action always draws) or the looks the
 * form brought with it (`useFormLooks`) knows. A form's own looks are classes,
 * which a library implementation cannot draw — but it is not a mistake that it
 * does not.
 */
export function useLastLook<T>(
  kind: string,
  look: LookRef | undefined,
  table: Record<string, T> | undefined,
  understood?: (name: string) => boolean,
): T | undefined {
  const form = useFormLooks();
  for (const name of lookNames(look))
    if (table?.[name] === undefined && !understood?.(name) && form[name] === undefined)
      warnUnknownLook(kind, name);
  return pickLook(look, table);
}

/** The names of a look, as the `data-look` attribute carries them. */
export function lookAttr(look: LookRef | undefined): string | undefined {
  const names = lookNames(look);
  return names.length ? names.join(" ") : undefined;
}

/** Lengths in a style that scale with the user's font size, as legacy's `rem` classes did. */
const REM_KEYS: ReadonlySet<string> = new Set(["fontSize", "lineHeight", "letterSpacing"]);
const SIDES: Record<string, [string, string]> = {
  marginHorizontal: ["marginLeft", "marginRight"],
  marginVertical: ["marginTop", "marginBottom"],
  paddingHorizontal: ["paddingLeft", "paddingRight"],
  paddingVertical: ["paddingTop", "paddingBottom"],
};

/** The properties that only mean something on a flex container. */
const FLEX_CONTAINER: ReadonlySet<string> = new Set([
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "alignItems",
  "alignContent",
  "gap",
  "rowGap",
  "columnGap",
]);

/**
 * A {@link PortableStyle} as an inline style: colour tokens resolved against
 * the theme's `colors`; a number a length in px, but `rem` for the font
 * properties (so the user's font size still scales text, as React Native's
 * does); React Native's `*Horizontal` / `*Vertical` shorthands expanded; a
 * border with a width and no style drawn solid, as React Native's is;
 * `border-box`, so a width plus padding means the same on both; and a flex
 * container (a style with `gap`, `flexDirection`, `justifyContent` …) a
 * `display: flex` column unless it says otherwise, since every React Native
 * view already is one.
 *
 * @group Theming
 */
export function portableCss(
  style: PortableStyle | undefined,
  colors: Record<string, string>,
): CSSProperties | undefined {
  if (!style) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(resolveStyleTokens(style, colors))) {
    if (SIDES[k]) for (const side of SIDES[k]) out[side] = v;
    else out[k] = REM_KEYS.has(k) && typeof v === "number" ? `${v / 16}rem` : v;
  }
  if (!Object.keys(out).length) return undefined;
  if (Object.keys(out).some((k) => /^border(Top|Right|Bottom|Left)?Width$/.test(k)) && out.borderStyle === undefined)
    out.borderStyle = "solid";
  out.boxSizing = "border-box";
  // Every React Native view is a flex container whose main axis is the column,
  // so `gap`, `justifyContent`, `flexDirection: "row"` just work there. An
  // element on the web is a block: without this they are silently ignored, and
  // a look drawn on a device fills a row where the same look on the web stacks.
  if (out.display === undefined && Object.keys(out).some((k) => FLEX_CONTAINER.has(k))) {
    out.display = "flex";
    if (out.flexDirection === undefined) out.flexDirection = "column";
  }
  return out as CSSProperties;
}

/** A style's box properties and its text properties, each as an inline style. */
export function portableCssSplit(
  style: PortableStyle | undefined,
  colors: Record<string, string>,
): { box: CSSProperties | undefined; text: CSSProperties | undefined } {
  const { box, text } = splitPortableStyle(style);
  return { box: portableCss(box, colors), text: portableCss(text, colors) };
}

/** One look part, or the layers of one from a list of looks. */
export type PartLayers = HtmlLookPart | readonly HtmlLookPart[] | undefined;

function* flat(parts: readonly PartLayers[]): Generator<HtmlLookPart> {
  for (const p of parts) {
    if (p === undefined) continue;
    if (Array.isArray(p)) yield* p as HtmlLookPart[];
    else yield p as HtmlLookPart;
  }
}

/**
 * A slot's own classes with a look's parts laid over them, in order: a string
 * part is added; a `{ replace }` part stands in for what came before it, the
 * slot's own classes included. A part that is a style, or a function of state,
 * adds no class (see {@link lookStyle}).
 */
export function lookClass(
  base: string | undefined,
  ...parts: PartLayers[]
): string | undefined {
  let out = base;
  for (const p of flat(parts)) {
    if (typeof p === "string") out = [out, p].filter(Boolean).join(" ");
    else if (typeof p === "object" && "replace" in p)
      out = typeof p.replace === "string" ? p.replace : undefined;
  }
  return out || undefined;
}

/** Whether any of these parts is a function of the state — and so needs it tracked. */
export function needsState(...parts: PartLayers[]): boolean {
  for (const p of flat(parts))
    if (typeof p === "function" || (typeof p === "object" && "replace" in p && typeof p.replace === "function"))
      return true;
  return false;
}

/**
 * The inline style a look's parts give an element, as {@link portableCss} draws it: the style parts
 * in order, a function called with `state`, a `{ replace }` dropping what came before it. `undefined`
 * when no part gives a style.
 */
export function lookStyle(
  colors: Record<string, string>,
  state: LookState,
  ...parts: PartLayers[]
): CSSProperties | undefined {
  let acc: PortableStyle | undefined;
  for (const p of flat(parts)) {
    if (typeof p === "string") continue;
    let v: unknown = p;
    if (typeof p === "object" && "replace" in p) {
      acc = undefined;
      v = p.replace;
    }
    if (typeof v === "function") v = (v as (s: LookState) => PortableStyle)(state);
    if (v && typeof v === "object") acc = { ...acc, ...(v as PortableStyle) };
  }
  return portableCss(acc, colors);
}

/** The handlers that let a look read `pressed` and `hovered`. */
export interface LookPointer {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}

/**
 * The window's width, for a look part that is a function of it: tracked only
 * while `enabled` (so a look that asks for nothing costs nothing), `0` until it
 * is read and on the server — the narrowest, as {@link NO_LOOK_STATE} says. What
 * every implementation's function-form look parts get as `LookState.width`.
 *
 * @group Implementations
 */
export function useLookWidth(enabled: boolean): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const read = () => setWidth(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [enabled]);
  return width;
}

/**
 * A boundary's look as inline styles, with the state its functions ask for
 * tracked — and **only** that: with no function in the look the hook costs a
 * few `useState`s and listens to nothing. `base` is what the boundary already
 * knows (`invalid`, `disabled`, `focused`).
 *
 * `style(part, authored)` is the part's (or parts', in order) inline style with
 * the author's own style laid over it; `pointer` is what to spread on the element that should
 * report `pressed` / `hovered`, and is `undefined` when the look does not read them.
 */
export function useLookStyles(
  look: LayeredLook | undefined,
  base?: Partial<LookState>,
): {
  style: (
    part: LookPartName | readonly LookPartName[],
    authored?: CSSProperties,
  ) => CSSProperties | undefined;
  pointer: LookPointer | undefined;
} {
  const colors = useHtmlTheme().tokens.colors;
  const needed = !!look && LOOK_PARTS.some((k) => needsState(look[k]));
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const width = useLookWidth(needed);
  const state: LookState = { ...NO_LOOK_STATE, ...base, hovered, pressed, width };
  return {
    style: (part, authored) => {
      const parts = typeof part === "string" ? [part] : part;
      const own = look ? lookStyle(colors, state, ...parts.map((k) => look[k])) : undefined;
      return own && authored ? { ...own, ...authored } : (authored ?? own);
    },
    pointer: needed
      ? {
          onPointerEnter: () => setHovered(true),
          onPointerLeave: () => {
            setHovered(false);
            setPressed(false);
          },
          onPointerDown: () => setPressed(true),
          onPointerUp: () => setPressed(false),
          onPointerCancel: () => setPressed(false),
        }
      : undefined,
  };
}

/**
 * A group's look, as the theme's classes or the implementation's styles —
 * reported once in development when neither names it.
 */
function useGroupLook(
  look: LookRef | undefined,
  looks: HtmlTheme["looks"],
  style: GroupLookStyle | undefined,
): { classes?: LayeredLook; style?: GroupLookStyle } {
  return { classes: lookParts("group", look, looks, !!style), style };
}

/** Join class names, skipping the empty and the false. */
function cat(...cs: (string | false | undefined)[]): string {
  return cs.filter(Boolean).join(" ");
}

/**
 * The region the `contents` slot draws — forms-react's `Contents` and
 * `Section` — as plain DOM: the chrome-less group. Always the same element,
 * so hiding it never remounts what is inside — and the hidden state covers
 * plain JSX children, which no boundary is responsible for.
 *
 * How it hides is the theme's `hideWith`: the attribute (no CSS needed), a
 * class, or an animated collapse — grid-template-rows 1fr → 0fr and opacity,
 * during which the boundaries inside keep drawing their own last frames.
 * `inert` takes it out of tab order and the a11y tree in every mode.
 */
export function ContentsRegion({
  title,
  style: authorStyle,
  shellStyle,
  hidden,
  invalid,
  layout,
  transitions,
  headingLevel,
  children,
  kind,
  look: lookName,
  classes = defaultHtmlTheme.contents,
  looks: looksProp,
  titleStyle,
  layoutStyle,
  lookStyle,
}: GroupRenderProps & {
  classes?: HtmlTheme["contents"];
  /** The theme's looks. */
  looks?: HtmlTheme["looks"];
  /**
   * The look as styles, for an implementation whose looks are runtime tokens
   * rather than classes — passed only when it names this look, so a look
   * neither it nor `looks` knows is reported.
   */
  lookStyle?: GroupLookStyle;
  /** The title's typography, for an implementation whose styles are runtime tokens. */
  titleStyle?: CSSProperties;
  /**
   * The body's default layout as a style, for an implementation whose styles
   * are runtime tokens — `classes.layout`'s counterpart, and like it dropped
   * when the author gives a `className`.
   */
  layoutStyle?: CSSProperties;
}) {
  const section = kind === "section";
  const htmlTheme = useHtmlTheme();
  const looks = looksProp ?? htmlTheme.looks;
  const look = useGroupLook(lookName, looks, lookStyle);
  const ls = useLookStyles(look.classes, { invalid: !!invalid });
  const colors = htmlTheme.tokens.colors;
  // A look's `control` is the body's layout: the theme's default only when there is none.
  const ownLayout = look.classes?.control === undefined;
  // With transitions off the region goes at once, whatever the theme
  // animates: the attribute, and no collapse.
  const mode = transitions ? classes.hideWith : "attribute";
  // A heading by role, not an h-element: the level comes from the outline
  // and an h2's user-agent margins and size would restyle every theme.
  const head = title !== undefined && title !== null && (
    <div
      role="heading"
      aria-level={headingLevel}
      className={lookClass(
          cat(classes.title, section && classes.section.title),
          look.classes?.label,
          look.classes?.labelText,
        )}
      style={{ ...titleStyle, ...look.style?.title, ...ls.style(["label", "labelText"]) }}
    >
      {title}
    </div>
  );
  // One body element either way, so a layout arriving later changes
  // attributes and not the tree.
  const body = (
    <div
      className={lookClass(
          layout
            ? classes.flexBody
            : cat(classes.body, section && classes.section.body, ownLayout && classes.layout),
          look.classes?.control,
        )}
      style={withStyle(
        withStyle(
          layout
            ? flexStyle(layout, classes.flexGap)
            : ownLayout
              ? layoutStyle
              : undefined,
          look.style?.body,
        ),
        ls.style("control", portableCss(authorStyle, colors)),
      )}
    >
      {children}
    </div>
  );
  // Wrapper, title and body, each its own element so a theme and the
  // author's class slots can style every part — and nothing else, so the
  // wrapper's children are the title and body, as legacy's layout's were.
  // A collapse is the one exception: it needs a single child to animate.
  return (
    <div
      className={lookClass(
          cat(
            classes.wrapper,
            section && classes.section.wrapper,
            mode === "collapse" && classes.collapse,
            hidden && mode === "class" && classes.hidden,
          ),
          look.classes?.shell,
        )}
      data-look={lookAttr(lookName)}
      data-hidden={hidden ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      inert={hidden || undefined}
      // The one hide that needs no CSS. The style too, because a `display`
      // from the wrapper's classes beats the attribute without preflight.
      hidden={(hidden && mode === "attribute") || undefined}
      style={withStyle(
        withStyle(look.style?.wrapper, ls.style("shell", portableCss(shellStyle, colors))),
        hidden && mode === "attribute" ? { display: "none" } : undefined,
      )}
    >
      {mode === "collapse" ? (
        <div className={classes.inner}>
          {head}
          {body}
        </div>
      ) : (
        <>
          {head}
          {body}
        </>
      )}
    </div>
  );
}

const justifyCss = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
  "space-around": "space-around",
} as const;
const alignCss = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
} as const;

/** A flex body's inline style: display, gap, and a direction only when given. */
export function flexStyle(
  l: FlexLayout,
  defaultGap: string | number,
): CSSProperties {
  return {
    display: "flex",
    flexDirection: l.direction,
    gap: l.gap ?? defaultGap,
    justifyContent: l.justify && justifyCss[l.justify],
    alignItems: l.align && alignCss[l.align],
    flexWrap: l.wrap ? "wrap" : undefined,
  };
}

/**
 * The inline group: a bare `<span>`. The children know they are inline
 * through the scope, not through this element; all it does is not be a block,
 * and hide with the `hidden` attribute.
 */
export function Inline({
  title,
  style: authorStyle,
  shellStyle,
  hidden,
  children,
  look: lookName,
  classes = defaultHtmlTheme.inline,
  looks: looksProp,
  lookStyle,
}: GroupRenderProps & {
  classes?: HtmlTheme["inline"];
  /** The theme's looks. */
  looks?: HtmlTheme["looks"];
  /** As {@link ContentsRegion}'s. */
  lookStyle?: GroupLookStyle;
}) {
  const htmlTheme = useHtmlTheme();
  const looks = looksProp ?? htmlTheme.looks;
  const look = useGroupLook(lookName, looks, lookStyle);
  const ls = useLookStyles(look.classes);
  const colors = htmlTheme.tokens.colors;
  return (
    <span
      className={lookClass(classes.wrapper, look.classes?.shell)}
      style={withStyle(look.style?.wrapper, ls.style("shell", portableCss(shellStyle, colors)))}
      data-look={lookAttr(lookName)}
      data-hidden={hidden ? "" : undefined}
      inert={hidden || undefined}
      hidden={hidden || undefined}
    >
      {title !== undefined && title !== null && (
        <span
          className={lookClass(classes.title, look.classes?.label, look.classes?.labelText)}
          style={look.style?.title}
        >
          {title}{" "}
        </span>
      )}
      <span
        className={lookClass(undefined, look.classes?.control)}
        style={ls.style(["control", "text"], portableCss(authorStyle, colors))}
      >
        {children}
      </span>
    </span>
  );
}

/**
 * Visually hidden, still in the accessibility tree — an empty live region, a
 * required note, a hidden label. Out of flow, so it is no item of a grid or
 * flex body. A style rather than a class: hiding is behaviour, and works with
 * no stylesheet.
 */
export const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

/**
 * The field's help goes behind a button at the label's end
 * (`helpPlacement: "labelEnd"`), and there is help to put there.
 */
export function labelEndHelp(p: {
  helpPlacement?: string;
  helpText?: ReactNode;
}): boolean {
  return p.helpPlacement === "labelEnd" && !noContent(p.helpText);
}

/**
 * `aria-describedby` for a control whose shell describes it as required
 * (`describeRequired`): the note first, then the help or error.
 */
export function requiredDescribedBy(p: {
  id: string;
  required?: boolean;
  error?: ReactNode;
  helpText?: ReactNode;
}): string | undefined {
  const rest = describedBy(p);
  if (!p.required) return rest;
  return rest ? `${fieldRequiredId(p.id)} ${rest}` : fieldRequiredId(p.id);
}

/**
 * A shell's `describeRequired` note: the words, visually hidden, under the
 * id the widget's `aria-describedby` names. Nothing unless both are asked for.
 */
export function RequiredNote({
  id,
  required,
  describeRequired,
  text,
}: {
  id: string;
  required?: boolean;
  describeRequired?: boolean;
  text: ReactNode;
}) {
  return required && describeRequired ? (
    <span id={fieldRequiredId(id)} style={visuallyHiddenStyle}>
      {text}
    </span>
  ) : null;
}

/** A display's content shows nothing: `null`, `undefined`, `false` or `""`. */
export function noContent(content: ReactNode): boolean {
  return content == null || content === false || content === "";
}

/**
 * The wrapper a display or an action sits in — what the JSON's `layoutClass`
 * styles. Always rendered, so a class arriving later changes an attribute and
 * not the tree; a span in prose, a div otherwise.
 */
export function DisplayShell({
  shellClassName,
  inline,
  kind = "display",
  tone,
  announce,
  regionOnly,
  style,
  children,
  classes = defaultHtmlTheme.displayShell,
}: {
  shellClassName?: PartLayers;
  inline?: boolean;
  kind?: "display" | "action";
  /** The display's tone: the theme's class for it, and `data-tone`. */
  tone?: Tone;
  /** A live region: `role="alert"` for an error, `role="status"` otherwise. */
  announce?: boolean;
  /**
   * With `announce`: draw only the empty live region, out of the layout — the
   * display's `regionOnly`, or a display with nothing to show. The same
   * element either way, so content arriving in it is announced.
   */
  regionOnly?: boolean;
  /** For an implementation whose colours are runtime tokens, not classes. */
  style?: CSSProperties;
  children: ReactNode;
  classes?: HtmlTheme["displayShell"];
}) {
  const Tag = inline ? "span" : "div";
  const role = announce ? (tone === "error" ? "alert" : "status") : undefined;
  if (announce && regionOnly) return <Tag role={role} style={visuallyHiddenStyle} />;
  return (
    <Tag
      className={lookClass(
        cat(
          classes[kind],
          // One colour, by precedence, never two competing by CSS order: an
          // announced message's, else the tone's, else the display's base.
          announce && tone
            ? classes.message[tone]
            : tone
              ? classes.tones[tone]
              : kind === "display" && classes.color,
        ),
        shellClassName,
      )}
      data-tone={tone}
      role={role}
      style={style}
    >
      {children}
    </Tag>
  );
}

/**
 * The chrome-less collection: the implementation's shell (so an array-level
 * `Length` error has somewhere to appear) around rows the boundary already
 * built. Mutation is deliberately not its job — `arrayActions` gives a host
 * the buttons, so they can live outside the list and a read-only list costs
 * nothing.
 */
export function ElementsList(
  p: CollectionRenderProps<unknown> & {
    classes?: HtmlTheme["elements"];
    /** The theme's looks. */
    looks?: HtmlTheme["looks"];
  },
) {
  const classes = p.classes ?? defaultHtmlTheme.elements;
  const htmlTheme = useHtmlTheme();
  const look = lookParts("collection", p.look, p.looks ?? htmlTheme.looks);
  const colors = htmlTheme.tokens.colors;
  const ls = useLookStyles(look);
  const Shell = useFieldShell();
  return (
    <Shell
      widget="elements"
      id={p.id}
      label={p.label}
      labelAs="legend"
      surface="custom"
      required={p.required}
      helpText={p.helpText}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <div
        className={lookClass(classes.className, look?.control)}
        style={ls.style("control", portableCss(p.style, colors))}
      >
        {p.elements.length ? p.elements.map((e) => e.node) : p.empty}
      </div>
    </Shell>
  );
}

/**
 * A React key per option: its value, which keeps each option's element (and
 * a radio's per-option content) across a re-filter. A list built from data
 * can repeat a value, and React would then warn and drop one, so a repeat is
 * told apart by its position among the repeats.
 */
export function optionKeys(options: { value: unknown }[]): string[] {
  const seen = new Map<string, number>();
  return options.map((o) => {
    const v = String(o.value);
    const n = seen.get(v) ?? 0;
    seen.set(v, n + 1);
    return n ? `${v}#${n}` : v;
  });
}

/**
 * A container's `onBlur` for a widget made of several focusable elements — a
 * check list's boxes: `leave` runs only when focus leaves the widget. React's
 * `onBlur` on a container is `focusout`, which also fires as focus moves from
 * one of its own elements to the next; touching the field then shows its error
 * while the user is still choosing, and the layout that error shifts can move
 * the next option out from under the pointer mid-click.
 */
export function onFocusLeave(
  leave: () => void,
): (e: FocusEvent<HTMLElement>) => void {
  return (e) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave();
  };
}

/**
 * A nesting context of named looks, for an implementation whose looks are
 * its library's props rather than classes (MUI, Ant, Fluent): one record of
 * looks per kind — `text`, `group`, `action` — and a provider that merges
 * a region's over the enclosing one's, a look given replacing the one of
 * that name above it.
 */
export function createLooksContext<V extends object>(
  name: string,
): {
  Provider: (props: { looks: V; children: ReactNode }) => ReactNode;
  useLooks: () => V;
} {
  const Ctx = createContext<V>({} as V);
  function Provider({ looks, children }: { looks: V; children: ReactNode }) {
    const parent = useContext(Ctx);
    const merged = useMemo(() => {
      const above = parent as Record<string, object | undefined>;
      const out: Record<string, object | undefined> = { ...above };
      for (const [k, v] of Object.entries(looks) as [string, object | undefined][])
        if (v) out[k] = { ...(above[k] ?? {}), ...v };
      return out as V;
    }, [parent, looks]);
    return <Ctx.Provider value={merged}>{children}</Ctx.Provider>;
  }
  Provider.displayName = name;
  return { Provider, useLooks: () => useContext(Ctx) };
}

/**
 * Rich text as DOM: `strong`, `em`, `sup`, `sub`, `a`, `br` and `img`, each
 * with its class. A library implementation passes its own `link` (MUI's
 * `Link`, Ant's `Typography.Link`) and keeps the rest; a link that opens
 * elsewhere gets `rel="noopener noreferrer"`.
 */
export function RichTextDom({
  nodes,
  classes = defaultHtmlTheme.richText,
  link,
}: RichTextRenderProps & {
  classes?: HtmlTheme["richText"];
  link?: RichTextParts["link"];
}) {
  const c = (s: string) => s || undefined;
  return (
    <>
      {drawRichText(nodes, {
        strong: (ch, k) => (
          <strong key={k} className={c(classes.strong)}>
            {ch}
          </strong>
        ),
        em: (ch, k) => (
          <em key={k} className={c(classes.em)}>
            {ch}
          </em>
        ),
        sup: (ch, k) => (
          <sup key={k} className={c(classes.sup)}>
            {ch}
          </sup>
        ),
        sub: (ch, k) => (
          <sub key={k} className={c(classes.sub)}>
            {ch}
          </sub>
        ),
        link:
          link ??
          ((n, ch, k) => (
            <a
              key={k}
              href={n.href}
              target={n.target}
              rel={n.target === "_blank" ? "noopener noreferrer" : undefined}
              className={c(classes.link)}
            >
              {ch}
            </a>
          )),
        break: (k) => <br key={k} />,
        image: (n, k) => (
          <img
            key={k}
            src={n.src}
            alt={n.alt}
            width={n.width}
            height={n.height}
            className={c(classes.image)}
          />
        ),
      })}
    </>
  );
}

/** A source as the web takes it: a URL, or a bundler's static import's. */
export function webImage(source: unknown): { src?: string; width?: number; height?: number } {
  if (typeof source === "string") return { src: source };
  if (source && typeof source === "object") {
    const o = source as { src?: unknown; uri?: unknown; width?: unknown; height?: unknown };
    const src = typeof o.src === "string" ? o.src : typeof o.uri === "string" ? o.uri : undefined;
    return {
      src,
      width: typeof o.width === "number" ? o.width : undefined,
      height: typeof o.height === "number" ? o.height : undefined,
    };
  }
  return {};
}

/** A width or height as an attribute (pixels) or a style (a percentage). */
function dimension(v: number | string | undefined): { attr?: number; style?: string } {
  return typeof v === "number" ? { attr: v } : v ? { style: v } : {};
}

/**
 * The image display as DOM: an `<img>` in the display's wrapper, sized by
 * attribute when given pixels — so the page reserves its box before it loads
 * — and by style when given a percentage. `alt=""` takes a decorative image
 * out of the accessibility tree, as html means it. A web bundler's static
 * import (`{ src, width, height }`) is taken as it is.
 */
export function ImageDom({
  classes = defaultHtmlTheme.image,
  displayShell,
  looks: looksProp,
  lookStyle,
  toneStyle,
  ...p
}: ImageDisplayRenderProps & {
  classes?: HtmlTheme["image"];
  /** The theme's looks. */
  looks?: HtmlTheme["looks"];
  displayShell?: HtmlTheme["displayShell"];
  /** A look as a style, for an implementation whose looks are tokens. */
  lookStyle?: (look: string) => CSSProperties | undefined;
  /** The wrapper's style: a tone's colour from tokens. */
  toneStyle?: CSSProperties;
}) {
  const { rc, rendered } = useReactive();
  const img = webImage(getProp(rc, p.source));
  const alt = getProp(rc, p.alt) ?? "";
  const fit = getProp(rc, p.fit);
  const htmlTheme = useHtmlTheme();
  const looks = looksProp ?? htmlTheme.looks;
  const colors = htmlTheme.tokens.colors;
  const lookName = p.look;
  const styled = lookNames(lookName)
    .map((n) => lookStyle?.(n))
    .reduce<CSSProperties | undefined>((a, b) => (a && b ? { ...a, ...b } : (a ?? b)), undefined);
  const look = lookParts("image", lookName, looks, styled !== undefined);
  const ls = useLookStyles(look);
  const w = dimension(getProp(rc, p.width) ?? img.width);
  const h = dimension(getProp(rc, p.height) ?? (getProp(rc, p.width) === undefined ? img.height : undefined));
  return rendered(
    <DisplayShell
      shellClassName={look?.shell}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || !img.src}
      classes={displayShell}
      style={withStyle(toneStyle, portableCss(p.shellStyle, colors))}
    >
      {img.src && (
        <img
          src={img.src}
          alt={alt}
          width={w.attr}
          height={h.attr}
          className={lookClass(classes.className, look?.control)}
          data-look={lookAttr(lookName)}
          style={{
            ...(w.style ? { width: w.style } : {}),
            ...(h.style ? { height: h.style } : {}),
            // A width alone keeps the proportions, whatever a stylesheet's
            // height on img says.
            ...(w.attr !== undefined && h.attr === undefined && !h.style ? { height: "auto" } : {}),
            ...(fit ? { objectFit: fit } : {}),
            ...styled,
            ...ls.style("control", portableCss(p.style, colors)),
          }}
        />
      )}
    </DisplayShell>,
  );
}
