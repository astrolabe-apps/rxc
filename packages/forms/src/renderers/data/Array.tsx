"use client";

import { controls } from "@rxc/controls";
import {
  isDataControl,
  ValidatorType,
  type LengthValidator,
} from "@rxc/forms-core";
import { Field } from "../../Field";
import type { DataRendererProps } from "../../types";

interface ArrayLengthRange {
  min: number;
  max: number;
}

function getLengthRange(
  validators: { type: string }[] | null | undefined,
): ArrayLengthRange {
  let min = 0;
  let max = Infinity;
  if (!validators) return { min, max };
  for (const v of validators) {
    if (v.type === ValidatorType.Length) {
      const lv = v as LengthValidator;
      if (lv.min != null) min = lv.min;
      if (lv.max != null) max = lv.max;
    }
  }
  return { min, max };
}

/**
 * Renders a list of array elements (one per child) plus add/remove
 * buttons. Add/remove mutate the underlying array control directly
 * (`wc.addElement`/`wc.removeElement`) — Phase 3 will route this through
 * `<ActionScope>` if action infrastructure is needed for arrays. For
 * Phase 2 the renderer drives mutations itself.
 */
export const ArrayRenderer = controls<DataRendererProps>(
  "ArrayRenderer",
  ({ node }, { rc, update }) => {
    const { data, definition } = node.getState(rc);
    if (!data) return null;

    const children = node.getChildren(rc);
    const validators = isDataControl(definition)
      ? definition.validators
      : undefined;
    const { min, max } = getLengthRange(validators);
    const len = children.length;

    return (
      <div className="flex flex-col gap-3">
        {children.map((child, i) => (
          <div
            key={child.uniqueId}
            className="flex items-start gap-2 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3"
          >
            <div className="flex-1">
              <Field node={child} />
            </div>
            <button
              type="button"
              disabled={len <= min}
              onClick={() => {
                update((wc) =>
                  wc.removeElement(
                    data as Parameters<typeof wc.removeElement>[0],
                    i,
                  ),
                );
              }}
              className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={len >= max}
          onClick={() =>
            update((wc) =>
              wc.addElement(data as Parameters<typeof wc.addElement>[0], null),
            )
          }
          className="self-start text-xs px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
    );
  },
);
