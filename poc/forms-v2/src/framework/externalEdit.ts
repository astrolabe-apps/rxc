import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import { untrackedRead } from "@rx-controls/core";
import { createFormField, scopeOf } from "./schema.js";
import type { FormField } from "./types.js";

export interface EditSession<T> {
  index: number;
  draft: Control<T>;
  /** Bound in the *array's* scope, wherever the modal later renders. */
  field: FormField<T>;
}

export interface ExternalEdit<T> {
  session(rc: ReadContext): EditSession<T> | undefined;
  /**
   * `from` is the row's own field — the scoped one the collection boundary
   * handed to the row callback. That is where the array's scope is known; the
   * array field a host holds outside the boundary carries none.
   */
  beginEdit(index: number, from?: FormField<unknown>): void;
  apply(): void;
  cancel(): void;
}

const KEY = "$externalEdit";

/**
 * The staged-edit controller, cached on the **array control's meta** so the
 * collection and the sibling that hosts the modal share one session without
 * being anywhere near each other in the React tree.
 *
 * This is the case that decides whether `FormField` is worth having: the draft
 * belongs to the array's scope, and the modal renders somewhere else.
 */
export function getExternalEdit<T>(
  ctx: ControlContext,
  field: FormField<T[]>,
): ExternalEdit<T> {
  const arrayControl = field.control;
  const existing = arrayControl.meta[KEY] as ExternalEdit<T> | undefined;
  if (existing) return existing;

  const sessionControl = ctx.newControl<EditSession<T> | undefined>(undefined);
  const controller: ExternalEdit<T> = {
    session: (rc) => rc.getValue(sessionControl),
    beginEdit: (index, from) => {
      const element = untrackedRead.getElements(arrayControl)[index];
      const draft = ctx.newControl<T>(
        structuredClone(untrackedRead.getValue(element)),
      );
      // Captured here, at bind time, from the field that knows the scope.
      const bound = createFormField(draft, scopeOf(from ?? field));
      ctx.update((wc) =>
        wc.setValue(sessionControl, { index, draft, field: bound }),
      );
    },
    apply: () => {
      const s = untrackedRead.getValue(sessionControl);
      if (!s) return;
      const element = untrackedRead.getElements(arrayControl)[s.index];
      ctx.update((wc) => {
        wc.setValue(element, untrackedRead.getValue(s.draft));
        wc.setValue(sessionControl, undefined);
      });
    },
    cancel: () => ctx.update((wc) => wc.setValue(sessionControl, undefined)),
  };
  arrayControl.meta[KEY] = controller;
  return controller;
}
