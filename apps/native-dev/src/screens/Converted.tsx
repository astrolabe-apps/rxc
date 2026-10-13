import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Form } from "@rx-controls/forms-react";
import { useControl } from "@rx-controls/react";
import { JsonForm } from "@rx-controls/forms-json";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";

/**
 * Legacy forms converted offline (`rushx convert-looks` in tools/forms-corpus,
 * then `rushx sync-converted` here), drawn with the generated native looks:
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
  const theme: PartialNativeTheme = { tokens: { colors: data.tokens }, looks: data.looks };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, padding: 8 }}>
        {names.map((n) => (
          <Pressable key={n} onPress={() => setAt(n)} style={{ padding: 6, borderRadius: 6, backgroundColor: n === at ? "#111827" : "#e5e7eb" }}>
            <Text style={{ color: n === at ? "#fff" : "#111827" }}>{n}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <NativeThemeProvider theme={theme}>
        <ConvertedForm key={at} form={data.forms[at]!} />
      </NativeThemeProvider>
    </View>
  );
}

// The loader's default icon is a DOM <i>, which React Native cannot draw: a native host supplies its own.
const noIcon = () => null;

function ConvertedForm({ form }: { form: { controls: any[]; fields?: any[] } }) {
  const value = useControl<unknown>({});
  const action = useMemo(() => () => () => {}, []);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
      <Form clearHidden>
        <JsonForm controls={form.controls} schema={form.fields ?? []} data={value} actionHandler={action} icon={noIcon} />
      </Form>
    </ScrollView>
  );
}
