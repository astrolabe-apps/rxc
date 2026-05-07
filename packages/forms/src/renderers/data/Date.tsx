"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_INPUT_CLASS =
  "rounded border px-2.5 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100";
const VALID_BORDER = "border-zinc-300 dark:border-zinc-600";
const INVALID_BORDER = "border-red-400 dark:border-red-600";

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
      const baseClass = rendererClass(
        definition.styleClass,
        dataTheme.inputClass ?? DEFAULT_INPUT_CLASS,
      );
      const stateClass = [
        hasError ? INVALID_BORDER : VALID_BORDER,
        disabled ? "opacity-50 cursor-not-allowed" : "",
        readonly ? "bg-zinc-50 dark:bg-zinc-800/50" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return (
        <input
          id={id}
          type={inputType}
          value={display}
          disabled={disabled}
          readOnly={readonly}
          aria-describedby={`${id}-error`}
          aria-invalid={hasError || undefined}
          className={`${baseClass ?? ""} ${stateClass}`.trim()}
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
