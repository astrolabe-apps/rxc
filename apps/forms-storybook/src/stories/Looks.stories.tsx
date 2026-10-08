import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Action, Contents, InlineGroup, TextDisplay } from "@rx-controls/forms-react";
import { HtmlThemeProvider, type PartialHtmlTheme } from "@rx-controls/forms-html";
import { MuiVariantsProvider, type MuiVariants } from "@rx-controls/forms-mui";
import { AntdVariantsProvider, type AntdVariants } from "@rx-controls/forms-antd";
import { FluentVariantsProvider, type FluentVariants } from "@rx-controls/forms-fluent";
import { tokens } from "@fluentui/react-components";
import type { ScopeArgs } from "../support";

/*
 * Named looks: the form names a role — `lead`, `tag`, `card`, `callout`,
 * `quiet`, `inlineLink` — and each implementation's theme says what it looks
 * like. The source below is the same under every implementation; only the
 * providers differ, and each implementation reads only its own.
 */
const html: PartialHtmlTheme = {
  text: {
    variants: {
      lead: "text-lg font-semibold",
      tag: "inline-block rounded bg-blue-100 px-2 py-0.5 text-sm font-bold text-blue-800",
    },
  },
  contents: {
    variants: {
      card: { wrapper: "rounded-lg bg-gray-100 p-4" },
      callout: { wrapper: "border-l-4 border-green-600 pl-4", title: "text-green-800" },
    },
  },
  action: {
    variants: {
      quiet: { className: "bg-transparent text-blue-700" },
      inlineLink: { className: "bg-transparent underline text-blue-700" },
    },
  },
};
const mui: MuiVariants = {
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
};
const antd: AntdVariants = {
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
};
const fluent: FluentVariants = {
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
};

function Looks({ children }: { children: ReactNode }) {
  return (
    <HtmlThemeProvider theme={html}>
      <MuiVariantsProvider variants={mui}>
        <AntdVariantsProvider variants={antd}>
          <FluentVariantsProvider variants={fluent}>{children}</FluentVariantsProvider>
        </AntdVariantsProvider>
      </MuiVariantsProvider>
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
        <TextDisplay text="Step 1 of 2" variant="tag" />
        <TextDisplay text="Before you start, check the details we hold for you." variant="lead" />
        <Contents title="Your vessel" variant="card">
          <TextDisplay text="UBER — a 6.2m runabout, registered in Hobart." />
          <Action actionId="checkAgain" text="I've updated it, check again" variant="quiet" />
        </Contents>
        <Contents title="Good to know" variant="callout">
          <InlineGroup>
            <TextDisplay text="You can change these on your" />
            <Action actionId="profile" text="profile page" variant="inlineLink" />
          </InlineGroup>
        </Contents>
      </Contents>
    </Looks>
  ),
};
