import {
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Tone } from "@rx-controls/forms-react";

/**
 * Every class the React Native implementation puts on an element, one slot
 * per element — NativeWind classes, which an app's Tailwind build turns into
 * styles. `forms-native`'s API, not the contract's.
 *
 * Only classes NativeWind carries to native belong here: no pseudo-elements,
 * no descendant selectors. State an element has no variant for — a frame
 * focused, a box checked, a tab active — is a slot of its own, applied by the
 * implementation, so it never depends on a variant a platform lacks.
 *
 * The app's Tailwind `content` must include this package's built files
 * (`node_modules/@rx-controls/forms-native/lib/**
 * What a group variant adds, per element. Any slot may be left out.
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
 * What an action variant adds. Either slot may be left out.
 */
export interface ActionVariantClasses {
  /** Added to the button. */
  className?: string;
  /**
   * Added to its text, and to an icon given as a string: React Native text
   * inherits nothing from the button around it, so this is how a glyph
   * takes the button's colour.
   */
  textClassName?: string;
}

/**\/*.js`), or none of these
 * classes are compiled.
 *
 * @group Theming
 */
export interface NativeTheme {
  /**
   * The field shell, per widget: slots merged over `shell` for the shell
   * around that widget (`FieldShellProps.widget` — `select`, `checkbox`, or
   * a third-party widget's own name). For a look whose shells differ by
   * widget: a card behind each radio question, a larger label beside a
   * switch. Keyed as html's `shellFor` is.
   */
  shellFor: Partial<Record<string, DeepPartial<NativeTheme["shell"]>>>;
  /** The field shell. */
  shell: {
    /** The outer element: label, control, help, error. */
    className: string;
    /**
     * The label. In a row (a checkbox's, `labelEnd` help's) it sits beside
     * other items, and React Native's flex items do not shrink unless told:
     * keep `shrink` here, or a long label pushes the control off the screen.
     */
    label: string;
    /** The required marker, inside the label. */
    required: string;
    /** Help text. */
    help: string;
    /** The error. */
    error: string;
    /** A character count within its limit. */
    count: string;
    /** The count past its limit, in place of `count`. */
    countOver: string;
    /**
     * What a group that cannot carry `aria-required` (a check list) is
     * described with first. Words, for assistive technology.
     */
    requiredNote: string;
    /** A trailing label beside its control (a checkbox's): the row. */
    afterRow: string;
    /**
     * `labelEnd` help: the label and its button side by side. In a
     * `horizontal` row, beside the control, so it shrinks as `label` does.
     */
    labelRow: string;
    /**
     * A label beside its control (`orientation: "horizontal"` — a checkbox
     * with `labelPosition: "before"`): the row, the control at its end.
     */
    horizontal: string;
    /** The button that shows `labelEnd` help. */
    helpButton: {
      /** Its element. */
      className: string;
      /** What it shows. */
      icon: ReactNode;
      /** Its accessible name — words. */
      text: string;
    };
  };
  /** The input frame: the box around a text input or a select's trigger. */
  frame: {
    /** Always. */
    className: string;
    /** Added while the control has focus. */
    focused: string;
    /** Added while the field is invalid. */
    invalid: string;
    /** Added while the field is disabled. */
    disabled: string;
    /** The `TextInput` inside. */
    input: string;
  };
  /** The checkbox. */
  checkbox: {
    /**
     * `box`: a square that shows a tick. `switch`: React Native's own
     * `Switch`, for a form whose checkboxes are on/off settings.
     */
    control: "box" | "switch";
    /** The box. */
    box: string;
    /** Added while checked. */
    checked: string;
    /** The tick inside a checked box. */
    mark: string;
    /** What the tick shows. */
    markIcon: ReactNode;
  };
  /** The radio group. */
  radio: {
    /** The group. */
    className: string;
    /** Around each option and its per-option content. */
    entry: string;
    /** One option: the ring and its text. */
    option: string;
    /** The ring. */
    ring: string;
    /** Added to the ring while selected. */
    ringSelected: string;
    /** The dot inside a selected ring. */
    dot: string;
    /** The option's text. */
    label: string;
  };
  /** A set of checkboxes. */
  checkList: {
    /** The group. */
    className: string;
    /** One option: the box and its text. */
    option: string;
    /** The option's text. */
    label: string;
  };
  /** The select: a trigger in the input frame, its options in a sheet. */
  select: {
    /** The trigger's text: the chosen option's name. */
    value: string;
    /** The trigger's text with nothing chosen. */
    placeholder: string;
    /** The empty choice's words. */
    emptyText: string;
    /** The sheet's backdrop. */
    backdrop: string;
    /** The sheet. */
    sheet: string;
    /** One option in it. */
    option: string;
    /** Added to the chosen option. */
    optionSelected: string;
    /** An option's text. */
    optionText: string;
  };
  /** The display-only field. */
  displayOnly: {
    /** As a block. */
    className: string;
    /** Inside an inline group. */
    inline: string;
    /** Around a `startIcon` / `endIcon`. */
    icon: string;
  };
  /** The standard group. */
  contents: {
    /** The wrapper around title and body. */
    wrapper: string;
    /** The title, a heading. */
    title: string;
    /** The body the children sit in. */
    body: string;
    /**
     * Named looks (`GroupProps.variant` — "card", "callout"), each added to
     * the wrapper, title and body of a group that names it, over the slots
     * above (merged, so a variant's utility wins over the base's). A name not
     * here draws the base look, with a warning in development.
     */
    variants: Record<string, GroupVariantClasses>;
  };
  /** An inline group: prose. */
  inline: {
    /** Its element. */
    wrapper: string;
    /**
     * Named looks for an inline group, as `contents.variants`: `wrapper` is
     * added to its element (an inline group draws no title or body).
     */
    variants: Record<string, GroupVariantClasses>;
  };
  /** The text display. */
  text: {
    /** As a block. */
    className: string;
    /**
     * Drawn as a heading: `className` on every one, and the level's class
     * beside it — the level the form's outline gives the place.
     */
    heading: {
      /** On every heading. */
      className: string;
      /** Beside it, by the heading's level. */
      levels: Record<1 | 2 | 3 | 4 | 5 | 6, string>;
    };
    /** By tone, on any display's text. */
    tones: Record<Tone, string>;
    /**
     * Named looks (`TextDisplay variant` — "lead", "tag"), each merged over
     * the text's block or heading class, under its tone. A name not here
     * draws the base look, with a warning in development.
     */
    variants: Record<string, string>;
  };
  /** The icon display. */
  icon: {
    /** Its element, and a glyph given as a string. */
    className: string;
    /**
     * Named looks (`IconDisplay variant` — "large", "note"), merged over the
     * base. A name not here draws the base look, with a warning in
     * development.
     */
    variants: Record<string, string>;
  };
  /** Rich text (`RichText`): nested `Text`, inheriting what it sits in. */
  richText: {
    /** `b` / `strong`. */
    strong: string;
    /** `i` / `em`. */
    em: string;
    /**
     * `sup`. Digits and signs are drawn as Unicode superscripts, raised in
     * every font; anything else just takes this class — native text has no
     * baseline shift.
     */
    sup: string;
    /** `sub`. */
    sub: string;
    /** `a`. */
    link: string;
    /** `img`. */
    image: string;
  };
  /** The image display. */
  image: {
    /** The `Image`. */
    className: string;
    /**
     * Named looks (`ImageDisplay variant` — "rounded"), merged over the
     * base. A name not here draws the base look, with a warning in
     * development.
     */
    variants: Record<string, string>;
  };
  /** The html display: its markup's text. */
  html: {
    /** Its element. */
    className: string;
  };
  /** Buttons. */
  action: {
    /** Every button. */
    className: string;
    /**
     * Every button's text. React Native's flex items do not shrink unless
     * told, so keep `shrink` here: a long label beside an icon otherwise
     * pushes the icon out of the button.
     */
    textClassName: string;
    /** Around its icon, or the spinner in its place. */
    iconClassName: string;
    /**
     * Added over the text's classes on an icon given as a string, which is
     * drawn in the button's text look so it takes the button's colour: what
     * a glyph should not share with the words (an underline).
     */
    iconTextClassName: string;
    /** Added while disabled. */
    disabled: string;
    /**
     * Added by variant: the three emphases every theme draws, and any role a
     * form names (`ActionVariant`). A name not here draws as `secondary`,
     * with a warning in development.
     */
    variants: Record<"primary" | "secondary" | "link", ActionVariantClasses> &
      Record<string, ActionVariantClasses>;
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
    /** A tab's text. */
    tabText: string;
    /** Added to the active tab's text. */
    activeText: string;
    /** The marker on a tab whose panel has an error. */
    invalidMarker: string;
    /** Around each panel. */
    panel: string;
  };
  /** The wizard. */
  wizard: {
    /** The step row. */
    steps: string;
    /** One step. */
    step: string;
    /** Added to the current step. */
    active: string;
    /** A step's text. */
    stepText: string;
    /** Around each page. */
    page: string;
    /** The Back / Next row. */
    nav: string;
  };
  /** The dialog. */
  dialog: {
    /** Behind the surface. */
    backdrop: string;
    /** The surface. */
    surface: string;
    /** In design mode, drawn in place. */
    inline: string;
    /** The heading. */
    title: string;
    /** The button row. */
    actions: string;
  };
  /** The disclosure. */
  disclosure: {
    /** The outer element. */
    className: string;
    /** The toggle. */
    toggle: string;
    /** The toggle's text. */
    title: string;
    /** What the toggle shows beside its text; turned while open. */
    icon: ReactNode;
    /**
     * Which side of the title `icon` sits: `before`, or `after` for a
     * chevron at the title's end. The invalid marker stays last.
     */
    iconPlacement: "before" | "after";
    /** The marker on a toggle whose content has an error. */
    invalidMarker: string;
    /** Around the content. */
    content: string;
  };
  /** The chrome-less collection. */
  elements: {
    /** Around the rows. */
    className: string;
  };
}

