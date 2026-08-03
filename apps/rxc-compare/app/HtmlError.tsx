"use client";

import { useControls, type Rendered } from "@rxc/controls";
import type { ErrorProps } from "@rxc/forms";
import { ErrorMessage } from "./components/ErrorMessage";

export function HtmlError({ node, id }: ErrorProps): Rendered {
  const { rc, rendered } = useControls();
  const { data, touched } = node.getState(rc);
  if (!data || !touched) return rendered(null);
  const message = rc.getError(data);
  if (!message) return rendered(null);
  return rendered(<ErrorMessage id={id}>{message}</ErrorMessage>);
}
