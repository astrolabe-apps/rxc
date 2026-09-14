"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import type { FlexRenderer as FlexRenderOptions } from "@rx-controls/forms-core";
import { isGroupControl } from "@rx-controls/forms-core";
import { rendererClass } from "@rx-controls/forms-react-core";
import type { GroupRendererProps } from "@rx-controls/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

export function FlexRenderer({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const children = node.getChildren(rc);
  const def = node.getState(rc).definition;
  const groupTheme = useHtmlTheme().group;
  const opts = isGroupControl(def)
    ? (def.groupOptions as FlexRenderOptions | undefined)
    : undefined;
  const direction = (opts?.direction as "row" | "column" | undefined) ?? "row";
  const gap = opts?.gap ?? groupTheme.defaultFlexGap;
  const className = rendererClass(def.styleClass, groupTheme.flexClass);
  return rendered(
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
}
