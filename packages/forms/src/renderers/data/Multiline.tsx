"use client";

import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass, useTextInputController } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export const MultilineRenderer = controls<DataRendererProps>(
  "MultilineRenderer",
  ({ node, id }, { rc }) => {
    const c = useTextInputController(rc, node);
    const dataTheme = useHtmlTheme().data;
    if (!c.data) return null;
    const className = rendererClass(c.styleClass, dataTheme.multiline.className);
    return (
      <textarea
        id={id}
        value={c.value}
        placeholder={c.placeholder}
        disabled={c.disabled}
        readOnly={c.readonly}
        rows={4}
        aria-describedby={`${id}-error`}
        aria-invalid={c.hasError || undefined}
        className={className}
        onChange={(e) => c.onChangeText(e.target.value)}
        onBlur={c.onBlur}
      />
    );
  },
);
