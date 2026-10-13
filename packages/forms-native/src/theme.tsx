import {
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Tone } from "@rx-controls/forms-react";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import type { NativeLook } from "./looks.js";

/**
 * Every style the React Native implementation puts on an element, one slot
 * per element — React Native `style` objects, a {@link ViewStyle} for a
 * container and a {@link TextStyle} for words. `forms-native`'s API, not the
 * contract's.
 *
 * State an element has no variant for — a frame focused, a box checked, a tab
 * active — is a slot of its own, applied by the implementation after the base
 * slot, so a later one wins.
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
    style: ViewStyle;
    /**
     * The label. In a row (a checkbox's, `labelEnd` help's) it sits beside
     * other items, and React Native's flex items do not shrink unless told:
     * keep `shrink` here, or a long label pushes the control off the screen.
     */
    label: TextStyle;
    /** The required marker, inside the label. */
    required: TextStyle;
    /** Help text. */
    help: TextStyle;
    /** The error. */
    error: TextStyle;
    /** A character count within its limit. */
    count: TextStyle;
    /** The count past its limit, in place of `count`. */
    countOver: TextStyle;
    /**
     * What a group that cannot carry `aria-required` (a check list) is
     * described with first. Words, for assistive technology.
     */
    requiredNote: string;
    /** A trailing label beside its control (a checkbox's): the row. */
    afterRow: ViewStyle;
    /**
     * `labelEnd` help: the label and its button side by side. In a
     * `horizontal` row, beside the control, so it shrinks as `label` does.
     */
    labelRow: ViewStyle;
    /**
     * A label beside its control (`orientation: "horizontal"` — a checkbox
     * with `labelPosition: "before"`): the row, the control at its end.
     */
    horizontal: ViewStyle;
    /** The button that shows `labelEnd` help. */
    helpButton: {
      /** Its element. */
      style: ViewStyle;
      /** What it shows. */
      icon: ReactNode;
      /** Its accessible name — words. */
      text: string;
    };
  };
  /** The input frame: the box around a text input or a select's trigger. */
  frame: {
    /** Always. */
    style: ViewStyle;
    /** Added while the control has focus. */
    focused: ViewStyle;
    /** Added while the field is invalid. */
    invalid: ViewStyle;
    /** Added while the field is disabled. */
    disabled: ViewStyle;
    /** The `TextInput` inside. */
    input: TextStyle;
  };
  /** The checkbox. */
  checkbox: {
    /**
     * `box`: a square that shows a tick. `switch`: React Native's own
     * `Switch`, for a form whose checkboxes are on/off settings.
     */
    control: "box" | "switch";
    /**
     * The `Switch`'s colours, as colour values: they are its props, not
     * styles, so no style reaches them. One left out is the platform's own.
     * `trackOff` is also iOS's background while off.
     */
    switchColors?: {
      /** The track while on. */
      trackOn?: string;
      /** The track while off. */
      trackOff?: string;
      /** The thumb while on. */
      thumbOn?: string;
      /** The thumb while off. */
      thumbOff?: string;
    };
    /** The box. */
    box: ViewStyle;
    /** Added while checked. */
    checked: ViewStyle;
    /** The tick inside a checked box. */
    mark: TextStyle;
    /** What the tick shows. */
    markIcon: ReactNode;
  };
  /** The radio group. */
  radio: {
    /** The group. */
    style: ViewStyle;
    /** Around each option and its per-option content. */
    entry: ViewStyle;
    /** One option: the ring and its text. */
    option: ViewStyle;
    /** The ring. */
    ring: ViewStyle;
    /** Added to the ring while selected. */
    ringSelected: ViewStyle;
    /** The dot inside a selected ring. */
    dot: ViewStyle;
    /** The option's text. */
    label: TextStyle;
  };
  /** A set of checkboxes. */
  checkList: {
    /** The group. */
    style: ViewStyle;
    /** One option: the box and its text. */
    option: ViewStyle;
    /** The option's text. */
    label: TextStyle;
  };
  /** The select: a trigger in the input frame, its options in a sheet. */
  select: {
    /** The trigger's text: the chosen option's name. */
    value: TextStyle;
    /** The trigger's text with nothing chosen. */
    placeholder: TextStyle;
    /** The empty choice's words. */
    emptyText: string;
    /** The sheet's backdrop. */
    backdrop: ViewStyle;
    /** The sheet. */
    sheet: ViewStyle;
    /** One option in it. */
    option: ViewStyle;
    /** Added to the chosen option. */
    optionSelected: ViewStyle;
    /** An option's text. */
    optionText: TextStyle;
  };
  /** The display-only field. */
  displayOnly: {
    /** As a block. */
    style: ViewStyle;
    /** The value's words. */
    text: TextStyle;
    /** Inside an inline group. */
    inline: TextStyle;
    /** Around a `startIcon` / `endIcon`. */
    icon: ViewStyle;
  };
  /** The standard group. */
  contents: {
    /** The wrapper around title and body. */
    wrapper: ViewStyle;
    /** The title, a heading. */
    title: TextStyle;
    /** The body the children sit in. */
    body: ViewStyle;
  };
  /** An inline group: prose. */
  inline: {
    /** Its element. */
    wrapper: ViewStyle;
  };
  /** The text display. */
  text: {
    /** As a block. */
    style: TextStyle;
    /**
     * Drawn as a heading: `style` on every one, and the level's style
     * beside it — the level the form's outline gives the place.
     */
    heading: {
      /** On every heading. */
      style: TextStyle;
      /** Beside it, by the heading's level. */
      levels: Record<1 | 2 | 3 | 4 | 5 | 6, TextStyle>;
    };
    /** By tone, on any display's text. */
    tones: Record<Tone, TextStyle>;
  };
  /** The icon display. */
  icon: {
    /** Its element, and a glyph given as a string. */
    style: TextStyle;
  };
  /** Rich text (`RichText`): nested `Text`, inheriting what it sits in. */
  richText: {
    /** `b` / `strong`. */
    strong: TextStyle;
    /** `i` / `em`. */
    em: TextStyle;
    /**
     * `sup`. Digits and signs are drawn as Unicode superscripts, raised in
     * every font; anything else just takes this style — native text has no
     * baseline shift.
     */
    sup: TextStyle;
    /** `sub`. */
    sub: TextStyle;
    /** `a`. */
    link: TextStyle;
    /** `img`. */
    image: ImageStyle;
  };
  /** The image display. */
  image: {
    /** The `Image`. */
    style: ImageStyle;
  };
  /** The html display: its markup's text. */
  html: {
    /** Its element. */
    style: TextStyle;
  };
  /** Buttons. */
  action: {
    /** Every button. */
    style: ViewStyle;
    /**
     * Every button's text. React Native's flex items do not shrink unless
     * told, so keep `shrink` here: a long label beside an icon otherwise
     * pushes the icon out of the button.
     */
    textStyle: TextStyle;
    /** Around its icon, or the spinner in its place. */
    iconStyle: ViewStyle;
    /**
     * Added over the text's styles on an icon given as a string, which is
     * drawn in the button's text look so it takes the button's colour: what
     * a glyph should not share with the words (an underline).
     */
    iconTextStyle: TextStyle;
    /** Added while disabled. */
    disabled: ViewStyle;
  };
  /** The tab strip. */
  tabs: {
    /** The outer element. */
    style: ViewStyle;
    /** The row of tabs. */
    list: ViewStyle;
    /** One tab. */
    tab: ViewStyle;
    /** Added to the active tab. */
    active: ViewStyle;
    /** Added to every other tab. */
    inactive: ViewStyle;
    /** A tab's text. */
    tabText: TextStyle;
    /** Added to the active tab's text. */
    activeText: TextStyle;
    /** The marker on a tab whose panel has an error. */
    invalidMarker: TextStyle;
    /** Around each panel. */
    panel: ViewStyle;
  };
  /** The wizard. */
  wizard: {
    /** The step row. */
    steps: ViewStyle;
    /** One step. */
    step: ViewStyle;
    /** Added to the current step. */
    active: ViewStyle;
    /** A step's text. */
    stepText: TextStyle;
    /** Around each page. */
    page: ViewStyle;
    /** The Back / Next row. */
    nav: ViewStyle;
  };
  /** The dialog. */
  dialog: {
    /** Behind the surface. */
    backdrop: ViewStyle;
    /** The surface. */
    surface: ViewStyle;
    /** In design mode, drawn in place. */
    inline: ViewStyle;
    /** The heading. */
    title: TextStyle;
    /** The button row. */
    actions: ViewStyle;
  };
  /** The disclosure. */
  disclosure: {
    /** The outer element. */
    style: ViewStyle;
    /** The toggle. */
    toggle: ViewStyle;
    /** The toggle's text. */
    title: TextStyle;
    /** What the toggle shows beside its text; turned while open. */
    icon: ReactNode;
    /**
     * Which side of the title `icon` sits: `before`, or `after` for a
     * chevron at the title's end. The invalid marker stays last.
     */
    iconPlacement: "before" | "after";
    /** The marker on a toggle whose content has an error. */
    invalidMarker: TextStyle;
    /** Around the content. */
    content: ViewStyle;
  };
  /**
   * Named looks (`look="card"` on a boundary): for each, what it gives the
   * parts of the boundary it styles — React Native styles, as values or as
   * functions of the element's state; see {@link NativeLook}. A look is
   * layered over the slots above (the later in the element's `style` array
   * wins) unless a part says `{ replace }`. Looks the form brings in
   * `useFormLooks()` are class-valued and are not drawn on native: name each
   * one here too.
   *
   * A name not here draws the base look, with a warning in development.
   *
   * The three emphases every theme draws for an action — `primary`,
   * `secondary`, `link` — are looks, and `secondary` is the fallback for an
   * action's unknown name.
   */
  looks: Record<"primary" | "secondary" | "link", NativeLook> & Record<string, NativeLook>;
  /**
   * What a look's `$name` refers to: `colors` maps a token (`accent`) to a
   * colour value. `$accent/10` is that colour at 10%, for a `#rgb` / `#rrggbb`
   * token.
   */
  tokens: { colors: Record<string, string> };
  /** The chrome-less collection. */
  elements: {
    /** Around the rows. */
    style: ViewStyle;
  };
}


