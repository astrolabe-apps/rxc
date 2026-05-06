"use client";

import { type ReactNode } from "react";
import { controls } from "@rxc/controls";
import { isDataControl, type FormStateNode } from "@rxc/forms-core";

export const Label = controls<{
  node: FormStateNode;
  htmlFor: string;
  children: ReactNode;
}>("Label", ({ node, htmlFor, children }, { rc }) => {
  const def = node.getState(rc).definition;
  const required = isDataControl(def) && !!def.required;
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
    >
      {children}
      {required && (
        <span aria-hidden className="text-red-400 ml-0.5">
          *
        </span>
      )}
    </label>
  );
});
