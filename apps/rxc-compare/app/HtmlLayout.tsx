"use client";

import { useReactive, type Rendered } from "@rxc/controls";
import { DataRenderType, isDataControl } from "@rxc/forms-core";
import { rendererClass } from "@rxc/forms-react-core";
import type { LayoutProps } from "@rxc/forms";

// Legacy `defaultTailwindTheme.displayOnlyClass`. The legacy data renderer
// pushed this onto the control's layout wrapper (`ControlLayoutProps`) for
// display-only fields; rxc has no renderer→layout class hook, so the host
// Layout re-applies it here (the documented translation for renderers that
// mutated ControlLayoutProps).
const DISPLAY_ONLY_WRAPPER = "flex flex-row items-center gap-2";

// Wraps `label` + its label-kind adornments in a flex container, matching
// the legacy `label.labelContainer` slot from `DefaultRenderOptions`. HTML
// parsing of label text and error styling are handled by the custom
// `<Label>` (HtmlLabel) and `<Error>` (HtmlError) components, passed to
// `<Form>` separately.
export function HtmlLayout({ node, label, error, inline, className, style, children }: LayoutProps): Rendered {
  const { rc, rendered } = useReactive();
  const def = node.getState(rc).definition;
  const isDisplayOnly =
    isDataControl(def) &&
    def.renderOptions?.type === DataRenderType.DisplayOnly;
  const labelContainer =
    label == null ? null : (
      <div className="flex gap-4 items-baseline flex-wrap">{label}</div>
    );
  const merged = rendererClass(
    def.layoutClass,
    inline ? undefined : isDisplayOnly ? DISPLAY_ONLY_WRAPPER : "flex flex-col",
  );
  const finalClass =
    [merged, className].filter(Boolean).join(" ") || undefined;
  if (inline) {
    return rendered(
      <span className={finalClass} style={style}>
        {labelContainer && <>{labelContainer} </>}
        {children}
        {error && <> {error}</>}
      </span>
    );
  }
  return rendered(
    <div className={finalClass} style={style}>
      {labelContainer}
      {children}
      {error}
    </div>
  );
}
