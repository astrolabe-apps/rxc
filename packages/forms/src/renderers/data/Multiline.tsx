"use client";

import { useReactive, type Rendered } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass, useTextInputController } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export function MultilineRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const c = useTextInputController(rc, node);
  const dataTheme = useHtmlTheme().data;
  if (!c.data) return rendered(null);
  const className = rendererClass(c.styleClass, dataTheme.multiline.className);
  return rendered(
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
}
