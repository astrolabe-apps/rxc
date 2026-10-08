import { useControl, type Rendered, useReactive } from "@rx-controls/react";
import { CheckListField, Contents, RadioField, SelectField, TextField } from "@rx-controls/forms-react";
import { Screen, Shown } from "./Screen";

const states = [
  { name: "Tasmania", value: "TAS" },
  { name: "Victoria", value: "VIC" },
];
const sizes = [
  { name: "Under 6m", value: 1 },
  { name: "6m to 12m", value: 2 },
  { name: "Over 12m", value: 3 },
];

/** A select, a radio with per-option content, a check list. */
export function Options(): Rendered {
  const { rc, rendered } = useReactive();
  const data = useControl({
    state: undefined as string | undefined,
    size: undefined as number | undefined,
    length: "",
    uses: [] as number[],
  });
  const f = data.fields;
  return rendered(
    <Screen title="Options">
      <Contents>
        <SelectField field={f.state} label="State" options={states} required />
        <RadioField field={f.size} label="Vessel size" options={sizes} required>
          {(o, selected) =>
            o.value === 3 && selected ? <TextField field={f.length} label="Length in metres" required /> : null
          }
        </RadioField>
        <CheckListField field={f.uses} label="Used for" options={sizes} required />
      </Contents>
      <Shown value={rc.getValue(data)} />
    </Screen>,
  );
}
