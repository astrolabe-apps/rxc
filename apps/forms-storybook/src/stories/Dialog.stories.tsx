import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { Action, Dialog, TextField } from "@rx-controls/forms-react";
import { CheckForm, Values, type ScopeArgs } from "../support";

interface DialogArgs extends ScopeArgs {
  startOpen: boolean;
}

function DialogDemo(a: DialogArgs): Rendered {
  const { rendered, update } = useReactive();
  const open = useControl(a.startOpen);
  const data = useControl({ last: "" });
  const setOpen = (v: boolean) => update((wc) => wc.setValue(open, v));
  return rendered(
    <>
      <div className="flex flex-row gap-3 items-center">
        <Action
          actionId="openDetails"
          text="More details…"
          onClick={() => setOpen(true)}
        />
        <span>Last name is required, inside the dialog.</span>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="More details">
        <TextField
          field={data.fields.last}
          label="Last name"
          required
          helpText="Validated while the dialog is closed."
        />
      </Dialog>
      <CheckForm />
      <Values control={data} />
    </>,
  );
}

const meta: Meta<DialogArgs> = {
  title: "Containers/Dialog",
  render: (a) => <DialogDemo {...a} />,
  args: { startOpen: false },
};
export default meta;
type Story = StoryObj<DialogArgs>;

/** Closed is `silent`: the content stays mounted and keeps validating. */
export const Closed: Story = {};

/** Design mode draws it inline, with no dialog chrome. */
export const DesignMode: Story = { args: { designMode: true } };
