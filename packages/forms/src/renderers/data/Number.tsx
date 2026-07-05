"use client";

import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass, useNumberController } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Number input with parse-on-blur. The controller maintains a local string
 * buffer while the user is typing (so intermediate states like "1." don't
 * clobber the stored value) and commits the parsed number on blur; invalid
 * input is surfaced through the field's validators, not by the renderer.
 */
export const NumberRenderer = controls<DataRendererProps>(
  "NumberRenderer",
  ({ node, id }, { rc }) => {
    const c = useNumberController(rc, node);
    const theme = useHtmlTheme().data;
    if (!c.data) return null;
    const className = rendererClass(c.styleClass, theme.inputClass);
    return (
      <input
        id={id}
        type="number"
        step={c.isInt ? 1 : "any"}
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