/**
 * The default: a plain NativeWind look in Tailwind's palette, for an app with
 * no theme of its own.
 *
 * @group Theming
 */
export const defaultNativeTheme: NativeTheme = {
  shellFor: {},
  shell: {
    className: "gap-1",
    label: "shrink text-sm font-semibold text-gray-700",
    required: "text-red-600",
    help: "text-xs text-gray-500",
    error: "text-sm text-red-600",
    count: "text-xs text-gray-500",
    countOver: "text-xs text-red-600",
    requiredNote: "Required",
    afterRow: "flex-row items-center gap-2",
    labelRow: "shrink flex-row items-center gap-1",
    horizontal: "flex-row items-center justify-between gap-2",
    helpButton: { className: "px-1", icon: "ⓘ", text: "Help" },
  },
  frame: {
    className: "flex-row items-center gap-2 rounded-md border border-gray-300 bg-white px-3",
    focused: "border-blue-600",
    invalid: "border-red-500",
    disabled: "bg-gray-100 opacity-75",
    input: "flex-1 py-2 text-base text-gray-900",
  },
  checkbox: {
    control: "box",
    box: "h-5 w-5 items-center justify-center rounded border border-gray-400 bg-white",
    checked: "border-blue-600 bg-blue-600",
    mark: "text-xs font-bold text-white",
    markIcon: "✓",
  },
  radio: {
    className: "gap-2",
    entry: "gap-1",
    option: "flex-row items-center gap-2 py-1",
    ring: "h-5 w-5 items-center justify-center rounded-full border border-gray-400 bg-white",
    ringSelected: "border-blue-600",
    dot: "h-2.5 w-2.5 rounded-full bg-blue-600",
    label: "text-base text-gray-800",
  },
  checkList: {
    className: "gap-2",
    option: "flex-row items-center gap-2 py-1",
    label: "text-base text-gray-800",
  },
  select: {
    value: "flex-1 py-2 text-base text-gray-900",
    placeholder: "flex-1 py-2 text-base text-gray-400",
    emptyText: "—",
    backdrop: "flex-1 justify-end bg-black/40",
    sheet: "max-h-[70%] rounded-t-xl bg-white pb-6",
    option: "border-b border-gray-100 px-4 py-3",
    optionSelected: "bg-blue-50",
    optionText: "text-base text-gray-900",
  },
  displayOnly: {
    className: "flex-row items-center gap-1.5 py-1.5 text-base text-gray-900",
    inline: "font-semibold",
    icon: "items-center",
  },
  contents: {
    wrapper: "",
    title: "mb-2 text-base font-bold text-gray-900",
    body: "gap-4",
    variants: {},
  },
  inline: { wrapper: "flex-row flex-wrap items-baseline gap-1", variants: {} },
  text: {
    className: "text-base text-gray-800",
    heading: {
      className: "font-bold text-gray-900",
      levels: {
        1: "text-3xl",
        2: "text-xl",
        3: "text-lg",
        4: "text-base",
        5: "text-base",
        6: "text-base",
      },
    },
    tones: {
      error: "text-red-600",
      warning: "text-amber-600",
      info: "text-blue-700",
      success: "text-green-700",
    },
    variants: {},
  },
  icon: { className: "text-xl", variants: {} },
  image: { className: "", variants: {} },
  richText: {
    strong: "font-bold",
    em: "italic",
    sup: "",
    sub: "",
    link: "text-blue-600 underline",
    image: "",
  },
  html: { className: "text-base text-gray-800" },
  action: {
    className: "flex-row items-center justify-center gap-2 rounded-md px-4 py-2",
    textClassName: "shrink text-sm font-medium",
    iconClassName: "items-center",
    iconTextClassName: "no-underline",
    disabled: "opacity-50",
    variants: {
      primary: { className: "bg-blue-600", textClassName: "text-white" },
      secondary: { className: "border border-gray-300 bg-white", textClassName: "text-gray-800" },
      link: { className: "px-0 py-0", textClassName: "text-blue-600 underline" },
    },
  },
  tabs: {
    className: "gap-2",
    list: "flex-row border-b border-gray-200",
    tab: "flex-row items-center gap-1 border-b-2 px-4 py-3",
    active: "border-blue-600",
    inactive: "border-transparent",
    tabText: "text-sm font-medium text-gray-500",
    activeText: "text-blue-600",
    invalidMarker: "text-[9px] text-red-600",
    panel: "pt-2",
  },
  wizard: {
    steps: "mb-4 flex-row flex-wrap gap-2",
    step: "rounded-full border border-gray-300 px-3 py-1",
    active: "border-blue-600 bg-blue-50",
    stepText: "text-sm text-gray-700",
    page: "",
    nav: "mt-3 flex-row gap-2",
  },
  dialog: {
    backdrop: "flex-1 items-center justify-center bg-black/40 p-6",
    surface: "w-full gap-3 rounded-xl bg-white p-5",
    inline: "gap-3 rounded-md border border-gray-200 p-4",
    title: "text-lg font-semibold text-gray-900",
    actions: "flex-row justify-end gap-2",
  },
  disclosure: {
    className: "",
    toggle: "flex-row items-center gap-2 py-2",
    title: "text-base font-medium text-gray-700",
    icon: "▸",
    iconPlacement: "before",
    invalidMarker: "text-[9px] text-red-600",
    content: "pt-2",
  },
  elements: { className: "gap-2" },
};

