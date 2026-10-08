import { useState, type ComponentType } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ControlContextProvider, getCompatContext } from "@react-typed-forms/core";
import { FormProvider } from "@rx-controls/forms-react";
import { nativeRenderers } from "@rx-controls/forms-native";
import { KitchenSink } from "./screens/KitchenSink";
import { Fields } from "./screens/Fields";
import { Options } from "./screens/Options";
import { Displays } from "./screens/Displays";
import { Looks } from "./screens/Looks";
import { Containers } from "./screens/Containers";
import { Collection } from "./screens/Collection";

/**
 * A screen per story kind, as the Storybook has them — the same contract,
 * drawn by forms-native. No navigation library: a row of chips picks one.
 */
const screens: [string, ComponentType][] = [
  ["Kitchen sink", KitchenSink],
  ["Fields", Fields],
  ["Options", Options],
  ["Displays", Displays],
  ["Looks", Looks],
  ["Containers", Containers],
  ["Collection", Collection],
];

export function App() {
  const [at, setAt] = useState(0);
  const Screen = screens[at]![1];
  return (
    <ControlContextProvider value={getCompatContext()}>
      <FormProvider renderers={nativeRenderers}>
        <View className="flex-1 bg-white pt-12">
          <ScrollView
            horizontal
            className="max-h-12 grow-0 border-b border-gray-200"
            contentContainerClassName="items-center gap-2 px-3"
          >
            {screens.map(([name], i) => (
              <Pressable
                key={name}
                role="tab"
                aria-selected={i === at}
                onPress={() => setAt(i)}
                className={`rounded-full px-3 py-1 ${i === at ? "bg-blue-600" : "bg-gray-100"}`}
              >
                <Text className={i === at ? "text-white" : "text-gray-800"}>{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {/* Keyed, so a screen starts fresh each time it is picked. */}
          <Screen key={at} />
        </View>
        <StatusBar style="dark" />
      </FormProvider>
    </ControlContextProvider>
  );
}
