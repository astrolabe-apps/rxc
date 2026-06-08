"use client";

import { controls } from "@rxc/controls";
import type { FlexRenderer as FlexRenderOptions } from "@rxc/forms-core";
import { isGroupControl } from "@rxc/forms-core";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

export const FlexRenderer = controls<GroupRendererProps>(
  "FlexRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    const def = node.getState(rc).definition;
    const groupTheme = useHtmlTheme().group ?? {};
    const opts = isGroupControl(def)
      ? (def.groupOptions as FlexRenderOptions | undefined)
      : undefined;
    const direction = (opts?.direction as "row" | "column" | undefined) ?? "row";
    const gap = opts?.gap ?? groupTheme.defaultFlexGap;
    const className = rendererClass(def.styleClass, groupTheme.flexClass);
    return (
      <div
        className={className}
        style={{
          display: "flex",
          flexDirection: direction,
          gap,
        }}
      >
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </div>
    );
  },
);
