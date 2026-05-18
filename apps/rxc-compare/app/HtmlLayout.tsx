"use client";

import { controls } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import type { LayoutProps } from "@rxc/forms";

// Wraps `label` + its label-kind adornments in a flex container, matching
// the legacy `label.labelContainer` slot from `DefaultRenderOptions`. HTML
// parsing of label text and error styling are handled by the custom
// `<Label>` (HtmlLabel) and `<Error>` (HtmlError) components, passed to
// `<Form>` separately.
export const HtmlLayout = controls<LayoutProps>(
  "HtmlLayout",
  ({ node, label, error, inline, className, style, children }, { rc }) => {
    const def = node.getState(rc).definition;
    const labelContainer =
      label == null ? null : (
        <div className="flex gap-4 items-baseline flex-wrap">{label}</div>
      );
    const merged = rendererClass(
      def.layoutClass,
      inline ? undefined : "flex flex-col gap-1",
    );
    const finalClass =
      [merged, className].filter(Boolean).join(" ") || undefined;
    if (inline) {
      return (
        <span className={finalClass} style={style}>
          {labelContainer && <>{labelContainer} </>}
          {children}
          {error && <> {error}</>}
        </span>
      );
    }
    return (
      <div className={finalClass} style={style}>
        {labelContainer}
        {children}
        {error}
      </div>
    );
  },
);
