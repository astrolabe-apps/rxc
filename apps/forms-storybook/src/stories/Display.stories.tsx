import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReadContext } from "@rx-controls/core";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  Contents,
  DisplayOnlyField,
  HtmlDisplay,
  IconDisplay,
  ImageDisplay,
  RichText,
  Section,
  TextDisplay,
  TextField,
} from "@rx-controls/forms-react";
import type { ScopeArgs } from "../support";

interface DisplayArgs extends ScopeArgs {
  text: string;
}

const meta: Meta<DisplayArgs> = {
  title: "Boundaries/Display",
  args: { text: "Authored display — static content, no field." },
};
export default meta;
type Story = StoryObj<DisplayArgs>;

export const Text: Story = { render: (a) => <TextDisplay text={a.text} /> };

/**
 * `heading`: drawn as a heading at the level the outline gives the place —
 * a page title at the top, a card title one below the section around it.
 */
export const Heading: Story = {
  render: () => (
    <Contents>
      <TextDisplay text="Confirm your details" heading />
      <TextDisplay text="We use these to find your licence." />
      <Contents title="Postal address">
        <TextDisplay text="Is this still right?" heading />
        <TextDisplay text="12 Main St, Hobart" />
      </Contents>
    </Contents>
  ),
};

/**
 * `RichText`: inline markup parsed into a fixed subset — emphasis, a
 * superscript, a link, an image — and drawn by the implementation, so it looks
 * the same everywhere. Anywhere a node goes: here a label and its help.
 */
function RichLabels() {
  const size = useControl("");
  return (
    <Contents>
      <TextField
        field={size}
        label={<RichText html="Is <b>UBER</b> larger than 1m<sup>3</sup>?" />}
        helpText={
          <RichText html={'Measured as in <a href="https://example.test/guide" target="_blank">the guide</a>.'} />
        }
      />
      <TextDisplay text={<RichText html="<i>Emphasis</i>, <b>strength</b> &amp; H<sub>2</sub>O." />} />
    </Contents>
  );
}
export const Rich: Story = { render: () => <RichLabels /> };

/** A picture, drawn without a network: an inline SVG. */
const boat =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="#bfdbfe"/><rect y="140" width="320" height="60" fill="#1d4ed8"/><path d="M90 140h140l-20 25H110z" fill="#f8fafc"/><path d="M160 60v75h45z" fill="#f8fafc"/></svg>',
  );

/**
 * `ImageDisplay`: a source (a URL, or the platform's own asset), an `alt` —
 * `""` for decoration — and a size, its proportions kept when only a width
 * is given.
 */
export const Image: Story = {
  render: () => (
    <Contents>
      <ImageDisplay source={boat} alt="A boat at its mooring" width={320} height={200} />
      <ImageDisplay source={boat} alt="The same boat, smaller" width={160} />
      <ImageDisplay source={boat} alt="" width={320} height={40} fit="cover" />
    </Contents>
  ),
};

/**
 * `heading="group"`: the display is its group's own title — at the level a
 * `title` would take there — so content can come before it, and what follows
 * heads one deeper.
 */
export const GroupHeading: Story = {
  render: () => (
    <Section>
      <TextDisplay text="Step 1 of 2" />
      <TextDisplay text="Your details" heading="group" />
      <Contents title="Postal address">
        <TextDisplay text="12 Main St, Hobart" />
      </Contents>
    </Section>
  ),
};

export const Html: Story = {
  render: () => (
    <HtmlDisplay html="<p>Markup rendered <strong>as it is</strong> — the caller keeps it safe.</p>" />
  ),
};

/** An icon carries the meaning its glyph does not, as an accessible name. */
export const Icon: Story = {
  render: () => (
    <div className="flex flex-row gap-2 items-center">
      <IconDisplay
        icon={<span aria-hidden>★</span>}
        accessibleName="A starred item."
      />
      <TextDisplay text="Starred" />
    </div>
  ),
};

function DisplayOnly(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({
    status: "active" as string | undefined,
    tags: ["a", "c"],
    empty: undefined as string | undefined,
    joined: "2024-12-01",
  });
  const f = data.fields;
  const names = [
    { name: "Active", value: "active" },
    { name: "Alpha", value: "a" },
    { name: "Charlie", value: "c" },
  ];
  return rendered(
    <div className="flex flex-col gap-2">
      <DisplayOnlyField field={f.status} label="Status" options={names} />
      <DisplayOnlyField field={f.tags} label="Tags" options={names} />
      <DisplayOnlyField
        field={f.empty}
        label="Nothing here"
        emptyText="—"
        sampleText="Sample value"
      />
      <DisplayOnlyField
        field={f.joined}
        label="Joined"
        format={(v) => new Date(String(v)).toDateString()}
        startIcon={<span aria-hidden="true">●</span>}
      />
    </div>,
  );
}

/** A field that never writes: option names, arrays, empty and design-mode text, a format, an icon. */
export const DisplayOnlyValues: Story = { render: () => <DisplayOnly /> };

function Tones(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ reason: "" });
  const max = 20;
  const length = (rc: ReadContext) => rc.getValue(data.fields.reason).length;
  return rendered(
    <div className="flex flex-col gap-2">
      <TextDisplay text="Submission refused — please try again." tone="error" announce />
      <TextDisplay text="Your session expires in 5 minutes." tone="warning" />
      <TextDisplay text="Drafts are kept for 30 days." tone="info" />
      <TextDisplay text="Saved." tone="success" announce />
      <TextField field={data.fields.reason} label="Reason" />
      {/* A derived tone, and no `announce`: a counter must not be read out per key. */}
      <TextDisplay
        text={(rc) => `${length(rc)} / ${max} characters`}
        tone={(rc) => (length(rc) > max ? "error" : undefined)}
      />
    </div>,
  );
}

/**
 * `tone` colours a display by what it means; `announce` makes it a live
 * region (`role="alert"` for an error, `"status"` otherwise). The counter
 * turns red past its limit with no announcement.
 */
export const DisplayTones: Story = { render: () => <Tones /> };

function AnnouncedError(): Rendered {
  const { rendered, update } = useReactive();
  const error = useControl<string | undefined>(undefined);
  return rendered(
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <TextDisplay text="Cell one" />
        <TextDisplay
          hidden={(rc) => !rc.getValue(error)}
          text={error}
          tone="error"
          announce
        />
        <TextDisplay text="Cell two" />
      </div>
      <div className="flex flex-row gap-2">
        <Action
          actionId="fail"
          text="Fail"
          onClick={() =>
            update((wc) => wc.setValue(error, "Submission refused — please try again."))
          }
        />
        <Action
          actionId="clear"
          text="Clear"
          onClick={() => update((wc) => wc.setValue(error, undefined))}
        />
      </div>
    </div>,
  );
}

/**
 * `announce` with `hidden`: while hidden the live region stays in the page,
 * empty and out of the layout (the grid has no gap where it sits), so the
 * message arriving in it is announced.
 */
export const DisplayAnnouncedError: Story = { render: () => <AnnouncedError /> };
