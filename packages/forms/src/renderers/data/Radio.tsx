"use client";

import { controls } from "@rxc/controls";
import {
  FieldType,
  type FormStateNode,
  type RadioButtonRenderOptions,
} from "@rxc/forms-core";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { clsx, rendererClass } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";


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
 * Radio group. Field emits the external label (via the standard `<Label>`
 * dispatch + label-kind adornments); the renderer uses `aria-labelledby`
 * to wire it as the fieldset's accessible name. No legend — keeps the
 * markup symmetrical with every other data field and lets the host CSS
 * style the label via the bare `<label>` element selector.
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
    if (!data) return null;
    const value = rc.getValue(data);
    const stored = valueToString(value);
    const groupName = id;
    const fieldsetClass = rendererClass(
      definition.styleClass,
      radioTheme.className,
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
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-error`}
      >
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
              <div className={radioTheme.entryClass}>
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
