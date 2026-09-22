import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import { untrackedRead } from "@rx-controls/core";

export interface EditSession<T> {
  index: number;
  /** A copy of the element; `apply` writes it back. An ordinary control. */
  draft: Control<T>;
  /**
   * Opaque token of the boundary the edit began in, so that boundary can
   * recognise — and end — the session it started. See `ArrayActions.edit`.
   */
  origin?: unknown;
}

export interface ExternalEdit<T> {
  session(rc: ReadContext): EditSession<T> | undefined;
  beginEdit(index: number, origin?: unknown): void;
  apply(): void;
  cancel(): void;
}

const KEY = "$externalEdit";

/**
 * The staged-edit controller, cached on the **array control's meta** so the
 * collection and the sibling that hosts the modal share one session without
 * being anywhere near each other in the React tree.
 *
 * The draft is not bound to the array's region: the host renders it where the
 * host is, and reads the scope there. What ties a session to the region it
 * began in is the **collection boundary**, which cancels a session it started
 * when it locks or hides — it is the thing that re-renders when its scope
 * changes, whichever way the change arrived. The controller watches nothing
 * itself: a core `effect` here was tried first and could not see a lock that
 * came in as a React prop, because the boundary rebuilds its scope object on
 * re-render and the effect was holding the old one. README finding 19.
 */
export function getExternalEdit<T>(
  ctx: ControlContext,
  control: Control<T[]>,
): ExternalEdit<T> {
  const existing = peekExternalEdit(control);
  if (existing) return existing;

  const sessionControl = ctx.newControl<EditSession<T> | undefined>(undefined);
  const controller: ExternalEdit<T> = {
    session: (rc) => rc.getValue(sessionControl),
    beginEdit: (index, origin) => {
      const element = untrackedRead.getElements(control)[index];
      const draft = ctx.newControl<T>(
        structuredClone(untrackedRead.getValue(element)),
      );
      ctx.update((wc) => wc.setValue(sessionControl, { index, draft, origin }));
    },
    apply: () => {
      const s = untrackedRead.getValue(sessionControl);
      if (!s) return;
      const element = untrackedRead.getElements(control)[s.index];
      ctx.update((wc) => {
        wc.setValue(element, untrackedRead.getValue(s.draft));
        wc.setValue(sessionControl, undefined);
      });
    },
    cancel: () => ctx.update((wc) => wc.setValue(sessionControl, undefined)),
  };
  control.meta[KEY] = controller;
  return controller;
}

/** The controller if one has been created for this array; never creates one. */
export function peekExternalEdit<T>(
  control: Control<T[]>,
): ExternalEdit<T> | undefined {
  return control.meta[KEY] as ExternalEdit<T> | undefined;
}
