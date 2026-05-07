"use client";

import { type ReactNode } from "react";
import { controls } from "@rxc/controls";
import { isDataControl, type FormStateNode } from "@rxc/forms-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "./useHtmlTheme";

export const Label = controls<{
  node: FormStateNode;
  htmlFor: string;
  children: ReactNode;
}>("Label", ({ node, htmlFor, children }, { rc }) => {
  const def = node.getState(rc).definition;
  const required = isDataControl(def) && !!def.required;
  const theme = useHtmlTheme().label ?? {};
  const labelClassName = rendererClass(
    def.labelClass,
    theme.className ?? "text-xs font-medium text-zinc-600 dark:text-zinc-400",
  );
  const textClassName = rendererClass(def.labelTextClass, theme.textClass);
  return (
    <label htmlFor={htmlFor} className={labelClassName}>
      {textClassName ? <span className={textClassName}>{children}</span> : children}
      {required && (
        <span
          aria-hidden
          className={theme.requiredClass ?? "text-red-400 ml-0.5"}
        >
          *
        </span>
      )}
    </label>
  );
});
