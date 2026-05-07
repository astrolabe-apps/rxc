"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import { Field } from "../../Field";
import type { GroupRendererProps } from "@rxc/forms-react-core";

export const TabsRenderer = controls<GroupRendererProps>(
  "TabsRenderer",
  ({ node }, { rc }) => {
    const allChildren = node.getChildren(rc);
    const visibleChildren = allChildren.filter(
      (c) => c.getState(rc).visible !== false,
    );
    const [active, setActive] = useState(0);
    const safeIndex =
      active < visibleChildren.length ? active : 0;

    return (
      <div className="flex flex-col gap-2">
        <ul
          role="tablist"
          className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700"
        >
          {visibleChildren.map((c, i) => (
            <li key={c.uniqueId}>
              <button
                type="button"
                role="tab"
                aria-selected={i === safeIndex}
                aria-controls={`tabpanel-${c.uniqueId}`}
                onClick={() => setActive(i)}
                className={`px-3 py-1 text-sm rounded-t ${
                  i === safeIndex
                    ? "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-b-white dark:border-b-zinc-800 -mb-px"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {c.getState(rc).definition.title ?? `Tab ${i + 1}`}
              </button>
            </li>
          ))}
        </ul>
        <div role="tabpanel" id={`tabpanel-${visibleChildren[safeIndex]?.uniqueId}`}>
          {visibleChildren[safeIndex] && (
            <Field node={visibleChildren[safeIndex]} />
          )}
        </div>
      </div>
    );
  },
);
