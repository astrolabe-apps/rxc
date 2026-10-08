import { useState } from "react";
import {
  ControlContextProvider,
  createControlContext,
  useControl,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import {
  Action,
  CheckboxField,
  Contents,
  Dialog,
  DisplayOnlyField,
  Elements,
  Form,
  FormProvider,
  HtmlDisplay,
  IconDisplay,
  InlineGroup,
  RadioField,
  Section,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  Wizard,
} from "@rx-controls/forms-react";
import { htmlRenderers, HtmlThemeProvider, tailwindHtmlTheme } from "../../src/index";

const options = [
  { name: "Active", value: "active" },
  { name: "Inactive", value: "inactive" },
];

/** Every renderer the html implementation has, in one form. */
function Kitchen(): Rendered {
  const { rendered } = useReactive();
  const data = useControl({
    name: "Ada",
    notes: "",
    status: "active" as string | undefined,
    agreed: false,
    joined: "2024-03-09",
    pets: [{ name: "Rex" }, { name: "Tiddles" }],
    hidden: "",
  });
  const open = useControl(false);
  const f = data.fields;
  return rendered(
    <Form>
      <div className="flex flex-col gap-2">
        {/* No `id`: the boundary's useId has to agree across server and client. */}
        <TextField field={f.name} label="Name" required helpText="Help" />
        <TextField field={f.notes} label="Notes" multiline />
        <SelectField field={f.status} label="Status" options={options} />
        <RadioField field={f.status} label="Status (radios)" options={options}>
          {(o, selected) => (
            <Contents hidden={!selected}>
              <TextDisplay text={`${o.name} chosen`} />
            </Contents>
          )}
        </RadioField>
        <CheckboxField field={f.agreed} label="Agreed" />
        <DisplayOnlyField field={f.joined} label="Joined" />
        <InlineGroup>
          <TextDisplay text="Hello " />
          <DisplayOnlyField field={f.name} />
        </InlineGroup>
        <HtmlDisplay html="<em>markup</em>" />
        <IconDisplay icon={<span aria-hidden>★</span>} accessibleName="Star" />
        <Contents hidden title="Hidden region">
          <TextField field={f.hidden} label="Hidden" />
        </Contents>
        <Section>
          <TextDisplay text="Step 1 of 2" />
          {/* Its claim on the section runs in a commit effect, never on the server. */}
          <TextDisplay text="Section" heading="group" />
          <Contents title="Inside">{null}</Contents>
          <Elements field={f.pets} label="Pets">
            {(p, i) => <TextField field={p.fields.name} label={`Pet ${i + 1}`} />}
          </Elements>
        </Section>
        <Tabs
          items={[
            { key: "a", title: "A", children: <TextDisplay text="Tab A" /> },
            { key: "b", title: "B", children: <TextField field={f.notes} label="Notes" /> },
          ]}
        />
        <Wizard
          items={[
            { key: "p1", title: "One", children: <TextDisplay text="Page 1" /> },
            { key: "p2", title: "Two", children: <TextDisplay text="Page 2" /> },
          ]}
        />
        <Action actionId="open" text="Open" onClick={() => {}} />
        <Dialog open={open} title="Details">
          <TextField field={f.name} label="Name in dialog" />
        </Dialog>
      </div>
    </Form>,
  );
}

/**
 * An app root the way SSR runs one: a control context per render — the
 * server's and the client's are separate — and the implementation above it.
 */
export function SsrApp() {
  const [ctx] = useState(createControlContext);
  return (
    <ControlContextProvider value={ctx}>
      <FormProvider renderers={htmlRenderers}>
        <HtmlThemeProvider theme={tailwindHtmlTheme}>
          <Kitchen />
        </HtmlThemeProvider>
      </FormProvider>
    </ControlContextProvider>
  );
}
