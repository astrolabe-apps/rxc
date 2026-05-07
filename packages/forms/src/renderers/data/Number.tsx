"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import { FieldType } from "@rxc/forms-core";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_INPUT_CLASS =
  "rounded border px-2.5 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100";
const VALID_BORDER = "border-zinc-300 dark:border-zinc-600";
const INVALID_BORDER = "border-red-400 dark:border-red-600";

/**
 * Number input with parse-on-blur. Maintains a local string buffer while
 * the user is typing (so intermediate states like "1." don't clobber the
 * stored value); commits the parsed number on blur. Invalid input is
 * surfaced through the field's validators, not by the renderer.
 */
export const NumberRenderer = controls<DataRendererProps>(
  "NumberRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, field, disabled, readonly, touched, definition } =
      node.getState(rc);
    const theme = useHtmlTheme().data ?? {};
    const [buffer, setBuffer] = useState<string | null>(null);
    if (!data) return null;
    const stored = rc.getValue(data);
    const isInt = field?.type === FieldType.Int;
    const display = buffer ?? (stored == null ? "" : String(stored));
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
        type="number"
        step={isInt ? 1 : "any"}
        value={display}
        disabled={disabled}
        readOnly={readonly}
        aria-describedby={`${id}-error`}
        aria-invalid={hasError || undefined}
        className={`${baseClass ?? ""} ${stateClass}`.trim()}
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
