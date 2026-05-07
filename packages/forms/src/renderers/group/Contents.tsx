"use client";

import { controls } from "@rxc/controls";
import { Field } from "../../Field";
import type { GroupRendererProps } from "@rxc/forms-react-core";

/**
 * Transparent passthrough — renders children with no wrapping element.
 * Useful for option-expansion groups (CheckList/Radio per-option) and
 * for embedding child fields in a parent's flex/grid flow.
 */
export const ContentsRenderer = controls<GroupRendererProps>(
  "ContentsRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    return (
      <>
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </>
    );
  },
);
