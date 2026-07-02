"use client";

import { useFormOptions } from "@rxc/forms-react-core";
import type {
  HtmlFormOptions,
  HtmlFormTheme,
  PartialHtmlFormTheme,
} from "./theme";
import { defaultHtmlTheme, deepMergeTheme } from "./defaultTheme";

// Cache the merged theme by the host theme object identity. A host passes a
// stable theme object (typically a module constant or a memoized value), so
// the deep merge runs once per distinct theme — shared across every
// `useHtmlTheme()` call, every renderer, and every re-render — not once per
// usage. When no host theme is set, the framework default is returned as-is.
const mergeCache = new WeakMap<PartialHtmlFormTheme, HtmlFormTheme>();

/**
 * Read the active `HtmlFormTheme` — the framework {@link defaultHtmlTheme}
 * deep-merged with the host theme from the `FormOptions` context. Every slot
 * the default set populates is resolved, so renderers read `theme.X` directly
 * and never carry their own fallback class strings.
 */
export function useHtmlTheme(): HtmlFormTheme {
  const opts = useFormOptions() as HtmlFormOptions;
  const host = opts.theme;
  if (!host) return defaultHtmlTheme;
  let merged = mergeCache.get(host);
  if (!merged) {
    merged = deepMergeTheme<HtmlFormTheme>(defaultHtmlTheme, host);
    mergeCache.set(host, merged);
  }
  return merged;
}
