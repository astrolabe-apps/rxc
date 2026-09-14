"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import type { DataRendererProps } from "@rx-controls/forms-react-core";
import {
  clsx,
  rendererClass,
  useChecklistController,
} from "@rx-controls/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Multi-select via checkboxes against a collection field. Stores an
 * array of selected option values. Field emits the external label (via
 * the standard `<Label>` dispatch + label-kind adornments); the renderer
 * uses `aria-labelledby` to wire it as the fieldset's accessible name.
 *
 * Per-option children expansion: each option spawned by
 * `defaultResolveChildren` carries `meta.fieldOptionValue = option.value`,
 * so the form definition's children render once per option (with
 * `formData.option` + `formData.optionSelected` in scope for scripting).
 * The controller resolves each `entry.child`; rendered inside the wrapper.
 */
export function ChecklistRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const c = useChecklistController(rc, node);
  const checkTheme = useHtmlTheme().data.checkList;
  if (!c.data) return rendered(null);
  const fieldsetClass = rendererClass(c.styleClass, checkTheme.className);
  const entryWrapperClass = rendererClass(
    c.entryWrapperClass,
    checkTheme.entryWrapperClass,
  );

  return rendered(
    <fieldset
      id={id}
      disabled={c.disabled}
      className={fieldsetClass}
      aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-error`}
    >
      {c.entries.map((entry, i) => {
        const stateClass = entry.checked
          ? rendererClass(c.selectedClass, checkTheme.selectedClass)
          : rendererClass(c.notSelectedClass, checkTheme.notSelectedClass);
        const inputId = `${id}_${i}`;
        return (
          <div
            key={String(entry.option.value)}
            className={clsx(entryWrapperClass, stateClass)}
          >
            <div className={checkTheme.entryClass}>
              <input
                id={inputId}
                type="checkbox"
                checked={entry.checked}
                disabled={c.disabled || c.readonly}
                className={checkTheme.inputClass}
                onChange={(e) => c.toggle(entry.option.value, e.target.checked)}
                onBlur={c.onBlur}
              />
              <label htmlFor={inputId} className={checkTheme.labelClass}>
                {entry.option.name}
              </label>
            </div>
            {entry.child && <Field node={entry.child} />}
          </div>
        );
      })}
    </fieldset>
  );
}
