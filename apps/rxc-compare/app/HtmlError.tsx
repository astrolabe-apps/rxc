"use client";

import { controls } from "@rxc/controls";
import type { ErrorProps } from "@rxc/forms";
import { ErrorMessage } from "./components/ErrorMessage";

export const HtmlError = controls<ErrorProps>(
  "HtmlError",
  ({ node, id }, { rc }) => {
    const { data, touched } = node.getState(rc);
    if (!data || !touched) return null;
    const message = rc.getError(data);
    if (!message) return null;
    return <ErrorMessage id={id}>{message}</ErrorMessage>;
  },
);
