"use client";

import { controls } from "@rxc/controls";
import {
  isDataControl,
  ValidatorType,
  type LengthValidator,
} from "@rxc/forms-core";
import { Field } from "../../Field";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";


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
    const arrayTheme = useHtmlTheme().data?.array ?? {};
    if (!data) return null;

    const children = node.getChildren(rc);
    const validators = isDataControl(definition)
      ? definition.validators
      : undefined;
    const { min, max } = getLengthRange(validators);
    const len = children.length;

    const wrapperClass = rendererClass(
      definition.styleClass,
      arrayTheme.className,
    );

    return (
      <div className={wrapperClass}>
        {children.map((child, i) => (
          <div
            key={child.uniqueId}
            className={arrayTheme.childClass}
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
              className={arrayTheme.removeClass}
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
          className={arrayTheme.addClass}
        >
          Add
        </button>
      </div>
    );
  },
);
