"use client";

import type { TextDisplay } from "@rxc/forms-core";
import type { DisplayRendererProps } from "@rxc/forms-react-core";

export function TextDisplayRenderer({ data }: DisplayRendererProps) {
  const text = (data as TextDisplay).text;
  if (!text) return null;
  return <span className="text-sm text-zinc-700 dark:text-zinc-300">{text}</span>;
}
