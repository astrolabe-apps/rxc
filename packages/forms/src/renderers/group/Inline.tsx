"use client";

import { controls } from "@rxc/controls";
import { Field } from "../../Field";
import type { GroupRendererProps } from "@rxc/forms-react-core";

/**
 * Inline group: lays out children horizontally as a `<span>`. Children
 * inherit the inline placement from their containing flow.
 */
export const InlineGroupRenderer = controls<GroupRendererProps>(
  "InlineGroupRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </span>
    );
  },
);
