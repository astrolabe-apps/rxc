import { useControl, type Rendered, useReactive } from "@rx-controls/react";
import { CheckboxField, Contents, TextField } from "@rx-controls/forms-react";
import { Screen, Shown } from "./Screen";

/** Text fields, help at the label's end, both sides of a checkbox, a hidden label, a count. */
export function Fields(): Rendered {
  const { rc, rendered } = useReactive();
  const data = useControl({ name: "", uvi: "", agree: false, commercial: false, search: "", note: "" });
  const f = data.fields;
  return rendered(
    <Screen title="Fields">
      <Contents title="You">
        <TextField field={f.name} label="Name" required helpText="As it appears on your licence." />
        <TextField
          field={f.uvi}
          label="Unique Vessel Identifier"
          helpText="A Unique Vessel Identifier is issued by AMSA."
          helpPlacement="labelEnd"
        />
        <TextField field={f.search} label="Search" hideLabel placeholder="Search by name" />
        <TextField field={f.note} label="Note" multiline maxLength={40} showCount />
      </Contents>
      <Contents title="Checkboxes">
        {/* After (the default): box, words, help. */}
        <CheckboxField
          field={f.agree}
          label="I agree to the terms"
          helpText="You can read them on the website."
          helpPlacement="labelEnd"
          required
        />
        {/* Before: words, help, then the control at the row's end. */}
        <CheckboxField
          field={f.commercial}
          label="Commercial vessel"
          helpText="Used for hire or reward."
          helpPlacement="labelEnd"
          labelPosition="before"
        />
      </Contents>
      <Shown value={rc.getValue(data)} />
    </Screen>,
  );
}
