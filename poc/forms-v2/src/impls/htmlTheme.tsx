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
     * Added while hidden, and it must hide: the region stays mounted (it is
     * what clears its own value), so nothing else takes it off screen. Not the
     * `hidden` attribute — Ant's reset forces `[hidden]` to `display: none
     * !important`, which would kill the default theme's collapse animation.
     * The default is `""` because `demo.css` animates `[data-hidden]`.
     */
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

/** Today's classes, unchanged — `demo.css` styles them. */
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
