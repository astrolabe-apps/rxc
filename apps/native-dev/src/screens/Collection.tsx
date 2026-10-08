import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { Action, Contents, Elements, TextField } from "@rx-controls/forms-react";
import { Screen, Shown } from "./Screen";

/** A list of rows over an array, each with its own Remove, and an Add. */
export function Collection(): Rendered {
  const { rc, rendered, update } = useReactive();
  const pets = useControl<{ name: string }[]>([{ name: "Rex" }]);
  return rendered(
    <Screen title="Collection">
      <Elements field={pets} label="Pets" minLength={1} maxLength={4}>
        {(pet, i, actions) => (
          <Contents>
            <TextField field={pet.fields.name} label={`Pet ${i + 1}`} required />
            <Action
              actionId="remove"
              text="Remove"
              variant="link"
              disabled={!actions.canRemove}
              onClick={() => actions.remove(i)}
            />
          </Contents>
        )}
      </Elements>
      <Action
        actionId="add"
        text="Add a pet"
        disabled={(r) => r.getValue(pets).length >= 4}
        onClick={() => update((wc) => wc.updateValue(pets, (p) => [...p, { name: "" }]))}
      />
      <Shown value={rc.getValue(pets)} />
    </Screen>,
  );
}
