"use client";

import { useEffect, useRef, useState } from "react";
import { controls } from "@rxc/controls";
import {
  isDataControl,
  type ArrayElementRenderOptions,
} from "@rxc/forms-core";
import {
  rendererClass,
  type DataRendererProps,
} from "@rxc/forms-react-core";
import { Field } from "../../Field";

const DEFAULT_WRAPPER = "flex items-center gap-2 justify-between";
const DEFAULT_SUMMARY = "flex-1 truncate text-sm";
const DEFAULT_BTN =
  "px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600";
const DEFAULT_DIALOG =
  "rounded-lg p-6 max-w-lg w-full bg-white dark:bg-zinc-900 dark:text-zinc-100 backdrop:bg-black/40";
const DEFAULT_INNER = "flex flex-col gap-3";

/**
 * Per-element renderer used inside an array. Shows a one-line summary
 * + an "Edit" button; clicking the button opens a `<dialog>` that
 * renders the element's full form.
 *
 * `showInline: true` (from `ArrayElementRenderOptions`) skips the
 * dialog and renders the element's children inline.
 */
export const ArrayElementRenderer = controls<DataRendererProps>(
  "ArrayElementRenderer",
  ({ node, id }, { rc }) => {
    const { data, definition } = node.getState(rc);
    const renderOptions = isDataControl(definition)
      ? (definition.renderOptions as ArrayElementRenderOptions | undefined)
      : undefined;
    const showInline = !!renderOptions?.showInline;

    const children = node.getChildren(rc);
    const [open, setOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
      if (showInline) return;
      const el = dialogRef.current;
      if (!el) return;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    }, [open, showInline]);

    const className = rendererClass(definition.styleClass, DEFAULT_WRAPPER);

    if (showInline) {
      return (
        <div id={id} className={DEFAULT_INNER}>
          {children.map((c) => (
            <Field key={c.uniqueId} node={c} />
          ))}
        </div>
      );
    }

    const summary = data ? formatSummary(rc.getValue(data)) : "";

    return (
      <div id={id} className={className}>
        <span className={DEFAULT_SUMMARY}>{summary || "(empty)"}</span>
        <button
          type="button"
          className={DEFAULT_BTN}
          onClick={() => setOpen(true)}
        >
          Edit
        </button>
        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          className={DEFAULT_DIALOG}
        >
          <div className={DEFAULT_INNER}>
            {children.map((c) => (
              <Field key={c.uniqueId} node={c} />
            ))}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={DEFAULT_BTN}
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </dialog>
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
