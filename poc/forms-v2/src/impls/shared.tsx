import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  combineClass,
  mergeClass,
  useFieldShell,
  type ClassValue,
  type CollectionRenderProps,
  type GroupRenderProps,
  type VisibilityProps,
} from "../framework/index.js";

/**
 * Icon names as the JSON format spells them (FontAwesome's), drawn as text so
 * the POC's dependency list stays honest. An implementation may map them to
 * its own icon set instead; the contract only says a name arrives.
 */
const glyphs: Record<string, string> = {
  person: "\u{1F9D1}",
  building: "\u{1F3E2}",
  check: "\u2713",
  warning: "\u26A0",
};
export function glyphFor(name: string | undefined): string {
  return (name && glyphs[name]) ?? name ?? "";
}

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
  children,
}: GroupRenderProps) {
  // Legacy's anatomy, one element each: wrapper, title, body (finding 63).
  return (
    <div
      className={mergeClass("ff-contents", shellClassName)}
      data-hidden={hidden ? "" : undefined}
      data-invalid={invalid ? "" : undefined}
      inert={hidden || undefined}
    >
      <div className="ff-contents-inner">
        {title !== undefined && title !== null && (
          <div
            className={mergeClass(
              "ff-group-title",
              combineClass(labelClassName, labelTextClassName),
            )}
          >
            {title}
          </div>
        )}
        <div className={mergeClass("ff-contents-body", className)}>
          {children}
        </div>
      </div>
    </div>
  );
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
}: GroupRenderProps) {
  return (
    <span
      className={mergeClass("ff-inline", shellClassName)}
      data-hidden={hidden ? "" : undefined}
      inert={hidden || undefined}
    >
      {title !== undefined && title !== null && (
        <span
          className={mergeClass(
            "ff-group-title",
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
}: {
  shellClassName?: ClassValue;
  inline?: boolean;
  kind?: "display" | "action";
  children: ReactNode;
}) {
  const Tag = inline ? "span" : "div";
  return (
    <Tag className={mergeClass(`ff-${kind}`, shellClassName)}>{children}</Tag>
  );
}

/**
 * The chrome-less collection: the implementation's shell (so an array-level
 * `Length` error has somewhere to appear) around rows the boundary already
 * built. Mutation is deliberately not its job — `arrayActions` gives a host
 * the buttons, so they can live outside the list and a read-only list costs
 * nothing.
 */
export function ElementsList(p: CollectionRenderProps<unknown>) {
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
      <div className="ff-elements">
        {p.elements.length ? p.elements.map((e) => e.node) : p.empty}
      </div>
    </Shell>
  );
}
