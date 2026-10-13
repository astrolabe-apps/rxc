import type { Meta, StoryObj } from "@storybook/react-vite";
import { HtmlThemeProvider, type PartialHtmlTheme } from "@rx-controls/forms-html";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { MuiLooksProvider, type MuiLooks } from "@rx-controls/forms-mui";
import { PortableLooksDemo, portableLooks, portableTokens } from "rxc-forms-conformance/portable";
import type { ScopeArgs } from "../support";

/*
 * One look table written once as portable styles, and one form naming them.
 * The html implementation draws them as inline CSS; forms-native (here through
 * react-native-web) as React Native styles. Each reads the same table from
 * its own theme — the playground app draws the same source on a device. MUI
 * is given the same names mapped to its own mechanisms (below).
 */
const html = { tokens: { colors: portableTokens }, looks: portableLooks } as PartialHtmlTheme;
const native = { tokens: { colors: portableTokens }, looks: portableLooks } as PartialNativeTheme;

/*
 * MUI does not read portable styles: it names each look in its own terms —
 * `sx` on its own components, its Typography and Button props, its states
 * (`&.Mui-focused`, `&.Mui-error`). The same names, mapped by hand here, so the
 * form above draws under MUI too. (A responsive group is MUI's breakpoints in
 * `sx`, which a group look's plain style cannot express: left stacked.)
 */
const ink = portableTokens.ink;
const accent = portableTokens.accent;
const mui: MuiLooks = {
  group: {
    card: {
      wrapper: { background: portableTokens.paper, border: `1px solid ${ink}33`, borderRadius: 12, padding: 16 },
      title: { fontSize: 20, fontWeight: 700, color: ink, letterSpacing: 0.2 },
      body: { display: "flex", flexDirection: "column", gap: 12 },
    },
    start: { body: { display: "flex", flexDirection: "column", alignItems: "flex-start" } },
    row: {
      body: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" },
    },
    responsive: { body: { display: "flex", flexDirection: "column", gap: 12 } },
  },
  text: {
    tag: {
      sx: {
        background: `${accent}26`,
        color: accent,
        px: 1,
        py: 0.25,
        borderRadius: 0.75,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      },
    },
    lead: { sx: { fontSize: 18, lineHeight: "26px", color: ink } },
    note: { sx: { fontStyle: "italic", color: `${ink}99`, fontSize: 13 } },
    underlined: { sx: { textDecoration: "underline", color: accent, fontWeight: 600 } },
  },
  field: {
    field: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      control: {
        borderRadius: "8px",
        background: "#fff",
        "& fieldset": { borderWidth: 2, borderColor: `${ink}4d` },
        "&.Mui-focused fieldset": { borderColor: accent },
        "&.Mui-error fieldset": { borderColor: portableTokens.danger },
      },
      text: { fontSize: 16, color: ink },
    },
  },
  action: {
    button: {
      variant: "contained",
      sx: {
        borderRadius: 999,
        px: 2.5,
        py: 1.25,
        bgcolor: accent,
        textTransform: "none",
        fontWeight: 700,
        fontSize: 15,
        "&:hover": { bgcolor: `${accent}b3` },
      },
    },
  },
};

// Only html, native and MUI draw this story: they are the ones with a table
// above; the smoke test draws it under those three.
const meta: Meta<ScopeArgs> = {
  title: "Boundaries/Portable looks",
  parameters: { implementations: ["html", "native", "mui"] },
};
export default meta;
type Story = StoryObj<ScopeArgs>;

export const OneTableTwoRenderers: Story = {
  render: () => (
    <HtmlThemeProvider theme={html}>
      <NativeThemeProvider theme={native}>
        <MuiLooksProvider looks={mui}>
          <PortableLooksDemo />
        </MuiLooksProvider>
      </NativeThemeProvider>
    </HtmlThemeProvider>
  ),
};
