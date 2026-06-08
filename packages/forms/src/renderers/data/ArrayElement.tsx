"use client";

import { useEffect, useRef, useState } from "react";
import { controls } from "@rxc/controls";
import {
  type ArrayElementRenderOptions,
  type ArrayRenderOptions,
  isDataControl,
} from "@rxc/forms-core";
import {
  rendererClass,
  useExternalEdit,
  type DataRendererProps,
} from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Per-element renderer used inside an array. Shows a one-line summary
 * + an "Edit" button.
 *
 * Behavior depends on whether the parent array opts into editExternal:
 *
 * - **`editExternal: true` on parent array** — Edit dispatches
 *   `beginEdit(elementIndex)` on the array's shared `useExternalEdit`
 *   controller. The modal that displays the draft is rendered by a
 *   sibling `renderType: ArrayElement` data control bound to the same
 *   array field (`ArrayElementModalHostRenderer`), not by this
 *   component. Without the sibling, clicking Edit stages a draft that
 *   has no UI host.
 *
 * - **`editExternal` unset / false** — Edit opens a local `<dialog>`
 *   that renders the live element's children (legacy compact-view UX).
 *   Mutations to the children commit immediately.
 *
 * `showInline: true` on this renderer's own `renderOptions` skips both
 * paths and renders the live children inline.
 */
export const ArrayElementRenderer = controls<DataRendererProps>(
  "ArrayElementRenderer",
  ({ node, id }, { rc }) => {
    const { data, definition } = node.getState(rc);
    const aeTheme = useHtmlTheme().data?.arrayElement ?? {};
    const renderOptions = isDataControl(definition)
      ? (definition.renderOptions as ArrayElementRenderOptions | undefined)
      : undefined;
    const showInline = !!renderOptions?.showInline;

    // Parent array context — present whenever this renderer fires (the
    // matcher requires `elementIndex` to be set). When `editExternal` is
    // on the array, this renderer dispatches through the parent's
    // staged-edit controller rather than mutating the live element. The
    // modal display lives on a sibling control bound to the same array.
    const parentArray = node.parentNode;
    const parentDef = parentArray?.getState(rc).definition;
    const parentRenderOpts =
      parentDef && isDataControl(parentDef)
        ? (parentDef.renderOptions as ArrayRenderOptions | undefined)
        : undefined;
    const editExternal = !!parentRenderOpts?.editExternal;
    const elementIndex = node.parent.cursor(rc).elementIndex;

    // Controller is cheap (memoized on node.meta). Not a React hook;
    // safe to call conditionally.
    const editController =
      editExternal && parentArray ? useExternalEdit(parentArray) : null;

    const liveChildren = node.getChildren(rc);
    const [open, setOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
      if (showInline) return;
      const el = dialogRef.current;
      if (!el) return;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    }, [open, showInline]);

    const className = rendererClass(definition.styleClass, aeTheme.className);

    if (showInline) {
      return (
        <div id={id} className={aeTheme.innerClass}>
          {liveChildren.map((c) => (
            <Field key={c.uniqueId} node={c} />
          ))}
        </div>
      );
    }

    const summary = data ? formatSummary(rc.getValue(data)) : "";

    const handleEditClick = () => {
      if (editExternal && editController && elementIndex !== undefined) {
        editController.beginEdit(elementIndex);
        return;
      }
      setOpen(true);
    };

    return (
      <div id={id} className={className}>
        <span className={aeTheme.summaryClass}>{summary || "(empty)"}</span>
        <button
          type="button"
          className={aeTheme.buttonClass}
          onClick={handleEditClick}
        >
          Edit
        </button>
        {/* Local dialog ONLY for the non-editExternal path. With
         *  editExternal, the sibling `ArrayElementModalHostRenderer`
         *  displays the staged draft on the array's shared session. */}
        {!editExternal ? (
          <dialog
            ref={dialogRef}
            onClose={() => setOpen(false)}
            className={aeTheme.dialogClass}
          >
            <div className={aeTheme.innerClass}>
              {liveChildren.map((c) => (
                <Field key={c.uniqueId} node={c} />
              ))}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={aeTheme.buttonClass}
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </dialog>
        ) : null}
      </div>
    );
  },
);

function formatSummary(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    for (const key of Object.keys(v)) {
      const x = v[key];
      if (x != null && (typeof x === "string" || typeof x === "number")) {
        return String(x);
      }
    }
    return JSON.stringify(value);
  }
  return String(value);
}
