"use client";

import { controls } from "@rxc/controls";
import type {
  CheckListRenderOptions,
  FormStateNode,
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

/**
 * Multi-select via checkboxes against a collection field. Stores an
 * array of selected option values. Registered with `hidesLabel: true`
 * — `<legend>` is the label.
 *
 * Per-option children expansion: each option spawned by
 * `defaultResolveChildren` carries `meta.fieldOptionValue = option.value`,
 * so the form definition's children render once per option (with
 * `formData.option` + `formData.optionSelected` in scope for scripting).
 * Looked up and rendered inside the option's wrapper.
 */
export const ChecklistRenderer = controls<DataRendererProps>(
  "ChecklistRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, fieldOptions, disabled, readonly, definition } =
      node.getState(rc);
    const checkTheme = useHtmlTheme().data?.checkList ?? {};
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

    const fieldsetClass = rendererClass(
      definition.styleClass,
      checkTheme.className ?? DEFAULT_FIELDSET,
    );

    const ro = (definition as { renderOptions?: CheckListRenderOptions })
      .renderOptions;
    const defEntryWrapper = ro?.entryWrapperClass ?? undefined;
    const defSelected = ro?.selectedClass ?? undefined;
    const defNotSelected = ro?.notSelectedClass ?? undefined;

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
          <legend className={checkTheme.labelClass ?? DEFAULT_LEGEND}>
            {labelText}
          </legend>
        )}
        {(fieldOptions ?? []).map((o, i) => {
          const optKey = String(o.value);
          const isChecked = selected.includes(o.value);
          const entryWrapperClass = rendererClass(
            defEntryWrapper,
            checkTheme.entryWrapperClass,
          );
          const stateClass = isChecked
            ? rendererClass(defSelected, checkTheme.selectedClass)
            : rendererClass(defNotSelected, checkTheme.notSelectedClass);
          const inputId = `${id}_${i}`;
          const optChild = childByValue.get(o.value);
          return (
            <div key={optKey} className={clsx(entryWrapperClass, stateClass)}>
              <div className={checkTheme.entryClass ?? DEFAULT_ENTRY}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled || readonly}
                  className={checkTheme.inputClass}
                  onChange={(e) => toggle(o.value, e.target.checked)}
                  onBlur={() => update((wc) => wc.setTouched(data!, true, true))}
                />
                <label htmlFor={inputId} className={checkTheme.labelClass}>
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
