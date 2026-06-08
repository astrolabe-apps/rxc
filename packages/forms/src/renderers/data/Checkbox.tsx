"use client";

import { controls } from "@rxc/controls";
import { isDataControl } from "@rxc/forms-core";
import { useLabelText } from "@rxc/forms-react-core";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
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
 * via `matchBoolField` (exported from `@rxc/forms`) before
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
export const CheckboxRenderer = controls<DataRendererProps>(
  "CheckboxRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, disabled, readonly, touched, definition } =
      node.getState(rc);
    const checkboxTheme = useHtmlTheme().data?.checkbox ?? {};
    const labelText = useLabelText(node, rc);
    const Label = useLabel();
    if (!data) return null;
    const required = isDataControl(definition) && !!definition.required;
    const checked = !!rc.getValue(data);
    const hasError = touched && !!rc.getError(data);
    const wrapperClass = rendererClass(
      definition.styleClass,
      checkboxTheme.className,
    );
    return (
      <span className={wrapperClass}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled || readonly}
          required={required}
          aria-required={required || undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={`${id}-error`}
          className={checkboxTheme.inputClass}
          onChange={(e) =>
            update((wc) => wc.setValue(data, e.target.checked))
          }
          onBlur={() => update((wc) => wc.setTouched(data, true, true))}
        />
        {labelText && (
          <Label node={node} htmlFor={id} id={`${id}-label`}>
            {labelText}
          </Label>
        )}
      </span>
    );
  },
);
