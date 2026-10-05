/*
 * The DOM building blocks the html implementation draws with that are not
 * html-specific: a region, an inline group, the chrome-less collection, the
 * wrapper a display sits in, and the no-transition visibility slot. Also on
 * the `@rx-controls/forms-html/shared` subpath, for sibling implementations
 * (forms-mui, forms-antd) that draw these parts as plain DOM too. Not public
 * API: no semver promise, and not in the generated reference.
 */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import {
  combineClass,
  mergeClass,
  useFieldShell,
  type ClassValue,
  type CollectionRenderProps,
  type FormElementProps,
  type GroupRenderProps,
  type FlexLayout,
  type Tone,
  type VisibilityProps,
} from "@rx-controls/forms-react";
import { defaultHtmlTheme, useHtmlTheme, type HtmlTheme } from "./theme.js";

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
  className,
  shellClassName,
  labelClassName,
  labelTextClassName,
  hidden,
  invalid,
  layout,
  transitions,
  headingLevel,
  children,
  classes = defaultHtmlTheme.contents,
  titleStyle,
}: GroupRenderProps & {
  classes?: HtmlTheme["contents"];
  /** The title's typography, for an implementation whose styles are runtime tokens. */
  titleStyle?: CSSProperties;
}) {
  // With transitions off the region goes at once, whatever the theme
  // animates: the attribute, and no collapse.
  const mode = transitions ? classes.hideWith : "attribute";
  // A heading by role, not an h-element: the level comes from the outline
  // and an h2's user-agent margins and size would restyle every theme.
  const head = title !== undefined && title !== null && (
    <div
      role="heading"
      aria-level={headingLevel}
      className={mergeClass(
        classes.title,
        combineClass(labelClassName, labelTextClassName),
      )}
      style={titleStyle}
    >
      {title}
    </div>
  );
  // One body element either way, so a layout arriving later changes
  // attributes and not the tree.
  const body = (
    <div
      className={mergeClass(layout ? classes.flexBody : classes.body, className)}
      style={layout ? flexStyle(layout, classes.flexGap) : undefined}
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
      className={mergeClass(
        mode === "collapse"
          ? `${classes.wrapper} ${classes.collapse}`
          : hidden && mode === "class"
            ? `${classes.wrapper} ${classes.hidden}`
            : classes.wrapper,
        shellClassName,
      )}
      data-hidden={hidden ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      inert={hidden || undefined}
      // The one hide that needs no CSS. The style too, because a `display`
      // from the wrapper's classes beats the attribute without preflight.
      hidden={(hidden && mode === "attribute") || undefined}
      style={hidden && mode === "attribute" ? { display: "none" } : undefined}
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
  className,
  shellClassName,
  labelClassName,
  labelTextClassName,
  hidden,
  children,
  classes = defaultHtmlTheme.inline,
}: GroupRenderProps & { classes?: HtmlTheme["inline"] }) {
  return (
    <span
      className={mergeClass(classes.wrapper, shellClassName)}
      data-hidden={hidden ? "" : undefined}
      inert={hidden || undefined}
      hidden={hidden || undefined}
    >
      {title !== undefined && title !== null && (
        <span
          className={mergeClass(
            classes.title,
            combineClass(labelClassName, labelTextClassName),
          )}
        >
          {title}{" "}
        </span>
      )}
      <span className={mergeClass(undefined, className)}>{children}</span>
    </span>
  );
}

/**
 * An empty live region takes no space and draws nothing, but stays in the
 * accessibility tree — out of flow, so it is no item of a grid or flex body.
 */
const regionOnlyStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
};

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
  shellClassName?: ClassValue;
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
  if (announce && regionOnly) return <Tag role={role} style={regionOnlyStyle} />;
  return (
    <Tag
      className={mergeClass(
        tone ? `${classes[kind]} ${classes.tones[tone]}` : classes[kind],
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
  p: CollectionRenderProps<unknown> & { classes?: HtmlTheme["elements"] },
) {
  const classes = p.classes ?? defaultHtmlTheme.elements;
  const Shell = useFieldShell();
  return (
    <Shell
      id={p.id}
      label={p.label}
      labelAs="legend"
      surface="custom"
      required={p.required}
      helpText={p.helpText}
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <div className={classes.className}>
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
