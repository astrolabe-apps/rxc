"use client";

import type { HtmlDisplay } from "@rxc/forms-core";
import type { DisplayRendererProps } from "../../types";

/**
 * Renders raw HTML. **Caller is responsible for sanitization** — Display
 * data flows through the renderer untouched. Use only with trusted
 * authoring sources.
 */
export function HtmlDisplayRenderer({ data }: DisplayRendererProps) {
  const html = (data as HtmlDisplay).html ?? "";
  return (
    <div
      className="text-sm text-zinc-700 dark:text-zinc-300"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
