import type { PartialHtmlFormTheme } from "@rx-controls/forms";

// Initial pass at translating legacy `DefaultRenderOptions` (from
// apps/legacy-compare/app/renderer.tsx) to an @rx-controls/forms HtmlFormTheme.
// The legacy version was layered on top of `defaultTailwindTheme` from
// @react-typed-forms/schemas-html; many of those defaults map cleanly to
// rxc's HtmlFormTheme, but some legacy slots (e.g. `label.labelContainer`,
// `label.groupLabelClass`) have no 1:1 in the new theme and need either
// a custom Layout / Label or per-control class overrides on the form
// definition.
export const fireTheme: PartialHtmlFormTheme = {
  label: {
    // Mirror the ServiceTas portal: `formStyles.defaults` blanks
    // `className` and `groupLabelClass`, so the only label class in
    // production is the form-definition's `labelClass` (e.g. "title1").
    className: "",
    textClass: "",
    requiredClass: "text-red-500",
    // Legacy renders `<span class="text-red-500"></span>` — the span exists
    // for layout/CSS, but the asterisk is intentionally suppressed.
    requiredText: "",
    groupClassName: "",
  },
  data: {
    inputClass: "form-control",
    // Legacy renders the display-only value element with just the
    // form-definition's `textClass` (e.g. "body !text-accent"); the flex
    // wrapper lives on the layout (see HtmlLayout). Suppress the rxc
    // zinc/text-sm fallback so `textClass` is the only class on the value.
    displayOnlyClass: "",
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
    // Mirror the ServiceTas portal: `formStyles.defaults` blanks
    // `standardClassName` so Standard groups inherit no opinionated
    // flex/gap chrome — only the form-definition's `styleClass`
    // (e.g. "flex flex-col gap-[24px] bg-white …") determines layout.
    standardClass: "",
    defaultFlexGap: "1em",
    grid: { defaultColumns: 1 },
  },
  action: {
    // Legacy renders buttons as plain block-shaped `<button>` with no
    // inline-flex wrapper. Suppress the rxc default layout class so the
    // emitted markup matches.
    buttonLayoutClass: "",
    linkLayoutClass: "",
    // Legacy button chrome: rounded-lg / p-3 / disabled-state classes.
    // The variantClass (primary/secondary) layers the background on top.
    buttonClass:
      "rounded-lg p-3 text-white disabled:opacity-75 disabled:cursor-not-allowed",
    primaryClass: "bg-primary-500",
    secondaryClass: "bg-secondary-500",
    // Inline "link" actions in the legacy app are `body-bold underline
    // !text-accent` text — no flex, no blue colour. `@` prefix replaces
    // rxc's `text-blue-600 hover:underline disabled:opacity-40` default.
    linkClass: "@ body-bold underline !text-accent",
  },
  adornment: {
    // Match ServiceTas client-common/renderer.tsx accordion overrides.
    // The default rxc accordion already ships FA `chevron-up`/`chevron-down`
    // icons; only the toggler styling needs to come from the host.
    accordion: {
      titleClass: "cursor-pointer",
      togglerClass: "text-accent !text-[20px]",
    },
  },
};
