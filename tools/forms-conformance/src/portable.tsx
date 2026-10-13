import { useEffect, type ReactNode } from "react";
import { useControl, useControlContext } from "@rx-controls/react";
import {
  Action,
  CheckboxField,
  CheckListField,
  Contents,
  DisplayOnlyField,
  RadioField,
  SelectField,
  TextDisplay,
  TextField,
} from "@rx-controls/forms-react";
import type { LookState, PortableStyle } from "@rx-controls/forms-react";

/**
 * One form, one set of looks written once as portable styles, for drawing the
 * same thing under two implementations and comparing: Storybook (html) and
 * the native playground. Only `forms-react` and plain data — no DOM, no React
 * Native — so the identical source renders under both.
 *
 * `portableLooks` is a table of parts, valid as an html theme's `looks` and a
 * native theme's `looks` alike; `portableTokens` are the colours they name.
 */
type Part = PortableStyle | ((s: LookState) => PortableStyle);

export const portableTokens = {
  ink: "#111827",
  accent: "#0f766e",
  danger: "#b91c1c",
  paper: "#f1f5f9",
};

export const portableLooks: Record<string, Record<string, Part>> = {
  card: {
    shell: {
      backgroundColor: "$paper",
      borderWidth: 1,
      borderColor: "$ink/20",
      borderRadius: 12,
      padding: 16,
    },
    control: { gap: 12 },
    labelText: { fontSize: 20, fontWeight: "700", color: "$ink", letterSpacing: 0.2 },
  },
  // A parent places its children (`alignItems`), as here: a child's own
  // `alignSelf` / `flex` reaches the flex item on a device, but on the web a
  // wrapper sits between the body and the child and is the item instead.
  start: { control: { alignItems: "flex-start" } },
  tag: {
    control: {
      backgroundColor: "$accent/15",
      color: "$accent",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
  },
  lead: { control: { fontSize: 18, lineHeight: 26, color: "$ink" } },
  note: { control: { fontStyle: "italic", color: "$ink/60", fontSize: 13 } },
  underlined: { control: { textDecorationLine: "underline", color: "$accent", fontWeight: "600" } },
  field: {
    shell: { gap: 4 },
    control: (s) => ({
      borderWidth: 2,
      borderRadius: 8,
      borderColor: s.invalid ? "$danger" : s.focused ? "$accent" : "$ink/30",
      backgroundColor: "#ffffff",
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: "$ink",
    }),
    labelText: { fontSize: 13, fontWeight: "600", color: "$ink/70" },
  },
  // Choices: the options spaced, their words in ink.
  choice: {
    shell: { gap: 4 },
    control: { gap: 6 },
    text: { fontSize: 15, color: "$ink" },
    labelText: { fontSize: 13, fontWeight: "600", color: "$ink/70" },
  },
  readout: {
    shell: { gap: 4 },
    control: { backgroundColor: "$accent/15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    text: { fontSize: 15, fontWeight: "600", color: "$accent" },
    labelText: { fontSize: 13, fontWeight: "600", color: "$ink/70" },
  },
  button: {
    control: (s) => ({
      backgroundColor: s.pressed ? "$accent/70" : "$accent",
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 10,
      opacity: s.disabled ? 0.5 : 1,
    }),
    text: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  },
  row: {
    control: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center" },
  },
  responsive: {
    control: (s) => ({ flexDirection: s.width >= 600 ? "row" : "column", gap: 12 }),
  },
};

/** The demo form: every look above, in a card. */
export function PortableLooksDemo(): ReactNode {
  const name = useControl("");
  const email = useControl("not an email");
  const ctx = useControlContext();
  // An error published and shown from the start, so the invalid look is on screen.
  useEffect(
    () =>
      ctx.update((wc) => {
        wc.setError(email, "demo", "Not a valid email address");
        wc.setTouched(email, true);
      }),
    [ctx, email],
  );
  return (
    <Contents title="Portable looks" look="card">
      <Contents look="start">
        <TextDisplay text="Declared" look="tag" />
      </Contents>
      <TextDisplay text="One look table, drawn by two implementations." look="lead" />
      <TextField field={name} label="Name" look="field" />
      <TextField field={email} label="Email (shown invalid)" look="field" />
      <SelectField
        field={useControl("b")}
        label="Choose one"
        look="field"
        options={[
          { name: "Alpha", value: "a" },
          { name: "Beta", value: "b" },
        ]}
      />
      <RadioField
        field={useControl("a")}
        label="Radio"
        look="choice"
        options={[
          { name: "Alpha", value: "a" },
          { name: "Beta", value: "b" },
        ]}
      />
      <CheckListField
        field={useControl<string[]>(["b"])}
        label="Check list"
        look="choice"
        options={[
          { name: "Alpha", value: "a" },
          { name: "Beta", value: "b" },
        ]}
      />
      <CheckboxField field={useControl(true)} label="Checkbox" look="choice" />
      <DisplayOnlyField field={useControl("Read-only value")} label="Display only" look="readout" />
      <Contents look="row">
        <Action actionId="save" text="Save" look="button" />
        <TextDisplay text="Press and hold the button" look="note" />
      </Contents>
      <Contents look="responsive">
        <TextDisplay text="Narrow: stacked" look="underlined" />
        <TextDisplay text="Wide (≥ 600): in a row" look="underlined" />
      </Contents>
    </Contents>
  );
}
