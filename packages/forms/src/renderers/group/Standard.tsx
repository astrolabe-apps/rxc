"use client";

import { controls } from "@rxc/controls";
import { Field } from "../../Field";
import type { GroupRendererProps } from "../../types";

export const StandardGroupRenderer = controls<GroupRendererProps>(
  "StandardGroupRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    return (
      <div className="flex flex-col gap-3 border border-zinc-200 dark:border-zinc-700 rounded p-3">
        {children.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </div>
    );
  },
);
