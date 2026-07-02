"use client";

import { controls } from "@rxc/controls";
import type { TextfieldRenderOptions } from "@rxc/forms-core";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export const MultilineRenderer = controls<DataRendererProps>(
  "MultilineRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, disabled, readonly, touched, definition } = node.getState(rc);
    const dataTheme = useHtmlTheme().data;
    if (!data) return null;
    const raw = rc.getValue(data);
    const value = raw == null ? "" : String(raw);
    const hasError = touched && !!rc.getError(data);
    const placeholder =
      ((definition as { renderOptions?: TextfieldRenderOptions }).renderOptions
        ?.placeholder ?? undefined) || undefined;
    const className = rendererClass(
      definition.styleClass,
      dataTheme.multiline.className,
    );
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
        className={className}
        onChange={(e) => update((wc) => wc.setValue(data, e.target.value))}
        onBlur={() => update((wc) => wc.setTouched(data, true, true))}
      />
    );
  },
);
