import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Action, Contents, ImageDisplay, InlineGroup, TextDisplay } from "@rx-controls/forms-react";
import { HtmlThemeProvider, type PartialHtmlTheme } from "@rx-controls/forms-html";
import { MuiLooksProvider, type MuiLooks } from "@rx-controls/forms-mui";
import { AntdLooksProvider, type AntdLooks } from "@rx-controls/forms-antd";
import { FluentLooksProvider, type FluentLooks } from "@rx-controls/forms-fluent";
import { tokens } from "@fluentui/react-components";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import type { ScopeArgs } from "../support";

/*
 * Named looks: the form names a role — `lead`, `tag`, `card`, `callout`,
 * `quiet`, `inlineLink` — and each implementation's theme says what it looks
 * like. The source below is the same under every implementation; only the
 * providers differ, and each implementation reads only its own.
 */
const html: PartialHtmlTheme = {
  looks: {
    lead: { control: "text-lg font-semibold" },
    tag: { control: "inline-block rounded bg-blue-100 px-2 py-0.5 text-sm font-bold text-blue-800" },
    card: { shell: "rounded-lg bg-gray-100 p-4" },
    callout: { shell: "border-l-4 border-green-600 pl-4", label: "text-green-800" },
    quiet: { control: "bg-transparent text-blue-700" },
    inlineLink: { control: "bg-transparent underline text-blue-700" },
    rounded: { control: "rounded-xl" },
  },
};
const mui: MuiLooks = {
  text: {
    lead: { variant: "subtitle1", sx: { fontWeight: 600 } },
    tag: {
      sx: (t) => ({
        display: "inline-block",
        px: 1,
        borderRadius: 1,
        bgcolor: t.palette.primary.light,
        color: t.palette.primary.contrastText,
        fontWeight: 700,
      }),
    },
  },
  group: {
    card: { wrapper: (t) => ({ background: t.palette.grey[100], padding: t.spacing(2), borderRadius: 8 }) },
    callout: { wrapper: (t) => ({ borderLeft: `4px solid ${t.palette.success.main}`, paddingLeft: t.spacing(2) }) },
  },
  action: {
    quiet: { variant: "text", color: "primary" },
    inlineLink: { variant: "text", sx: { p: 0, minWidth: 0, textDecoration: "underline" } },
  },
  image: { rounded: (t) => ({ borderRadius: Number(t.shape.borderRadius) * 3 }) },
};
const antd: AntdLooks = {
  text: {
    lead: { strong: true, style: (t) => ({ fontSize: t.fontSizeLG }) },
    tag: {
      strong: true,
      style: (t) => ({ background: t.colorPrimaryBg, color: t.colorPrimary, padding: "0 8px", borderRadius: t.borderRadiusSM }),
    },
  },
  group: {
    card: { wrapper: (t) => ({ background: t.colorFillQuaternary, padding: t.padding, borderRadius: t.borderRadiusLG }) },
    callout: { wrapper: (t) => ({ borderLeft: `4px solid ${t.colorSuccess}`, paddingLeft: t.padding }) },
  },
  action: {
    quiet: { type: "text" },
    inlineLink: { type: "link", style: { padding: 0, textDecoration: "underline" } },
  },
  image: { rounded: (t) => ({ borderRadius: t.borderRadiusLG }) },
};
const fluent: FluentLooks = {
  text: {
    lead: { size: 400, weight: "semibold" },
    tag: {
      weight: "bold",
      style: {
        background: tokens.colorBrandBackground2,
        color: tokens.colorBrandForeground2,
        padding: `0 ${tokens.spacingHorizontalS}`,
        borderRadius: tokens.borderRadiusMedium,
      },
    },
  },
  group: {
    card: { wrapper: { background: tokens.colorNeutralBackground3, padding: tokens.spacingHorizontalL, borderRadius: tokens.borderRadiusLarge } },
    callout: { wrapper: { borderLeft: `4px solid ${tokens.colorPaletteGreenBorder2}`, paddingLeft: tokens.spacingHorizontalL } },
  },
  action: {
    quiet: { appearance: "subtle" },
    inlineLink: { appearance: "transparent", style: { padding: 0, minWidth: 0, textDecoration: "underline" } },
  },
  image: { rounded: { borderRadius: tokens.borderRadiusXLarge } },
};

const native: PartialNativeTheme = {
  looks: {
    lead: { control: { fontSize: 18, lineHeight: 28, fontWeight: "600" } },
    tag: {
      control: {
        alignSelf: "flex-start",
        borderRadius: 4,
        backgroundColor: "#dbeafe",
        paddingHorizontal: 8,
        paddingVertical: 2,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "700",
        color: "#1e40af",
      },
    },
    card: { shell: { borderRadius: 8, backgroundColor: "#f3f4f6", padding: 16 } },
    callout: {
      shell: { borderLeftWidth: 4, borderLeftColor: "#16a34a", paddingLeft: 16 },
      label: { color: "#166534" },
    },
    quiet: {
      control: { borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0 },
      text: { color: "#1d4ed8" },
    },
    inlineLink: {
      control: { borderWidth: 0, backgroundColor: "transparent", padding: 0 },
      text: { color: "#1d4ed8", textDecorationLine: "underline" },
    },
    rounded: { control: { borderRadius: 12 } },
  },
};

function Looks({ children }: { children: ReactNode }) {
  return (
    <HtmlThemeProvider theme={html}>
      <MuiLooksProvider looks={mui}>
        <AntdLooksProvider looks={antd}>
          <FluentLooksProvider looks={fluent}>
            <NativeThemeProvider theme={native}>{children}</NativeThemeProvider>
          </FluentLooksProvider>
        </AntdLooksProvider>
      </MuiLooksProvider>
    </HtmlThemeProvider>
  );
}

const meta: Meta<ScopeArgs> = { title: "Boundaries/Named looks" };
export default meta;
type Story = StoryObj<ScopeArgs>;

/**
 * Text, groups and actions each naming a role. A name the theme does not know
 * draws the base look, with a warning in development.
 */
export const Roles: Story = {
  render: () => (
    <Looks>
      <Contents>
        <TextDisplay text="Step 1 of 2" look="tag" />
        <TextDisplay text="Before you start, check the details we hold for you." look="lead" />
        <ImageDisplay
          source={
            "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#bfdbfe"/><rect y="80" width="240" height="40" fill="#1d4ed8"/></svg>',
            )
          }
          alt=""
          width={240}
          height={120}
          look="rounded"
        />
        <Contents title="Your vessel" look="card">
          <TextDisplay text="UBER — a 6.2m runabout, registered in Hobart." />
          <Action actionId="checkAgain" text="I've updated it, check again" look="quiet" />
        </Contents>
        <Contents title="Good to know" look="callout">
          <InlineGroup>
            <TextDisplay text="You can change these on your" />
            <Action actionId="profile" text="profile page" look="inlineLink" />
          </InlineGroup>
        </Contents>
      </Contents>
    </Looks>
  ),
};
