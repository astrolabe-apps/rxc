import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Control } from "@rx-controls/core";
import {
  useControl,
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import {
  Action,
  Dialog,
  Elements,
  Section,
  StandardActionIds,
  TextDisplay,
  TextField,
  getExternalEdit,
} from "@rx-controls/forms-react";
import { Values, type ScopeArgs } from "../support";

type Pet = { name: string };

/**
 * The staged-edit host, rendered outside the region the array lives in. It
 * shares the array's controller — cached on the array's control — without
 * being anywhere near the collection that began the edit.
 */
function DraftHost({ field }: { field: Control<Pet[]> }): Rendered {
  const { rc, rendered } = useReactive();
  const edit = getExternalEdit(useControlContext(), field);
  const session = edit.session(rc);
  return rendered(
    <Dialog
      open={!!session}
      onClose={() => edit.cancel()}
      title={session ? `Editing pet ${session.index + 1}` : undefined}
    >
      {session && (
        <div className="flex flex-col gap-2">
          <TextField field={session.draft.fields.name} label="Name (draft)" required />
          <div className="flex flex-row gap-2">
            <Action
              actionId={StandardActionIds.apply}
              text="Apply"
              variant="primary"
              onClick={() => edit.apply()}
            />
            <Action
              actionId={StandardActionIds.cancel}
              text="Cancel"
              variant="link"
              onClick={() => edit.cancel()}
            />
          </div>
        </div>
      )}
    </Dialog>,
  );
}

interface StagedArgs extends ScopeArgs {
  lockRegion: boolean;
}

function Staged(a: StagedArgs): Rendered {
  const { rendered } = useReactive();
  const pets = useControl<Pet[]>([{ name: "Rex" }, { name: "Tiddles" }]);
  return rendered(
    <>
      <Section readOnly={a.lockRegion}>
        <Elements field={pets} label="Pets">
          {(pet, i, row) => (
            <div className="flex flex-row gap-2 items-center">
              <TextDisplay text={(rc) => rc.getValue(pet.fields.name)} />
              <Action
                actionId={StandardActionIds.edit}
                text="Edit"
                disabled={!row.canEdit}
                onClick={() => row.edit(i)}
              />
            </div>
          )}
        </Elements>
      </Section>
      <DraftHost field={pets} />
      <Values control={pets} />
    </>,
  );
}

const meta: Meta<StagedArgs> = {
  title: "Containers/Staged edit",
  render: (a) => <Staged {...a} />,
  args: { lockRegion: false },
};
export default meta;
type Story = StoryObj<StagedArgs>;

/**
 * Edit stages a draft; nothing reaches the array until Apply. Locking the
 * region the edit began in ends the session.
 */
export const StagedEdit: Story = {};
