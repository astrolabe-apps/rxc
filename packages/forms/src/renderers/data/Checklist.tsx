"use client";

import { controls } from "@rxc/controls";
import { useLabelText } from "../../labelText";
import type { DataRendererProps } from "../../types";

/**
 * Multi-select via checkboxes against a collection field. Stores an
 * array of selected option values. Registered with `hidesLabel: true`
 * — `<legend>` is the label.
 */
export const ChecklistRenderer = controls<DataRendererProps>(
  "ChecklistRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, fieldOptions, disabled, readonly } = node.getState(rc);
    const labelText = useLabelText(node, rc);
    if (!data) return null;
    const value = rc.getValue(data);
    const selected = Array.isArray(value) ? (value as unknown[]) : [];

    function toggle(optValue: unknown, checked: boolean) {
      const next = checked
        ? selected.includes(optValue)
          ? selected
          : [...selected, optValue]
        : selected.filter((v) => v !== optValue);
      update((wc) => wc.setValue(data!, next));
    }

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
          const optKey = String(o.value);
          const isChecked = selected.includes(o.value);
          return (
            <label
              key={optKey}
              className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={disabled || readonly}
                onChange={(e) => toggle(o.value, e.target.checked)}
                onBlur={() => update((wc) => wc.setTouched(data!, true, true))}
              />
              <span>{o.name}</span>
            </label>
          );
        })}
      </fieldset>
    );
  },
);
