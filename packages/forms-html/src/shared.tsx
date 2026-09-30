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
  type ReactNode,
} from "react";
import {
  combineClass,
  mergeClass,
  useFieldShell,
  type ClassValue,
  type CollectionRenderProps,
  type GroupRenderProps,
  type StackLayout,
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
 * The chrome-less group. Always the same element, so hiding it never remounts
 * what is inside — and the hidden state covers plain JSX children, which no
 * boundary is responsible for.
 *
 * It collapses rather than switching to `display: none`, which is what makes a
 * region-level exit animation possible: the CSS animates `grid-template-rows`
 * 1fr → 0fr and opacity, `inert` takes it out of tab order and the a11y tree,
 * and the boundaries inside keep drawing their own last frames meanwhile.
 */
export function Contents({
  title,
  className,
  shellClassName,
  labelClassName,
  labelTextClassName,
  hidden,
  invalid,
  layout,
  children,
  classes = defaultHtmlTheme.contents,
}: GroupRenderProps & { classes?: HtmlTheme["contents"] }) {
  // One element each for wrapper, title and body: a theme and the author's
  // class slots can each style every part.
  return (
    <div
      className={mergeClass(
        hidden && classes.hideWith === "class" && classes.hidden
          ? `${classes.wrapper} ${classes.hidden}`
          : classes.wrapper,
        shellClassName,
      )}
      data-hidden={hidden ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      inert={hidden || undefined}
      // The one hide that needs no CSS; a theme that animates opts out.
      hidden={(hidden && classes.hideWith === "attribute") || undefined}
    >
      <div className={classes.inner}>
        {title !== undefined && title !== null && (
          <div
            className={mergeClass(
              classes.title,
              combineClass(labelClassName, labelTextClassName),
            )}
          >
            {title}
          </div>
        )}
        {/* One body element either way, so a layout arriving later changes
            attributes and not the tree. */}
        <div
          className={mergeClass(
            layout ? classes.flexBody : classes.body,
            className,
          )}
          style={layout ? flexStyle(layout, classes.flexGap) : undefined}
        >
          {children}
        </div>
      </div>
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
  l: StackLayout,
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
 * The wrapper a display or an action sits in — what the JSON's `layoutClass`
 * styles. Always rendered, so a class arriving later changes an attribute and
 * not the tree; a span in prose, a div otherwise.
 */
export function DisplayShell({
  shellClassName,
  inline,
  kind = "display",
  children,
  classes = defaultHtmlTheme.displayShell,
}: {
  shellClassName?: ClassValue;
  inline?: boolean;
  kind?: "display" | "action";
  children: ReactNode;
  classes?: HtmlTheme["displayShell"];
}) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={mergeClass(classes[kind], shellClassName)}>{children}</Tag>
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
