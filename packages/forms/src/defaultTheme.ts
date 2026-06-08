import { IconLibrary } from "@rxc/forms-core";
import type { HtmlFormTheme } from "./theme";

/**
 * Recursively merge a partial host theme over a base theme. Plain objects
 * are merged key-by-key; everything else (strings, arrays, ReactNodes,
 * IconReferences) is a leaf where the host value wins. A host value of
 * `undefined` is treated as "not set" and keeps the base — so partial
 * themes only override what they specify.
 *
 * Note: an explicit empty string `""` IS an override (blanks the default),
 * matching the legacy `rendererClass`/`mergeObjects` convention where hosts
 * opt out of a default by setting it empty.
 */
export function deepMergeTheme<T>(base: T, over: Partial<T> | undefined): T {
  if (!over) return base;
  if (!isPlainObject(base)) return (over as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(over as Record<string, unknown>)) {
    const ov = (over as Record<string, unknown>)[key];
    if (ov === undefined) continue;
    const bv = out[key];
    out[key] =
      isPlainObject(bv) && isPlainObject(ov)
        ? deepMergeTheme(bv, ov as Record<string, unknown>)
        : ov;
  }
  return out as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    v != null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

// Single input chrome string. Valid/error/disabled/readonly are expressed
// as state variants on the one class (matching the legacy single-`inputClass`
// model) rather than being layered as separate classes by the renderer — so
// a host that overrides `inputClass` fully owns the input's appearance.
const INPUT =
  "rounded border px-2.5 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100 " +
  "border-zinc-300 dark:border-zinc-600 " +
  "aria-invalid:border-red-400 dark:aria-invalid:border-red-600 " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "read-only:bg-zinc-50 dark:read-only:bg-zinc-800/50";
const TEXT_DISPLAY = "text-sm text-zinc-700 dark:text-zinc-300";

/**
 * The framework default `HtmlFormTheme` — every class string the default
 * renderer set uses lives here, in one place. `useHtmlTheme()` deep-merges a
 * host theme over this, so renderers read a single resolved slot per concern
 * and carry no hardcoded chrome of their own.
 */
export const defaultHtmlTheme: HtmlFormTheme = {
  layout: {
    className: "flex flex-col gap-1",
  },
  label: {
    className: "text-xs font-medium text-zinc-600 dark:text-zinc-400",
    requiredClass: "text-red-400 ml-0.5",
  },
  error: {
    className: "text-xs text-red-500",
  },
  data: {
    inputClass: INPUT,
    displayOnlyClass: TEXT_DISPLAY,
    elementSelectedClass:
      "inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300",
    multiline: { className: INPUT },
    checkbox: { className: "inline-flex items-center gap-2" },
    radio: {
      className: "flex flex-col gap-1",
      entryClass: "inline-flex items-center gap-2",
    },
    checkList: {
      className: "flex flex-col gap-1",
      entryClass: "inline-flex items-center gap-2",
    },
    autocomplete: {
      className: "relative",
      inputClass: "w-full " + INPUT,
      listClass:
        "absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow",
      optionClass:
        "cursor-pointer px-2.5 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700",
      activeOptionClass: "bg-blue-50 dark:bg-blue-900/30",
    },
    array: {
      className: "flex flex-col gap-3",
      childClass:
        "flex items-start gap-2 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3",
      addClass:
        "self-start text-xs px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40",
      removeClass:
        "text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 disabled:opacity-40",
      dialogClass:
        "rounded-lg p-6 max-w-lg w-full bg-white dark:bg-zinc-900 dark:text-zinc-100 backdrop:bg-black/40",
      dialogBodyClass: "flex flex-col gap-3",
      cancelClass:
        "text-xs px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600",
    },
    arrayElement: {
      className: "flex items-center gap-2 justify-between",
      summaryClass: "flex-1 truncate text-sm",
      buttonClass:
        "px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600",
      dialogClass:
        "rounded-lg p-6 max-w-lg w-full bg-white dark:bg-zinc-900 dark:text-zinc-100 backdrop:bg-black/40",
      innerClass: "flex flex-col gap-3",
    },
    scrollList: {
      className: "flex flex-col gap-3",
      spinnerClass: "flex justify-center my-4 text-sm text-zinc-500",
    },
  },
  group: {
    standardClass:
      "flex flex-col gap-3 border border-zinc-200 dark:border-zinc-700 rounded p-3",
    defaultFlexGap: "0.75rem",
    grid: { defaultColumns: 1 },
    tabs: {
      className: "flex flex-col gap-2",
      tabListClass: "flex gap-1 border-b border-zinc-200 dark:border-zinc-700",
      tabClass: "px-3 py-1 text-sm rounded-t",
      activeTabClass:
        "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 border-b-white dark:border-b-zinc-800 -mb-px",
      inactiveTabClass:
        "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
    },
    accordion: {
      className: "flex flex-col gap-2",
      sectionClass: "rounded border border-zinc-200 dark:border-zinc-700 p-2",
      titleClass:
        "cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300",
      contentClass: "mt-2",
    },
    dialog: {
      className:
        "rounded-lg p-6 max-w-lg w-full bg-white dark:bg-zinc-900 dark:text-zinc-100 backdrop:bg-black/40",
      titleClass: "text-lg font-semibold mb-3",
      containerClass: "flex flex-col gap-3",
    },
    wizard: {
      className: "flex flex-col gap-3",
      stepListClass: "flex items-center gap-2 text-sm",
      stepClass: "px-2 py-1 rounded",
      stepActiveClass: "bg-blue-600 text-white",
      stepDoneClass: "bg-green-600 text-white",
      stepPendingClass:
        "border border-zinc-200 dark:border-zinc-700 text-zinc-500",
      stepInvisibleClass: "hidden",
      navClass: "flex items-center justify-between gap-2",
      buttonClass:
        "px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-sm disabled:opacity-40",
    },
  },
  action: {
    buttonLayoutClass: "inline-flex items-center justify-center gap-1.5",
    linkLayoutClass: "inline-flex items-center gap-1",
    buttonClass: "px-3 py-1 rounded text-sm disabled:opacity-40",
    primaryClass: "bg-blue-600 text-white",
    secondaryClass: "border border-zinc-300 dark:border-zinc-600",
    linkClass: "text-blue-600 hover:underline disabled:opacity-40",
    groupClass: "",
  },
  display: {
    textClass: TEXT_DISPLAY,
    htmlClass: TEXT_DISPLAY,
  },
  adornment: {
    helpText: {
      contentTextClass: "text-xs text-zinc-500 dark:text-zinc-400",
      inlineClass: "inline-flex items-center gap-2",
      blockClass: "flex flex-col gap-1",
    },
    optional: {
      className: "flex items-center gap-2 w-full",
      childWrapperClass: "grow",
      nullWrapperClass: "inline-flex items-center gap-1 mr-2",
      checkClass: "m-2",
      labelWrapClass: "inline-flex items-center gap-1",
    },
    accordion: {
      className: "flex items-center gap-2 my-2 w-fit",
      titleClass: "cursor-pointer",
      iconOpen: { library: IconLibrary.FontAwesome, name: "chevron-up" },
      iconClosed: { library: IconLibrary.FontAwesome, name: "chevron-down" },
    },
  },
};
