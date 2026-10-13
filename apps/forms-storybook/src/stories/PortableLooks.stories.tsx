import type { Meta, StoryObj } from "@storybook/react-vite";
import { HtmlThemeProvider, type PartialHtmlTheme } from "@rx-controls/forms-html";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { MuiLooksProvider, type MuiLooks } from "@rx-controls/forms-mui";
import { AntdLooksProvider, type AntdLooks } from "@rx-controls/forms-antd";
import { FluentLooksProvider, type FluentLooks } from "@rx-controls/forms-fluent";
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
 * form above draws under MUI too. A look that is a function of state gets the
 * same `LookState` here as under html and native, so the responsive group
 * below flips at 600 wide under every implementation.
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
    responsive: { body: (_t, st) => ({ display: "flex", flexDirection: st.width >= 600 ? "row" : "column", gap: 12 }) },
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
    choice: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      control: { gap: "6px" },
      text: { fontSize: 15, color: ink },
    },
    readout: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      control: { background: `${accent}26`, borderRadius: "6px", px: 1, py: 0.5 },
      text: { fontSize: 15, fontWeight: 600, color: accent },
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

/*
 * Ant and Fluent: the same names again, in Ant's tokens-and-style and Fluent's
 * plain styles. A field look's `control` is the widget's own element (the
 * text frame, the select, the option group, the value); `text` its words.
 */
const ant: AntdLooks = {
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
    responsive: { body: (_t, st) => ({ display: "flex", flexDirection: st.width >= 600 ? "row" : "column", gap: 12 }) },
  },
  text: {
    tag: {
      style: {
        background: `${accent}26`,
        color: accent,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      },
    },
    lead: { style: { fontSize: 18, lineHeight: "26px", color: ink } },
    note: { italic: true, style: { color: `${ink}99`, fontSize: 13 } },
    underlined: { underline: true, style: { color: accent, fontWeight: 600 } },
  },
  field: {
    field: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      control: { borderWidth: 2, borderRadius: 8, background: "#fff" },
      text: { fontSize: 16, color: ink },
    },
    choice: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      text: { fontSize: 15, color: ink },
    },
    readout: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      control: { background: `${accent}26`, borderRadius: 6, padding: "4px 8px" },
      text: { fontSize: 15, fontWeight: 600, color: accent },
    },
  },
  action: {
    button: { type: "primary", shape: "round", style: { background: accent, fontWeight: 700 } },
  },
};
const fluent: FluentLooks = {
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
    responsive: { body: (st) => ({ display: "flex", flexDirection: st.width >= 600 ? "row" : "column", gap: 12 }) },
  },
  text: {
    tag: {
      style: {
        background: `${accent}26`,
        color: accent,
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.8,
      },
    },
    lead: { style: { fontSize: 18, lineHeight: "26px", color: ink } },
    note: { italic: true, style: { color: `${ink}99`, fontSize: 13 } },
    underlined: { underline: true, style: { color: accent, fontWeight: 600 } },
  },
  field: {
    field: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      control: { borderRadius: 8, background: "#fff" },
      text: { fontSize: 16, color: ink },
    },
    choice: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      text: { fontSize: 15, color: ink },
    },
    readout: {
      label: { fontSize: 13, fontWeight: 600, color: `${ink}b3` },
      control: { background: `${accent}26`, borderRadius: 6, padding: "4px 8px" },
      text: { fontSize: 15, fontWeight: 600, color: accent },
    },
  },
  action: {
    button: { appearance: "primary", shape: "circular", style: { background: accent, fontWeight: 700 } },
  },
};

// All five implementations draw this story: each has a table above (html and
// native read the portable one; the others, their own names for it).
const meta: Meta<ScopeArgs> = {
  title: "Boundaries/Portable looks",
  parameters: { implementations: ["html", "native", "mui", "antd", "fluent"] },
};
export default meta;
type Story = StoryObj<ScopeArgs>;

export const OneTableTwoRenderers: Story = {
  render: () => (
    <HtmlThemeProvider theme={html}>
      <NativeThemeProvider theme={native}>
        <MuiLooksProvider looks={mui}>
          <AntdLooksProvider looks={ant}>
            <FluentLooksProvider looks={fluent}>
              <PortableLooksDemo />
            </FluentLooksProvider>
          </AntdLooksProvider>
        </MuiLooksProvider>
      </NativeThemeProvider>
    </HtmlThemeProvider>
  ),
};
