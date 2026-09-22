import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import { getExternalEdit } from "./externalEdit.js";
import type { ScopeState } from "./scope.js";
import type { ArrayActions } from "./types.js";

export interface ArrayBounds {
  minLength?: number;
  maxLength?: number;
}

export interface ArrayActionOptions extends ArrayBounds {
  /**
   * The scope of the boundary these actions belong to; its locks fold into
   * the `can*` flags. A host building actions outside any boundary has none
   * to pass.
   */
  scope?: ScopeState;
  /**
   * An opaque token for that boundary. `edit` stamps it on the session, and
   * the boundary cancels a session carrying its own token when it locks or
   * hides.
   */
  origin?: unknown;
}

/**
 * `arrayActions`, not `useArrayActions`: it takes an `rc` and returns values,
 * with no React involved — the same reason §1 spells the prop resolver
 * `getProp`. Both the collection boundary and a host rendering its own buttons
 * outside the list call it.
 */
export function arrayActions<T>(
  rc: ReadContext,
  ctx: ControlContext,
  control: Control<T[]>,
  opts: ArrayActionOptions = {},
): ArrayActions {
  const elements = rc.isNull(control) ? [] : rc.getElements(control);
  const length = elements.length;
  const { minLength, maxLength, scope, origin } = opts;
  const locked =
    rc.isDisabled(control) ||
    (scope ? scope.disabled(rc) || scope.readOnly(rc) : false);
  return {
    length,
    canAdd: !locked && (maxLength === undefined || length < maxLength),
    canRemove: !locked && (minLength === undefined || length > minLength),
    canEdit: !locked,
    add: (value, index) =>
      ctx.update((wc) => wc.addElement(control, value as T, index)),
    remove: (index) => ctx.update((wc) => wc.removeElement(control, index)),
    move: (from, to) =>
      ctx.update((wc) =>
        wc.updateElements(control, (elems) => {
          const next = elems.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
        }),
      ),
    edit: (index) => getExternalEdit(ctx, control).beginEdit(index, origin),
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
