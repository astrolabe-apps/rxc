import type { ReactNode } from "react";
import type { HtmlTheme, PartialHtmlTheme } from "../impls/htmlTheme.js";

/**
 * ServiceTas's legacy renderer options, restated as an `HtmlTheme`.
 *
 * Source: `ServiceTas/…/client-common/renderer.tsx` `DefaultRenderOptions`,
 * which is `deepMerge(serviceTasOptions, defaultTailwindTheme)` — legacy's
 * `deepMerge(value, fallback)`, so ServiceTas wins and `defaultTailwindTheme`
 * (`@react-typed-forms/schemas-html@6`) fills the rest. Every slot below says
 * which of the two it came from. Complete rather than partial on purpose: it
 * is a whole look, and a slot left to `defaultHtmlTheme` would leak the POC's
 * `ff-*` classes into a page that never loads `demo.css`.
 *
 * Legacy's classes landed on legacy's elements; where v2's anatomy differs
 * the comment says what was chosen (README finding 72).
 */

/** `components/ErrorMessage.tsx`, ported: the warning glyph + underlined text. */
function ErrorMessage({ children, id }: { children: ReactNode; id: string }) {
  return (
    <div className="flex underline error font-bold gap-x-2 items-center">
      <div className="w-4 h-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          height="16"
          width="16"
          viewBox="0 0 512 512"
          className="fill-current"
        >
          <path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z" />
        </svg>
      </div>
      <span id={id}>{children}</span>
    </div>
  );
}

export const serviceTasTheme: HtmlTheme = {
  shell: {
    // layout.className (defaultTailwindTheme). Legacy has no horizontal
    // layout; this is the nearest shape.
    vertical: "flex flex-col",
    horizontal: "flex flex-row items-center gap-2",
    // label.className (ServiceTas) — v2's label is one element, legacy's a
    // <label> around a text <span>; controlLabelTextClass is "" so nothing
    // is lost by folding the two.
    label: "py-4",
    // Legacy's inline-label wrapper in DefaultLayout.
    labelAfter: "inline-flex items-center gap-1",
    control: "",
    // ServiceTas draws help as a Radix popover at LabelEnd — a component,
    // not a class, so a theme cannot express it (a shell override can).
    help: "footnote",
    // layout.errorClass (defaultTailwindTheme); unused while renderError is set.
    error: "text-sm text-red-500",
    // layout.renderError (ServiceTas).
    renderError: (e, id) => <ErrorMessage id={id}>{e}</ErrorMessage>,
    // label.requiredElement (ServiceTas): the span, no asterisk.
    required: { className: "text-red-500", text: "" },
  },
  frame: {
    // Bootstrap 3's `.form-control` styles the <input> — border, :focus,
    // :disabled — so the border stays on the input and the frame only lays
    // out its slots. Moving it to the frame would lose :focus / :disabled,
    // which do not fire on a <div>.
    className: "flex items-center gap-2",
    slot: "",
    // data.inputClass (both).
    input: "form-control",
    // data.multilineClass (defaultTailwindTheme).
    multiline: "border p-2 outline-0 whitespace-pre-wrap",
    // …and so the definition's styleClass goes where legacy put it.
    classNameOn: "input",
  },
  // data.selectOptions.emptyText (defaultTailwindTheme).
  select: { emptyText: "<select>" },
  // Styled globally by `input[type="checkbox"]` in the host css.
  checkbox: { input: "" },
  radio: {
    // data.radioOptions (ServiceTas). Legacy's entry was a <div> holding the
    // input and a <label for>; v2's is a <label> wrapping both, so the input
    // is still the text's preceding sibling and `peer-*` still works.
    className: "flex flex-wrap flex-col lg:flex-row gap-4",
    entryWrapper: "w-fit",
    entry: "flex items-center gap-2",
    input: "peer disabled:opacity-80",
    label:
      "cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-80",
  },
  // Legacy put displayOnlyClass on the layout, not the value; the value
  // carries only the definition's textClass (as rxc-compare found).
  displayOnly: { className: "", inline: "" },
  // group.flexClassName (defaultTailwindTheme) + group.defaultFlexGap (ServiceTas).
  stack: { className: "gap-2", defaultGap: "1em" },
  contents: {
    // layout.className — a group's title and body sat in the same layout.
    wrapper: "flex flex-col",
    // Legacy had no exit animation; the region just goes.
    hidden: "hidden",
    inner: "",
    // label.className + label.groupLabelClass: legacy's group label is the
    // control label's class with the group one added. And it was a <label>,
    // which Bootstrap 3 makes bold; v2's title is a <div>, so the theme says
    // what the element used to imply.
    title: "font-bold py-4 text-2xl",
    // group.standardClassName (defaultTailwindTheme; ServiceTas leaves it).
    body: "flex flex-col gap-4",
    // group.flexClassName (defaultTailwindTheme) + group.defaultFlexGap
    // (ServiceTas). A Flex group's body; the formStyles overlays set only
    // standardClassName, so they do not reach it.
    flexBody: "gap-2",
    flexGap: "1em",
  },
  // group.inlineClass (defaultTailwindTheme).
  inline: { wrapper: "", title: "" },
  elements: { className: "flex flex-col" },
  displayShell: { display: "", action: "" },
  // Legacy's text display is a <div>; v2's is a <p>, which Bootstrap margins.
  text: { className: "m-0", inline: "" },
  // display.htmlClassName (ServiceTas).
  html: { className: "html" },
  icon: { className: "" },
  action: {
    // action.buttonClass / textClass (ServiceTas blanks both).
    className: "",
    textClassName: "",
    styles: {
      primary: {
        className:
          "w-full lg:w-fit bg-accent min-w-[138px] min-h-[54px] hover:bg-[#096946] disabled:opacity-80 disabled:cursor-not-allowed px-[12px] py-[5px]",
        textClassName: "headline !text-white select-none",
      },
      secondary: {
        className:
          "w-full lg:w-fit bg-white min-w-[138px] min-h-[54px] px-[15px] py-[10px] border border-border group active:bg-accent hover:bg-accent disabled:opacity-80 disabled:cursor-not-allowed select-none",
        textClassName:
          "headline !text-accent group-active:!text-white group-hover:!text-white",
      },
      link: {
        className:
          "disabled:opacity-80 disabled:cursor-not-allowed cursor-pointer",
        textClassName: "",
      },
    },
    // action.busyIcon (defaultTailwindTheme) + iconBeforeClass.
    busy: <i className="fa-solid fa-spinner fa-spin px-2" />,
  },
  tabs: {
    // group.tabs (defaultTailwindTheme). Legacy's tab was an <li> (tabClass)
    // around a label (labelClass + active/inactive); v2's is one <button>.
    className: "",
    list: "flex flex-wrap text-sm font-medium text-center text-gray-500 border-b border-gray-200",
    tab: "me-2 inline-flex items-center justify-center p-4 border-b-2 group",
    active: "text-blue-600 border-blue-600 rounded-t-lg active",
    inactive:
      "border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 cursor-pointer",
    invalidMarker: "ml-1 text-danger",
    panel: "my-2",
  },
  // Legacy's wizard is ServiceTas's own SteppedProcess renderer, not a theme.
  wizard: {
    steps: "flex gap-4 mb-4 list-none p-0",
    step: "",
    page: "",
    nav: "flex gap-4 justify-between",
  },
  dialog: {
    className: "p-6 bg-white shadow-lg backdrop:bg-black/50",
    inline: "",
    title: "title3 block mb-4",
    actions: "flex gap-2 justify-end",
  },
};

