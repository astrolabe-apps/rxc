"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import { rendererClass, useAccordionSection } from "@rx-controls/forms-react-core";
import type { FormStateNode } from "@rx-controls/forms-core";
import type { GroupRendererProps } from "@rx-controls/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Accordion group: each child becomes a `<details>` section. Uses native
 * `<details>`/`<summary>` — semantic, accessible. Per-section open state
 * lives in {@link useAccordionSection}; the animated variant is provided by
 * `@rx-controls/forms-motion`.
 */
export function AccordionGroupRenderer({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const { definition } = node.getState(rc);
  const accTheme = useHtmlTheme().group.accordion;
  const children = node.getChildren(rc);
  const wrapperClass = rendererClass(definition.styleClass, accTheme.className);
  return rendered(
    <div className={wrapperClass}>
      {children.map((c) => (
        <AccordionSection key={c.uniqueId} node={c} />
      ))}
    </div>
  );
}

function AccordionSection({ node }: { node: FormStateNode }): Rendered {
  const { rc, rendered } = useReactive();
  const c = useAccordionSection(rc, node);
  const accTheme = useHtmlTheme().group.accordion;
  return rendered(
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
}
