import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Form, FormIconsProvider, RichText } from "@rx-controls/forms-react";
import { useControl } from "@rx-controls/react";
import { JsonForm } from "@rx-controls/forms-json";
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

export function Converted() {
  const names = data ? Object.keys(data.forms) : [];
  const [at, setAt] = useState(names[0]);
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 8 }}>
        {names.map((n) => (
          <Pressable key={n} onPress={() => setAt(n)} style={{ padding: 6, borderRadius: 6, backgroundColor: n === at ? "#111827" : "#e5e7eb" }}>
            <Text style={{ color: n === at ? "#fff" : "#111827" }}>{n}</Text>
          </Pressable>
        ))}
      </View>
      {/* The app's icons: Font Awesome (Pro with a ServiceTas checkout beside the repo). */}
      <FormIconsProvider set={fontAwesomeIcons}>
        <NativeThemeProvider theme={serviceTasNativeTheme}>
          <NativeThemeProvider theme={theme}>
            <ConvertedForm key={at} form={data.forms[at]!} />
          </NativeThemeProvider>
        </NativeThemeProvider>
      </FormIconsProvider>
    </View>
  );
}

// ServiceTas took up legacy's html titles (`1m<sup>3</sup>`), so a host draws them as rich text.
const displayText = (text: string) => <RichText html={text} />;

function ConvertedForm({ form }: { form: { controls: any[]; fields?: any[] } }) {
  const value = useControl<unknown>({});
  const action = useMemo(() => () => () => {}, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
      <Form clearHidden>
        <JsonForm {...nativeStandInHost} controls={form.controls} schema={form.fields ?? []} data={value} actionHandler={action} displayText={displayText} />
      </Form>
    </ScrollView>
  );
}
