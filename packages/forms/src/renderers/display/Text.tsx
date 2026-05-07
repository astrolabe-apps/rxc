"use client";

import type { TextDisplay } from "@rxc/forms-core";
import type { DisplayRendererProps } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_CLASS = "text-sm text-zinc-700 dark:text-zinc-300";

export function TextDisplayRenderer({ data }: DisplayRendererProps) {
  const displayTheme = useHtmlTheme().display ?? {};
  const text = (data as TextDisplay).text;
  if (!text) return null;
  return <span className={displayTheme.textClass ?? DEFAULT_CLASS}>{text}</span>;
}
