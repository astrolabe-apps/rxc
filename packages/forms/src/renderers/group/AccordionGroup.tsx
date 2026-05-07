"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_WRAPPER = "flex flex-col gap-2";
const DEFAULT_SECTION =
  "rounded border border-zinc-200 dark:border-zinc-700 p-2";
const DEFAULT_TITLE =
  "cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300";
const DEFAULT_CONTENT = "mt-2";

/**
 * Accordion group: each child becomes a `<details>` section. Uses native
 * `<details>`/`<summary>` for v1 — semantic, accessible, no JS state
 * needed. Animated variant deferred to Phase 4b.
 */
export const AccordionGroupRenderer = controls<GroupRendererProps>(
  "AccordionGroupRenderer",
  ({ node }, { rc }) => {
    const { definition } = node.getState(rc);
    const accTheme = useHtmlTheme().group?.accordion ?? {};
    const children = node.getChildren(rc);
    const wrapperClass = rendererClass(
      definition.styleClass,
      accTheme.className ?? DEFAULT_WRAPPER,
    );
    return (
      <div className={wrapperClass}>
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
  const accTheme = useHtmlTheme().group?.accordion ?? {};
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className={DEFAULT_SECTION}
    >
      <summary className={accTheme.titleClass ?? DEFAULT_TITLE}>
        {def.title ?? "Section"}
      </summary>
      <div className={accTheme.contentClass ?? DEFAULT_CONTENT}>
        <Field node={node} />
      </div>
    </details>
  );
});
