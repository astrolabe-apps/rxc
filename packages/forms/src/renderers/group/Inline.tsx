"use client";

import { controls } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Inline group: lays out children as raw inline content inside a `<span>`.
 * Children render with the `inline` flag (no per-child Layout wrapper) and
 * participate in natural text flow, so prose with embedded form controls
 * or action links wraps on word boundaries. Matches legacy
 * `defaultTailwindTheme.inlineClass = ""` — hosts that want a flex layout
 * should set `theme.group.inlineClass` (or per-control `styleClass`).
 */
export const InlineGroupRenderer = controls<GroupRendererProps>(
  "InlineGroupRenderer",
  ({ node }, { rc }) => {
    const { definition } = node.getState(rc);
    const groupTheme = useHtmlTheme().group;
    const children = node.getChildren(rc);
    const className = rendererClass(
      definition.styleClass,
      groupTheme.inlineClass,
    );
    return (
      <span className={className}>
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} inline />
        ))}
      </span>
    );
  },
);