/**
 * `client-common/formStyles.ts`, restated. Each is an overlay picked per form
 * by `FormDefinitions[form].defaultConfig.style` and merged *over* the base —
 * legacy's `deepMerge(formStyles[style], DefaultRenderOptions)`, overlay first,
 * so it wins. One nested `HtmlThemeProvider` each.
 *
 * Legacy derived the group title from `label.className` + `groupLabelClass`
 * at render time; a theme slot is a plain string, so an overlay that moves
 * the label class restates the title too.
 */
export const formStyles = {
  compact: {
    shell: { label: "font-bold" },
    contents: { title: "font-bold text-2xl my-4", body: "mb-4" },
  },
  medium: {
    shell: { label: "font-bold py-1" },
    contents: { title: "font-bold py-1 text-2xl my-4", body: "mb-4" },
  },
  mrs: {
    shell: { label: "", vertical: "flex flex-col gap-[8px]" },
    contents: {
      title: "font-bold",
      body: "",
      wrapper: "flex flex-col gap-[8px]",
    },
  },
  mast: {
    shell: { label: "", vertical: "flex flex-col gap-[8px]" },
    contents: {
      title: "font-bold",
      body: "",
      wrapper: "flex flex-col gap-[8px]",
    },
  },
  defaults: {
    shell: { label: "" },
    contents: { title: "font-bold", body: "" },
  },
} satisfies Record<string, PartialHtmlTheme>;

export type FormStyle = keyof typeof formStyles;

/** No overlay: legacy's `formStyles[undefined]` fell through to the base. */
export const noOverlay: PartialHtmlTheme = {};

export function overlayFor(style: string | null | undefined): PartialHtmlTheme {
  return style && style in formStyles
    ? formStyles[style as FormStyle]
    : noOverlay;
}
