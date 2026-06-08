"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

function makeDateRenderer(
  inputType: "date" | "datetime-local" | "time",
  displayName: string,
) {
  return controls<DataRendererProps>(
    displayName,
    ({ node, id }, { rc, update }) => {
      const { data, disabled, readonly, touched, definition } =
        node.getState(rc);
      const dataTheme = useHtmlTheme().data ?? {};
      const [buffer, setBuffer] = useState<string | null>(null);
      if (!data) return null;
      const stored = rc.getValue(data);
      const display = buffer ?? (stored == null ? "" : String(stored));
      const hasError = touched && !!rc.getError(data);
      const className = rendererClass(definition.styleClass, dataTheme.inputClass);
      return (
        <input
          id={id}
          type={inputType}
          value={display}
          disabled={disabled}
          readOnly={readonly}
          aria-describedby={`${id}-error`}
          aria-invalid={hasError || undefined}
          className={className}
          onChange={(e) => setBuffer(e.target.value)}
          onBlur={() => {
            const raw = buffer ?? display;
            update((wc) => wc.setValue(data, raw === "" ? null : raw));
            setBuffer(null);
            update((wc) => wc.setTouched(data, true, true));
          }}
        />
      );
    },
  );
}

export const DateRenderer = makeDateRenderer("date", "DateRenderer");
export const DateTimeRenderer = makeDateRenderer(
  "datetime-local",
  "DateTimeRenderer",
);
export const TimeRenderer = makeDateRenderer("time", "TimeRenderer");
