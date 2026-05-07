"use client";

import type { HtmlDisplay } from "@rxc/forms-core";
import type { DisplayRendererProps } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_CLASS = "text-sm text-zinc-700 dark:text-zinc-300";

/**
 * Renders raw HTML. **Caller is responsible for sanitization** — Display
 * data flows through the renderer untouched. Use only with trusted
 * authoring sources.
 */
export function HtmlDisplayRenderer({ data }: DisplayRendererProps) {
  const displayTheme = useHtmlTheme().display ?? {};
  const html = (data as HtmlDisplay).html ?? "";
  return (
    <div
      className={displayTheme.htmlClass ?? DEFAULT_CLASS}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
