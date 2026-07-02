"use client";

import { controls } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

export const StandardGroupRenderer = controls<GroupRendererProps>(
  "StandardGroupRenderer",
  ({ node }, { rc }) => {
    const { definition } = node.getState(rc);
    const groupTheme = useHtmlTheme().group;
    const children = node.getChildren(rc);
    const className = rendererClass(
      definition.styleClass,
      groupTheme.standardClass,
    );
    return (
      <div className={className}>
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </div>
    );
  },
);
