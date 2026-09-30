import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { Contents, CheckboxField, Stack, TextField } from "@rx-controls/forms-react";
import { CheckForm, Values, type ScopeArgs } from "../support";

interface FieldArgs extends ScopeArgs {
  label: string;
  required: boolean;
  placeholder: string;
  helpText: string;
  multiline: boolean;
  fieldDisabled: boolean;
  fieldReadOnly: boolean;
}

function Basic(a: FieldArgs): Rendered {
  const { rendered } = useReactive();
  const name = useControl("");
  return rendered(
    <>
      <TextField
        field={name}
        label={a.label}
        required={a.required}
        placeholder={a.placeholder}
        helpText={a.helpText}
        multiline={a.multiline}
        disabled={a.fieldDisabled}
        readOnly={a.fieldReadOnly}
      />
      <CheckForm />
      <Values control={name} />
    </>,
  );
}

const meta: Meta<FieldArgs> = {
  title: "Boundaries/Field",
  render: (a) => <Basic {...a} />,
  args: {
    label: "First name",
    required: false,
    placeholder: "Ada",
    helpText: "",
    multiline: false,
    fieldDisabled: false,
    fieldReadOnly: false,
  },
  argTypes: {
    fieldDisabled: { name: "disabled (field)" },
    fieldReadOnly: { name: "readOnly (field)" },
  },
};
export default meta;
type Story = StoryObj<FieldArgs>;

export const Plain: Story = {};

export const Required: Story = {
  args: { required: true, helpText: "Check the form to see the error." },
};

export const Multiline: Story = {
  args: { label: "Notes", multiline: true, placeholder: "" },
};

/** A field-level lock cannot undo a region's, only add to it. */
export const Locked: Story = {
  args: { fieldReadOnly: true, helpText: "Read-only on the field itself." },
};

function Validators(): Rendered {
  const { rendered } = useReactive();
  const email = useControl("");
  return rendered(
    <>
      <TextField
        field={email}
        label="Email"
        inputType="email"
        inputMode="email"
        autoComplete="email"
        startIcon="@"
        endIcon={(rc) => ((rc.getValue(email) ?? "").includes("@") ? "✓" : null)}
        helpText="Two keyed rules, each published and cleared on its own."
        validate={{
          shape: (v) =>
            !v || v.includes("@") ? null : "That does not look like an email",
          length: (v) => (!v || v.length < 30 ? null : "Too long"),
        }}
      />
      <Values control={email} />
    </>,
  );
}

/** Keyed validators, icons inside the frame, and input hints. */
export const WithValidators: Story = { render: () => <Validators /> };

function Async(): Rendered {
  const { rendered } = useReactive();
  const name = useControl("");
  return rendered(
    <>
      <TextField
        field={name}
        label="Username"
        required
        helpText="An 800 ms availability check — try smith. Check the form while it runs: it waits."
        validate={{
          taken: async (v) => {
            await new Promise((r) => setTimeout(r, 800));
            return v?.trim().toLowerCase() === "smith" ? "Smith is taken" : null;
          },
        }}
      />
      <CheckForm />
      <Values control={name} />
    </>,
  );
}

/** An asynchronous rule: pending while it runs, superseded by the next keystroke. */
export const AsyncValidator: Story = { render: () => <Async /> };

function DefaultCycle(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ hasVet: true, vet: undefined as string | undefined });
  const f = data.fields;
  return rendered(
    <Stack gap={8}>
      <CheckboxField field={f.hasVet} label="Has a vet" />
      <Contents hidden={(rc) => !rc.getValue(f.hasVet)}>
        <TextField
          field={f.vet}
          label="Vet's name"
          required
          defaultValue="Dr. Dolittle"
          helpText="Turn on clearHidden, untick above, tick again: cleared, then defaulted."
        />
      </Contents>
      <Values control={data} />
    </Stack>,
  );
}

/** `clearHidden` and `defaultValue` as a cycle: hide → cleared → show → defaulted. */
export const DefaultValueCycle: Story = {
  render: () => <DefaultCycle />,
  args: { clearHidden: true },
};
