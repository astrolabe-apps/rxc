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
 * @group Theming
 */
export interface HtmlTheme {
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
    /** The standard body. */
    body: string;
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
  };
  /** {@link FadeVisibility}. */
  visibility: {
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
    /** Around a display. */
    display: string;
    /** Around a button. */
    action: string;
    /**
     * Added around a display with a `tone` — its colour, inherited by the
     * text inside.
     */
    tones: Record<Tone, string>;
  };
  /** The text display. */
  text: {
    /** As a block. */
    className: string;
    /** Inside an inline group. */
    inline: string;
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
    /** Added by variant, on top of the two above. */
    variants: Record<
      ActionVariant,
      {
        /** Added to the button. */
        className: string;
        /** Added to its text. */
        textClassName: string;
      }
    >;
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
  shell: {
    vertical: "rxf-shell rxf-shell--vertical",
    horizontal: "rxf-shell rxf-shell--horizontal",
    label: "rxf-label",
    labelAfter: "rxf-label-after",
    control: "rxf-control",
    help: "rxf-help",
    error: "rxf-error",
    renderError: null,
    required: { className: "rxf-required", text: "*" },
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
  displayOnly: { className: "rxf-readonly", inline: "rxf-readonly-inline" },
  contents: {
    wrapper: "rxf-contents",
    hideWith: "attribute",
    hidden: "",
    collapse: "",
    inner: "rxf-contents-inner",
    title: "rxf-group-title",
    body: "rxf-contents-body",
    flexBody: "rxf-contents-flex",
    flexGap: 16,
  },
  inline: { wrapper: "rxf-inline", title: "rxf-group-title" },
  visibility: { fade: "rxf-fade" },
  elements: { className: "rxf-elements" },
  displayShell: {
    display: "rxf-display",
    action: "rxf-action",
    tones: {
      error: "rxf-tone-error",
      warning: "rxf-tone-warning",
      info: "rxf-tone-info",
      success: "rxf-tone-success",
    },
  },
  text: { className: "rxf-text", inline: "rxf-text" },
  html: { className: "rxf-html" },
  icon: { className: "rxf-icon" },
  action: {
    className: "rxf-btn",
    textClassName: "",
    variants: {
      primary: { className: "rxf-btn--primary", textClassName: "" },
      secondary: { className: "rxf-btn--secondary", textClassName: "" },
      link: { className: "rxf-btn--link", textClassName: "" },
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
 * resets what preflight would have: a `<fieldset>` shell's border, margin
 * and padding, a `<button>`'s border, background and font, a `<p>`'s
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
  shell: {
    // A shell may be a <fieldset> (labelAs "legend"): reset its UA box.
    vertical:
      "rxf-shell rxf-shell--vertical m-0 flex min-w-0 flex-col gap-1 border-0 p-0",
    horizontal:
      "rxf-shell rxf-shell--horizontal m-0 flex min-w-0 flex-row items-baseline gap-3 border-0 p-0",
    label: "rxf-label text-sm font-semibold text-gray-700",
    labelAfter: "rxf-label-after inline-flex items-center gap-2 cursor-pointer",
    control: "rxf-control block",
    help: "rxf-help m-0 text-xs text-gray-500",
    // layout.errorClass
    error: "rxf-error m-0 text-sm text-red-500",
    renderError: null,
    // label.requiredElement
    required: { className: "rxf-required text-red-500", text: " *" },
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
    className: "rxf-readonly min-h-[1.5em] py-1.5",
    inline: "rxf-readonly-inline font-semibold",
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
    body: "rxf-contents-body flex flex-col gap-4",
    flexBody: "rxf-contents-flex gap-2",
    flexGap: "0.5rem",
  },
  // group.inlineClass
  inline: { wrapper: "rxf-inline", title: "rxf-group-title" },
  visibility: {
    // Inline in prose, where a block wrapper would break the sentence.
    fade: "rxf-fade transition-[opacity,transform] duration-200 data-[leaving]:-translate-y-1 data-[leaving]:opacity-0 [.rxf-inline_&]:inline",
  },
  elements: { className: "rxf-elements flex flex-col gap-2.5" },
  displayShell: {
    display: "rxf-display block [.rxf-inline_&]:inline",
    action: "rxf-action inline-block [.rxf-inline_&]:inline",
    tones: {
      error: "rxf-tone-error text-red-700",
      warning: "rxf-tone-warning text-amber-700",
      info: "rxf-tone-info text-sky-700",
      success: "rxf-tone-success text-green-700",
    },
  },
  text: { className: "rxf-text m-0", inline: "rxf-text" },
  html: { className: "rxf-html" },
  icon: { className: "rxf-icon" },
  // action.buttonClass, over the standard palette in place of `primary-500`.
  action: {
    className:
      "rxf-btn inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-sm [font:inherit] disabled:cursor-not-allowed disabled:opacity-75",
    textClassName: "",
    variants: {
      primary: {
        className: "rxf-btn--primary bg-blue-600 text-white hover:bg-blue-700",
        textClassName: "",
      },
      secondary: {
        className:
          "rxf-btn--secondary border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
        textClassName: "",
      },
      link: {
        className: "rxf-btn--link bg-transparent px-0 text-blue-600 underline",
        textClassName: "",
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
