"use client";

import { controls } from "@rxc/controls";
import { FieldType } from "@rxc/forms-core";
import type { DataRendererProps } from "../../types";

function formatScalar(value: unknown, type: string | undefined): string {
  if (value == null) return "";
  if (type === FieldType.Bool) return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}

/**
 * Display-only rendering. For options-bearing fields, looks up the
 * option's `name` for the stored value. Otherwise stringifies via
 * field-type-aware formatting.
 */
export const DisplayOnlyRenderer = controls<DataRendererProps>(
  "DisplayOnlyRenderer",
  ({ node, id }, { rc }) => {
    const { data, field, fieldOptions } = node.getState(rc);
    if (!data) return null;
    const value = rc.getValue(data);
    let text: string;
    if (fieldOptions && fieldOptions.length > 0) {
      if (Array.isArray(value)) {
        text = value
          .map((v) => fieldOptions.find((o) => o.value === v)?.name ?? String(v))
          .join(", ");
      } else {
        text =
          fieldOptions.find((o) => o.value === value)?.name ??
          formatScalar(value, field?.type);
      }
    } else {
      text = formatScalar(value, field?.type);
    }
    return (
      <span id={id} className="text-sm text-zinc-700 dark:text-zinc-300">
        {text || <span className="text-zinc-400 italic">(empty)</span>}
      </span>
    );
  },
);
