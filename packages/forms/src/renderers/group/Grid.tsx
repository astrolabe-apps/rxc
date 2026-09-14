"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import type { GridRendererOptions } from "@rx-controls/forms-core";
import { isGroupControl } from "@rx-controls/forms-core";
import { rendererClass } from "@rx-controls/forms-react-core";
import type { GroupRendererProps } from "@rx-controls/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

export function GridRenderer({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const children = node.getChildren(rc);
  const def = node.getState(rc).definition;
  const gridTheme = useHtmlTheme().group.grid;
  const opts = isGroupControl(def)
    ? (def.groupOptions as GridRendererOptions | undefined)
    : undefined;
  const columns = opts?.columns ?? gridTheme.defaultColumns;
  const className = rendererClass(def.styleClass, gridTheme.className);
  return rendered(
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
}
