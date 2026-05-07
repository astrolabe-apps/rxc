/**
 * Class-name utilities matching legacy `astrolabe-common` semantics.
 *
 * `rendererClass(controlClass, globalClass)` combines a per-control class
 * (carried on the form definition — `styleClass`, `textClass`,
 * `labelClass`, etc.) with a theme-level class (from `HtmlFormTheme`).
 *
 * Override convention — the `@ ` (at-sign + space) prefix opts a class
 * out of merging:
 *  - `globalClass` starts with `@ ` → strip prefix, use `globalClass` alone.
 *    The theme overrides any per-control class.
 *  - `controlClass` starts with `@ ` → strip prefix, use `controlClass` alone.
 *    The form definition overrides the theme.
 *  - neither prefixed → merge with `clsx`.
 *
 * Without `@ `, both contribute — the per-control class is appended to
 * the theme class so authors can layer modifiers on top of the theme
 * default.
 */

/**
 * Strip the `@ ` override prefix from a class name. Returns the class
 * unchanged if it has no prefix.
 */
export function getOverrideClass(className?: string | null): string | null | undefined {
  if (className && className.startsWith("@ ")) {
    return className.substring(2);
  }
  return className;
}

/**
 * Merge a per-control class with a theme-level class using the legacy
 * override-prefix convention (see module doc above).
 */
export function rendererClass(
  controlClass?: string | null,
  globalClass?: string | null,
): string | undefined {
  const gc = getOverrideClass(globalClass);
  if (gc !== globalClass) return gc ? gc : undefined;
  const oc = getOverrideClass(controlClass);
  if (oc === controlClass) return clsx(controlClass, globalClass);
  return oc ? oc : undefined;
}

/**
 * Tiny `clsx`-equivalent: joins truthy strings with spaces. Kept inline
 * to avoid a dependency for a one-line utility.
 */
export function clsx(
  ...classes: Array<string | null | undefined | false>
): string | undefined {
  const out: string[] = [];
  for (const c of classes) {
    if (c) out.push(c);
  }
  return out.length > 0 ? out.join(" ") : undefined;
}
