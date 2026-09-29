import {
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { ActionStyle } from "../framework/index.js";

/**
 * Every class the html implementation emits, one slot per element — legacy
 * `defaultTailwindTheme`'s model (README finding 72). This is `forms-html`'s
 * API, not the contract's: MUI, Ant and Mantine never read it, and a
 * third-party renderer reaches chrome through `useFieldShell` /
 * `useInputFrame`, never through these strings.
 *
 * The type is the **resolved** theme — every slot filled, so a renderer reads
 * `theme.shell.label` with no fallback, and a slot added here does not compile
 * until `defaultHtmlTheme` fills it. A host passes a `PartialHtmlTheme`.
 *
 * A slot is the implementation's *own* class for that element — the left-hand
 * side of `mergeClass`. The JSON's `styleClass` / `textClass` / `layoutClass` /
 * `labelClass` / `labelTextClass` still merge onto it or `{ replace }` it
 * (decision 4); a theme and a definition compose, they do not compete.
 */
export interface HtmlTheme {
  shell: {
    /** The outer element, by orientation. */
    vertical: string;
    horizontal: string;
    label: string;
    /** The `<label>` that wraps a checkbox and its trailing text. */
    labelAfter: string;
    /** Wraps the control under a leading label. */
    control: string;
    help: string;
    error: string;
    /**
     * Legacy's `layout.renderError`: a host whose errors are a component (an
     * icon, a link) rather than a styled `<p>`. `null` → the `<p>` above.
     */
    renderError: ((error: ReactNode, id: string) => ReactNode) | null;
    required: {
      className: string;
      /** Legacy ServiceTas renders the span and suppresses the asterisk. */
      text: string;
    };
  };
  frame: {
    className: string;
    slot: string;
    /** Lands on the `<input>` / `<select>` / `<textarea>` through the slot. */
    input: string;
    /** Appended for a `<textarea>` (legacy's `multilineClass`). */
    multiline: string;
    /**
     * Where the control's own `className` (the JSON's `styleClass`) lands:
     * on the element that carries the chrome. A theme with the border on the
     * frame says `"frame"`; one that keeps it on the input — Bootstrap's
     * `.form-control` — says `"input"`, or a `!bg-gray-200` meant for the
     * input paints the wrapper around it.
     */
    classNameOn: "frame" | "input";
  };
  select: {
    /** Text of the empty option (legacy `selectOptions.emptyText`). */
    emptyText: string;
  };
  checkbox: { input: string };
  radio: {
    className: string;
    /** Per option, around the option and its per-option content. */
    entryWrapper: string;
    /** The `<label>` wrapping the input and its text. */
    entry: string;
    input: string;
    label: string;
  };
  displayOnly: { className: string; inline: string };
  stack: {
    className: string;
    /** Used when a stack's `gap` is unset (legacy `defaultFlexGap`). */
    defaultGap: number | string;
  };
  contents: {
    wrapper: string;
    /**
     * How a hidden region leaves the screen. It stays mounted either way —
     * each child clears its own value — and is always `inert`.
     *
     * - `"attribute"`: the `hidden` attribute. Works with no CSS at all, which
     *   is why the default uses it.
     * - `"class"`: `hidden` (below) plus whatever the theme keys on
     *   `[data-hidden]` — the only way to animate the exit, since the
     *   attribute is `display: none` at once.
     */
    hideWith: "attribute" | "class";
    /** Added while hidden, under `hideWith: "class"`. It must hide. */
    hidden: string;
    inner: string;
    title: string;
    /** The standard body — legacy's `standardClassName`. */
    body: string;
    /** A body with a `layout`: a flex box — legacy's `flexClassName`. */
    flexBody: string;
    /** Its gap when the layout has none — legacy's `defaultFlexGap`. */
    flexGap: number | string;
  };
  inline: { wrapper: string; title: string };
  /** The `FadeVisibility` slot's wrapper. */
  visibility: {
    /**
     * The wrapper that holds a leaving boundary's last frame. It gets
     * `data-leaving` for the length of the exit; with no CSS for it the
     * content simply stays up for that long, then goes.
     */
    fade: string;
  };
  elements: { className: string };
  /** The wrapper a display or an action sits in (legacy's layout element). */
  displayShell: { display: string; action: string };
  text: { className: string; inline: string };
  html: { className: string };
  icon: { className: string };
  action: {
    className: string;
    textClassName: string;
    /** Layered on `className` / `textClassName` by style. */
    styles: Record<ActionStyle, { className: string; textClassName: string }>;
    busy: ReactNode;
  };
  tabs: {
    className: string;
    list: string;
    tab: string;
    active: string;
    inactive: string;
    invalidMarker: string;
    panel: string;
  };
  wizard: {
    steps: string;
    step: string;
    page: string;
    nav: string;
  };
  dialog: {
    className: string;
    inline: string;
    title: string;
    actions: string;
  };
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? T[K] extends ReactNode
        ? T[K]
        : DeepPartial<T[K]>
      : T[K];
};

export type PartialHtmlTheme = DeepPartial<HtmlTheme>;

/**
 * The default: **hook classes only** — one stable, `rxf-`-prefixed name per
 * element and state, and no styling. A form renders and behaves with no CSS
 * at all; a host that wants a look targets these names with its own CSS, or
 * uses `tailwindHtmlTheme`. `demo.css` is this POC's stylesheet for them.
 * README finding 79.
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
  displayOnly: { className: "rxf-readonly", inline: "rxf-readonly-inline" },
  stack: { className: "rxf-stack", defaultGap: 16 },
  contents: {
    wrapper: "rxf-contents",
    hideWith: "attribute",
    hidden: "",
    inner: "rxf-contents-inner",
    title: "rxf-group-title",
    body: "rxf-contents-body",
    flexBody: "rxf-contents-flex",
    flexGap: 16,
  },
  inline: { wrapper: "rxf-inline", title: "rxf-group-title" },
  visibility: { fade: "rxf-fade" },
  elements: { className: "rxf-elements" },
  displayShell: { display: "rxf-display", action: "rxf-action" },
  text: { className: "rxf-text", inline: "rxf-text" },
  html: { className: "rxf-html" },
  icon: { className: "rxf-icon" },
  action: {
    className: "rxf-btn",
    textClassName: "",
    styles: {
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
 * so the theme stands on its own. README finding 79.
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
      "rxf-frame flex w-full items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 data-[multiline]:items-start data-[focused]:border-blue-600 data-[focused]:ring-2 data-[focused]:ring-blue-600/20 data-[invalid]:border-red-600 data-[disabled]:bg-gray-100 data-[disabled]:text-gray-400 data-[readonly]:bg-gray-50",
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
  displayOnly: {
    className: "rxf-readonly min-h-[1.5em] py-1.5",
    inline: "rxf-readonly-inline font-semibold",
  },
  stack: { className: "rxf-stack", defaultGap: "0.5rem" },
  contents: {
    // The collapse: grid rows 1fr → 0fr and a fade, keyed on data-hidden.
    wrapper:
      "rxf-contents grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] duration-200 data-[hidden]:grid-rows-[0fr] data-[hidden]:opacity-0 data-[hidden]:pointer-events-none",
    hideWith: "class",
    hidden: "",
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
  },
  text: { className: "rxf-text m-0", inline: "rxf-text" },
  html: { className: "rxf-html" },
  icon: { className: "rxf-icon" },
  // action.buttonClass, over the standard palette in place of `primary-500`.
  action: {
    className:
      "rxf-btn inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-sm [font:inherit] disabled:cursor-not-allowed disabled:opacity-75",
    textClassName: "",
    styles: {
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    !isValidElement(v)
  );
}

/**
 * Over wins, slot by slot — legacy `deepMerge(value, fallback)`. An overlay
 * *replaces* a slot rather than appending to it: a theme names the class an
 * element has, and appending is what the JSON's class props are for.
 */
export function deepMergeTheme<T>(
  base: T,
  over: DeepPartial<T> | undefined,
): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    const b = out[k];
    out[k] = isPlainObject(v) && isPlainObject(b) ? deepMergeTheme(b, v) : v;
  }
  return out as T;
}

const HtmlThemeContext = createContext<HtmlTheme>(defaultHtmlTheme);

export function useHtmlTheme(): HtmlTheme {
  return useContext(HtmlThemeContext);
}

/**
 * Merges over the enclosing theme, so providers nest — ServiceTas's
 * `formStyles` (`compact`, `mrs`, `mast`, …) are overlays picked per form on
 * top of one base, and each is one more provider.
 *
 * The merge runs when the parent or `theme` changes identity, not per render:
 * the boundaries are memo bailouts that a new context value punches through,
 * so pass a module constant (or a memoised object), never an inline literal.
 */
export function HtmlThemeProvider({
  theme,
  children,
}: {
  theme: PartialHtmlTheme;
  children: ReactNode;
}) {
  const parent = useHtmlTheme();
  const resolved = useMemo(
    () => deepMergeTheme(parent, theme),
    [parent, theme],
  );
  return <HtmlThemeContext value={resolved}>{children}</HtmlThemeContext>;
}
