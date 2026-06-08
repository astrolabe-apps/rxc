"use client";

import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export const TextfieldRenderer = controls<DataRendererProps>(
  "TextfieldRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, disabled, readonly, touched, definition } = node.getState(rc);
    const theme = useHtmlTheme().data ?? {};
    if (!data) return null;
    const raw = rc.getValue(data);
    const value = raw == null ? "" : String(raw);
    const hasError = touched && !!rc.getError(data);
    // Single resolved class — valid/error/disabled/readonly are state
    // variants baked into `inputClass`, driven by the attributes below.
    const className = rendererClass(definition.styleClass, theme.inputClass);
    return (
      <input
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        readOnly={readonly}
        aria-describedby={`${id}-error`}
        aria-invalid={hasError || undefined}
        className={className}
        onChange={(e) => update((wc) => wc.setValue(data, e.target.value))}
        onBlur={() => update((wc) => wc.setTouched(data, true, true))}
      />
    );
  },
);
