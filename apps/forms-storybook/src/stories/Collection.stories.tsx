import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  useControl,
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import {
  Action,
  arrayActions,
  Elements,
  Section,
  Stack,
  StandardActionIds,
  TextField,
} from "@rx-controls/forms-react";
import { CheckForm, Values, type ScopeArgs } from "../support";

interface CollectionArgs extends ScopeArgs {
  minLength: number;
  maxLength: number;
  lockRegion: boolean;
}

type Pet = { name: string };

function Pets(a: CollectionArgs): Rendered {
  const { rc, rendered } = useReactive();
  const ctx = useControlContext();
  const pets = useControl<Pet[]>([{ name: "Rex" }]);
  const bounds = { minLength: a.minLength, maxLength: a.maxLength };
  // Buttons outside the list: mutation is not the collection renderer's job.
  const outside = arrayActions(rc, ctx, pets, bounds);
  return rendered(
    <>
      <Section readOnly={a.lockRegion}>
        <Elements
          field={pets}
          label="Pets"
          {...bounds}
          helpText={`Length ${a.minLength}–${a.maxLength}, validated on the array itself.`}
          empty={<p>No pets yet.</p>}
        >
          {(pet, i, row) => (
            <Stack direction="row" gap={8} align="end">
              <TextField field={pet.fields.name} label={`Pet ${i + 1}`} required />
              <Action
                actionId={StandardActionIds.remove}
                text="Remove"
                disabled={!row.canRemove}
                onClick={() => row.remove(i)}
              />
            </Stack>
          )}
        </Elements>
        <Action
          actionId={StandardActionIds.add}
          text={`Add pet (${outside.length}/${a.maxLength})`}
          style="primary"
          disabled={!outside.canAdd}
          onClick={() => outside.add({ name: "" })}
        />
      </Section>
      <CheckForm />
      <Values control={pets} />
    </>,
  );
}

const meta: Meta<CollectionArgs> = {
  title: "Boundaries/Collection",
  render: (a) => <Pets {...a} />,
  args: { minLength: 1, maxLength: 3, lockRegion: false },
};
export default meta;
type Story = StoryObj<CollectionArgs>;

/** Rows keyed by `uniqueId`, bounds on the array, `can*` from the scope. */
export const Elements_: Story = { name: "Elements" };

/** Every `can*` is false inside a locked region. */
export const LockedRegion: Story = { args: { lockRegion: true } };
