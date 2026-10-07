import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { Disclosure, TextDisplay, TextField } from "@rx-controls/forms-react";
import { CheckForm, Values, type ScopeArgs } from "../support";

function DisclosureDemo(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ licence: "", note: "" });
  const f = data.fields;
  return rendered(
    <>
      <TextField field={f.licence} label="Licence number" />
      <Disclosure title="How to find this">
        <TextDisplay text="Your licence number is on the back of your card, under the photo." />
      </Disclosure>
      <Disclosure title="Add a note for the assessor">
        <TextField field={f.note} label="Note" required />
      </Disclosure>
      <CheckForm />
      <Values control={data} />
    </>,
  );
}

const meta: Meta<ScopeArgs> = {
  title: "Containers/Disclosure",
  render: () => <DisclosureDemo />,
};
export default meta;

/**
 * A title that shows or hides its content. Closed, the content is `silent` —
 * mounted, still validating — so Check refuses the required note in a
 * disclosure nobody opened and marks its toggle. (A `<Form onSubmit>`
 * refused the same way also opens it to focus the field.)
 */
export const Disclosure_: StoryObj<ScopeArgs> = { name: "Disclosure" };
