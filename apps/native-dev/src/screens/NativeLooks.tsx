import type { ReactNode } from "react";
import { Action, Contents, TextDisplay, TextField } from "@rx-controls/forms-react";
import { useControl } from "@rx-controls/react";
import { NativeThemeProvider, type PartialNativeTheme } from "@rx-controls/forms-native";
import { Screen } from "./Screen";

/**
 * Looks with colour tokens and state: a function of the element's state
 * (`focused`, `invalid`, `pressed`, `width` …) returning styles, from
 * `theme.looks`. `docs/FORMS-V2-LOOKS.md`.
 */
const theme: PartialNativeTheme = {
  tokens: { colors: { accent: "#1d4ed8", danger: "#dc2626", ink: "#111827" } },
  looks: {
    card: {
      shell: { backgroundColor: "#f3f4f6", padding: 16, borderRadius: 12 },
      label: { marginBottom: 4 },
      labelText: { fontSize: 18, fontWeight: "bold", color: "$ink" },
    },
    field: {
      shell: { backgroundColor: "$accent/10", padding: 8, borderRadius: 8 },
      control: (s) => ({
        borderWidth: 2,
        borderColor: s.invalid ? "$danger" : s.focused ? "$accent" : "#9ca3af",
        borderRadius: 6,
        color: "$accent",
        fontSize: 18,
      }),
      labelText: { color: "$accent", fontWeight: "bold" },
    },
    pill: {
      shell: { alignSelf: "flex-start" },
      control: (s) => ({
        backgroundColor: s.pressed ? "$danger" : "$accent",
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 10,
        opacity: s.disabled ? 0.5 : 1,
      }),
      text: { color: "#ffffff", fontWeight: "bold" },
    },
    tag: {
      control: {
        alignSelf: "flex-start",
        backgroundColor: "$danger/10",
        paddingHorizontal: 5,
        paddingVertical: 3,
        color: "$danger",
        fontSize: 12,
      },
    },
  },
};

/** Looks on a device: shell, frame, label and input text, a state-dependent button. */
export function NativeLooks(): ReactNode {
  const name = useControl("");
  return (
    <NativeThemeProvider theme={theme}>
      <Screen title="Native looks">
        <TextDisplay text="NEW" look="tag" />
        <Contents look="card" title="A card">
          <TextDisplay text="Padding, tint and radius on the wrapper; a bold title." />
          <TextDisplay
            text="The author's style wins: 22px, bold."
            style={{ fontSize: 22, fontWeight: "bold" }}
          />
        </Contents>
        <TextField
          field={name}
          label="Name"
          look="field"
          required
          helpText="Border follows focus and error; the input's colour is a token."
        />
        <Action actionId="pill" text="Press and hold me" look="pill" />
        <Action actionId="wide" text="shellStyle stretches me" shellStyle={{ alignSelf: "stretch" }} />
      </Screen>
    </NativeThemeProvider>
  );
}
