import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  CheckboxField,
  SelectField,
  Stack,
  TextDisplay,
  TextField,
} from "@rx-controls/forms-react";
import { Stars } from "../widgets/Stars";
import { PetCards } from "../widgets/PetCards";
import { Collapsible } from "../widgets/Collapsible";
import { SelectChild } from "../widgets/SelectChild";
import { CheckForm, Values, type ScopeArgs } from "../support";

const meta: Meta<ScopeArgs> = { title: "Third party" };
export default meta;
type Story = StoryObj<ScopeArgs>;

function StarsDemo(): Rendered {
  const { rendered } = useReactive();
  const rating = useControl<number | undefined>(undefined);
  return rendered(
    <>
      <Stars
        field={rating}
        label="How did we do?"
        maxStars={5}
        required
        requiredMessage="Please rate us"
        helpText="Its own surface; the implementation's shell."
      />
      <CheckForm />
      <Values control={rating} />
    </>,
  );
}

/** A field written outside the package, through `fieldRenderer`. */
export const StarsField: Story = { render: () => <StarsDemo /> };

function Cards(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ show: true, pets: [{ name: "Rex" }] });
  const f = data.fields;
  return rendered(
    <Stack gap={8}>
      <CheckboxField field={f.show} label="Show the group" />
      <Collapsible
        title="Pets as cards"
        hidden={(rc) => !rc.getValue(f.show)}
        defaultOpen
        summary={(rc) => {
          const n = rc.getValue(f.pets)?.length ?? 0;
          return `${n} pet${n === 1 ? "" : "s"}`;
        }}
      >
        <PetCards
          field={f.pets}
          label="Pets"
          minLength={1}
          maxLength={3}
          columns={2}
          empty={<p>No cards.</p>}
        >
          {(pet, i) => (
            <TextField field={pet.fields.name} required label={`Pet ${i + 1}`} />
          )}
        </PetCards>
      </Collapsible>
      <CheckForm />
      <Values control={data} />
    </Stack>,
  );
}

/**
 * A collection (`collectionRenderer`) inside a group (`groupRenderer`), both
 * written outside the package. Collapse the group and the cards keep
 * validating — the badge; hide it and they stop.
 */
export const CardsInCollapsible: Story = { render: () => <Cards /> };

function Branches(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ kind: "person" as string | undefined, email: "" });
  const f = data.fields;
  return rendered(
    <Stack gap={8}>
      <SelectField
        field={f.kind}
        label="Operator"
        options={[
          { name: "Person", value: "person" },
          { name: "Business", value: "business" },
        ]}
      />
      <SelectChild
        selected={(rc) => rc.getValue(f.kind)}
        items={[
          {
            key: "person",
            children: <TextField field={f.email} label="Contact email" required />,
          },
          {
            key: "business",
            children: <TextDisplay text="Businesses are contacted by post." />,
          },
        ]}
      />
      <CheckForm />
      <Values control={data} />
    </Stack>,
  );
}

/**
 * A container that produces `silent`, written with the public scope API: the
 * branch the data has not chosen stays mounted and validating.
 */
export const SelectChildBranches: Story = { render: () => <Branches /> };