const gray = {
  900: "#111827",
  800: "#1f2937",
  700: "#374151",
  500: "#6b7280",
  400: "#9ca3af",
  300: "#d1d5db",
  200: "#e5e7eb",
  100: "#f3f4f6",
};
const blue600 = "#2563eb";
const red600 = "#dc2626";
const white = "#fff";
const scrim = "rgba(0, 0, 0, 0.4)";
/** Tailwind's type scale: size and line height. */
const xs = { fontSize: 12, lineHeight: 16 } as const;
const sm = { fontSize: 14, lineHeight: 20 } as const;
const base = { fontSize: 16, lineHeight: 24 } as const;
const row = { flexDirection: "row", alignItems: "center" } as const;

/**
 * The default: a plain look in Tailwind's palette, as React Native styles,
 * for an app with no theme of its own.
 *
 * @group Theming
 */
export const defaultNativeTheme: NativeTheme = {
  shellFor: {},
  shell: {
    style: { gap: 4 },
    label: { flexShrink: 1, ...sm, fontWeight: "600", color: gray[700] },
    required: { color: red600 },
    help: { ...xs, color: gray[500] },
    error: { ...sm, color: red600 },
    count: { ...xs, color: gray[500] },
    countOver: { ...xs, color: red600 },
    requiredNote: "Required",
    afterRow: { ...row, gap: 8 },
    labelRow: { flexShrink: 1, ...row, gap: 4 },
    horizontal: { ...row, justifyContent: "space-between", gap: 8 },
    helpButton: { style: { paddingHorizontal: 4 }, icon: "ⓘ", text: "Help" },
  },
  frame: {
    style: {
      ...row,
      gap: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: gray[300],
      backgroundColor: white,
      paddingHorizontal: 12,
    },
    focused: { borderColor: blue600 },
    invalid: { borderColor: "#ef4444" },
    disabled: { backgroundColor: gray[100], opacity: 0.75 },
    input: { flex: 1, paddingVertical: 8, ...base, color: gray[900] },
  },
  checkbox: {
    control: "box",
    box: {
      height: 20,
      width: 20,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 4,
      borderWidth: 1,
      borderColor: gray[400],
      backgroundColor: white,
    },
    checked: { borderColor: blue600, backgroundColor: blue600 },
    mark: { ...xs, fontWeight: "700", color: white },
    markIcon: "✓",
  },
  radio: {
    style: { gap: 8 },
    entry: { gap: 4 },
    option: { ...row, gap: 8, paddingVertical: 4 },
    ring: {
      height: 20,
      width: 20,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: gray[400],
      backgroundColor: white,
    },
    ringSelected: { borderColor: blue600 },
    dot: { height: 10, width: 10, borderRadius: 9999, backgroundColor: blue600 },
    label: { ...base, color: gray[800] },
  },
  checkList: {
    style: { gap: 8 },
    option: { ...row, gap: 8, paddingVertical: 4 },
    label: { ...base, color: gray[800] },
  },
  select: {
    value: { flex: 1, paddingVertical: 8, ...base, color: gray[900] },
    placeholder: { flex: 1, paddingVertical: 8, ...base, color: gray[400] },
    emptyText: "—",
    backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: scrim },
    sheet: {
      maxHeight: "70%",
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      backgroundColor: white,
      paddingBottom: 24,
    },
    option: {
      borderBottomWidth: 1,
      borderBottomColor: gray[100],
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    optionSelected: { backgroundColor: "#eff6ff" },
    optionText: { ...base, color: gray[900] },
  },
  displayOnly: {
    style: { ...row, gap: 6, paddingVertical: 6 },
    text: { ...base, color: gray[900] },
    inline: { fontWeight: "600" },
    icon: { alignItems: "center" },
  },
  contents: {
    wrapper: {},
    title: { marginBottom: 8, ...base, fontWeight: "700", color: gray[900] },
    body: { gap: 16 },
  },
  inline: { wrapper: { ...row, flexWrap: "wrap", alignItems: "baseline", gap: 4 } },
  text: {
    style: { ...base, color: gray[800] },
    heading: {
      style: { fontWeight: "700", color: gray[900] },
      levels: {
        1: { fontSize: 30, lineHeight: 36 },
        2: { fontSize: 20, lineHeight: 28 },
        3: { fontSize: 18, lineHeight: 28 },
        4: base,
        5: base,
        6: base,
      },
    },
    tones: {
      error: { color: red600 },
      warning: { color: "#d97706" },
      info: { color: "#1d4ed8" },
      success: { color: "#15803d" },
    },
  },
  icon: { style: { fontSize: 20, lineHeight: 28 } },
  image: { style: {} },
  richText: {
    strong: { fontWeight: "700" },
    em: { fontStyle: "italic" },
    sup: {},
    sub: {},
    link: { color: blue600, textDecorationLine: "underline" },
    image: {},
  },
  html: { style: { ...base, color: gray[800] } },
  action: {
    style: {
      ...row,
      justifyContent: "center",
      gap: 8,
      borderRadius: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    textStyle: { flexShrink: 1, ...sm, fontWeight: "500" },
    iconStyle: { alignItems: "center" },
    iconTextStyle: { textDecorationLine: "none" },
    disabled: { opacity: 0.5 },
  },
  tabs: {
    style: { gap: 8 },
    list: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: gray[200] },
    tab: { ...row, gap: 4, borderBottomWidth: 2, paddingHorizontal: 16, paddingVertical: 12 },
    active: { borderBottomColor: blue600 },
    inactive: { borderBottomColor: "transparent" },
    tabText: { ...sm, fontWeight: "500", color: gray[500] },
    activeText: { color: blue600 },
    invalidMarker: { fontSize: 9, color: red600 },
    panel: { paddingTop: 8 },
  },
  wizard: {
    steps: { marginBottom: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 },
    step: {
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: gray[300],
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    active: { borderColor: blue600, backgroundColor: "#eff6ff" },
    stepText: { ...sm, color: gray[700] },
    page: {},
    nav: { marginTop: 12, flexDirection: "row", gap: 8 },
  },
  dialog: {
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: scrim,
      padding: 24,
    },
    surface: { width: "100%", gap: 12, borderRadius: 12, backgroundColor: white, padding: 20 },
    inline: { gap: 12, borderRadius: 6, borderWidth: 1, borderColor: gray[200], padding: 16 },
    title: { fontSize: 18, lineHeight: 28, fontWeight: "600", color: gray[900] },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  },
  disclosure: {
    style: {},
    toggle: { ...row, gap: 8, paddingVertical: 8 },
    title: { ...base, fontWeight: "500", color: gray[700] },
    icon: "▸",
    iconPlacement: "before",
    invalidMarker: { fontSize: 9, color: red600 },
    content: { paddingTop: 8 },
  },
  looks: {
    primary: { control: { backgroundColor: blue600 }, text: { color: white } },
    secondary: {
      control: { borderWidth: 1, borderColor: gray[300], backgroundColor: white },
      text: { color: gray[800] },
    },
    link: {
      control: { paddingHorizontal: 0, paddingVertical: 0 },
      text: { color: blue600, textDecorationLine: "underline" },
    },
  },
  tokens: { colors: {} },
  elements: { style: { gap: 8 } },
};

