"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import { Field } from "../../Field";
import type { GroupRendererProps } from "../../types";

/**
 * Accordion group: each child becomes a `<details>` section. Uses native
 * `<details>`/`<summary>` for v1 — semantic, accessible, no JS state
 * needed. Animated variant deferred to Phase 4b.
 */
export const AccordionGroupRenderer = controls<GroupRendererProps>(
  "AccordionGroupRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    return (
      <div className="flex flex-col gap-2">
        {children.map((c) => (
          <AccordionSection key={c.uniqueId} node={c} />
        ))}
      </div>
    );
  },
);

const AccordionSection = controls<{
  node: import("@rxc/forms-core").FormStateNode;
}>("AccordionSection", ({ node }, { rc }) => {
  const def = node.getState(rc).definition;
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded border border-zinc-200 dark:border-zinc-700 p-2"
    >
      <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {def.title ?? "Section"}
      </summary>
      <div className="mt-2">
        <Field node={node} />
      </div>
    </details>
  );
});
