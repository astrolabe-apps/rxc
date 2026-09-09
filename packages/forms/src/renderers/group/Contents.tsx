"use client";

import { useReactive, type Rendered } from "@rxc/controls";
import { Field } from "../../Field";
import type { GroupRendererProps } from "@rxc/forms-react-core";

/**
 * Transparent passthrough — renders children with no wrapping element.
 * Useful for option-expansion groups (CheckList/Radio per-option) and
 * for embedding child fields in a parent's flex/grid flow.
 */
export function ContentsRenderer({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const children = node.getChildren(rc);
  return rendered(
    <>
      {children.map((c) => (
        <Field key={c.uniqueId} node={c} />
      ))}
    </>
  );
}
