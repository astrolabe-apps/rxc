"use client";

import { controls } from "@rxc/controls";
import { useLabelText } from "@rxc/forms-react-core";
import type { DataRendererProps } from "@rxc/forms-react-core";

/**
 * Bool checkbox that absorbs its label into the renderer's own DOM:
 * `<label><input type=checkbox /> {labelText}</label>`. Registered with
 * `hidesLabel: true` so Field skips emitting a separate `<Label>`.
 */
export const BoolRenderer = controls<DataRendererProps>(
  "BoolRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, disabled, readonly } = node.getState(rc);
    const labelText = useLabelText(node, rc);
    if (!data) return null;
    const checked = !!rc.getValue(data);
    return (
      <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          readOnly={readonly}
          aria-describedby={`${id}-error`}
          onChange={(e) =>
            update((wc) => wc.setValue(data, e.target.checked))
          }
          onBlur={() => update((wc) => wc.setTouched(data, true, true))}
        />
        {labelText && <span>{labelText}</span>}
      </label>
    );
  },
);
