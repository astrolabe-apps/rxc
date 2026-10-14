import type { PartialNativeTheme } from "../../src/index";

/**
 * ServiceTas's React Native renderer options, restated as a `NativeTheme`.
 *
 * Source: `servicetas-rn/components/formRenderers.tsx` `defaultRNRenderOptions`,
 * which is `deepMerge(serviceTasOptions, defaultRnTailwindTheme)`
 * (`@react-typed-forms/schemas-rn`) — ServiceTas wins and the schemas-rn theme
 * fills the rest — plus `servicetas-rn/global.css` (the typography classes
 * `body`, `headline`, `title1` … and `.form-control`) and
 * `client-common/tailwindColours.ts`. Every slot says which class it came from.
 * A slot is here only where ServiceTas styles it; the rest is the default
 * theme's. It is the native counterpart of `forms-html`'s `serviceTasTheme`
 * fixture: html restates the web options, this the device's.
 *
 * Legacy's classes were NativeWind's; here they are the styles those classes
 * compile to, with the colours tokens where a look can say them. One choice is
 * ours, not the source's, and is marked: the focus colour. An input's size is
 * schemas-rn's `RNTextInput` (`native:min-h-[54px] px-3 native:py-[6px] text-lg
 * native:leading-[1.25]`) under `.form-control`'s border.
 *
 * Fonts are Nunito, by the names `@expo-google-fonts/nunito` registers
 * (`Nunito_400Regular` …); a host that has not loaded them draws the system
 * font, which is the only difference.
 */

/** `client-common/tailwindColours.ts` (the ones forms use). */
export const serviceTasColors: Record<string, string> = {
  accent: "#267151",
  text: "#343534",
  border: "#E7E7E8",
  danger: "#A30000",
  "danger-800": "#991b1b",
  primary: "#098851",
  "primary-200": "#b9e1cb",
  "primary-500": "#37926a",
  "primary-600": "#256f50",
  grey: "#C4C4C4",
  lightGrey: "#F5F5F5",
  lightGreen: "#E6F3EE",
  darkGrey: "#404041",
  "surface-100": "#f3f4f6",
  "surface-200": "#e5e7eb",
  "gray-200": "#e5e7eb",
  "red-500": "#ef4444",
};

const F = {
  regular: "Nunito_400Regular",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
} as const;

/**
 * `global.css` `@layer utilities`: each is text-[size] leading-[line] tracking-[…] text-text font-…
 * The weight is in the family (`Nunito_700Bold`), so `fontWeight` is `400`: a
 * theme merges over the default's, whose weights would otherwise synthesise a second bold.
 */
const type = {
  title1: { fontSize: 28, lineHeight: 34, letterSpacing: 0.38, fontFamily: F.extrabold, fontWeight: "400" },
  title2: { fontSize: 22, lineHeight: 28, letterSpacing: -0.26, fontFamily: F.extrabold, fontWeight: "400" },
  title3: { fontSize: 20, lineHeight: 25, letterSpacing: -0.45, fontFamily: F.extrabold, fontWeight: "400" },
  headline: { fontSize: 17, lineHeight: 22, letterSpacing: -0.43, fontFamily: F.bold, fontWeight: "400" },
  body: { fontSize: 17, lineHeight: 22, letterSpacing: -0.43, fontFamily: F.regular, fontWeight: "400" },
  callout: { fontSize: 16, lineHeight: 21, letterSpacing: -0.31, fontFamily: F.semibold, fontWeight: "400" },
  subhead: { fontSize: 15, lineHeight: 20, letterSpacing: -0.23, fontFamily: F.semibold, fontWeight: "400" },
  footnote: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, fontFamily: F.regular, fontWeight: "400" },
  caption1: { fontSize: 12, lineHeight: 16, letterSpacing: 0, fontFamily: F.regular, fontWeight: "400" },
} as const;
const ink = serviceTasColors.text;
const withInk = <T extends object>(t: T) => ({ ...t, color: ink });

