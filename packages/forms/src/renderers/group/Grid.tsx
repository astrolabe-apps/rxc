"use client";

import { controls } from "@rxc/controls";
import type { GridRendererOptions } from "@rxc/forms-core";
import { isGroupControl } from "@rxc/forms-core";
import { Field } from "../../Field";
import type { GroupRendererProps } from "../../types";

export const GridRenderer = controls<GroupRendererProps>(
  "GridRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    const def = node.getState(rc).definition;
    const opts = isGroupControl(def)
      ? (def.groupOptions as GridRendererOptions | undefined)
      : undefined;
    const columns = opts?.columns ?? 2;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: "0.75rem",
        }}
      >
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </div>
    );
  },
);
