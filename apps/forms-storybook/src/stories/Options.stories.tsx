import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  CheckboxField,
  Contents,
  RadioField,
  SelectField,
  TextDisplay,
  TextField,
  type FieldOption,
} from "@rx-controls/forms-react";
import { CheckForm, Values, type ScopeArgs } from "../support";

const statusOptions: FieldOption[] = [
  { name: "Active", value: "active" },
  { name: "Inactive", value: "inactive" },
  { name: "Pending", value: "pending", disabled: true },
];

const priorityOptions: FieldOption[] = [
  { name: "Low", value: 1 },
  { name: "Medium", value: 2 },
  { name: "High", value: 3 },
];

interface OptionArgs extends ScopeArgs {
  label: string;
  required: boolean;
}

const meta: Meta<OptionArgs> = {
  title: "Boundaries/Options",
  args: { label: "Status", required: false },
};
export default meta;
type Story = StoryObj<OptionArgs>;

function Select(a: OptionArgs): Rendered {
  const { rendered } = useReactive();
  const status = useControl<string | undefined>(undefined);
  return rendered(
    <>
      <SelectField
        field={status}
        label={a.label}
        required={a.required}
        options={statusOptions}
        helpText="Pending is shown but not choosable."
      />
      <CheckForm />
      <Values control={status} />
    </>,
  );
}

export const Select_: Story = { name: "Select", render: (a) => <Select {...a} /> };

function NumericSelect(a: OptionArgs): Rendered {
  const { rendered } = useReactive();
  const priority = useControl<number | undefined>(2);
  return rendered(
    <>
      <SelectField
        field={priority}
        label={a.label}
        required={a.required}
        options={priorityOptions}
        helpText="The option list is how a number comes back as a number."
      />
      <Values control={priority} />
    </>,
  );
}

/** Values round-trip as their own type through the platform's strings. */
export const NumericValues: Story = {
  render: (a) => <NumericSelect {...a} />,
  args: { label: "Priority" },
};

function Radio(a: OptionArgs): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ status: "active" as string | undefined, why: "" });
  const f = data.fields;
  return rendered(
    <>
      <RadioField
        field={f.status}
        label={a.label}
        required={a.required}
        options={statusOptions}
      >
        {(o, selected) => (
          // Gated with a hidden group, never `selected && …`, so the field
          // under Inactive keeps validating while Active is chosen.
          <Contents hidden={!selected}>
            {o.value === "inactive" ? (
              <TextField field={f.why} label="Why inactive?" required />
            ) : (
              <TextDisplay text={`${o.name} it is.`} />
            )}
          </Contents>
        )}
      </RadioField>
      <CheckForm />
      <Values control={data} />
    </>,
  );
}

/** Per-option content, called for every option and gated by presence. */
export const RadioWithContent: Story = { render: (a) => <Radio {...a} /> };

function Checkbox(a: OptionArgs): Rendered {
  const { rendered } = useReactive();
  const agreed = useControl(false);
  return rendered(
    <>
      <CheckboxField
        field={agreed}
        label={a.label}
        required={a.required}
        helpText="A widget that labels itself: the label trails the box."
      />
      <Values control={agreed} />
    </>,
  );
}

export const Checkbox_: Story = {
  name: "Checkbox",
  render: (a) => <Checkbox {...a} />,
  args: { label: "I agree" },
};
