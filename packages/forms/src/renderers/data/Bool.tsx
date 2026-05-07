"use client";

import { controls } from "@rxc/controls";
import { useLabelText } from "@rxc/forms-react-core";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_WRAPPER =
  "inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300";

/**
 * Bool checkbox that absorbs its label into the renderer's own DOM:
 * `<label><input type=checkbox /> {labelText}</label>`. Registered with
 * `hidesLabel: true` so Field skips emitting a separate `<Label>`.
 */
export const BoolRenderer = controls<DataRendererProps>(
  "BoolRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, disabled, readonly, definition } = node.getState(rc);
    const boolTheme = useHtmlTheme().data?.bool ?? {};
    const labelText = useLabelText(node, rc);
    if (!data) return null;
    const checked = !!rc.getValue(data);
    const wrapperClass = rendererClass(
      definition.styleClass,
      boolTheme.className ?? DEFAULT_WRAPPER,
    );
    return (
      <label className={wrapperClass}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          readOnly={readonly}
          aria-describedby={`${id}-error`}
          className={boolTheme.inputClass}
          onChange={(e) =>
            update((wc) => wc.setValue(data, e.target.checked))
          }
          onBlur={() => update((wc) => wc.setTouched(data, true, true))}
        />
        {labelText && (
          <span className={boolTheme.labelClass}>{labelText}</span>
        )}
      </label>
    );
  },
);
