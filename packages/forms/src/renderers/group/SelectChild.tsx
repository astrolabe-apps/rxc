"use client";

import { controls } from "@rxc/controls";
import {
  isGroupControl,
  type SelectChildRenderer as SelectChildRenderOptions,
} from "@rxc/forms-core";
import { Field } from "../../Field";
import { useExpression } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";

export const SelectChildRenderer = controls<GroupRendererProps>(
  "SelectChildRenderer",
  ({ node }, { rc }) => {
    const children = node.getChildren(rc);
    const def = node.getState(rc).definition;
    const opts = isGroupControl(def)
      ? (def.groupOptions as SelectChildRenderOptions | undefined)
      : undefined;
    const idx = useExpression(rc, node, opts?.childIndexExpression);
    const child =
      typeof idx === "number" && Number.isFinite(idx)
        ? children[idx]
        : undefined;
    if (!child) return null;
    return <Field node={child} />;
  },
);
