"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_WRAPPER = "flex flex-col gap-2";
const DEFAULT_TABLIST =
  "flex gap-1 border-b border-zinc-200 dark:border-zinc-700";
const DEFAULT_TAB = "px-3 py-1 text-sm rounded-t";
const DEFAULT_ACTIVE_TAB =
  "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-b-white dark:border-b-zinc-800 -mb-px";
const DEFAULT_INACTIVE_TAB =
  "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100";

export const TabsRenderer = controls<GroupRendererProps>(
  "TabsRenderer",
  ({ node }, { rc }) => {
    const { definition } = node.getState(rc);
    const tabsTheme = useHtmlTheme().group?.tabs ?? {};
    const allChildren = node.getChildren(rc);
    const visibleChildren = allChildren.filter(
      (c) => c.getState(rc).visible !== false,
    );
    const [active, setActive] = useState(0);
    const safeIndex = active < visibleChildren.length ? active : 0;

    const wrapperClass = rendererClass(
      definition.styleClass,
      tabsTheme.className ?? DEFAULT_WRAPPER,
    );

    return (
      <div className={wrapperClass}>
        <ul
          role="tablist"
          className={tabsTheme.tabListClass ?? DEFAULT_TABLIST}
        >
          {visibleChildren.map((c, i) => {
            const isActive = i === safeIndex;
            const tabBase = tabsTheme.tabClass ?? DEFAULT_TAB;
            const tabState = isActive
              ? tabsTheme.activeTabClass ?? DEFAULT_ACTIVE_TAB
              : tabsTheme.inactiveTabClass ?? DEFAULT_INACTIVE_TAB;
            return (
              <li key={c.uniqueId}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${c.uniqueId}`}
                  onClick={() => setActive(i)}
                  className={`${tabBase} ${tabState}`.trim()}
                >
                  {c.getState(rc).definition.title ?? `Tab ${i + 1}`}
                </button>
              </li>
            );
          })}
        </ul>
        <div
          role="tabpanel"
          id={`tabpanel-${visibleChildren[safeIndex]?.uniqueId}`}
          className={tabsTheme.contentClass}
        >
          {visibleChildren[safeIndex] && (
            <Field node={visibleChildren[safeIndex]} />
          )}
        </div>
      </div>
    );
  },
);
