"use client";

import { controls } from "@rxc/controls";
import { FieldType } from "@rxc/forms-core";
import { useLabelText } from "@rxc/forms-react-core";
import type { DataRendererProps } from "@rxc/forms-react-core";

function valueToString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function stringToValue(raw: string, fieldType: string | undefined): unknown {
  if (raw === "") return null;
  if (fieldType === FieldType.Int || fieldType === FieldType.Double) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (fieldType === FieldType.Bool) {
    if (raw === "true") return true;
    if (raw === "false") return false;
  }
  return raw;
}

/**
 * Radio group. Registered with `hidesLabel: true` — the `<legend>` is the
 * accessible label, no separate Field-emitted label.
 */
export const RadioRenderer = controls<DataRendererProps>(
  "RadioRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, field, fieldOptions, disabled, readonly } = node.getState(rc);
    const labelText = useLabelText(node, rc);
    if (!data) return null;
    const value = rc.getValue(data);
    const stored = valueToString(value);
    const groupName = id;

    return (
      <fieldset
        id={id}
        disabled={disabled}
        className="flex flex-col gap-1"
        aria-describedby={`${id}-error`}
      >
        {labelText && (
          <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {labelText}
          </legend>
        )}
        {(fieldOptions ?? []).map((o) => {
          const optValue = valueToString(o.value);
          return (
            <label
              key={optValue}
              className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <input
                type="radio"
                name={groupName}
                value={optValue}
                checked={stored === optValue}
                disabled={disabled || readonly}
                onChange={() =>
                  update((wc) =>
                    wc.setValue(data, stringToValue(optValue, field?.type)),
                  )
                }
                onBlur={() => update((wc) => wc.setTouched(data, true, true))}
              />
              <span>{o.name}</span>
            </label>
          );
        })}
      </fieldset>
    );
  },
);
