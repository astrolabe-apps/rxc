import type { Meta, StoryObj } from "@storybook/react-vite";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  InlineGroup,
  SelectField,
  TextDisplay,
  TextField,
  useWizard,
  Wizard,
} from "@rx-controls/forms-react";
import { Values, type ScopeArgs } from "../support";

function WizardDemo(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({
    last: "",
    status: undefined as string | undefined,
    email: "",
    reason: "",
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
            key: "reason",
            title: "Reason",
            // Only for an inactive status: otherwise Next and Back skip it.
            hidden: (rc) => rc.getValue(f.status) !== "inactive",
            children: <TextField field={f.reason} label="Why inactive?" required />,
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
 * The page index is bound to the data, so it survives a remount. The Reason
 * page is hidden unless the status is Inactive, and skipped while hidden.
 */
export const Wizard_: StoryObj<ScopeArgs> = { name: "Wizard" };

/** A page's own button, gated by the page's check, then a pretend server call. */
function Verify(): Rendered {
  const { rendered } = useReactive();
  const wizard = useWizard();
  return rendered(
    <InlineGroup>
      <Action
        actionId="verify"
        text="Verify licence"
        variant="primary"
        onClick={async () => {
          if (!(await wizard.next())) return;
          await new Promise((r) => setTimeout(r, 600));
        }}
      />
    </InlineGroup>,
  );
}

function Outcome(): Rendered {
  const { rendered } = useReactive();
  const wizard = useWizard();
  return rendered(
    <InlineGroup>
      <Action actionId="found" text="Licence found" onClick={() => wizard.goTo("found")} />
      <Action
        actionId="none"
        text="No licence"
        variant="secondary"
        onClick={() => wizard.goTo("none")}
      />
    </InlineGroup>,
  );
}

function HostDrivenDemo(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({ licence: "", page: 0 as number | undefined });
  const f = data.fields;
  return rendered(
    <>
      <Wizard
        navigation="none"
        page={f.page}
        items={[
          {
            key: "licence",
            title: "Licence",
            children: (
              <>
                <TextDisplay text="Your licence" heading />
                <TextField field={f.licence} label="Licence number" required />
                <Verify />
              </>
            ),
          },
          {
            key: "result",
            title: "Result",
            children: (
              <>
                <TextDisplay text="What did the server say?" heading />
                <Outcome />
              </>
            ),
          },
          { key: "found", title: "Found", children: <TextDisplay text="Licence linked." heading /> },
          { key: "none", title: "None", children: <TextDisplay text="We'll call you back." heading /> },
        ]}
      />
      <Values control={data} />
    </>,
  );
}

/**
 * `navigation="none"`: no step strip, no Back / Next. Each page's own actions
 * move the wizard through `useWizard()` — `next()` is the page's check, so
 * Verify refuses an empty licence; `goTo(key)` jumps to an outcome a server
 * call decided. Each page's title is a `heading` display.
 */
export const HostDriven: StoryObj<ScopeArgs> = { render: () => <HostDrivenDemo /> };
