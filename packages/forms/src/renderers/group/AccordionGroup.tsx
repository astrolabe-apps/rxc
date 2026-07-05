"use client";

import { controls } from "@rxc/controls";
import { rendererClass, useAccordionSection } from "@rxc/forms-react-core";
import type { FormStateNode } from "@rxc/forms-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Accordion group: each child becomes a `<details>` section. Uses native
 * `<details>`/`<summary>` — semantic, accessible. Per-section open state
 * lives in {@link useAccordionSection}; the animated variant is provided by
 * `@rxc/forms-motion`.
 */
export const AccordionGroupRenderer = controls<GroupRendererProps>(
  "AccordionGroupRenderer",
  ({ node }, { rc }) => {
    const { definition } = node.getState(rc);
    const accTheme = useHtmlTheme().group.accordion;
    const children = node.getChildren(rc);
    const wrapperClass = rendererClass(definition.styleClass, accTheme.className);
    return (
      <div className={wrapperClass}>
        {children.map((c) => (
          <AccordionSection key={c.uniqueId} node={c} />
        ))}
      </div>
    );
  },
);

const AccordionSection = controls<{ node: FormStateNode }>(
  "AccordionSection",
  ({ node }, { rc }) => {
    const c = useAccordionSection(rc, node);
    const accTheme = useHtmlTheme().group.accordion;
    return (
      <details
        open={c.open}
        onToggle={(e) => c.setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className={accTheme.sectionClass}
      >
        <summary className={accTheme.titleClass}>{c.title}</summary>
        <div className={accTheme.contentClass}>
          <Field node={node} />
        </div>
      </details>
    );
  },
);
