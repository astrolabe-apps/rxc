import { useEffect, useState, type ComponentType } from "react";
import { Linking, LogBox, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { scenarioFromLink, type ScenarioLink } from "@rx-controls/forms-scenarios/app";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { ControlContextProvider, getCompatContext } from "@react-typed-forms/core";
import { FormProvider } from "@rx-controls/forms-react";
import { nativeRenderers } from "@rx-controls/forms-native";
import { KitchenSink } from "./screens/KitchenSink";
import { Fields } from "./screens/Fields";
import { Options } from "./screens/Options";
import { Displays } from "./screens/Displays";
import { Looks } from "./screens/Looks";
import { NativeLooks } from "./screens/NativeLooks";
import { Containers } from "./screens/Containers";
import { Collection } from "./screens/Collection";
import { FeedScreen } from "./screens/FeedScreen";
import { Converted } from "./screens/Converted";
import { Portable } from "./screens/Portable";

/**
 * A screen per story kind, as the Storybook has them — the same contract,
 * drawn by forms-native. No navigation library: a row of chips picks one.
 */
const screens: [string, ComponentType<any>][] = [
  ["Kitchen sink", KitchenSink],
  ["Fields", Fields],
  ["Options", Options],
  ["Displays", Displays],
  ["Looks", Looks],
  ["Portable", Portable],
  ["Native looks", NativeLooks],
  ["Containers", Containers],
  ["Collection", Collection],
  ["Feed", FeedScreen],
  ["Converted", Converted],
];

export function App() {
  const [at, setAt] = useState(0);
  // A form-scenario link (@rx-controls/forms-scenarios) opens a converted form with its data.
  const [scenario, setScenario] = useState<ScenarioLink | undefined>();
  useEffect(() => {
    const open = (url: string | null) => {
      const s = url ? scenarioFromLink(url) : undefined;
      if (!s) return;
      // Development overlays would cover the form a scenario reads; the warnings still reach Metro.
      LogBox.ignoreAllLogs(true);
      setScenario(s);
      setAt(screens.findIndex(([, C]) => C === Converted));
    };
    Linking.getInitialURL().then(open);
    const sub = Linking.addEventListener("url", (e) => open(e.url));
    return () => sub.remove();
  }, []);
  // The Converted screen draws ServiceTas's typography, which is Nunito.
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  if (!fontsLoaded) return null;
  const Screen = screens[at]![1];
  return (
    <ControlContextProvider value={getCompatContext()}>
      <FormProvider renderers={nativeRenderers}>
        <View style={styles.root}>
          <ScrollView
            horizontal
            style={styles.chips}
            contentContainerStyle={styles.chipRow}
          >
            {screens.map(([name], i) => (
              <Pressable
                key={name}
                role="tab"
                aria-selected={i === at}
                onPress={() => setAt(i)}
                style={[styles.chip, i === at && styles.chipOn]}
              >
                <Text style={i === at ? styles.chipTextOn : styles.chipText}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {/* Keyed, so a screen starts fresh each time it is picked. */}
          {Screen === Converted ? <Converted key={at} scenario={scenario} /> : <Screen key={at} />}
        </View>
        <StatusBar style="dark" />
      </FormProvider>
    </ControlContextProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingTop: 48 },
  chips: { maxHeight: 48, flexGrow: 0, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  chipRow: { alignItems: "center", gap: 8, paddingHorizontal: 12 },
  chip: { borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "#f3f4f6" },
  chipOn: { backgroundColor: "#2563eb" },
  chipText: { color: "#1f2937" },
  chipTextOn: { color: "#fff" },
});
