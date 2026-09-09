"use client";

import { useReactive, type Rendered } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

export function StandardGroupRenderer({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const { definition } = node.getState(rc);
  const groupTheme = useHtmlTheme().group;
  const children = node.getChildren(rc);
  const className = rendererClass(
    definition.styleClass,
    groupTheme.standardClass,
  );
  return rendered(
    <div className={className}>
      {children.map((c) => (
        <Field key={c.uniqueId} node={c} />
      ))}
    </div>
  );
}
