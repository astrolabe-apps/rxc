import { ScrollView } from "react-native";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { PortableLooksDemo, portableLooks, portableTokens } from "rxc-forms-conformance/portable";

/**
 * The same form and the same look table Storybook draws under html
 * (`Boundaries/Portable looks`), drawn here on a device — to compare one
 * portable look across the two implementations.
 */
const theme = { tokens: { colors: portableTokens }, looks: portableLooks } as PartialNativeTheme;

export function Portable() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <NativeThemeProvider theme={theme}>
        <PortableLooksDemo />
      </NativeThemeProvider>
    </ScrollView>
  );
}
