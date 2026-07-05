"use client";

import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass, useTextInputController } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export const TextfieldRenderer = controls<DataRendererProps>(
  "TextfieldRenderer",
  ({ node, id }, { rc }) => {
    const c = useTextInputController(rc, node);
    const theme = useHtmlTheme().data;
    if (!c.data) return null;
    // Single resolved class — valid/error/disabled/readonly are state
    // variants baked into `inputClass`, driven by the attributes below.
    const className = rendererClass(c.styleClass, theme.inputClass);
    return (
      <input
        id={id}
        type="text"
        value={c.value}
        disabled={c.disabled}
        readOnly={c.readonly}
        aria-describedby={`${id}-error`}
        aria-invalid={c.hasError || undefined}
        className={className}
        onChange={(e) => c.onChangeText(e.target.value)}
        onBlur={c.onBlur}
      />
    );
  },
);
