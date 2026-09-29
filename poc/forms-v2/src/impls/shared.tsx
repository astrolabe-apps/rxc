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
} from "../framework/index.js";
import { defaultHtmlTheme, type HtmlTheme } from "./htmlTheme.js";

/** The no-op: a hard mount/unmount. Cannot animate an exit. */
export function DefaultVisibility({ visible, children }: VisibilityProps) {
  return visible ? <>{children}</> : null;
}

/**
 * Holds the subtree mounted for the length of the exit transition, which is
 * the whole reason `visibility` is a registry slot rather than a ternary.
 * CSS rather than framer-motion so the POC keeps its dependency list honest.
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

  if (!visible && !mounted) return null;
  return (
    <div className="ff-fade" data-leaving={visible ? undefined : ""}>
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
  // Legacy's anatomy, one element each: wrapper, title, body (finding 63).
  return (
    <div
      className={mergeClass(
        hidden && classes.hidden
          ? `${classes.wrapper} ${classes.hidden}`
          : classes.wrapper,
        shellClassName,
      )}
      data-hidden={hidden ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      inert={hidden || undefined}
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

/** Legacy's `flexStyles`: display, gap, and a direction only when given. */
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
 * Legacy's Inline group: a bare `<span>` (legacy's `inlineClass` is `""`).
 * The children know they are inline through the scope, not through this
 * element; all this does is not be a block, and hide with CSS like every
 * group (finding 17).
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
 * The wrapper a display or an action sits in — legacy's layout element,
 * which `layoutClass` landed on 320 times in the corpus. Always rendered, so
 * a class arriving later changes an attribute and not the tree (finding 22);
 * a span in prose, a div otherwise.
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
