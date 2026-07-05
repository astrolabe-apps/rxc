"use client";

import { controls } from "@rxc/controls";
import { rendererClass, useTabsController } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

export const TabsRenderer = controls<GroupRendererProps>(
  "TabsRenderer",
  ({ node }, { rc }) => {
    const c = useTabsController(rc, node);
    const tabsTheme = useHtmlTheme().group.tabs;
    const wrapperClass = rendererClass(c.styleClass, tabsTheme.className);

    return (
      <div className={wrapperClass}>
        <ul role="tablist" className={tabsTheme.tabListClass}>
          {c.tabs.map((tab, i) => {
            const tabState = tab.active
              ? tabsTheme.activeTabClass
              : tabsTheme.inactiveTabClass;
            return (
              <li key={tab.node.uniqueId}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab.active}
                  aria-controls={`tabpanel-${tab.node.uniqueId}`}
                  onClick={() => c.setActiveIndex(i)}
                  className={`${tabsTheme.tabClass} ${tabState}`.trim()}
                >
                  {tab.title}
                </button>
              </li>
            );
          })}
        </ul>
        <div
          role="tabpanel"
          id={`tabpanel-${c.activeChild?.uniqueId}`}
          className={tabsTheme.contentClass}
        >
          {c.activeChild && <Field node={c.activeChild} />}
        </div>
      </div>
    );
  },
);
