"use client";

import { controls } from "@rxc/controls";
import { FieldType } from "@rxc/forms-core";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

/** Convert a stored value to/from the string select uses on the wire. */
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

export const SelectRenderer = controls<DataRendererProps>(
  "SelectRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, field, fieldOptions, disabled, readonly, touched, definition } =
      node.getState(rc);
    const dataTheme = useHtmlTheme().data ?? {};
    const selectTheme = dataTheme.select ?? {};
    if (!data) return null;
    const value = rc.getValue(data);
    const hasError = touched && !!rc.getError(data);
    const options = fieldOptions ?? [];
    const required = !!field?.required;
    const stored = valueToString(value);
    const className = rendererClass(
      definition.styleClass,
      selectTheme.className ?? dataTheme.inputClass,
    );
    const placeholder =
      stored === "" && required
        ? selectTheme.requiredText ?? "—"
        : selectTheme.emptyText ?? "—";

    // Group options by their `group` if any have one
    const groups = new Map<string | null, typeof options>();
    for (const opt of options) {
      const g = (opt as { group?: string | null }).group ?? null;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(opt);
    }
    const groupKeys = Array.from(groups.keys());
    const usesGroups = groupKeys.some((k) => k != null);

    return (
      <select
        id={id}
        value={stored}
        disabled={disabled || readonly}
        aria-describedby={`${id}-error`}
        aria-invalid={hasError || undefined}
        className={className}
        onChange={(e) =>
          update((wc) =>
            wc.setValue(data, stringToValue(e.target.value, field?.type)),
          )
        }
        onBlur={() => update((wc) => wc.setTouched(data, true, true))}
      >
        {(!required || stored === "") && <option value="">{placeholder}</option>}
        {usesGroups
          ? groupKeys.map((g) =>
              g == null ? (
                groups
                  .get(g)!
                  .map((o) => (
                    <option key={String(o.value)} value={valueToString(o.value)}>
                      {o.name}
                    </option>
                  ))
              ) : (
                <optgroup key={g} label={g}>
                  {groups.get(g)!.map((o) => (
                    <option key={String(o.value)} value={valueToString(o.value)}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ),
            )
          : options.map((o) => (
              <option key={String(o.value)} value={valueToString(o.value)}>
                {o.name}
              </option>
            ))}
      </select>
    );
  },
);
