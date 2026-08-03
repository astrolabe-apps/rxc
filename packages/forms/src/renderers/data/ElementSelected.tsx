"use client";

import { useControls, type Rendered } from "@rxc/controls";
import {
  rendererClass,
  useElementSelectedController,
  resolveLabelText,
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
export function ElementSelectedRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useControls();
  const c = useElementSelectedController(rc, node);
  const dataTheme = useHtmlTheme().data;
  const labelText = resolveLabelText(node, rc);
  if (!c.data) return rendered(null);
  const wrapperClass = rendererClass(
    c.styleClass,
    dataTheme.elementSelectedClass,
  );
  return rendered(
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
}
