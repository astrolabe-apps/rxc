import type { ReadContext, WriteContext } from "@rx-controls/core";
import type { ArrayActions, FormField } from "./types.js";

export interface ArrayBounds {
  minLength?: number;
  maxLength?: number;
}

/**
 * `arrayActions`, not `useArrayActions`: it takes an `rc` and returns values,
 * with no React involved — the same reason §1 spells the prop resolver
 * `getProp`. Both the collection boundary and a host rendering its own buttons
 * outside the list call it.
 */
export function arrayActions<T>(
  rc: ReadContext,
  update: (cb: (wc: WriteContext) => void) => void,
  field: FormField<T[]>,
  bounds: ArrayBounds = {},
): ArrayActions {
  const control = field.control;
  const elements = rc.isNull(control) ? [] : rc.getElements(control);
  const length = elements.length;
  const { minLength, maxLength } = bounds;
  return {
    length,
    canAdd: maxLength === undefined || length < maxLength,
    canRemove: minLength === undefined || length > minLength,
    add: (value, index) =>
      update((wc) => wc.addElement(control, value as T, index)),
    remove: (index) => update((wc) => wc.removeElement(control, index)),
    move: (from, to) =>
      update((wc) =>
        wc.updateElements(control, (elems) => {
          const next = elems.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
        }),
      ),
  };
}

export function lengthValidator<T>(
  bounds: ArrayBounds,
): (v: T[] | null | undefined) => string | null {
  return (v) => {
    const n = v?.length ?? 0;
    if (bounds.minLength !== undefined && n < bounds.minLength)
      return `At least ${bounds.minLength} required`;
    if (bounds.maxLength !== undefined && n > bounds.maxLength)
      return `At most ${bounds.maxLength} allowed`;
    return null;
  };
}
