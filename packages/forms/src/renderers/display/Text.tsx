"use client";

import { controls } from "@rxc/controls";
import { isDisplayControl, type TextDisplay } from "@rxc/forms-core";
import { rendererClass, type DisplayRendererProps } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_CLASS = "text-sm text-zinc-700 dark:text-zinc-300";

// See `HtmlDisplayRenderer` for the rationale on reading through `node`
// rather than the passed-in `data` prop. The same applies: the `data`
// proxy is bound to `<Field>`'s rc and won't deliver post-reconcile
// subscriptions on scripted `displayData.text` overrides.
export const TextDisplayRenderer = controls<DisplayRendererProps>(
  "TextDisplayRenderer",
  ({ node }, { rc }) => {
    const displayTheme = useHtmlTheme().display ?? {};
    const def = node.getState(rc).definition;
    const text = isDisplayControl(def)
      ? (def.displayData as TextDisplay).text
      : undefined;
    if (!text) return null;
    // textClass goes on the rendered element to match the legacy
    // `<div class="body">` shape; styleClass is layered on top so per-
    // control styling still wins.
    const textClassName = rendererClass(
      def.textClass,
      displayTheme.textClass ?? DEFAULT_CLASS,
    );
    const className =
      [def.styleClass, textClassName].filter(Boolean).join(" ") || undefined;
    return <span className={className}>{text}</span>;
  },
);
