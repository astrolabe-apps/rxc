"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import type { ErrorProps } from "@rx-controls/forms";
import { ErrorMessage } from "./components/ErrorMessage";

export function HtmlError({ node, id }: ErrorProps): Rendered {
  const { rc, rendered } = useReactive();
  const { data, touched } = node.getState(rc);
  if (!data || !touched) return rendered(null);
  const message = rc.getError(data);
  if (!message) return rendered(null);
  return rendered(<ErrorMessage id={id}>{message}</ErrorMessage>);
}
