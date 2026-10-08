import type { ReactNode } from "react";
import { ScrollView, Text } from "react-native";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { Action, Contents, Form, TextDisplay, useFormValidation } from "@rx-controls/forms-react";

/**
 * One screen: a scrolling form with a submit, and what it last said — so a
 * refused submit's focus and its reveal can be seen.
 */
export function Screen({ title, children }: { title: string; children: ReactNode }): Rendered {
  const { rendered, update } = useReactive();
  const validation = useFormValidation();
  const result = useControl<string | undefined>(undefined);
  return rendered(
    <ScrollView contentContainerClassName="gap-5 p-4 pb-24" keyboardShouldPersistTaps="handled">
      <Form
        validation={validation}
        onSubmit={() => update((wc) => wc.setValue(result, "Submitted"))}
      >
        {/* A region, so its parts are spaced as a group body spaces them. */}
        <Contents>
          <TextDisplay text={title} heading />
          {children}
          <Action actionId="submit" text="Submit" variant="primary" submit />
          <TextDisplay text={(rc) => rc.getValue(result)} announce tone="success" />
        </Contents>
      </Form>
    </ScrollView>,
  );
}

/** A value for the eye, under a screen. */
export function Shown({ value }: { value: unknown }) {
  return <Text className="font-mono text-xs text-gray-500">{JSON.stringify(value)}</Text>;
}
