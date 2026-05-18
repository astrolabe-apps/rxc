"use client";

import { controls } from "@rxc/controls";
import {
  FieldType,
  type FormStateNode,
  type RadioButtonRenderOptions,
} from "@rxc/forms-core";
import { useLabelText } from "@rxc/forms-react-core";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { clsx, rendererClass } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_FIELDSET = "flex flex-col gap-1";
const DEFAULT_LEGEND = "text-xs font-medium text-zinc-600 dark:text-zinc-400";
const DEFAULT_ENTRY =
  "inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300";

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
 *
 * Per-option children expansion: each option spawned by
 * `defaultResolveChildren` carries `meta.fieldOptionValue = option.value`,
 * so the form definition's children render once per option (with
 * `formData.option` + `formData.optionSelected` in scope for scripting).
 * The renderer looks each one up and renders it underneath the input/label
 * inside the option's wrapper div.
 */
export const RadioRenderer = controls<DataRendererProps>(
  "RadioRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, field, fieldOptions, disabled, readonly, definition } =
      node.getState(rc);
    const radioTheme = useHtmlTheme().data?.radio ?? {};
    const labelText = useLabelText(node, rc);
    if (!data) return null;
    const value = rc.getValue(data);
    const stored = valueToString(value);
    const groupName = id;
    const fieldsetClass = rendererClass(
      definition.styleClass,
      radioTheme.className ?? DEFAULT_FIELDSET,
    );

    // Per-option control classes from the form definition's renderOptions.
    const ro = (definition as { renderOptions?: RadioButtonRenderOptions })
      .renderOptions;
    const defEntryWrapper = ro?.entryWrapperClass ?? undefined;
    const defSelected = ro?.selectedClass ?? undefined;
    const defNotSelected = ro?.notSelectedClass ?? undefined;

    // Look up per-option children expanded by defaultResolveChildren —
    // each carries `meta.fieldOptionValue` matching its option's value.
    const children = node.getChildren(rc);
    const childByValue = new Map<unknown, FormStateNode>();
    for (const child of children) {
      const v = child.getState(rc).meta?.fieldOptionValue;
      if (v !== undefined) childByValue.set(v, child);
    }

    return (
      <fieldset
        id={id}
        disabled={disabled}
        className={fieldsetClass}
        aria-describedby={`${id}-error`}
      >
        {labelText && (
          <legend className={radioTheme.labelClass ?? DEFAULT_LEGEND}>
            {labelText}
          </legend>
        )}
        {(fieldOptions ?? []).map((o, i) => {
          const optValue = valueToString(o.value);
          const checked = stored === optValue;
          const entryWrapperClass = rendererClass(
            defEntryWrapper,
            radioTheme.entryWrapperClass,
          );
          const stateClass = checked
            ? rendererClass(defSelected, radioTheme.selectedClass)
            : rendererClass(defNotSelected, radioTheme.notSelectedClass);
          const inputId = `${id}_${i}`;
          const optChild = childByValue.get(o.value);
          return (
            <div key={optValue} className={clsx(entryWrapperClass, stateClass)}>
              <div className={radioTheme.entryClass ?? DEFAULT_ENTRY}>
                <input
                  id={inputId}
                  type="radio"
                  name={groupName}
                  value={optValue}
                  checked={checked}
                  disabled={disabled || readonly}
                  className={radioTheme.inputClass}
                  onChange={() =>
                    update((wc) =>
                      wc.setValue(data, stringToValue(optValue, field?.type)),
                    )
                  }
                  onBlur={() => update((wc) => wc.setTouched(data, true, true))}
                />
                <label htmlFor={inputId} className={radioTheme.labelClass}>
                  {o.name}
                </label>
              </div>
              {optChild && <Field node={optChild} />}
            </div>
          );
        })}
      </fieldset>
    );
  },
);
