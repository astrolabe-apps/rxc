"use client";

import { useState } from "react";
import { controls } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";


export const TabsRenderer = controls<GroupRendererProps>(
  "TabsRenderer",
  ({ node }, { rc }) => {
    const { definition } = node.getState(rc);
    const tabsTheme = useHtmlTheme().group.tabs;
    const allChildren = node.getChildren(rc);
    const visibleChildren = allChildren.filter(
      (c) => c.getState(rc).visible !== false,
    );
    const [active, setActive] = useState(0);
    const safeIndex = active < visibleChildren.length ? active : 0;

    const wrapperClass = rendererClass(
      definition.styleClass,
      tabsTheme.className,
    );

    return (
      <div className={wrapperClass}>
        <ul
          role="tablist"
          className={tabsTheme.tabListClass}
        >
          {visibleChildren.map((c, i) => {
            const isActive = i === safeIndex;
            const tabBase = tabsTheme.tabClass;
            const tabState = isActive
              ? tabsTheme.activeTabClass
              : tabsTheme.inactiveTabClass;
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
