"use client";

import { useFormOptions } from "@rxc/forms-react-core";
import type { HtmlFormOptions, HtmlFormTheme } from "./theme";

const EMPTY: HtmlFormTheme = {};

/**
 * Read the active `HtmlFormTheme` from the `FormOptions` context.
 *
 * Returns a stable empty object when no theme is set so renderers can
 * destructure without nil-checking every leaf.
 */
export function useHtmlTheme(): HtmlFormTheme {
  const opts = useFormOptions() as HtmlFormOptions;
  return opts.theme ?? EMPTY;
}
