import {
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { ActionVariant, Tone } from "@rx-controls/forms-react";

/**
 * Every class the HTML implementation emits, one slot per element.
 *
 * This is `forms-html`'s API, not the contract's: other implementations never
 * read it, and a third-party widget gets chrome through the contract's
 * `useFieldShell` / `useInputFrame`, never through these strings.
 *
 * The type is the **resolved** theme: every slot is filled, so the
 * implementation reads a slot with no fallback. A host supplies a
 * {@link PartialHtmlTheme} through {@link HtmlThemeProvider}.
 *
 * A slot is the implementation's *own* class for its element. An author's
 * class props still merge onto it, or replace it with `{ replace }`, so a
 * theme and a form definition compose rather than compete.
 *
 * **Behaviour never hangs on a theme class.** Hiding, collapsing and the like
 * work with every slot set to `""`; a theme only styles.
 *
 * **An app's element selectors outrank a slot's class.** A slot is one class
 * on the element, so an app-wide rule on the element type wins against it —
 * `input[type=radio]` in a global stylesheet, and outright under Tailwind's
 * `important: "#app"`, which makes that rule `#app input[type=radio]`
 * (1,1,1) against the theme's `#app .w-[13px]` (1,1,0). Where an app styles
 * native controls globally, mark the slot's utilities important (`!w-[13px]`)
 * or give the theme a wrapper class to scope them under.
 *
 * @group Theming
 */
export interface HtmlTheme {
  /**
   * The field shell, per widget: slots merged over `shell` for the shell
   * around that widget (`FieldShellProps.widget` — `select`, `checkList`,
   * or a third-party widget's own name). For a look whose shells differ by
   * widget. The shell also carries the name as `data-widget`.
   */
  shellFor: Partial<Record<string, DeepPartial<HtmlTheme["shell"]>>>;
  /** The field shell. */
  shell: {
    /** The outer element, label above the control. */
    vertical: string;
    /** The outer element, label beside the control. */
    horizontal: string;
    /** The label. */
    label: string;
    /** The `<label>` that wraps a checkbox and its trailing text. */
    labelAfter: string;
    /** The wrapper around the control, under a leading label. */
    control: string;
    /** Help text. */
    help: string;
    /**
     * Help at the label's end (`helpPlacement: "labelEnd"`): the label and
     * its button side by side.
     */
    labelRow: string;
    /** The button that shows `labelEnd` help, beside the label. */
    helpButton: {
      /** Its element. */
      className: string;
      /** What it shows — an info glyph, an icon component. */
      icon: ReactNode;
      /** Its accessible name. Words, for assistive technology. */
      text: string;
    };
    /** A field's character count (`showCount`), within its limit. */
    count: string;
    /** The count past the limit, in place of `count`: one colour, not two. */
    countOver: string;
    /** The error. */
    error: string;
    /**
     * Draw the error as a component — an icon, a link — rather than a styled
     * paragraph. `null` uses `error`.
     */
    renderError: ((error: ReactNode, id: string) => ReactNode) | null;
    /** The required marker. */
    required: {
      /** Its element. */
      className: string;
      /** Its text. Empty for a marker drawn entirely in CSS. */
      text: string;
      /**
       * What a group that cannot carry `aria-required` (a check list) is
       * described with, visually hidden. Words, for assistive technology.
       */
      note: string;
    };
  };
  /** The input frame. */
  frame: {
    /** The frame. */
    className: string;
    /** The element around the native control, between the edge content. */
    slot: string;
    /** The native `<input>`, `<select>` or `<textarea>`. */
    input: string;
    /** Added for a `<textarea>`. */
    multiline: string;
    /**
     * Where a control's own `className` lands: on whichever element carries
     * the chrome. `"frame"` for a theme that borders the frame; `"input"` for
     * one that borders the input, as Bootstrap's `.form-control` does.
     */
    classNameOn: "frame" | "input";
  };
  /** The select. */
  select: {
    /** The empty option's text. */
    emptyText: string;
  };
  /** The checkbox. */
  checkbox: {
    /** The `<input type="checkbox">`. */
    input: string;
  };
  /** The radio group. */
  radio: {
    /** The group. */
    className: string;
    /** Around each option and its per-option content. */
    entryWrapper: string;
    /** The `<label>` around one input and its text. */
    entry: string;
    /** The `<input type="radio">`. */
    input: string;
    /** The option's text. */
    label: string;
  };
  /** A set of choices. */
  checkList: {
    /** The group. */
    className: string;
    /** The `<label>` around one checkbox and its text. */
    entry: string;
    /** The `<input type="checkbox">`. */
    input: string;
    /** The option's text. */
    label: string;
  };
  /** The read-only value. */
  displayOnly: {
    /** As a block. */
    className: string;
    /** Inside an inline group. */
    inline: string;
    /** Around a `startIcon` / `endIcon`, either side of the value. */
    icon: string;
  };
  /** The standard group. */
  contents: {
    /** The wrapper around title and body. */
    wrapper: string;
    /**
     * How a hidden region leaves the screen. It stays mounted either way —
     * each child clears its own value — and is always `inert`, marked
     * `data-hidden`.
     *
     * - `"attribute"`: the `hidden` attribute and `display: none`. Works with
     *   no CSS at all, and wins over a `display` the wrapper's classes set.
     * - `"class"`: `hidden` (below), whose CSS must hide it — a fade on the
     *   wrapper itself, keyed on `[data-hidden]`, say.
     * - `"collapse"`: an animated collapse. The wrapper adds `collapse`
     *   and holds one extra element, `inner`, around title and body — the
     *   only mode that renders one, since a grid-rows collapse needs a single
     *   child. Anything styling the wrapper's children (a `layoutClass` gap
     *   between title and body) sees `inner` instead.
     *
     * Under a scope with transitions off every mode hides as `"attribute"`
     * does, and `"collapse"` renders no `inner`.
     */
    hideWith: "attribute" | "class" | "collapse";
    /** Added while hidden, under `hideWith: "class"`. It must hide. */
    hidden: string;
    /** Added to the wrapper under `hideWith: "collapse"`: the animation. */
    collapse: string;
    /** The element inside the wrapper under `hideWith: "collapse"`. */
    inner: string;
    /** The title. */
    title: string;
    /**
     * The standard body: always applied. Hooks and anything that is not
     * layout — the author's `className` adds to it.
     */
    body: string;
    /**
     * The body's layout when the author gives none. A group's `className`
     * **is** its layout, so it replaces this rather than merging with it: a
     * theme's `flex flex-col gap-4` would otherwise fight an author's `grid`
     * or `gap-1`, decided by stylesheet order.
     */
    layout: string;
    /**
     * Added for a section (`kind: "section"` — a `Section`, or any group
     * built with `{ scope: true }`) and only for one: the card around a
     * titled part of the form, without bordering every plain region.
     */
    section: {
      /** Added to the wrapper. */
      wrapper: string;
      /** Added to the title. */
      title: string;
      /** Added to the body. */
      body: string;
    };
    /**
     * Named looks (`GroupProps.variant` — "card", "callout"), each added to
     * the wrapper, title and body of a `contents` or `section` region that
     * names it, beside the slots above. A name not here draws the base look,
     * with a warning in development. The wrapper carries the name as
     * `data-variant` either way.
     */
    variants: Record<string, GroupVariantClasses>;
    /** A body with a `layout`: the flex box. */
    flexBody: string;
    /** Its gap when the layout sets none. */
    flexGap: number | string;
  };
  /** The inline group. */
  inline: {
    /** The `<span>`. */
    wrapper: string;
    /** Its title. */
    title: string;
    /** Named looks for an inline group, as `contents.variants` (no body slot). */
    variants: Record<string, GroupVariantClasses>;
  };
  /** The `visibility` slot. */
  visibility: {
    /**
     * Animate a boundary leaving: {@link FadeVisibility}, which holds its last
     * frame for the exit. `false` hides at once ({@link DefaultVisibility}):
     * no wrapper element, no hold. A theme setting, so an app chooses it
     * where it chooses its look, not in its forms.
     */
    transitions: boolean;
    /**
     * The wrapper that holds a leaving boundary's last frame. It gets
     * `data-leaving` for the length of the exit; with no CSS for it the
     * content simply stays up that long, then goes.
     */
    fade: string;
  };
  /** The chrome-less collection. */
  elements: {
    /** The list. */
    className: string;
  };
  /** The wrapper a display or a button sits in. */
  displayShell: {
    /** Around a display. Not its colour: that is `color`, which a tone replaces. */
    display: string;
    /**
     * A display's base text colour, dropped when it has a tone — so a tone
     * replaces it rather than competing with it. Put a base colour here, not
     * on the text slot: the tone colours the wrapper and the text inherits
     * it, so a colour on the text itself masks every tone.
     */
    color: string;
    /** Around a button. */
    action: string;
    /**
     * Around a display with a `tone`, in place of `color`: its colour,
     * inherited by the text inside.
     */
    tones: Record<Tone, string>;
    /**
     * Around an **announced** display with a `tone`, in place of the tone's
     * class: a message the user must not miss — the box a refused submit's
     * error sits in, with its own colour — where a counter turning red past
     * its limit (toned, not announced) gets `tones` alone.
     */
    message: Record<Tone, string>;
  };
  /** The text display. */
  text: {
    /** As a block. */
    className: string;
    /** Inside an inline group. */
    inline: string;
    /**
     * Drawn as a heading (`heading`): `className` on every one, and the
     * level's class beside it — the level the form's outline gives the
     * place, 1 to 6. In place of the block `className`, not added to it.
     */
    heading: {
      /** On every heading. */
      className: string;
      /** Beside it, by the heading's level. */
      levels: Record<1 | 2 | 3 | 4 | 5 | 6, string>;
    };
    /**
     * Named looks (`TextDisplay variant` — "lead", "tag"), each added to the
     * text element beside its block, inline or heading class. A colour here
     * masks a tone, as one on the base slot would. A name not here draws the
     * base look, with a warning in development; the element carries the name
     * as `data-variant` either way.
     */
    variants: Record<string, string>;
  };
  /** Rich text (`RichText`): the inline elements its markup draws. */
  richText: {
    /** `<strong>`, for `b` and `strong`. */
    strong: string;
    /** `<em>`, for `i` and `em`. */
    em: string;
    /** `<sup>`. */
    sup: string;
    /** `<sub>`. */
    sub: string;
    /** `<a>`. */
    link: string;
    /** `<img>`. */
    image: string;
  };
  /** The HTML display. */
  html: {
    /** Its element. */
    className: string;
  };
  /** The icon display. */
  icon: {
    /** Its element. */
    className: string;
  };
  /** Buttons. */
  action: {
    /** Every button. */
    className: string;
    /** Every button's text. */
    textClassName: string;
    /**
     * Around every button's icon — or the busy spinner standing in for it —
     * so an icon is sized and spaced with the button, whatever element the
     * author's icon is.
     */
    iconClassName: string;
    /**
     * Added by variant, on top of the three above: the three emphases every
     * theme draws, and any role a form names (`ActionVariant`). A name not
     * here draws as `secondary`, with a warning in development; the button
     * carries the name as `data-variant` either way.
     *
     * Added, not merged: two utilities of one kind — a base `px-3` and a
     * variant's `px-0` — resolve by stylesheet order, not by which slot is
     * the variant's. Leave out of the base what a variant changes, as the
     * Tailwind theme does with padding, or mark the variant's `!`. The same
     * holds for `text.variants` and `contents.variants`.
     */
    variants: Record<"primary" | "secondary" | "link", ActionVariantClasses> &
      Record<string, ActionVariantClasses>;
    /** Shown while an asynchronous handler runs. */
    busy: ReactNode;
  };
  /** The tab strip. */
  tabs: {
    /** The outer element. */
    className: string;
    /** The row of tabs. */
    list: string;
    /** One tab. */
    tab: string;
    /** Added to the active tab. */
    active: string;
    /** Added to every other tab. */
    inactive: string;
    /** The marker on a tab whose panel has an error. */
    invalidMarker: string;
    /** A panel. */
    panel: string;
  };
  /** The wizard. */
  wizard: {
    /** The row of steps. */
    steps: string;
    /** One step. */
    step: string;
    /** A page. */
    page: string;
    /** The Back / Next row. */
    nav: string;
  };
  /** The dialog. */
  dialog: {
    /** The `<dialog>`. */
    className: string;
    /** In design mode, drawn in place. */
    inline: string;
    /** The heading. */
    title: string;
    /** The button row. */
    actions: string;
  };
  /** The disclosure: a native `<details>`. */
  disclosure: {
    /** The `<details>`. */
    className: string;
    /** The `<summary>` — the toggle. */
    summary: string;
    /** Around the content. */
    content: string;
    /** On the toggle while a touched field inside shows an error. */
    invalidMarker: string;
  };
}

/**
 * What a group variant adds, per element. Any slot may be left out.
 *
 * @group Theming
 */
export interface GroupVariantClasses {
  /** Added to the wrapper around title and body. */
  wrapper?: string;
  /** Added to the title. */
  title?: string;
  /** Added to the body. */
  body?: string;
}

/**
 * What an action variant adds, per element. Any slot may be left out.
 *
 * @group Theming
 */
export interface ActionVariantClasses {
  /** Added to the button. */
  className?: string;
  /** Added to its text. */
  textClassName?: string;
  /** Added around its icon. */
  iconClassName?: string;
}

/**
 * Every property optional, recursively — except functions and React nodes,
 * which are replaced whole.
 *
 * @group Theming
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? T[K] extends ReactNode
        ? T[K]
        : DeepPartial<T[K]>
      : T[K];
};

/**
 * What a host supplies: any subset of {@link HtmlTheme}. A slot given
 * **replaces** the enclosing theme's; it does not append to it.
 *
 * @group Theming
 */
export type PartialHtmlTheme = DeepPartial<HtmlTheme>;

/**
 * The theme in effect when no provider sets one: **hook classes only** — one
 * stable, `rxf-`-prefixed name per element and state, and no styling. A form
 * renders and behaves with no CSS at all; a host that wants a look targets
 * these names with its own CSS, or uses {@link tailwindHtmlTheme}.
 *
 * @group Theming
 */
export const defaultHtmlTheme: HtmlTheme = {
  shellFor: {},
  shell: {
    vertical: "rxf-shell rxf-shell--vertical",
    horizontal: "rxf-shell rxf-shell--horizontal",
    label: "rxf-label",
    labelAfter: "rxf-label-after",
    control: "rxf-control",
    help: "rxf-help",
    labelRow: "rxf-label-row",
    helpButton: {
      className: "rxf-help-button",
      icon: <span aria-hidden="true">ⓘ</span>,
      text: "Help",
    },
    error: "rxf-error",
    renderError: null,
    required: { className: "rxf-required", text: "*", note: "Required" },
    count: "rxf-count",
    countOver: "rxf-count rxf-count-over",
  },
  frame: {
    className: "rxf-frame",
    slot: "rxf-slot",
    input: "rxf-input",
    multiline: "",
    classNameOn: "frame",
  },
  select: { emptyText: "" },
  checkbox: { input: "" },
  radio: {
    className: "rxf-radio",
    entryWrapper: "rxf-radio-entry",
    entry: "rxf-radio-option",
    input: "",
    label: "",
  },
  checkList: {
    className: "rxf-checklist",
    entry: "rxf-checklist-option",
    input: "",
    label: "",
  },
  displayOnly: {
    className: "rxf-readonly",
    inline: "rxf-readonly-inline",
    icon: "rxf-readonly-icon",
  },
  contents: {
    wrapper: "rxf-contents",
    hideWith: "attribute",
    hidden: "",
    collapse: "",
    inner: "rxf-contents-inner",
    title: "rxf-group-title",
    body: "rxf-contents-body",
    layout: "",
    section: {
      wrapper: "rxf-section",
      title: "rxf-section-title",
      body: "rxf-section-body",
    },
    flexBody: "rxf-contents-flex",
    flexGap: 16,
    variants: {},
  },
  inline: { wrapper: "rxf-inline", title: "rxf-group-title", variants: {} },
  visibility: { transitions: true, fade: "rxf-fade" },
  elements: { className: "rxf-elements" },
  displayShell: {
    display: "rxf-display",
    color: "",
    action: "rxf-action",
    tones: {
      error: "rxf-tone-error",
      warning: "rxf-tone-warning",
      info: "rxf-tone-info",
      success: "rxf-tone-success",
    },
    message: {
      error: "rxf-message rxf-tone-error",
      warning: "rxf-message rxf-tone-warning",
      info: "rxf-message rxf-tone-info",
      success: "rxf-message rxf-tone-success",
    },
  },
  text: {
    className: "rxf-text",
    inline: "rxf-text",
    heading: {
      className: "rxf-heading",
      levels: {
        1: "rxf-heading-1",
        2: "rxf-heading-2",
        3: "rxf-heading-3",
        4: "rxf-heading-4",
        5: "rxf-heading-5",
        6: "rxf-heading-6",
      },
    },
    variants: {},
  },
  richText: {
    strong: "rxf-strong",
    em: "rxf-em",
    sup: "rxf-sup",
    sub: "rxf-sub",
    link: "rxf-link",
    image: "rxf-rich-image",
  },
  html: { className: "rxf-html" },
  icon: { className: "rxf-icon" },
  action: {
    className: "rxf-btn",
    textClassName: "",
    iconClassName: "rxf-btn-icon",
    variants: {
      primary: { className: "rxf-btn--primary", textClassName: "", iconClassName: "" },
      secondary: { className: "rxf-btn--secondary", textClassName: "", iconClassName: "" },
      link: { className: "rxf-btn--link", textClassName: "", iconClassName: "" },
    },
    busy: <span className="rxf-spinner" />,
  },
  tabs: {
    className: "rxf-tabs",
    list: "rxf-tabstrip",
    tab: "rxf-tab",
    active: "rxf-tab--active",
    inactive: "",
    invalidMarker: "rxf-tab-dot",
    panel: "rxf-tabpanel",
  },
  wizard: {
    steps: "rxf-steps",
    step: "rxf-step",
    page: "rxf-wizard-page",
    nav: "rxf-row",
  },
  dialog: {
    className: "rxf-modal",
    inline: "rxf-modal-inline",
    title: "rxf-modal-title",
    actions: "rxf-row",
  },
  disclosure: {
    className: "rxf-disclosure",
    summary: "rxf-disclosure-summary",
    content: "rxf-disclosure-content",
    invalidMarker: "rxf-disclosure-dot",
  },
};

/**
 * The Tailwind look: every hook class, plus Tailwind utilities. Nothing is
 * shipped as CSS — the host's own Tailwind build generates it, once the
 * package is in its scan (`@source` in v4, `content` in v3).
 *
 * Written for **Tailwind 3.4 and 4 alike**, because the two adopters are on
 * 3.4 and this repo on 4: explicit colours and widths wherever a default
 * changed between them (`border`, `ring`), none of the renamed utilities
 * (`shadow-sm`, bare `rounded` / `shadow`, `outline-none`), no
 * `bg-opacity-*`, opacity modifiers from 3.4's scale only, and no stacked
 * variants (v4 reversed their order) — a single arbitrary variant instead,
 * `[&[data-active]_button]:…`. **Does not presuppose preflight** — ServiceTas
 * runs without it (`corePlugins: { preflight: false }`) — so each slot
 * resets what preflight would have: a `<button>`'s border, background and font, a `<p>`'s
 * margin.
 *
 * Legacy `defaultTailwindTheme`'s classes where legacy had real ones (group
 * bodies, the tab strip, errors, radios); where legacy leaned on host CSS —
 * `form-control` inputs, a `primary` palette — the standard palette instead,
 * so the theme stands on its own.
 *
 * @group Theming
 */
export const tailwindHtmlTheme: HtmlTheme = {
  shellFor: {},
  shell: {
    vertical: "rxf-shell rxf-shell--vertical flex min-w-0 flex-col gap-1",
    horizontal:
      "rxf-shell rxf-shell--horizontal flex min-w-0 flex-row items-baseline gap-3",
    label: "rxf-label text-sm font-semibold text-gray-700",
    labelAfter: "rxf-label-after inline-flex items-center gap-2 cursor-pointer",
    control: "rxf-control block",
    help: "rxf-help m-0 text-xs text-gray-500",
    labelRow: "rxf-label-row inline-flex items-center gap-1",
    helpButton: {
      className:
        "rxf-help-button inline-flex cursor-pointer items-center border-0 bg-transparent p-0 leading-none text-gray-500 hover:text-gray-700",
      icon: <span aria-hidden="true">ⓘ</span>,
      text: "Help",
    },
    // layout.errorClass
    error: "rxf-error m-0 text-sm text-red-500",
    renderError: null,
    // label.requiredElement
    required: { className: "rxf-required text-red-500", text: " *", note: "Required" },
    count: "rxf-count m-0 text-xs text-gray-500",
    countOver: "rxf-count rxf-count-over m-0 text-xs text-red-600",
  },
  frame: {
    className:
      "rxf-frame box-border flex w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 data-[multiline]:items-start data-[focused]:border-blue-600 data-[focused]:ring-2 data-[focused]:ring-blue-600/20 data-[invalid]:border-red-600 data-[disabled]:bg-gray-100 data-[disabled]:text-gray-400 data-[readonly]:bg-gray-50",
    slot: "rxf-slot inline-flex text-sm text-gray-400",
    input:
      "rxf-input min-w-0 flex-1 border-0 bg-transparent p-0 outline-0 text-inherit [font:inherit]",
    multiline: "resize-y whitespace-pre-wrap",
    classNameOn: "frame",
  },
  select: { emptyText: "" },
  checkbox: { input: "h-4 w-4" },
  // data.checkOptions
  radio: {
    className: "rxf-radio flex items-center gap-4",
    entryWrapper: "rxf-radio-entry",
    entry: "rxf-radio-option flex items-center gap-1 cursor-pointer",
    input: "h-4 w-4",
    label: "",
  },
  checkList: {
    className: "rxf-checklist flex flex-col gap-1.5",
    entry: "rxf-checklist-option flex items-center gap-1 cursor-pointer",
    input: "h-4 w-4",
    label: "",
  },
  displayOnly: {
    className: "rxf-readonly flex items-center gap-1.5 min-h-[1.5em] py-1.5",
    inline: "rxf-readonly-inline font-semibold",
    icon: "rxf-readonly-icon inline-flex items-center",
  },
  contents: {
    wrapper: "rxf-contents",
    // The collapse: grid rows 1fr → 0fr and a fade, keyed on data-hidden.
    hideWith: "collapse",
    hidden: "",
    collapse:
      "grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-200 data-[hidden]:grid-rows-[0fr] data-[hidden]:opacity-0 data-[hidden]:pointer-events-none",
    inner: "rxf-contents-inner min-h-0 overflow-hidden",
    // group.groupLabelClass
    title: "rxf-group-title font-bold",
    // group.standardClassName / flexClassName
    body: "rxf-contents-body",
    layout: "flex flex-col gap-4",
    section: {
      wrapper: "rxf-section",
      title: "rxf-section-title",
      body: "rxf-section-body",
    },
    flexBody: "rxf-contents-flex gap-2",
    flexGap: "0.5rem",
    variants: {},
  },
  // group.inlineClass
  inline: { wrapper: "rxf-inline", title: "rxf-group-title", variants: {} },
  visibility: {
    transitions: true,
    // Inline in prose, where a block wrapper would break the sentence.
    fade: "rxf-fade transition-[opacity,transform] duration-200 data-[leaving]:-translate-y-1 data-[leaving]:opacity-0 [.rxf-inline_&]:inline",
  },
  elements: { className: "rxf-elements flex flex-col gap-2.5" },
  displayShell: {
    display: "rxf-display block [.rxf-inline_&]:inline",
    color: "",
    action: "rxf-action inline-block [.rxf-inline_&]:inline",
    tones: {
      error: "rxf-tone-error text-red-700",
      warning: "rxf-tone-warning text-amber-700",
      info: "rxf-tone-info text-sky-700",
      success: "rxf-tone-success text-green-700",
    },
    message: {
      error: "rxf-message rxf-tone-error text-red-700",
      warning: "rxf-message rxf-tone-warning text-amber-700",
      info: "rxf-message rxf-tone-info text-sky-700",
      success: "rxf-message rxf-tone-success text-green-700",
    },
  },
  text: {
    className: "rxf-text m-0",
    inline: "rxf-text",
    heading: {
      // A group title's look at every level, as the group titles have: a
      // heading's rank is the outline's, and sizes per level are the app's.
      className: "rxf-heading m-0 font-bold",
      levels: {
        1: "rxf-heading-1",
        2: "rxf-heading-2",
        3: "rxf-heading-3",
        4: "rxf-heading-4",
        5: "rxf-heading-5",
        6: "rxf-heading-6",
      },
    },
    variants: {},
  },
  richText: {
    strong: "rxf-strong font-bold",
    em: "rxf-em italic",
    sup: "rxf-sup",
    sub: "rxf-sub",
    link: "rxf-link text-blue-600 underline",
    // Inline in the words, never wider than what holds them.
    image: "rxf-rich-image inline-block max-w-full",
  },
  html: { className: "rxf-html" },
  icon: { className: "rxf-icon" },
  // action.buttonClass, over the standard palette in place of `primary-500`.
  action: {
    className:
      // No padding here: the variants set it, since a variant's `px-0` cannot
      // beat a base `px-3` (Tailwind resolves the two by stylesheet order).
      "rxf-btn inline-flex items-center gap-1.5 rounded-lg border border-transparent text-sm [font:inherit] disabled:cursor-not-allowed disabled:opacity-75",
    textClassName: "",
    iconClassName: "rxf-btn-icon inline-flex items-center",
    variants: {
      primary: {
        className: "rxf-btn--primary bg-blue-600 px-3 py-2 text-white hover:bg-blue-700",
        textClassName: "",
        iconClassName: "",
      },
      secondary: {
        className:
          "rxf-btn--secondary border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50",
        textClassName: "",
        iconClassName: "",
      },
      link: {
        className: "rxf-btn--link bg-transparent text-blue-600 underline",
        textClassName: "",
        iconClassName: "",
      },
    },
    busy: (
      <span className="rxf-spinner inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
    ),
  },
  // group.tabs, dark: variants dropped.
  tabs: {
    className: "rxf-tabs",
    list: "rxf-tabstrip flex flex-wrap text-sm font-medium text-center text-gray-500 border-b border-gray-200",
    // A <button>: border-0 and the background reset what preflight would.
    tab: "rxf-tab me-2 inline-flex items-center justify-center p-4 border-0 border-b-2 bg-transparent [font:inherit] group",
    active: "rxf-tab--active text-blue-600 border-blue-600 rounded-t-lg active",
    inactive:
      "border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 cursor-pointer",
    invalidMarker: "rxf-tab-dot ml-1 text-[9px] text-red-600",
    panel: "rxf-tabpanel my-2",
  },
  wizard: {
    steps:
      "rxf-steps mb-4 mt-0 flex list-none gap-1.5 border-b border-gray-200 p-0",
    step: "rxf-step [&_button]:border-0 [&_button]:border-b-2 [&_button]:[font:inherit] [&_button]:border-transparent [&_button]:bg-transparent [&_button]:px-2.5 [&_button]:py-2 [&_button]:text-sm [&_button]:text-gray-600 [&[data-active]_button]:border-blue-600 [&[data-active]_button]:text-blue-600 [&[data-invalid]_button]:text-red-600",
    page: "rxf-wizard-page",
    nav: "rxf-row flex items-end gap-2",
  },
  dialog: {
    className:
      "rxf-modal min-w-[360px] rounded-lg border border-gray-300 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop:bg-black/40",
    inline:
      "rxf-modal-inline rounded-lg border border-dashed border-gray-400 p-3",
    title: "rxf-modal-title mb-3 block font-semibold",
    actions: "rxf-row flex justify-end gap-2",
  },
  disclosure: {
    className: "rxf-disclosure",
    summary: "rxf-disclosure-summary cursor-pointer select-none font-medium text-gray-700",
    content: "rxf-disclosure-content mt-2",
    invalidMarker: "rxf-disclosure-dot ml-1 text-[9px] text-red-600",
  },
};

/**
 * The theme in effect at this position, fully resolved.
 *
 * @group Theming
 */
export function useHtmlTheme(): HtmlTheme {
  return useContext(ThemeContext);
}

const ThemeContext = createContext<HtmlTheme>(defaultHtmlTheme);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" && v !== null && !Array.isArray(v) && !isValidElement(v)
  );
}

/**
 * Over wins, slot by slot: an overlay **replaces** a slot rather than
 * appending to it. A theme names the class an element has; appending is what
 * the author's class props are for.
 */
function mergeTheme<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    const b = out[k];
    out[k] = isPlainObject(v) && isPlainObject(b) ? mergeTheme(b, v) : v;
  }
  return out as T;
}

/**
 * The props of {@link HtmlThemeProvider}.
 *
 * @group Theming
 */
export interface HtmlThemeProviderProps {
  /**
   * Slots to replace, over the enclosing theme. Pass a module constant or a
   * memoised object: a new object every render re-renders every field below.
   */
  theme: PartialHtmlTheme;
  /** The region it applies to. */
  children: ReactNode;
}

/**
 * Apply a theme to a region, merged over the enclosing one — so providers
 * nest, and a per-form overlay is one more provider on top of an app's base
 * theme. The merge runs when the parent theme or `theme` changes identity,
 * not on every render.
 *
 * @group Theming
 */
export function HtmlThemeProvider({
  theme,
  children,
}: HtmlThemeProviderProps): ReactNode {
  const parent = useHtmlTheme();
  const resolved = useMemo(() => mergeTheme(parent, theme), [parent, theme]);
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>;
}
