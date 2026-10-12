import { act } from "react";
import { createRoot } from "react-dom/client";
import { untrackedRead } from "@rx-controls/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
} from "@rx-controls/react";
import {
  CheckboxField,
  CheckListField,
  Form,
  FormProvider,
  RadioField,
} from "@rx-controls/forms-react";
import { NativeThemeProvider, nativeRenderers } from "../src/index";

// What the implementation hands React Native's views, on a device
const seen = vi.hoisted(
  () => [] as { type: string; props: Record<string, unknown> }[],
);
vi.mock("react-native", async (original) => {
  const rn = await original<typeof import("react-native")>();
  const { createElement, forwardRef } = await import("react");
  const recorded = (type: "Text" | "Pressable" | "Switch") =>
    forwardRef((props: Record<string, unknown>, ref) => {
      seen.push({ type, props });
      return createElement(rn[type] as never, { ...props, ref } as never);
    });
  return {
    ...rn,
    Platform: { ...rn.Platform, OS: "android" },
    Text: recorded("Text"),
    Pressable: recorded("Pressable"),
    Switch: recorded("Switch"),
  };
});

function mount(
  form: React.ReactNode,
  control: "switch" | "box" = "switch",
  ctx = createControlContext(),
) {
  const root = createRoot(document.createElement("div"));
  act(() =>
    root.render(
      <ControlContextProvider value={ctx}>
        <FormProvider renderers={nativeRenderers}>
          <NativeThemeProvider theme={{ checkbox: { control } }}>
            <Form>{form}</Form>
          </NativeThemeProvider>
        </FormProvider>
      </ControlContextProvider>,
    ),
  );
  return root;
}
const last = (type: string, pick: (p: Record<string, unknown>) => boolean) =>
  seen.filter((s) => s.type === type && pick(s.props)).at(-1)?.props;

/**
 * Android shows TalkBack what a view's props say and nothing the web's
 * `aria-labelledby` does, so a device-only pass (MAST alpha.8's R1 and R2)
 * reads them. react-native-web cannot show the tree, so this pins the props.
 */
describe("accessibility on a device", () => {
  afterEach(() => void (seen.length = 0));

  it("keeps a radio group's question in the tree, and a check list's, naming it without the marker", () => {
    const ctx = createControlContext();
    const root = mount(
      <>
        <RadioField
          field={ctx.newControl<boolean | null>(null)}
          label="Does it match?"
          required
          options={[{ name: "Yes", value: true }]}
        />
        <CheckListField
          field={ctx.newControl<number[]>([])}
          label="Pick some"
          required
          options={[{ name: "One", value: 1 }]}
        />
      </>,
      "switch",
      ctx,
    );
    const radio = last("Text", (p) => p["aria-label"] === "Does it match?")!;
    expect(radio.importantForAccessibility).toBeUndefined();
    expect(radio.accessibilityElementsHidden).toBeUndefined();
    const list = last("Text", (p) => p["aria-label"] === "Pick some")!;
    expect(list.importantForAccessibility).toBeUndefined();
    // Said once, for a required group (a radio's is the options' own state)
    expect(list.accessibilityHint).toBeTruthy();
    act(() => root.unmount());
  });

  it("still hides the label of a control that carries its own name", () => {
    const ctx = createControlContext();
    const root = mount(<CheckboxField field={ctx.newControl(false)} label="Opt in" hideLabel={false} />);
    const label = last("Text", (p) => p.id !== undefined && String(p.id).includes("label"))!;
    expect(label.importantForAccessibility).toBe("no-hide-descendants");
    act(() => root.unmount());
  });

  it("makes a checkbox's row the one accessible element, its control hidden from it", () => {
    const ctx = createControlContext();
    const on = ctx.newControl(false);
    for (const control of ["switch", "box"] as const) {
      seen.length = 0;
      const root = mount(<CheckboxField field={on} label="Opt in" helpText="Why" />, control, ctx);
      const row = last("Pressable", (p) => p.accessible === true)!;
      expect(row.role).toBe(control === "switch" ? "switch" : "checkbox");
      expect(row["aria-label"]).toBe("Opt in");
      expect(row.accessibilityState).toEqual({ checked: false, disabled: false });
      expect(row.accessibilityHint).toBe("Why");
      const inner =
        control === "switch"
          ? last("Switch", () => true)!
          : last("Pressable", (p) => p.accessible !== true && p.role === "checkbox")!;
      expect(inner.importantForAccessibility).toBe("no-hide-descendants");
      act(() => (row.onPress as () => void)());
      expect(untrackedRead.getValue(on)).toBe(true);
      act(() => ctx.update((wc) => wc.setValue(on, false)));
      act(() => root.unmount());
    }
  });

  it("leaves a checkbox whose label isn't drawn as it was", () => {
    const ctx = createControlContext();
    const root = mount(<CheckboxField field={ctx.newControl(false)} label="Opt in" hideLabel />);
    expect(last("Pressable", (p) => p.accessible === true)).toBeUndefined();
    expect(last("Switch", () => true)!.importantForAccessibility).toBeUndefined();
    act(() => root.unmount());
  });
});
