"use client";

import { useEffect, useRef, useState } from "react";
import { controls } from "@rxc/controls";
import {
  isGroupControl,
  type DialogRenderOptions,
} from "@rxc/forms-core";
import { ActionScope } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import type { GroupRendererProps } from "@rxc/forms-react-core";

/**
 * Trigger + modal pattern. Children whose `placement === "trigger"`
 * render inline; the rest render in a modal opened by the
 * `openDialog`/`closeDialog` action IDs (intercepted via ActionScope).
 */
export const DialogRenderer = controls<GroupRendererProps>(
  "DialogRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    const def = node.getState(rc).definition;
    const opts = isGroupControl(def)
      ? (def.groupOptions as DialogRenderOptions | undefined)
      : undefined;
    const title = opts?.title ?? null;

    const [open, setOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
      const el = dialogRef.current;
      if (!el) return;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    }, [open]);

    const triggers = children.filter(
      (c) => c.getState(rc).definition.placement === "trigger",
    );
    const content = children.filter(
      (c) => c.getState(rc).definition.placement !== "trigger",
    );

    return (
      <ActionScope
        onAction={(id) => {
          if (id === "openDialog") {
            setOpen(true);
            return true;
          }
          if (id === "closeDialog") {
            setOpen(false);
            return true;
          }
          return undefined;
        }}
      >
        {triggers.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          className="rounded-lg p-6 max-w-lg w-full bg-white dark:bg-zinc-900 dark:text-zinc-100 backdrop:bg-black/40"
        >
          {title && (
            <h2 className="text-lg font-semibold mb-3">{title}</h2>
          )}
          <div className="flex flex-col gap-3">
            {content.map((c) => (
              <Field key={c.uniqueId} node={c} />
            ))}
          </div>
        </dialog>
      </ActionScope>
    );
  },
);
