import { useEffect, useMemo, useState } from "react";
import { FORM_TEST_ID, report, type ScenarioLink } from "@rx-controls/forms-scenarios/app";
import { ScrollView, Text, View } from "react-native";
import { FormPicker } from "../FormPicker";
import { Form, FormIconsProvider, RichText } from "@rx-controls/forms-react";
import { useControl, useControlEffect } from "@rx-controls/react";
import { JsonForm, metaFields } from "@rx-controls/forms-json";
import { useControlContext } from "@rx-controls/react";
import type { ReadContext } from "@rx-controls/core";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { nativeStandInHost } from "../host";
import { DatePickerHost } from "../DatePickerHost";
import { fontAwesomeIcons } from "../icons/fontAwesome";
import { serviceTasNativeTheme } from "../../../../packages/forms-native/test/fixtures/serviceTasTheme";

/**
 * Legacy forms converted offline (`rushx convert-looks` in tools/forms-corpus,
 * then `rushx sync-converted` here), drawn with the generated native looks under
 * ServiceTas's own native theme (`forms-native`'s test fixture):
 * the forms name their looks and the theme's table says what each draws.
 * The data is another repository's, gitignored; without it this screen says so.
 */
type Data = {
  looks: NonNullable<PartialNativeTheme["looks"]>;
  forms: Record<string, { controls: any[]; fields?: any[] }>;
  tokens: Record<string, string>;
};

function load(): Data | undefined {
  try {
    return {
      // optional requires: absent until `sync-converted` has run
      looks: require("../converted/looks.local.js").looks,
      forms: require("../converted/forms.local.json"),
      tokens: require("../converted/tokens.local.json"),
    };
  } catch {
    return undefined;
  }
}
const data = load();

export function Converted({ scenario }: { scenario?: ScenarioLink }) {
  const names = data ? Object.keys(data.forms) : [];
  const [at, setAt] = useState(scenario?.form ?? names[0]);
  // A scenario opens its form with its data, under its run.
  const [opened, setOpened] = useState<ScenarioLink | undefined>(scenario);
  useEffect(() => {
    if (!scenario) return;
    setAt(scenario.form);
    setOpened(scenario);
  }, [scenario]);
  if (!data || !at)
    return (
      <Text style={{ padding: 16 }}>
        No converted forms. In tools/forms-corpus run `rushx convert-looks`, then `rushx sync-converted` here.
      </Text>
    );
  // ServiceTas's own native theme (a fixture), with the converted forms' looks over it.
  const theme: PartialNativeTheme = { tokens: { colors: data.tokens }, looks: data.looks, date: { picker: DatePickerHost } };
  return (
    <View style={{ flex: 1 }}>
      <FormPicker
        names={names}
        value={at}
        onChange={(n) => {
          setAt(n);
          setOpened(undefined);
        }}
      />
      {/* The app's icons: Font Awesome (Pro with a ServiceTas checkout beside the repo). */}
      <FormIconsProvider set={fontAwesomeIcons}>
        <NativeThemeProvider theme={serviceTasNativeTheme}>
          <NativeThemeProvider theme={theme}>
            <ConvertedForm
              key={`${at}:${opened?.run ?? ""}`}
              name={at}
              form={data.forms[at]!}
              initial={opened?.form === at ? opened.data : {}}
              run={opened?.form === at ? opened.run : ""}
            />
          </NativeThemeProvider>
        </NativeThemeProvider>
      </FormIconsProvider>
    </View>
  );
}

// ServiceTas took up legacy's html titles (`1m<sup>3</sup>`), so a host draws them as rich text.
const displayText = (text: string) => <RichText html={text} />;

/** Whether a form draws a feed (`ScrollList`): a list that scrolls itself. */
const hasFeed = (controls: any[]): boolean =>
  controls.some((c) => c?.renderOptions?.type === "ScrollList" || hasFeed(c?.children ?? []));

function ConvertedForm({
  name,
  form,
  initial,
  run,
}: {
  name: string;
  form: { controls: any[]; fields?: any[] };
  initial: unknown;
  run: string;
}) {
  const value = useControl<unknown>(initial ?? {});
  const ctx = useControlContext();
  // ServiceTas's bindings: `$meta` is the loader's meta store, `$platform` the device.
  const variables = useMemo(
    () => (rc: ReadContext) => ({ meta: rc.getValue(metaFields(ctx, value)), platform: "mobile" }),
    [ctx, value],
  );
  // What a scenario reads back: drawn, the data as it changes, each action.
  useControlEffect((rc) => rc.getValue(value), (v) => report(run, { kind: "data", data: v }), true);
  useEffect(() => report(run, { kind: "ready", form: name }), [run, name]);
  const action = useMemo(
    () => (actionId: string, actionData: unknown) => () => report(run, { kind: "action", actionId, data: actionData }),
    [run],
  );
  const body = (
    <Form clearHidden>
      <JsonForm {...nativeStandInHost} controls={form.controls} schema={form.fields ?? []} data={value} actionHandler={action} displayText={displayText} variables={variables} />
    </Form>
  );
  // A feed is its own scroll container (a FlatList), as legacy's ScrollList was: inside
  // another vertical ScrollView it would not virtualise and React Native warns.
  return hasFeed(form.controls) ? (
    <View testID={FORM_TEST_ID} style={{ flex: 1, paddingHorizontal: 16 }}>{body}</View>
  ) : (
    <ScrollView testID={FORM_TEST_ID} contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>{body}</ScrollView>
  );
}
