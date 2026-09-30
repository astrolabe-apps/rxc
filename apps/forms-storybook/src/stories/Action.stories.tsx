import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  ActionOverrideProvider,
  Stack,
  StandardActionIds,
  TextField,
  type ActionRenderProps,
  type ActionStyle,
  type IconPlacement,
} from "@rx-controls/forms-react";
import type { ScopeArgs } from "../support";

interface ActionArgs extends ScopeArgs {
  text: string;
  style: ActionStyle;
  iconPlacement: IconPlacement;
  withIcon: boolean;
  actionDisabled: boolean;
}

const meta: Meta<ActionArgs> = {
  title: "Boundaries/Action",
  args: {
    text: "Save",
    style: "primary",
    iconPlacement: "before",
    withIcon: false,
    actionDisabled: false,
  },
  argTypes: {
    style: { control: "inline-radio", options: ["primary", "secondary", "link"] },
    iconPlacement: {
      control: "inline-radio",
      options: ["before", "after", "replace"],
    },
    actionDisabled: { name: "disabled (action)" },
  },
  render: (a) => (
    <Action
      actionId="save"
      text={a.text}
      style={a.style}
      icon={a.withIcon ? <span aria-hidden>✔</span> : undefined}
      iconPlacement={a.iconPlacement}
      disabled={a.actionDisabled}
      onClick={() => {}}
    />
  ),
};
export default meta;
type Story = StoryObj<ActionArgs>;

export const Button: Story = {};

export const Styles: Story = {
  render: () => (
    <Stack direction="row" gap={8}>
      <Action actionId="a" text="Primary" style="primary" />
      <Action actionId="b" text="Secondary" style="secondary" />
      <Action actionId="c" text="Link" style="link" />
    </Stack>
  ),
};

export const IconOnly: Story = {
  args: { withIcon: true, iconPlacement: "replace", text: "Save (accessible name)" },
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function Busy(): Rendered {
  const { rendered } = useReactive();
  const name = useControl("");
  return rendered(
    <Stack gap={8}>
      <TextField field={name} label="Locked while Save all runs" />
      <Stack direction="row" gap={8}>
        <Action
          actionId="save"
          text="Save (self)"
          style="primary"
          onClick={() => wait(1500)}
        />
        <Action
          actionId="saveAll"
          text="Save all (global)"
          disableType="global"
          onClick={() => wait(1500)}
        />
      </Stack>
    </Stack>,
  );
}

/** An async handler shows busy; `global` locks the whole form while it runs. */
export const AsyncBusy: Story = { render: () => <Busy /> };

function Fancy(p: ActionRenderProps) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled}
      style={{ borderRadius: 999, padding: "4px 14px", border: "2px dashed" }}
    >
      ＋ {p.text}
    </button>
  );
}

/** A host restyles one id for a region — including buttons it never wrote. */
export const OverrideById: Story = {
  render: () => (
    <ActionOverrideProvider value={{ [StandardActionIds.add]: Fancy }}>
      <Stack direction="row" gap={8}>
        <Action actionId={StandardActionIds.add} text="Add" style="primary" />
        <Action actionId="other" text="Not overridden" />
      </Stack>
    </ActionOverrideProvider>
  ),
};
