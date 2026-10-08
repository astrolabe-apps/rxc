import React from "react";
import { Platform, ScrollView, Text } from "react-native";
import { getCompatPatchInfo } from "@react-typed-forms/core";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  CheckboxField,
  CheckListField,
  Contents,
  Dialog,
  Disclosure,
  DisplayOnlyField,
  Form,
  InlineGroup,
  RadioField,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  useFormValidation,
} from "@rx-controls/forms-react";
import { NativeThemeProvider } from "@rx-controls/forms-native";

const states = [
  { name: "Tasmania", value: "TAS" },
  { name: "Victoria", value: "VIC" },
  { name: "New South Wales", value: "NSW" },
];
const yesNo = [
  { name: "Yes", value: true },
  { name: "No", value: false },
];
const reasons = [
  { name: "Recreation", value: "rec" },
  { name: "Commercial", value: "com" },
  { name: "Other", value: "other" },
];

/**
 * Every widget kind in one form, inside the compat engine's context as a
 * ServiceTas app has it.
 */
export function KitchenSink(): Rendered {
  const { rc, rendered, update } = useReactive();
  const data = useControl({
    name: "",
    email: "",
    state: undefined as string | undefined,
    hasLicence: undefined as boolean | undefined,
    licence: "",
    uvi: false,
    reasons: [] as string[],
    phone: "",
  });
  const address = useControl("12 Main St, Hobart");
  const dialogOpen = useControl(false);
  const result = useControl<string | undefined>(undefined);
  const validation = useFormValidation();
  const f = data.fields;
  const info = getCompatPatchInfo();
  return rendered(
    // Checkboxes as on/off settings: the theme's switch.
    <NativeThemeProvider theme={{ checkbox: { control: "switch" } }}>
      <ScrollView contentContainerClassName="gap-5 p-4 pb-24">
          <Form
            validation={validation}
            onSubmit={() => update((wc) => wc.setValue(result, "Submitted"))}
          >
            <TextDisplay text="Forms v2 on React Native" heading />
            <TextDisplay
              text={`React ${React.version} · ${Platform.OS} · engine copies ${info.engineCopies}`}
            />
            <Tabs
              items={[
                {
                  key: "you",
                  title: "You",
                  children: (
                    <Contents title="Your details">
                      <TextField
                        field={f.name}
                        label="Name"
                        required
                        helpText="As it appears on your licence."
                      />
                      <TextField field={f.email} label="Email" inputMode="email" />
                      <SelectField field={f.state} label="State" options={states} required />
                      <DisplayOnlyField
                        field={address}
                        label="Postal address"
                        startIcon={<Text>{"•"}</Text>}
                      />
                    </Contents>
                  ),
                },
                {
                  key: "licence",
                  title: "Licence",
                  children: (
                    <Contents title="Your licence">
                      <RadioField
                        field={f.hasLicence}
                        label="Do you hold a licence?"
                        options={yesNo}
                        required
                      >
                        {(o, selected) =>
                          o.value === true && selected ? (
                            <TextField field={f.licence} label="Licence number" required />
                          ) : null
                        }
                      </RadioField>
                      <CheckboxField
                        field={f.uvi}
                        label="Commercial vessel"
                        helpText="A Unique Vessel Identifier is issued by AMSA."
                        helpPlacement="labelEnd"
                      />
                      <CheckListField
                        field={f.reasons}
                        label="Why do you need it?"
                        options={reasons}
                        required
                      />
                      <Disclosure title="Need a callback?">
                        <TextField field={f.phone} label="Phone" inputMode="tel" required />
                      </Disclosure>
                    </Contents>
                  ),
                },
              ]}
            />
            <InlineGroup>
              <TextDisplay text="Read the" />
              <Action
                actionId="terms"
                text="terms"
                variant="link"
                onClick={() => update((wc) => wc.setValue(dialogOpen, true))}
              />
              <TextDisplay text="before you submit." />
            </InlineGroup>
            <Dialog
              open={dialogOpen}
              onClose={() => update((wc) => wc.setValue(dialogOpen, false))}
              title="Terms"
            >
              <TextDisplay text="Your details are used only to process this request." />
            </Dialog>
            <Action actionId="submit" text="Submit" variant="primary" submit />
            <TextDisplay
              text={(r) => r.getValue(result)}
              announce
              tone="success"
            />
          </Form>
          <Text selectable className="font-mono text-xs text-gray-500">
            {JSON.stringify(rc.getValue(data))}
          </Text>
      </ScrollView>
    </NativeThemeProvider>,
  );
}
