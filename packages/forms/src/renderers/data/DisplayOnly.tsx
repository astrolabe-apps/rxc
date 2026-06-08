"use client";

import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_CLASS = "text-sm text-zinc-700 dark:text-zinc-300";

/**
 * Display-only rendering. Formats the stored value through the
 * {@link SchemaInterface} (option `name` lookup + type-aware date/bool
 * formatting), matching the legacy `DefaultDisplayOnly`. Layers the
 * definition's `textClass` over the theme class so per-column text styles
 * (e.g. accent colours on DataGrid cells) are honoured.
 */
export const DisplayOnlyRenderer = controls<DataRendererProps>(
  "DisplayOnlyRenderer",
  ({ node, inline }, { rc }) => {
    const { data, field, fieldOptions, definition } = node.getState(rc);
    const dataTheme = useHtmlTheme().data ?? {};
    if (!data) return null;
    const value = rc.getValue(data);
    const schemaInterface = node.schemaInterface;
    let text: string;
    if (Array.isArray(value)) {
      text = value
        .map(
          (v) =>
            (field && schemaInterface.textValue(field, v, fieldOptions)) ??
            String(v),
        )
        .join(", ");
    } else {
      text =
        (field && schemaInterface.textValue(field, value, fieldOptions)) ??
        (value == null ? "" : String(value));
    }
    const className = rendererClass(
      definition.textClass,
      rendererClass(
        definition.styleClass,
        dataTheme.displayOnlyClass ?? DEFAULT_CLASS,
      ),
    );
    // Block element by default; inline element inside an inline group, to
    // avoid invalid nesting (mirrors legacy `inline ? "span" : "div"`).
    const Tag = inline ? "span" : "div";
    return (
      <Tag className={className}>
        {text || <span className="text-zinc-400 italic">(empty)</span>}
      </Tag>
    );
  },
);
