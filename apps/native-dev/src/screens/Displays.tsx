import type { ReactNode } from "react";
import {
  Contents,
  ImageDisplay,
  RichText,
  Section,
  TextDisplay,
  TextField,
} from "@rx-controls/forms-react";
import { useControl } from "@rx-controls/react";
import { Screen } from "./Screen";

/** A bundled asset: the number Metro gives a require of an image. */
const boat = require("../../assets/boat.png");

/** Headings, a group's own heading, rich text, images, tones. */
export function Displays(): ReactNode {
  const size = useControl("");
  return (
    <Screen title="Displays">
      <Section>
        {/* Content before the section's own title. */}
        <TextDisplay text="Step 1 of 2" />
        <TextDisplay text="Your details" heading="group" />
        <Contents title="Postal address">
          <TextDisplay text="Is this still right?" heading />
          <TextDisplay text="12 Main St, Hobart" />
        </Contents>
      </Section>
      <Contents title="Rich text">
        <TextField
          field={size}
          label={<RichText html="Is your fire larger than 1m<sup>3</sup>?" />}
          helpText={<RichText html={'Measured as in <a href="https://example.com">the guide</a>.'} />}
        />
        <TextDisplay text={<RichText html="<i>Emphasis</i>, <b>strength</b> &amp; H<sub>2</sub>O." />} />
      </Contents>
      <Contents title="Images">
        {/* A bundled asset, its height from its own proportions. */}
        <ImageDisplay source={boat} alt="A boat at its mooring" width={240} />
        {/* A URL, a box both given, cropped to it. */}
        <ImageDisplay
          source="https://picsum.photos/id/1011/600/400"
          alt="A lake, from a URL"
          width={300}
          height={120}
          fit="cover"
        />
        {/* Decoration: no name. */}
        <ImageDisplay source={boat} alt="" width={120} height={12} fit="cover" />
      </Contents>
      <Contents title="Tones">
        <TextDisplay text="Saved." tone="success" />
        <TextDisplay text="Your licence expires soon." tone="warning" />
        <TextDisplay text="Something went wrong." tone="error" announce />
      </Contents>
    </Screen>
  );
}
