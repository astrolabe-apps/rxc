import type { ReactNode } from "react";
import type { Rendered } from "@rx-controls/react";
import type { ActionStyle } from "@rx-controls/forms-react";
import { notBuilt, notBuiltComponent } from "./notBuilt.js";

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
  /** The read-only value. */
  displayOnly: {
    /** As a block. */
    className: string;
    /** Inside an inline group. */
    inline: string;
  };
  /** The layout box. */
  stack: {
    /** The box. */
    className: string;
    /** The gap when a stack sets none. */
    defaultGap: number | string;
  };
  /** The standard group. */
  contents: {
    /** The wrapper around title and body. */
    wrapper: string;
    /**
     * Added while hidden. The region stays mounted — each child clears its own
     * value — so this is what takes it off screen, unless the theme leaves it
     * to an animation keyed on `data-hidden`.
     */
    hidden: string;
    /** The element inside the wrapper, for a collapse animation. */
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
    /** Added by style, on top of the two above. */
    styles: Record<
      ActionStyle,
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
 * The theme in effect when no provider sets one.
 *
 * @group Theming
 */
export const defaultHtmlTheme: HtmlTheme = {
  shell: {
    vertical: "ff-shell ff-shell--vertical",
    horizontal: "ff-shell ff-shell--horizontal",
    label: "ff-label",
    labelAfter: "ff-label-after",
    control: "ff-control",
    help: "ff-help",
    error: "ff-error",
    renderError: null,
    required: { className: "ff-required", text: "*" },
  },
  frame: {
    className: "ff-frame",
    slot: "ff-slot",
    input: "ff-input",
    multiline: "",
    classNameOn: "frame",
  },
  select: { emptyText: "" },
  checkbox: { input: "" },
  radio: {
    className: "ff-radio",
    entryWrapper: "ff-radio-entry",
    entry: "ff-radio-option",
    input: "",
    label: "",
  },
  displayOnly: { className: "ff-readonly", inline: "ff-readonly-inline" },
  stack: { className: "ff-stack", defaultGap: 16 },
  contents: {
    wrapper: "ff-contents",
    hidden: "",
    inner: "ff-contents-inner",
    title: "ff-group-title",
    body: "ff-contents-body",
    flexBody: "ff-contents-flex",
    flexGap: 16,
  },
  inline: { wrapper: "ff-inline", title: "ff-group-title" },
  elements: { className: "ff-elements" },
  displayShell: { display: "ff-display", action: "ff-action" },
  text: { className: "ff-text", inline: "ff-text" },
  html: { className: "ff-html" },
  icon: { className: "ff-icon" },
  action: {
    className: "ff-btn",
    textClassName: "",
    styles: {
      primary: { className: "ff-btn--primary", textClassName: "" },
      secondary: { className: "ff-btn--secondary", textClassName: "" },
      link: { className: "ff-btn--link", textClassName: "" },
    },
    busy: <span className="ff-spinner" />,
  },
  tabs: {
    className: "ff-tabs",
    list: "ff-tabstrip",
    tab: "ff-tab",
    active: "ff-tab--active",
    inactive: "",
    invalidMarker: "ff-tab-dot",
    panel: "ff-tabpanel",
  },
  wizard: {
    steps: "ff-steps",
    step: "ff-step",
    page: "ff-wizard-page",
    nav: "ff-row",
  },
  dialog: {
    className: "ff-modal",
    inline: "ff-modal-inline",
    title: "ff-modal-title",
    actions: "ff-row",
  },
};

/**
 * The theme in effect at this position, fully resolved.
 *
 * @group Theming
 */
export function useHtmlTheme(): HtmlTheme {
  return notBuilt("useHtmlTheme");
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
export const HtmlThemeProvider: (props: HtmlThemeProviderProps) => Rendered =
  notBuiltComponent<HtmlThemeProviderProps>("HtmlThemeProvider");
