"use client";

import { controls } from "@rxc/controls";
import {
  rendererClass,
  useElementSelectedController,
  useLabelText,
  type DataRendererProps,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Renderer for `DataRenderType.ElementSelected`.
 *
 * The bound data is an array; the controller resolves an `elementExpression`
 * to a per-element value and reports whether the array currently contains
 * that value. Toggling the checkbox adds or removes the value from the
 * array.
 *
 * Registered with `hidesLabel: true` — the renderer absorbs the label
 * inline like {@link CheckboxRenderer}.
 */
export const ElementSelectedRenderer = controls<DataRendererProps>(
  "ElementSelectedRenderer",
  ({ node, id }, { rc }) => {
    const c = useElementSelectedController(rc, node);
    const dataTheme = useHtmlTheme().data;
    const labelText = useLabelText(node, rc);
    if (!c.data) return null;
    const wrapperClass = rendererClass(
      c.styleClass,
      dataTheme.elementSelectedClass,
    );
    return (
      <label className={wrapperClass}>
        <input
          id={id}
          type="checkbox"
          checked={c.checked}
          disabled={c.disabled || c.disabledByElement}
          readOnly={c.readonly}
          aria-describedby={`${id}-error`}
          className={dataTheme.checkbox.inputClass}
          onChange={(e) => c.toggle(e.target.checked)}
          onBlur={c.onBlur}
        />
        {labelText && <span>{labelText}</span>}
      </label>
    );
  },
);
