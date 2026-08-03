"use client";

import { useControls, type Rendered } from "@rxc/controls";
import {
  isGroupControl,
  type SelectChildRenderer as SelectChildRenderOptions,
} from "@rxc/forms-core";
import { Field } from "../../Field";
import { useExpression } from "@rxc/forms-react-core";
import type { GroupRendererProps } from "@rxc/forms-react-core";

export function SelectChildRenderer({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useControls();
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
