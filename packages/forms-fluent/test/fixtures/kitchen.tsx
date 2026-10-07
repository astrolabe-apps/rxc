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
import {
  FluentProvider,
  RendererProvider,
  SSRProvider,
  webLightTheme,
  type GriffelRenderer,
} from "@fluentui/react-components";
import { fluentRenderers } from "../../src/index";

const options = [
  { name: "Active", value: "active" },
  { name: "Inactive", value: "inactive" },
];

/** Every renderer the Fluent implementation has, in one form. */
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
      <div>
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
        <Section title="Section">
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
 * With `renderer`, the way a Fluent app runs one: Griffel's renderer (so the
 * server can emit the CSS), `SSRProvider` and the app's own `FluentProvider`,
 * which the implementation's root must use rather than replace. Without, the
 * root supplies the provider itself.
 */
export function SsrApp({ renderer }: { renderer?: GriffelRenderer }) {
  const [ctx] = useState(createControlContext);
  const form = (
    <ControlContextProvider value={ctx}>
      <FormProvider renderers={fluentRenderers}>
        <Kitchen />
      </FormProvider>
    </ControlContextProvider>
  );
  if (!renderer) return form;
  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <FluentProvider theme={webLightTheme}>{form}</FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
