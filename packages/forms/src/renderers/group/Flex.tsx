"use client";

import { controls } from "@rxc/controls";
import type { FlexRenderer as FlexRenderOptions } from "@rxc/forms-core";
import { isGroupControl } from "@rxc/forms-core";
import { Field } from "../../Field";
import type { GroupRendererProps } from "../../types";

export const FlexRenderer = controls<GroupRendererProps>(
  "FlexRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    const def = node.getState(rc).definition;
    const opts = isGroupControl(def)
      ? (def.groupOptions as FlexRenderOptions | undefined)
      : undefined;
    const direction = (opts?.direction as "row" | "column" | undefined) ?? "row";
    const gap = opts?.gap ?? "0.75rem";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: direction,
          gap,
          flexWrap: "wrap",
        }}
      >
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </div>
    );
  },
);
