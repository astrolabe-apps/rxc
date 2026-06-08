"use client";

import { useEffect, useRef } from "react";
import { controls } from "@rxc/controls";
import { isDataControl } from "@rxc/forms-core";
import {
  rendererClass,
  useExternalEdit,
  type DataRendererProps,
} from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Modal host for the staged-edit (`editExternal`) flow.
 *
 * Bound to a collection field via a `dataControl(arrayField, ...,
 * { renderOptions: { type: ArrayElement } })` that's a SIBLING of the
 * `renderType: Array` control. Renders nothing until a staged-edit
 * session exists on the array, then pops a native `<dialog>` with the
 * draft form + Apply / Cancel.
 *
 * This matches the legacy `@react-typed-forms/schemas-html` convention
 * where the modal host is a separate data control bound to the same
 * array field — both controls resolve to the same underlying array
 * `Control`, so `useExternalEdit(node)` returns the same controller
 * the Array renderer's Add/Edit buttons drive.
 *
 * The modal applies for both `add` and `edit` sessions; the per-row
 * `ArrayElementRenderer` only dispatches `beginEdit`, it doesn't host
 * its own dialog.
 */
export const ArrayElementModalHostRenderer = controls<DataRendererProps>(
  "ArrayElementModalHostRenderer",
  ({ node, id }, { rc }) => {
    const { definition } = node.getState(rc);
    const arrayTheme = useHtmlTheme().data?.array ?? {};

    const editController = useExternalEdit(node);
    const session = editController.session(rc);

    const dialogRef = useRef<HTMLDialogElement | null>(null);
    useEffect(() => {
      const el = dialogRef.current;
      if (!el) return;
      if (session && !el.open) el.showModal();
      if (!session && el.open) el.close();
    }, [session]);

    const className = isDataControl(definition)
      ? rendererClass(definition.styleClass, undefined)
      : undefined;

    return (
      <dialog
        id={id}
        ref={dialogRef}
        onClose={() => editController.cancel()}
        className={arrayTheme.dialogClass}
      >
        {session ? (
          <div className={arrayTheme.dialogBodyClass}>
            <Field node={session.draftForm} />
            <div className={className ?? "flex justify-end gap-2"}>
              <button
                type="button"
                className={arrayTheme.cancelClass}
                onClick={() => editController.cancel()}
              >
                Cancel
              </button>
              <button
                type="button"
                className={arrayTheme.addClass}
                onClick={() => editController.apply()}
              >
                Apply
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    );
  },
);
