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
  },
  data: {
    inputClass: "form-control",
    select: { className: "form-control" },
    radio: {
      className: "flex flex-wrap flex-col lg:flex-row gap-4",
      entryClass: "flex items-center gap-2",
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
  },
  group: {
    defaultFlexGap: "1em",
    grid: { defaultColumns: 1 },
  },
};
