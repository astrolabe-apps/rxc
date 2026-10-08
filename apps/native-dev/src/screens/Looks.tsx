import type { ReactNode } from "react";
import { Action, Contents, ImageDisplay, InlineGroup, TextDisplay } from "@rx-controls/forms-react";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { Screen } from "./Screen";

const boat = require("../../assets/boat.png");

/** The roles the Storybook's "Named looks" story names, as NativeWind classes. */
const looks: PartialNativeTheme = {
  text: {
    variants: {
      lead: "text-lg font-semibold",
      tag: "self-start rounded bg-blue-100 px-2 py-0.5 text-sm font-bold text-blue-800",
    },
  },
  contents: {
    variants: {
      card: { className: "rounded-lg bg-gray-100 p-4" },
      callout: { className: "border-l-4 border-green-600 pl-4", title: "text-green-800" },
    },
  },
  action: {
    variants: {
      quiet: { className: "border-0 bg-transparent px-0", textClassName: "text-blue-700" },
      inlineLink: { className: "border-0 bg-transparent p-0", textClassName: "text-blue-700 underline" },
    },
  },
  image: { variants: { rounded: "rounded-xl" } },
};

/** Named looks: the form names a role, the theme says what it looks like. */
export function Looks(): ReactNode {
  return (
    <NativeThemeProvider theme={looks}>
      <Screen title="Named looks">
        <TextDisplay text="Step 1 of 2" variant="tag" />
        <TextDisplay text="Before you start, check the details we hold for you." variant="lead" />
        <ImageDisplay source={boat} alt="" width={240} variant="rounded" />
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
      </Screen>
    </NativeThemeProvider>
  );
}
