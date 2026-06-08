"use client";

import { useMemo } from "react";
import { controls } from "@rxc/controls";
import {
  isDataControl,
  type ElementSelectedRenderOptions,
} from "@rxc/forms-core";
import {
  rendererClass,
  useExpression,
  useLabelText,
  type DataRendererProps,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Renderer for `DataRenderType.ElementSelected`.
 *
 * The bound data is an array; the renderer resolves an `elementExpression`
 * to a per-element value and shows a checkbox indicating whether the
 * array currently contains that value. Toggling the checkbox adds or
 * removes the value from the array.
 *
 * Registered with `hidesLabel: true` — the renderer absorbs the label
 * inline like {@link CheckboxRenderer}.
 */
export const ElementSelectedRenderer = controls<DataRendererProps>(
  "ElementSelectedRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, disabled, readonly, definition } = node.getState(rc);
    const dataTheme = useHtmlTheme().data ?? {};
    const elementSelectedClass = dataTheme.elementSelectedClass;
    const checkboxTheme = dataTheme.checkbox ?? {};
    const labelText = useLabelText(node, rc);

    const elementExpression = isDataControl(definition)
      ? (definition.renderOptions as ElementSelectedRenderOptions | undefined)
          ?.elementExpression
      : undefined;
    // Stabilize identity so useExpression only re-registers when the
    // expression definition actually changes.
    const stableExpr = useMemo(
      () => elementExpression,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [elementExpression?.type, JSON.stringify(elementExpression ?? null)],
    );
    const elementValue = useExpression(rc, node, stableExpr);

    if (!data) return null;
    const arr = rc.getValue(data) as unknown[] | undefined;
    const checked = Array.isArray(arr) ? arr.includes(elementValue) : false;
    const wrapperClass = rendererClass(
      definition.styleClass,
      elementSelectedClass,
    );
    return (
      <label className={wrapperClass}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled || elementValue === undefined}
          readOnly={readonly}
          aria-describedby={`${id}-error`}
          className={checkboxTheme.inputClass}
          onChange={(e) => {
            const next = e.target.checked;
            update((wc) => {
              const current = (rc.getValue(data) as unknown[] | undefined) ?? [];
              if (next) {
                if (!current.includes(elementValue)) {
                  wc.setValue(data, [...current, elementValue]);
                }
              } else {
                wc.setValue(
                  data,
                  current.filter((x) => x !== elementValue),
                );
              }
            });
          }}
          onBlur={() => update((wc) => wc.setTouched(data, true, true))}
        />
        {labelText && <span>{labelText}</span>}
      </label>
    );
  },
);
