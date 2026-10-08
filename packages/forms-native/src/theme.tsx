import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ActionVariant } from "@rx-controls/forms-react";

/**
 * Every class the React Native implementation puts on an element, one slot
 * per element — NativeWind classes, which an app's Tailwind build turns into
 * styles. `forms-native`'s API, not the contract's.
 *
 * Only classes NativeWind carries to native belong here: no pseudo-elements,
 * no descendant selectors. State the element itself has no variant for —
 * a frame focused, invalid or disabled — is a slot of its own, applied by
 * the implementation, so it never depends on a variant a platform lacks.
 *
 * The app's Tailwind `content` must include this package's built files
 * (`node_modules/@rx-controls/forms-native/lib/**\/*.js`), or none of these
 * classes are compiled.
 *
 * @group Theming
 */
export interface NativeTheme {
  /** The field shell. */
  shell: {
    /** The outer element: label, control, help, error. */
    className: string;
    /** The label. */
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
  };
  /** The input frame: the box around a text input. */
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
  /** The standard group. */
  contents: {
    /** The wrapper around title and body. */
    className: string;
    /** The title, a heading. */
    title: string;
    /** The body the children sit in. */
    body: string;
  };
  /** An inline group: prose. */
  inline: {
    /** Its element. */
    className: string;
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
  };
  /** Buttons. */
  action: {
    /** Every button. */
    className: string;
    /** Every button's text. */
    textClassName: string;
    /** Added while disabled. */
    disabled: string;
    /** Added by variant. */
    variants: Record<ActionVariant, { className: string; textClassName: string }>;
  };
}

/**
 * The default: a plain NativeWind look in Tailwind's palette, for an app with
 * no theme of its own.
 *
 * @group Theming
 */
export const defaultNativeTheme: NativeTheme = {
  shell: {
    className: "gap-1",
    label: "text-sm font-semibold text-gray-700",
    required: "text-red-600",
    help: "text-xs text-gray-500",
    error: "text-sm text-red-600",
    count: "text-xs text-gray-500",
    countOver: "text-xs text-red-600",
  },
  frame: {
    className: "flex-row items-center gap-2 rounded-md border border-gray-300 bg-white px-3",
    focused: "border-blue-600",
    invalid: "border-red-500",
    disabled: "bg-gray-100 opacity-75",
    input: "flex-1 py-2 text-base text-gray-900",
  },
  contents: {
    className: "",
    title: "mb-2 text-base font-bold text-gray-900",
    body: "gap-4",
  },
  inline: { className: "flex-row flex-wrap items-baseline gap-1" },
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
  },
  action: {
    className: "flex-row items-center justify-center gap-2 rounded-md px-4 py-2",
    textClassName: "text-sm font-medium",
    disabled: "opacity-50",
    variants: {
      primary: { className: "bg-blue-600", textClassName: "text-white" },
      secondary: { className: "border border-gray-300 bg-white", textClassName: "text-gray-800" },
      link: { className: "px-0", textClassName: "text-blue-600 underline" },
    },
  },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? T[K] : DeepPartial<T[K]> };

/**
 * A theme as a host supplies it: any slots, merged over the enclosing theme.
 *
 * @group Theming
 */
export type PartialNativeTheme = DeepPartial<NativeTheme>;

function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over))
    out[k] =
      v && typeof v === "object"
        ? merge((base as Record<string, unknown>)[k], v as never)
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
