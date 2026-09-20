import { useEffect, useRef, useState } from "react";
import {
  mergeClass,
  useFieldShell,
  type CollectionRenderProps,
  type GroupRenderProps,
  type VisibilityProps,
} from "../framework/index.js";

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
export function Contents({ className, hidden, children }: GroupRenderProps) {
  return (
    <div
      className={mergeClass("ff-contents", className)}
      data-hidden={hidden ? "" : undefined}
      inert={hidden || undefined}
    >
      <div className="ff-contents-inner">{children}</div>
    </div>
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
    >
      <div className="ff-elements">
        {p.elements.length ? p.elements : p.empty}
      </div>
    </Shell>
  );
}