export const serviceTasNativeTheme: PartialNativeTheme = {
  tokens: { colors: serviceTasColors },
  shell: {
    // layout.className (ServiceTas): "flex flex-col gap-[16px]".
    style: { gap: 16 },
    // label.textClass "headline"; labelContainer: "flex flex-row gap-[4px] items-baseline flex-wrap shrink".
    label: { ...withInk(type.headline), flexShrink: 1 },
    // schemas-rn's required element had no marker class of its own; red, as the web fixture's.
    required: { color: "#ef4444" },
    // The help text is a popover component (`createRNHelpTextRenderer`), triggerLabelClass "caption1".
    help: withInk(type.footnote),
    // labelContainer "flex flex-row gap-[4px] items-baseline flex-wrap shrink": the trigger wraps
    // under a label too long to share its line.
    labelRow: { flexShrink: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 8, rowGap: 4 },
    // Its trigger: triggerContainerClass "flex flex-row gap-2 items-center p-[4px] rounded-full self-start",
    // a `surface-100` pill when it has words (`helpLabel`), the words "text-sm font-bold caption1".
    helpButton: {
      style: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 4,
        borderRadius: 9999,
        alignSelf: "flex-start",
      },
      // `label && "bg-surface-100"`: the grey pill is only for a trigger with words.
      labelled: { backgroundColor: serviceTasColors["surface-100"] },
      text: "Help",
      label: { ...withInk(type.caption1), fontSize: 14, fontFamily: F.bold },
    },
    error: { ...type.footnote, color: serviceTasColors.danger, fontFamily: F.bold },
  },
  frame: {
    // data.inputClass "form-control" (global.css): border bg-white disabled:bg-neutral-50
    // border-[#E7E7E8] text-text rounded-none, over schemas-rn's RNTextInput size.
    style: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: serviceTasColors.border,
      borderRadius: 0,
      backgroundColor: "#ffffff",
      minHeight: 54,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    // The focus colour is ours too: the class names none.
    focused: { borderColor: serviceTasColors.accent },
    invalid: { borderColor: serviceTasColors.danger },
    disabled: { backgroundColor: "#fafafa" },
    input: { ...withInk(type.body), fontSize: 18, lineHeight: 22.5, flex: 1, padding: 0 },
  },
  // schemas-rn's RNDateTimePicker: the read-only input, then a square `bg-[#F5F5F5] size-[54px]
  // border border-[#E7E7E8]` button with a calendar. (The picker is the host's.)
  date: {
    row: { flexDirection: "row", alignItems: "stretch" },
    button: {
      width: 54,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: serviceTasColors.border,
      backgroundColor: serviceTasColors.lightGrey,
    },
  },
  checkbox: {
    // schemas-rn's RNCheckbox: "native:h-[24px] native:w-[24px] native:rounded border border-accent", a
    // tick of `text-accent text-[18px]` on no fill.
    // (a style given replaces the base's whole, so each restates what it keeps)
    box: {
      height: 24,
      width: 24,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 4,
      borderWidth: 1,
      borderColor: serviceTasColors.accent,
      backgroundColor: "transparent",
    },
    checked: { borderColor: serviceTasColors.accent, backgroundColor: "transparent" },
    mark: { fontSize: 18, fontWeight: "400", color: serviceTasColors.accent },
  },
  radio: {
    // data.radioOptions: className "flex items-start gap-[24px]".
    style: { alignItems: "flex-start", gap: 24 },
    // entryWrapperClass "w-full"; entryClass "flex flex-row items-center gap-[8px] p-[16px]
    // border border-[#E7E7E8] w-full rounded-xl".
    entry: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 16,
      borderWidth: 1,
      borderColor: serviceTasColors.border,
      borderRadius: 12,
    },
    // labelClass "body shrink".
    // labelClass "body shrink" reaches the option's container in schemas-rn, not its text, which
    // draws at React Native's default size in the system font.
    label: { fontSize: 16, lineHeight: 20, color: serviceTasColors.text, flexShrink: 1 },
    // The option row has no padding of its own (the entry's `p-[16px]` is all); the ring is
    // schemas-rn's RNRadioItem: 20 round, `border border-primary`, a 10 dot `bg-primary`.
    option: { flexDirection: "row", alignItems: "center", gap: 8 },
    ring: {
      height: 20,
      width: 20,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: serviceTasColors.primary,
      backgroundColor: "transparent",
    },
    ringSelected: { borderColor: serviceTasColors.primary },
    dot: { height: 10, width: 10, borderRadius: 9999, backgroundColor: serviceTasColors.primary },
  },
  checkList: {
    // data.checkOptions (schemas-rn): entryClass "flex flex-row items-center gap-[8px]", labelClass "body shrink".
    option: { flexDirection: "row", alignItems: "center", gap: 8 },
    label: { ...withInk(type.body), flexShrink: 1 },
  },
  select: {
    value: withInk(type.body),
    placeholder: { ...type.body, color: "#9ca3af" },
    optionText: withInk(type.body),
  },
  // ScrollList (scrollListOptions: itemGap 16, contentContainerClassName "py-6 grow",
  // refreshControlTintColor #267151); schemas-rn's empty state is "headline" centred, its end
  // "subhead" in a py-[16px] row.
  feed: {
    gap: 16,
    content: { paddingVertical: 24, flexGrow: 1 },
    spinnerColor: serviceTasColors.accent,
    emptyText: withInk(type.headline),
    endText: withInk(type.subhead),
  },
  // The accordion (adornment.accordion: titleTextClass "subhead"): a chevron at the title's end, `togglerClass` "text-accent !text-[20px]"; the
  // card around it and the toggle row's layout come from the group's own look. Its icon is a
  // chevron down, then up when open, as the app's.
  disclosure: {
    toggle: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: withInk(type.subhead),
    // Chrome names: a host's icon set draws them as the app does (Font Awesome's chevrons).
    icon: { name: "chevron-down" },
    iconOpen: { name: "chevron-up" },
    iconStyle: { color: serviceTasColors.accent, fontSize: 20 },
    iconPlacement: "after",
  },
  // data.displayOnlyClass (schemas-rn): "flex flex-row items-center gap-2", no padding.
  displayOnly: { style: { flexDirection: "row", alignItems: "center", gap: 8 }, text: withInk(type.body) },
  contents: {
    // group titles are label text: the label's class plus the group's.
    title: { ...withInk(type.title3), marginBottom: 8 },
  },
  text: {
    // display.baseStyle defaultBodyStyle (constants/Styles.ts).
    style: withInk(type.body),
    heading: {
      style: withInk(type.title2),
      levels: {
        1: type.title1,
        2: type.title2,
        3: type.title3,
        4: type.headline,
        5: type.subhead,
        6: type.callout,
      },
    },
  },
  html: { style: withInk(type.body) },
  action: {
    // action.buttonClass / textClass: "" (ServiceTas blanks both; the emphases carry the look).
    // A theme merges over the default's, which cannot delete a key, so "blank" is stated: the
    // default button's row, centring, gap, radius and padding are reset to a bare view.
    style: {
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
      gap: 0,
      borderRadius: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    textStyle: { flexShrink: 1, ...withInk(type.body) },
    disabled: { opacity: 0.8 },
  },
  dialog: {
    // group.dialog.classes.containerClass "w-full px-[16px] max-h-[600px] min-h-[200px]".
    surface: { width: "100%", paddingHorizontal: 16, maxHeight: 600, minHeight: 200 },
    title: withInk(type.title3),
  },
  looks: {
    // action.primaryClass "flex flex-row items-center justify-center bg-accent min-h-[54px]
    // active:opacity-80 disabled:opacity-80 p-[4px] lg:px-[12px] lg:py-[5px] gap-[8px]",
    // primaryTextClass "headline !text-white text-center".
    primary: {
      control: (s) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 54,
        padding: 4,
        paddingHorizontal: s.width >= 1024 ? 12 : 4,
        paddingVertical: s.width >= 1024 ? 5 : 4,
        backgroundColor: "$accent",
        opacity: s.pressed || s.disabled ? 0.8 : 1,
      }),
      text: { ...type.headline, color: "#ffffff", textAlign: "center" },
    },
    // secondaryClass: bg-white border border-accent group active:bg-accent … ;
    // secondaryTextClass "headline !text-accent group-active:!text-white text-center".
    secondary: {
      control: (s) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 54,
        padding: 4,
        paddingHorizontal: s.width >= 1024 ? 12 : 4,
        paddingVertical: s.width >= 1024 ? 5 : 4,
        borderWidth: 1,
        borderColor: "$accent",
        backgroundColor: s.pressed ? "$accent" : "#ffffff",
        opacity: s.disabled ? 0.8 : 1,
      }),
      text: (s) => ({ ...type.headline, color: s.pressed ? "#ffffff" : "$accent", textAlign: "center" }),
    },
    // linkClass "disabled:opacity-80 active:opacity-80".
    link: {
      control: (s) => ({ opacity: s.pressed || s.disabled ? 0.8 : 1 }),
      text: { ...type.body, color: "$accent", textDecorationLine: "underline" },
    },
    // The typography classes, as looks (a form names them: `look="title1"`).
    ...Object.fromEntries(
      Object.entries(type).map(([name, t]) => [name, { control: { ...t, color: ink } }]),
    ),
  },
};
