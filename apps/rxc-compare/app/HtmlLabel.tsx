"use client";

import { cloneElement, isValidElement, type ReactNode } from "react";
import parse from "html-react-parser";
import { controls } from "@rxc/controls";
import { isDataControl, isGroupControl } from "@rxc/forms-core";
import { rendererClass } from "@rxc/forms-react-core";
import type { LabelProps } from "@rxc/forms";
import { useHtmlTheme } from "@rxc/forms";

function looksLikeHtml(s: string): boolean {
  return s.indexOf("<") !== -1 && s.indexOf(">") !== -1;
}

function htmlParseStrings(n: ReactNode): ReactNode {
  if (typeof n === "string") return looksLikeHtml(n) ? parse(n) : n;
  if (Array.isArray(n)) return n.map(htmlParseStrings);
  if (isValidElement(n)) {
    const children = (n.props as { children?: ReactNode })?.children;
    if (children !== undefined) {
      return cloneElement(n, undefined, htmlParseStrings(children));
    }
  }
  return n;
}

export const HtmlLabel = controls<LabelProps>(
  "HtmlLabel",
  ({ node, htmlFor, children }, { rc }) => {
    const def = node.getState(rc).definition;
    const required = isDataControl(def) && !!def.required;
    // Legacy `groupLabelClass: "text-2xl"` applied whenever the renderer
    // emitted a group-style label — both `type: "Group"` definitions and
    // compound Data controls rendered via `renderOptions.type: "Group"`.
    const isGroupLabel =
      isGroupControl(def) ||
      (isDataControl(def) &&
        (def.renderOptions as { type?: string } | undefined)?.type === "Group");
    const theme = useHtmlTheme().label ?? {};
    const labelClassName = rendererClass(
      def.labelClass,
      theme.className ?? "text-xs font-medium text-zinc-600 dark:text-zinc-400",
    );
    const textClassName = rendererClass(def.labelTextClass, theme.textClass);
    const parsed = htmlParseStrings(children);
    return (
      <label
        htmlFor={htmlFor}
        className={[labelClassName, isGroupLabel ? "text-2xl" : undefined]
          .filter(Boolean)
          .join(" ")}
      >
        {textClassName ? <span className={textClassName}>{parsed}</span> : parsed}
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
  },
);
