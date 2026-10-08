import React from "react";
import { Platform, ScrollView, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  ControlContextProvider,
  getCompatContext,
  getCompatPatchInfo,
} from "@react-typed-forms/core";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  Contents,
  Form,
  FormProvider,
  TextDisplay,
  TextField,
  useFormValidation,
} from "@rx-controls/forms-react";
import { nativeRenderers } from "@rx-controls/forms-native";

/**
 * forms-native's playground: a Forms v2 form under the React Native
 * implementation, on the ServiceTas app's stack (React Native 0.81, React
 * 19.1, NativeWind 4), inside the compat engine's context as that app has it.
 */
function Playground(): Rendered {
  const { rc, rendered, update } = useReactive();
  const data = useControl({ name: "", email: "", reason: "" });
  const result = useControl<string | undefined>(undefined);
  const validation = useFormValidation();
  const f = data.fields;
  const info = getCompatPatchInfo();
  return rendered(
    <FormProvider renderers={nativeRenderers}>
      <ScrollView contentContainerClassName="gap-4 p-4 pt-16">
        <Form validation={validation}>
          <TextDisplay text="Forms v2 on React Native" heading />
          <TextDisplay
            text={`React ${React.version} · ${Platform.OS} · engine copies ${info.engineCopies}`}
          />
          <Contents title="Your details">
            <TextField
              field={f.name}
              label="Name"
              required
              helpText="As it appears on your licence."
            />
            <TextField
              field={f.email}
              label="Email"
              inputMode="email"
              helpText="We send the receipt here."
            />
            <TextField field={f.reason} label="Reason" multiline maxLength={50} showCount />
          </Contents>
          <Action
            actionId="check"
            text="Check"
            variant="primary"
            onClick={async () => {
              const ok = await validation.check();
              update((wc) => wc.setValue(result, ok ? "Valid" : "Invalid: errors shown"));
            }}
          />
          <TextDisplay
            text={(r) => r.getValue(result)}
            announce
            tone={(r) => (r.getValue(result)?.startsWith("Valid") ? "success" : "error")}
          />
        </Form>
        <Text selectable className="font-mono text-xs text-gray-500">
          {JSON.stringify(rc.getValue(data))}
        </Text>
      </ScrollView>
      <StatusBar style="dark" />
    </FormProvider>,
  );
}

export function App() {
  return (
    <ControlContextProvider value={getCompatContext()}>
      <Playground />
    </ControlContextProvider>
  );
}