/** A node, a string, or anything else the merge replaces whole. */
function isPlain(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v) && !isValidElement(v);
}

/**
 * A slot group, as against a style: a group holds slots (objects), a style
 * holds values. A style given over one is replaced whole, so a theme can
 * drop a property of the enclosing theme's by leaving it out.
 */
function isGroup(v: unknown): v is Record<string, unknown> {
  return isPlain(v) && Object.values(v).some(isPlain);
}

/**
 * Every property optional, recursively — except styles, nodes and other
 * leaves, which are replaced whole.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends
    | string
    | number
    | boolean
    | null
    | undefined
    | ReactElement
    | ViewStyle
    | TextStyle
    | ImageStyle
    ? T[K]
    : DeepPartial<T[K]>;
};

/**
 * A theme as a host supplies it: any slots, merged over the enclosing theme.
 * A style or a node slot (an icon) is replaced whole.
 *
 * @group Theming
 */
export type PartialNativeTheme = Omit<DeepPartial<NativeTheme>, "looks" | "tokens"> & {
  looks?: Record<string, NativeLook>;
  tokens?: { colors?: Record<string, string> };
};

/** `over` onto `base`: groups merge, anything else replaces. */
function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    const b = (base as Record<string, unknown> | undefined)?.[k];
    out[k] = isGroup(v) && isGroup(b) ? merge(b, v as never) : v;
  }
  return out as T;
}

/** The theme with `over` laid on it: slots merged, looks and tokens by name. */
function mergeTheme(base: NativeTheme, over: PartialNativeTheme): NativeTheme {
  const { looks, tokens, shellFor, ...slots } = over;
  const out = merge(base, slots as DeepPartial<NativeTheme>);
  if (shellFor) {
    const merged = { ...base.shellFor };
    for (const [w, s] of Object.entries(shellFor)) {
      const was = merged[w] as Record<string, unknown> | undefined;
      merged[w] = { ...was, ...s, helpButton: { ...(was?.helpButton as object), ...s?.helpButton } } as never;
    }
    out.shellFor = merged;
  }
  if (looks) out.looks = { ...base.looks, ...looks };
  if (tokens?.colors) out.tokens = { colors: { ...base.tokens.colors, ...tokens.colors } };
  return out;
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
  const value = useMemo(() => mergeTheme(parent, theme), [parent, theme]);
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
