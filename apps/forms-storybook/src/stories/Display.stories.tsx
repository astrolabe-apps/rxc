import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReadContext } from "@rx-controls/core";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  DisplayOnlyField,
  HtmlDisplay,
  IconDisplay,
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
      />
    </div>,
  );
}

/** A field that never writes: option names, arrays, empty and design-mode text, a format. */
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
