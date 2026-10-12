import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
} from "@rx-controls/react";
import {
  CheckboxField,
  Form,
  FormProvider,
  RadioField,
  TextField,
} from "@rx-controls/forms-react";
import { NativeThemeProvider, nativeRenderers } from "../src/index";

// What the implementation hands React Native's views, on each render.
const seen = vi.hoisted(
  () => [] as { type: string; props: Record<string, unknown> }[],
);
vi.mock("react-native", async (original) => {
  // Imported here, as the factory is hoisted above the file's imports
  const rn = await original<typeof import("react-native")>();
  const { createElement, forwardRef } = await import("react");
  const recorded = (type: "TextInput" | "Pressable" | "Switch") =>
    forwardRef((props: Record<string, unknown>, ref) => {
      seen.push({ type, props });
      return createElement(rn[type] as never, { ...props, ref } as never);
    });
  return {
    ...rn,
    TextInput: recorded("TextInput"),
    Pressable: recorded("Pressable"),
    Switch: recorded("Switch"),
  };
});

/**
 * Fields disabled and enabled again — a `disableType="global"` action taking
 * the form's lock and releasing it — must be left enabled on Android, which
 * disables a view for `disabled: true` and enables it again only for an
 * explicit `false`. An `undefined` left the views disabled for good: a
 * refused check couldn't focus the input, nor could a tap, and the radio
 * options read as disabled (the MAST alpha.7 trial). react-native-web can't
 * show Android's views, so this pins the props they rest on.
 */
describe("native fields disabled, then enabled again", () => {
  afterEach(() => void (seen.length = 0));

  it("hand React Native a boolean disabled state, and editable alone", () => {
    const ctx = createControlContext();
    const locked = ctx.newControl(false);
    const root = createRoot(document.createElement("div"));
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={nativeRenderers}>
            <NativeThemeProvider theme={{ checkbox: { control: "switch" } }}>
              <Form disabled={(rc) => rc.getValue(locked)}>
                <TextField field={ctx.newControl("")} label="Name" />
                <RadioField
                  field={ctx.newControl<boolean | null>(null)}
                  label="Agree?"
                  options={[
                    { name: "Yes", value: true },
                    { name: "No", value: false },
                  ]}
                />
                <CheckboxField field={ctx.newControl(false)} label="Opt in" />
              </Form>
            </NativeThemeProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
    // Each view's disabled state, on its latest render
    const states = () => {
      const last = new Map<string, Record<string, unknown>>();
      for (const { type, props } of seen)
        if (type !== "Pressable" || props.role === "radio")
          last.set(`${type}:${String(props.id)}`, props);
      return [...last.entries()].map(([k, p]) =>
        k.startsWith("TextInput")
          ? [p["aria-disabled"], p.editable]
          : p.disabled,
      );
    };
    const enabled = [[false, true], false, false, false];
    expect(states()).toEqual(enabled);
    act(() => ctx.update((wc) => wc.setValue(locked, true)));
    expect(states()).toEqual([[true, false], true, true, true]);
    act(() => ctx.update((wc) => wc.setValue(locked, false)));
    expect(states()).toEqual(enabled);
    // React Native's TextInput takes a given `readOnly` over `editable`
    const inputs = seen.filter((s) => s.type === "TextInput");
    expect(inputs.every((s) => !("readOnly" in s.props))).toBe(true);
    act(() => root.unmount());
  });
});
