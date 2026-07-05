"use client";

import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { clsx, rendererClass, useRadioController } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

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
 * The controller resolves each `entry.child`; the renderer renders it
 * underneath the input/label inside the option's wrapper div.
 */
export const RadioRenderer = controls<DataRendererProps>(
  "RadioRenderer",
  ({ node, id }, { rc }) => {
    const c = useRadioController(rc, node);
    const radioTheme = useHtmlTheme().data.radio;
    if (!c.data) return null;
    const fieldsetClass = rendererClass(c.styleClass, radioTheme.className);
    const entryWrapperClass = rendererClass(
      c.entryWrapperClass,
      radioTheme.entryWrapperClass,
    );

    return (
      <fieldset
        id={id}
        disabled={c.disabled}
        className={fieldsetClass}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-error`}
      >
        {c.entries.map((entry, i) => {
          const stateClass = entry.selected
            ? rendererClass(c.selectedClass, radioTheme.selectedClass)
            : rendererClass(c.notSelectedClass, radioTheme.notSelectedClass);
          const inputId = `${id}_${i}`;
          return (
            <div
              key={entry.valueString}
              className={clsx(entryWrapperClass, stateClass)}
            >
              <div className={radioTheme.entryClass}>
                <input
                  id={inputId}
                  type="radio"
                  name={id}
                  value={entry.valueString}
                  checked={entry.selected}
                  disabled={c.disabled || c.readonly}
                  className={radioTheme.inputClass}
                  onChange={() => c.onSelect(entry.valueString)}
                  onBlur={c.onBlur}
                />
                <label htmlFor={inputId} className={radioTheme.labelClass}>
                  {entry.option.name}
                </label>
              </div>
              {entry.child && <Field node={entry.child} />}
            </div>
          );
        })}
      </fieldset>
    );
  },
);