/**
 * Every property optional, recursively — except nodes and other leaves,
 * which are replaced whole.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string | number | boolean | null | undefined | ReactElement
    ? T[K]
    : DeepPartial<T[K]>;
};

/**
 * A theme as a host supplies it: any slots, merged over the enclosing theme.
 * A node slot (an icon) is replaced whole.
 *
 * @group Theming
 */
export type PartialNativeTheme = DeepPartial<NativeTheme>;

/** `over` onto `base`; a key `base` lacks (a `shellFor` widget) starts empty. */
function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over))
    out[k] =
      v && typeof v === "object" && !isValidElement(v)
        ? merge((base as Record<string, unknown> | undefined)?.[k], v as never)
        : v;
  return out as T;
}

const ThemeContext = createContext<NativeTheme>(defaultNativeTheme);

/**
 * Supply a theme to everything below: slots merged over the enclosing one.
 *
 * @group Theming
 */
export function NativeThemeProvider({
  theme,
  children,
}: {
  theme: PartialNativeTheme;
  children: ReactNode;
}) {
  const parent = useContext(ThemeContext);
  const value = useMemo(() => merge(parent, theme), [parent, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * The theme in force.
 *
 * @group Theming
 */
export function useNativeTheme(): NativeTheme {
  return useContext(ThemeContext);
}
