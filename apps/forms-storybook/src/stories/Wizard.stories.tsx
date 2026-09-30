import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { SelectField, TextField, Wizard } from "@rx-controls/forms-react";
import { Values, type ScopeArgs } from "../support";

function WizardDemo(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({
    last: "",
    status: undefined as string | undefined,
    email: "",
    page: 0 as number | undefined,
  });
  const f = data.fields;
  return rendered(
    <>
      <Wizard
        validationKey="signup"
        page={f.page}
        items={[
          {
            key: "who",
            title: "Who",
            children: (
              <>
                <TextField
                  field={f.last}
                  label="Last name"
                  required
                  helpText="An 800 ms check — Next waits for it, then refuses Smith."
                  validate={{
                    taken: async (v) => {
                      await new Promise((r) => setTimeout(r, 800));
                      return v?.trim().toLowerCase() === "smith"
                        ? "Smith is taken — try another"
                        : null;
                    },
                  }}
                />
                <SelectField
                  field={f.status}
                  label="Status"
                  required
                  options={[
                    { name: "Active", value: "active" },
                    { name: "Inactive", value: "inactive" },
                  ]}
                />
              </>
            ),
          },
          {
            key: "detail",
            title: "Detail",
            children: <TextField field={f.email} label="Email" required />,
          },
        ]}
      />
      <Values control={data} />
    </>,
  );
}

const meta: Meta<ScopeArgs> = {
  title: "Containers/Wizard",
  render: () => <WizardDemo />,
};
export default meta;

/**
 * Next checks the page — waiting for async rules — and touches it on refusal.
 * The page index is bound to the data, so it survives a remount.
 */
export const Wizard_: StoryObj<ScopeArgs> = { name: "Wizard" };
