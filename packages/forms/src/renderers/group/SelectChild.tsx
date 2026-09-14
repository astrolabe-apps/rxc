"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import {
  isGroupControl,
  type SelectChildRenderer as SelectChildRenderOptions,
} from "@rx-controls/forms-core";
import { Field } from "../../Field";
import { useExpression } from "@rx-controls/forms-react-core";
import type { GroupRendererProps } from "@rx-controls/forms-react-core";

export function SelectChildRenderer({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useReactive();
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
  if (!child) return rendered(null);
  return rendered(<Field node={child} />);
}
