"use client";

import { useControls, type Rendered } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass, useDateController } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

function makeDateRenderer(
  inputType: "date" | "datetime-local" | "time",
  displayName: string,
) {
  function DateInputRenderer({ node, id }: DataRendererProps): Rendered {
    const { rc, rendered } = useControls();
    const c = useDateController(rc, node);
    const dataTheme = useHtmlTheme().data;
    if (!c.data) return rendered(null);
    const className = rendererClass(c.styleClass, dataTheme.inputClass);
    return rendered(
      <input
        id={id}
        type={inputType}
        value={c.value}
        disabled={c.disabled}
        readOnly={c.readonly}
        aria-describedby={`${id}-error`}
        aria-invalid={c.hasError || undefined}
        className={className}
        onChange={(e) => c.onChangeText(e.target.value)}
        onBlur={c.onBlur}
      />,
    );
  }
  DateInputRenderer.displayName = displayName;
  return DateInputRenderer;
}

export const DateRenderer = makeDateRenderer("date", "DateRenderer");
export const DateTimeRenderer = makeDateRenderer(
  "datetime-local",
  "DateTimeRenderer",
);
export const TimeRenderer = makeDateRenderer("time", "TimeRenderer");
