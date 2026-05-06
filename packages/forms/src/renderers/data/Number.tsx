"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import { FieldType } from "@rxc/forms-core";
import type { DataRendererProps } from "../../types";

/**
 * Number input with parse-on-blur. Maintains a local string buffer while
 * the user is typing (so intermediate states like "1." don't clobber the
 * stored value); commits the parsed number on blur. Invalid input is
 * surfaced through the field's validators, not by the renderer.
 */
export const NumberRenderer = controls<DataRendererProps>(
  "NumberRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, field, disabled, readonly, touched } = node.getState(rc);
    const [buffer, setBuffer] = useState<string | null>(null);
    if (!data) return null;
    const stored = rc.getValue(data);
    const isInt = field?.type === FieldType.Int;
    const display = buffer ?? (stored == null ? "" : String(stored));
    const hasError = touched && !!rc.getError(data);
    return (
      <input
        id={id}
        type="number"
        step={isInt ? 1 : "any"}
        value={display}
        disabled={disabled}
        readOnly={readonly}
        aria-describedby={`${id}-error`}
        aria-invalid={hasError || undefined}
        className={`rounded border px-2.5 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100 ${
          hasError
            ? "border-red-400 dark:border-red-600"
            : "border-zinc-300 dark:border-zinc-600"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${
          readonly ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
        }`}
        onChange={(e) => setBuffer(e.target.value)}
        onBlur={() => {
          const raw = buffer ?? display;
          if (raw === "") {
            update((wc) => wc.setValue(data, null));
          } else {
            const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw);
            if (!Number.isNaN(parsed)) {
              update((wc) => wc.setValue(data, parsed));
            }
          }
          setBuffer(null);
          update((wc) => wc.setTouched(data, true, true));
        }}
      />
    );
  },
);
