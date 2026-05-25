import type { HtmlFormTheme } from "@rxc/forms";

// Initial pass at translating legacy `DefaultRenderOptions` (from
// apps/legacy-compare/app/renderer.tsx) to an @rxc/forms HtmlFormTheme.
// The legacy version was layered on top of `defaultTailwindTheme` from
// @react-typed-forms/schemas-html; many of those defaults map cleanly to
// rxc's HtmlFormTheme, but some legacy slots (e.g. `label.labelContainer`,
// `label.groupLabelClass`) have no 1:1 in the new theme and need either
// a custom Layout / Label or per-control class overrides on the form
// definition.
export const fireTheme: HtmlFormTheme = {
  label: {
    className: "py-4",
    textClass: "",
    requiredClass: "text-red-500",
    // Legacy renders `<span class="text-red-500"></span>` — the span exists
    // for layout/CSS, but the asterisk is intentionally suppressed.
    requiredText: "",
    groupClassName: "text-2xl",
  },
  data: {
    inputClass: "form-control",
    select: { className: "form-control" },
    radio: {
      className: "flex flex-wrap flex-col lg:flex-row gap-4",
      entryClass: "flex items-center gap-2",
      // Legacy wraps each option in `<div class="w-fit">` so each card
      // shrinks to content width; without it the per-option div fills
      // the row.
      entryWrapperClass: "w-fit",
      labelClass:
        "cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-80",
      inputClass: "peer disabled:opacity-80",
    },
    checkList: {
      className: "flex flex-wrap gap-x-4",
      entryClass: "flex items-center gap-2",
    },
  },
  display: {
    htmlClass: "html",
    // Legacy renders TextDisplay as `<div class="body">…` — just the
    // form-definition's `textClass`, no opinionated zinc/text-sm
    // fallback. Suppress the rxc default so per-control `textClass`
    // (e.g. "body") is the only class on the element.
    textClass: "",
  },
  group: {
    // Legacy groups have no border / padding / rounded chrome — children
    // just stack. Keep a flex column with a moderate gap so the spacing
    // matches the legacy rendering without inheriting rxc's default
    // bordered card look.
    standardClass: "flex flex-col gap-4",
    defaultFlexGap: "1em",
    grid: { defaultColumns: 1 },
  },
};
