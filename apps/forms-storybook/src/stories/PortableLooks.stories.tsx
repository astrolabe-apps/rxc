import type { Meta, StoryObj } from "@storybook/react-vite";
import { HtmlThemeProvider, type PartialHtmlTheme } from "@rx-controls/forms-html";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { PortableLooksDemo, portableLooks, portableTokens } from "rxc-forms-conformance/portable";
import type { ScopeArgs } from "../support";

/*
 * One look table written once as portable styles, and one form naming them.
 * The html implementation draws them as inline CSS; forms-native (here through
 * react-native-web) as React Native styles. Each reads the same table from
 * its own theme — the playground app draws the same source on a device.
 */
const html = { tokens: { colors: portableTokens }, looks: portableLooks } as PartialHtmlTheme;
const native = { tokens: { colors: portableTokens }, looks: portableLooks } as PartialNativeTheme;

// Only html and native read portable styles from their themes; the smoke test
// draws this story under those two.
const meta: Meta<ScopeArgs> = {
  title: "Boundaries/Portable looks",
  parameters: { implementations: ["html", "native"] },
};
export default meta;
type Story = StoryObj<ScopeArgs>;

export const OneTableTwoRenderers: Story = {
  render: () => (
    <HtmlThemeProvider theme={html}>
      <NativeThemeProvider theme={native}>
        <PortableLooksDemo />
      </NativeThemeProvider>
    </HtmlThemeProvider>
  ),
};
