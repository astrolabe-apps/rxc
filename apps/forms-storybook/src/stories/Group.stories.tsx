import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  CheckboxField,
  Contents,
  DisplayOnlyField,
  InlineGroup,
  Section,
  Stack,
  TextDisplay,
  TextField,
} from "@rx-controls/forms-react";
import { CheckForm, Values, type ScopeArgs } from "../support";

type GroupArgs = ScopeArgs;

const meta: Meta<GroupArgs> = { title: "Boundaries/Group" };
export default meta;
type Story = StoryObj<GroupArgs>;

function Hideable(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ show: true, city: "Hobart" });
  const f = data.fields;
  return rendered(
    <Stack gap={8}>
      <CheckboxField field={f.show} label="Show the address" />
      <Contents hidden={(rc) => !rc.getValue(f.show)} title="Address">
        <TextField field={f.city} label="City" required />
        <p>Plain JSX inside the group hides with it.</p>
      </Contents>
      <Values control={data} />
    </Stack>,
  );
}

/** A chrome-less group: hidden without unmounting, so plain JSX goes too. */
export const HiddenContents: Story = { render: () => <Hideable /> };

function Scoped(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ first: "", last: "" });
  const f = data.fields;
  return rendered(
    <>
      <Section title="Who" validationKey="who">
        <TextField field={f.first} label="First name" required />
        <TextField field={f.last} label="Last name" />
      </Section>
      <CheckForm />
    </>,
  );
}

/** A group that is a validation scope: it knows when a rule inside is failing. */
export const SectionScope: Story = { render: () => <Scoped /> };

function Prose(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ rating: 4 as number | undefined, status: undefined });
  const f = data.fields;
  return rendered(
    <InlineGroup>
      <TextDisplay text="You rated us " />
      <DisplayOnlyField field={f.rating} emptyText="nothing yet" />
      <TextDisplay text=" out of 5, and your status is " />
      <DisplayOnlyField field={f.status} emptyText="unset" />
      <TextDisplay text="." />
    </InlineGroup>,
  );
}

/** The children learn they are inline from the scope and draw spans. */
export const Inline: Story = { render: () => <Prose /> };

function Flex(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ first: "", last: "" });
  const f = data.fields;
  return rendered(
    <Contents title="Name" layout={{ direction: "row", gap: 16, wrap: true }}>
      <TextField field={f.first} label="First name" />
      <TextField field={f.last} label="Last name" />
    </Contents>,
  );
}

/** `layout` makes the body itself the flex box — no Stack inside it. */
export const FlexLayout: Story = { render: () => <Flex /> };
