import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { Tabs, TextField } from "@rx-controls/forms-react";
import { CheckForm, Values, type ScopeArgs } from "../support";

function TabsDemo(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ first: "", email: "", notes: "" });
  const f = data.fields;
  return rendered(
    <>
      <Tabs
        validationKey="main"
        items={[
          {
            key: "details",
            title: "Details",
            children: <TextField field={f.first} label="First name" />,
          },
          {
            key: "contact",
            title: "Contact",
            children: (
              <TextField
                field={f.email}
                label="Email"
                required
                helpText="Required on an inactive tab: it still validates, and the tab is marked."
              />
            ),
          },
          {
            key: "notes",
            title: "Notes",
            children: <TextField field={f.notes} label="Notes" multiline />,
          },
        ]}
      />
      <CheckForm />
      <Values control={data} />
    </>,
  );
}

const meta: Meta<ScopeArgs> = {
  title: "Containers/Tabs",
  render: () => <TabsDemo />,
};
export default meta;

/** Inactive panels are `silent`: mounted, off screen, still validating. */
export const Tabs_: StoryObj<ScopeArgs> = { name: "Tabs" };
