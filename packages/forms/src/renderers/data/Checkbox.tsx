"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import {
  rendererClass,
  useCheckboxController,
  resolveLabelText,
} from "@rx-controls/forms-react-core";
import type { DataRendererProps } from "@rx-controls/forms-react-core";
import { useLabel } from "../../Label";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Checkbox with the label rendered inline next to the input:
 * `<span class="inline-flex"><input/> <Label>text</Label></span>`.
 *
 * Used as the default renderer for `FieldType.Bool` fields with no
 * explicit `renderOptions.type` and no options array, and registered
 * for the explicit `DataRenderType.Checkbox`. Hosts that want a
 * different default for Bool fields can register their own renderer
 * via `matchBoolField` (exported from `@rx-controls/forms`) before
 * `defaultRegistry()`.
 *
 * Registered with `hidesLabel: true` so `<Field>` skips its external
 * label slot; the renderer calls `<Label>` itself so the title still
 * picks up theme styling, the required indicator, AND label-kind
 * adornments (HelpText / Icon / etc.) — `<Label>` is the sole
 * composition point for those.
 *
 * Association is explicit: `<input id>` + `<Label htmlFor>`. Avoids
 * the implicit-label-with-redundant-htmlFor pattern that some AT
 * implementations handle oddly.
 *
 * `readonly` on a checkbox is a no-op per the HTML spec, so we
 * collapse it onto `disabled` to actually prevent toggling — matches
 * the Radio renderer's handling.
 */
export function CheckboxRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const c = useCheckboxController(rc, node);
  const checkboxTheme = useHtmlTheme().data.checkbox;
  const labelText = resolveLabelText(node, rc);
  const Label = useLabel();
  if (!c.data) return rendered(null);
  const wrapperClass = rendererClass(c.styleClass, checkboxTheme.className);
  return rendered(
    <span className={wrapperClass}>
      <input
        id={id}
        type="checkbox"
        checked={c.checked}
        disabled={c.disabled || c.readonly}
        required={c.required}
        aria-required={c.required || undefined}
        aria-invalid={c.hasError || undefined}
        aria-describedby={`${id}-error`}
        className={checkboxTheme.inputClass}
        onChange={(e) => c.onChange(e.target.checked)}
        onBlur={c.onBlur}
      />
      {labelText && (
        <Label node={node} htmlFor={id} id={`${id}-label`}>
          {labelText}
        </Label>
      )}
    </span>
  );
}
