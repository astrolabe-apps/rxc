"use client";

import { useReactive, type Rendered } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass, useTextInputController } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export function TextfieldRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const c = useTextInputController(rc, node);
  const theme = useHtmlTheme().data;
  if (!c.data) return rendered(null);
  // Single resolved class — valid/error/disabled/readonly are state
  // variants baked into `inputClass`, driven by the attributes below.
  const className = rendererClass(c.styleClass, theme.inputClass);
  return rendered(
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
}
