"use client";

import { useControls, type Rendered } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Display-only rendering. Formats the stored value through the
 * {@link SchemaInterface} (option `name` lookup + type-aware date/bool
 * formatting), matching the legacy `DefaultDisplayOnly`. Layers the
 * definition's `textClass` over the theme class so per-column text styles
 * (e.g. accent colours on DataGrid cells) are honoured.
 */
export function DisplayOnlyRenderer({ node, inline }: DataRendererProps): Rendered {
  const { rc, rendered } = useControls();
  const { data, field, fieldOptions, definition } = node.getState(rc);
  const dataTheme = useHtmlTheme().data;
  if (!data) return rendered(null);
  const value = rc.getValue(data);
  const schemaInterface = node.schemaInterface;
  // textValue handles collections itself (formats each element, joins) —
  // the local fallbacks only cover a definition with no schema field.
  let text: string | undefined = field
    ? schemaInterface.textValue(field, value, undefined, fieldOptions)
    : undefined;
  if (text === undefined) {
    text =
      value == null
        ? ""
        : Array.isArray(value)
          ? value.map(String).join(", ")
          : String(value);
  }
  const className = rendererClass(
    definition.textClass,
    rendererClass(definition.styleClass, dataTheme.displayOnlyClass),
  );
  // Block element by default; inline element inside an inline group, to
  // avoid invalid nesting (mirrors legacy `inline ? "span" : "div"`).
  const Tag = inline ? "span" : "div";
  return rendered(
    <Tag className={className}>
      {text || <span className="text-zinc-400 italic">(empty)</span>}
    </Tag>
  );
}
