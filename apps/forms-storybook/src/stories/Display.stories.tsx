import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  DisplayOnlyField,
  HtmlDisplay,
  IconDisplay,
  Stack,
  TextDisplay,
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
    <Stack direction="row" gap={8} align="center">
      <IconDisplay
        icon={<span aria-hidden>★</span>}
        accessibleName="A starred item."
      />
      <TextDisplay text="Starred" />
    </Stack>
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
    <Stack gap={8}>
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
    </Stack>,
  );
}

/** A field that never writes: option names, arrays, empty and design-mode text, a format. */
export const DisplayOnlyValues: Story = { render: () => <DisplayOnly /> };
