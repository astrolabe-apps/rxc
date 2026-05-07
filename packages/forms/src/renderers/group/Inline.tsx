"use client";

import { controls } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_CLASS = "inline-flex flex-wrap items-center gap-2";

/**
 * Inline group: lays out children horizontally as a `<span>`. Children
 * inherit the inline placement from their containing flow.
 */
export const InlineGroupRenderer = controls<GroupRendererProps>(
  "InlineGroupRenderer",
  ({ node }, { rc }) => {
    const { definition } = node.getState(rc);
    const groupTheme = useHtmlTheme().group ?? {};
    const children = node.getChildren(rc);
    const className = rendererClass(
      definition.styleClass,
      groupTheme.inlineClass ?? DEFAULT_CLASS,
    );
    return (
      <span className={className}>
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </span>
    );
  },
);
