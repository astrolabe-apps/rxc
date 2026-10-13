import type { ReactNode } from "react";
import { Action, Contents, ImageDisplay, InlineGroup, TextDisplay } from "@rx-controls/forms-react";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { Screen } from "./Screen";

const boat = require("../../assets/boat.png");

/** The roles the Storybook's "Named looks" story names, as NativeWind classes. */
const looks: PartialNativeTheme = {
  looks: {
    lead: { control: "text-lg font-semibold" },
    tag: { control: "self-start rounded bg-blue-100 px-2 py-0.5 text-sm font-bold text-blue-800" },
    card: { shell: "rounded-lg bg-gray-100 p-4" },
    callout: { shell: "border-l-4 border-green-600 pl-4", label: "text-green-800" },
    quiet: { control: "border-0 bg-transparent px-0", text: "text-blue-700" },
    inlineLink: { control: "border-0 bg-transparent p-0", text: "text-blue-700 underline" },
    rounded: { control: "rounded-xl" },
  },
};

/** Named looks: the form names a role, the theme says what it looks like. */
export function Looks(): ReactNode {
  return (
    <NativeThemeProvider theme={looks}>
      <Screen title="Named looks">
        <TextDisplay text="Step 1 of 2" look="tag" />
        <TextDisplay text="Before you start, check the details we hold for you." look="lead" />
        <ImageDisplay source={boat} alt="" width={240} look="rounded" />
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
      </Screen>
    </NativeThemeProvider>
  );
}
