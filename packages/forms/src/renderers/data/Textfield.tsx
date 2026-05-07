"use client";

import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_INPUT_CLASS =
  "rounded border px-2.5 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100";
const VALID_BORDER = "border-zinc-300 dark:border-zinc-600";
const INVALID_BORDER = "border-red-400 dark:border-red-600";

export const TextfieldRenderer = controls<DataRendererProps>(
  "TextfieldRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, disabled, readonly, touched, definition } = node.getState(rc);
    const theme = useHtmlTheme().data ?? {};
    if (!data) return null;
    const raw = rc.getValue(data);
    const value = raw == null ? "" : String(raw);
    const hasError = touched && !!rc.getError(data);
    const baseClass = rendererClass(
      definition.styleClass,
      theme.inputClass ?? DEFAULT_INPUT_CLASS,
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
        type="text"
        value={value}
        disabled={disabled}
        readOnly={readonly}
        aria-describedby={`${id}-error`}
        aria-invalid={hasError || undefined}
        className={`${baseClass ?? ""} ${stateClass}`.trim()}
        onChange={(e) => update((wc) => wc.setValue(data, e.target.value))}
        onBlur={() => update((wc) => wc.setTouched(data, true, true))}
      />
    );
  },
);
