import type { ReactNode } from "react";
import { Action, Contents, ImageDisplay, InlineGroup, TextDisplay } from "@rx-controls/forms-react";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { Screen } from "./Screen";

const boat = require("../../assets/boat.png");

/** The roles the Storybook's "Named looks" story names, as React Native styles. */
const looks: PartialNativeTheme = {
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
