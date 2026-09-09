"use client";

import { useEffect, useRef } from "react";
import { useReactive, type Rendered } from "@rxc/controls";
import { ActionScope, rendererClass, useDisclosure } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Trigger + modal pattern. Children whose `placement === "trigger"`
 * render inline; the rest render in a modal opened by the
 * `openDialog`/`closeDialog` action IDs. The controller owns the open
 * state + child partitioning + the ActionScope handler; the renderer owns
 * the native `<dialog>` element and its imperative `showModal()`/`close()`.
 */
export function DialogRenderer({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const c = useDisclosure(rc, node);
  const dialogTheme = useHtmlTheme().group.dialog;
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (c.open && !el.open) el.showModal();
    if (!c.open && el.open) el.close();
  }, [c.open]);

  const dialogClass = rendererClass(c.styleClass, dialogTheme.className);

  return rendered(
    <ActionScope onAction={(id) => c.handleAction(id)}>
      {c.triggerChildren.map((ch) => (
        <Field key={ch.uniqueId} node={ch} />
      ))}
      <dialog
        ref={dialogRef}
        onClose={() => c.setOpen(false)}
        className={dialogClass}
      >
        {c.title && <h2 className={dialogTheme.titleClass}>{c.title}</h2>}
        <div className={dialogTheme.containerClass}>
          {c.contentChildren.map((ch) => (
            <Field key={ch.uniqueId} node={ch} />
          ))}
        </div>
      </dialog>
    </ActionScope>
  );
}
