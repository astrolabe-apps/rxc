"use client";

import { controls } from "@rxc/controls";
import type { GridRendererOptions } from "@rxc/forms-core";
import { isGroupControl } from "@rxc/forms-core";
import { rendererClass } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

export const GridRenderer = controls<GroupRendererProps>(
  "GridRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    const def = node.getState(rc).definition;
    const gridTheme = useHtmlTheme().group?.grid ?? {};
    const opts = isGroupControl(def)
      ? (def.groupOptions as GridRendererOptions | undefined)
      : undefined;
    const columns = opts?.columns ?? gridTheme.defaultColumns ?? 2;
    const className = rendererClass(def.styleClass, gridTheme.className);
    return (
      <div
        className={className}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: "0.75rem",
        }}
      >
        {children.map((c) => (
          <div key={c.uniqueId} className={gridTheme.cellClass}>
            <Field node={c} />
          </div>
        ))}
      </div>
    );
  },
);
