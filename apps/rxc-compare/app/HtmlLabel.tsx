"use client";

import {
  cloneElement,
  isValidElement,
  useMemo,
  type ReactNode,
} from "react";
import parse from "html-react-parser";
import { useControls, type Rendered } from "@rxc/controls";
import { isDataControl } from "@rxc/forms-core";
import {
  indexAdornments,
  rendererClass,
  useRegistry,
  wrapAdornments,
} from "@rxc/forms-react-core";
import {
  isGroupLabel,
  useHtmlTheme,
  type LabelProps,
} from "@rxc/forms";

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

// Same as `<DefaultLabel>` but HTML-parses any string leaves in `children`.
// Group-shaped labels still pick up `theme.label.groupClassName` because
// the predicate is shared with the default.
export function HtmlLabel({ node, htmlFor, as: tag, id, children }: LabelProps): Rendered {
  const { rc, rendered } = useControls();
  const def = node.getState(rc).definition;
  const required = isDataControl(def) && !!def.required;
  const theme = useHtmlTheme().label ?? {};
  const textClassName = rendererClass(def.labelTextClass, theme.textClass);
  const labelClassName = rendererClass(
    def.labelClass,
    [
      theme.className ?? "text-xs font-medium text-zinc-600 dark:text-zinc-400",
      isGroupLabel(def) ? theme.groupClassName : undefined,
      textClassName,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const parsed = htmlParseStrings(children);
  const Tag = tag ?? "label";
  const tagProps = {
    ...(Tag === "label" && htmlFor ? { htmlFor } : {}),
    ...(id ? { id } : {}),
  };
  const labelEl = (
    <Tag {...tagProps} className={labelClassName}>
      {parsed}
      {required && (
        <span
          aria-hidden
          className={theme.requiredClass ?? "text-red-400 ml-0.5"}
        >
          {theme.requiredText ?? "*"}
        </span>
      )}
    </Tag>
  );
  // Label-kind adornments are now composed inside the Label
  // component, mirroring the DefaultLabel contract — Field no
  // longer wraps adornments around the label slot.
  const adornments = def.adornments ?? [];
  const registry = useRegistry();
  const adornmentMap = useMemo(
    () => indexAdornments(registry.adornments),
    [registry.adornments],
  );
  return rendered(wrapAdornments(adornments, adornmentMap, "label", labelEl, node));
}
