"use client";

import { controls } from "@rxc/controls";
import type { TextfieldRenderOptions } from "@rxc/forms-core";
import type { DataRendererProps } from "../../types";

export const MultilineRenderer = controls<DataRendererProps>(
  "MultilineRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, disabled, readonly, touched, definition } = node.getState(rc);
    if (!data) return null;
    const raw = rc.getValue(data);
    const value = raw == null ? "" : String(raw);
    const hasError = touched && !!rc.getError(data);
    const placeholder =
      ((definition as { renderOptions?: TextfieldRenderOptions }).renderOptions
        ?.placeholder ?? undefined) || undefined;
    return (
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        rows={4}
        aria-describedby={`${id}-error`}
        aria-invalid={hasError || undefined}
        className={`rounded border px-2.5 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100 ${
          hasError
            ? "border-red-400 dark:border-red-600"
            : "border-zinc-300 dark:border-zinc-600"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${
          readonly ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
        }`}
        onChange={(e) => update((wc) => wc.setValue(data, e.target.value))}
        onBlur={() => update((wc) => wc.setTouched(data, true, true))}
      />
    );
  },
);
