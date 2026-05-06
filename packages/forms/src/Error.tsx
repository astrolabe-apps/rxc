"use client";

import { controls } from "@rxc/controls";
import type { FormStateNode } from "@rxc/forms-core";

export const Error = controls<{ node: FormStateNode; id: string }>(
  "Error",
  ({ node, id }, { rc }) => {
    const { data, touched } = node.getState(rc);
    if (!data || !touched) return null;
    const message = rc.getError(data);
    if (!message) return null;
    return (
      <span role="alert" id={id} className="text-xs text-red-500">
        {message}
      </span>
    );
  },
);
