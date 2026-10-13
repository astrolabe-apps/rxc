import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { untrackedRead } from "@rx-controls/core";
import { ControlContextProvider, createControlContext } from "@rx-controls/react";
import {
  Action,
  CheckboxField,
  Disclosure,
  Form,
  FormProvider,
  InlineGroup,
  RadioField,
  TextDisplay,
  TextField,
  fieldLabelId,
} from "@rx-controls/forms-react";
import { NativeThemeProvider, nativeRenderers, type PartialNativeTheme } from "../src/index";

/**
 * What the theme reaches, and the React Native behaviour it carries: the
 * MAST trial's P5, P6, P7 and P9, and the slot names it shares with html.
 */
describe("the native theme", () => {
  const ctx = createControlContext();
  let root: Root;
  let el: HTMLElement;
  let logged: string[];
  beforeEach(() => {
    logged = [];
    for (const l of ["error", "warn", "log"] as const)
      vi.spyOn(console, l).mockImplementation((...a) => void logged.push(a.map(String).join(" ")));
    el = document.createElement("div");
    document.body.appendChild(el);
    root = createRoot(el);
  });
  afterEach(() => {
    act(() => root.unmount());
    el.remove();
    vi.restoreAllMocks();
    expect(logged).toEqual([]);
  });
  const mount = (ui: ReactNode, theme: PartialNativeTheme = {}) =>
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={nativeRenderers}>
            <NativeThemeProvider theme={theme}>
              <Form>{ui}</Form>
            </NativeThemeProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
  const byId = (id: string) => document.getElementById(id)!;
  const style = (e: Element | null) => (e as HTMLElement).style;
  const button = (name: string) => el.querySelector<HTMLElement>(`[aria-label="${name}"]`)!;
  const options = [
    { name: "One", value: "1" },
    { name: "Two", value: "2" },
  ];

  it("styles a shell per widget: shellFor over shell, nested slots merged", () => {
    mount(
      <>
        <RadioField field={ctx.newControl("")} id="r" label="Pick" options={options} />
        <TextField
          field={ctx.newControl("")}
          id="t"
          label="Name"
          helpText="Your name"
          helpPlacement="labelEnd"
        />
        <CheckboxField
          field={ctx.newControl(false)}
          id="c"
          label="Agree"
          helpText="Terms"
          helpPlacement="labelEnd"
        />
      </>,
      {
        shellFor: {
          radio: { style: { padding: 13 } },
          checkbox: { label: { fontSize: 21 }, helpButton: { text: "More" } },
        },
      },
    );
    // The radio's shell is the label's parent: padded, where the text field's is not.
    expect([
      style(byId(fieldLabelId("r")).parentElement).padding,
      style(byId(fieldLabelId("t")).parentElement).padding,
    ]).toEqual(["13px", ""]);
    // A slot given merges over `shell`: the checkbox's label is larger, the text field's the base's.
    expect([style(byId(fieldLabelId("c"))).fontSize, style(byId(fieldLabelId("t"))).fontSize]).toEqual([
      "21px",
      "14px",
    ]);
    // The help button's words are the checkbox's own, its icon still the base's.
    expect([!!button("More: Agree"), !!button("Help: Name")]).toEqual([true, true]);
    expect(button("More: Agree").textContent).toBe(button("Help: Name").textContent);
  });

  it("toggles a checkbox from its label, box or switch, and not while locked", () => {
    for (const control of ["box", "switch"] as const) {
      const box = ctx.newControl(false);
      const locked = ctx.newControl(false);
      mount(
        <Form disabled={(rc) => rc.getValue(locked)}>
          <CheckboxField field={box} id="c" label="Agree" labelPosition="before" />
        </Form>,
        { checkbox: { control } },
      );
      const press = () => act(() => byId(fieldLabelId("c")).click());
      press();
      expect([control, untrackedRead.getValue(box), untrackedRead.isTouched(box)]).toEqual([
        control,
        true,
        true,
      ]);
      press();
      expect(untrackedRead.getValue(box)).toBe(false);
      act(() => ctx.update((wc) => wc.setValue(locked, true)));
      press();
      expect(untrackedRead.getValue(box)).toBe(false);
    }
  });

  it("draws an action's string icon in its text's look, without the underline", () => {
    mount(
      <>
        <Action actionId="next" text="Next" icon="→" look="primary" />
        <Action actionId="out" text="Elsewhere" icon="↗" iconPlacement="after" look="link" />
      </>,
    );
    const glyph = (name: string, g: string) =>
      [...button(name).querySelectorAll("*")].find(
        (e) => e.textContent === g && e.children.length === 0,
      )!;
    const next = style(glyph("Next", "→"));
    expect([next.color, next.textDecorationLine]).toEqual([expect.stringMatching(/255, 255, 255/), "none"]);
    // the link look underlines its words; the glyph in them does not
    const link = style(glyph("Elsewhere", "↗"));
    expect([link.color, link.textDecorationLine]).toEqual([expect.stringMatching(/37, 99, 235/), "none"]);
    expect(style(button("Elsewhere").querySelector("span, div:not([aria-hidden])") && glyph("Elsewhere", "Elsewhere")).textDecorationLine).toBe(
      "underline",
    );
  });

  it("shrinks the row children React Native would not: a label, a label row, a button's text", () => {
    mount(
      <>
        <CheckboxField
          field={ctx.newControl(false)}
          id="c"
          label="A long label beside its switch"
          labelPosition="before"
          helpText="Help"
          helpPlacement="labelEnd"
        />
        <Action actionId="go" text="Go" look="primary" />
      </>,
    );
    const label = byId(fieldLabelId("c"));
    const text = [...button("Go").querySelectorAll("*")].find((e) => e.textContent === "Go")!;
    expect([
      style(label).flexShrink,
      style(label.parentElement).flexShrink,
      style(text).flexShrink,
    ]).toEqual(["1", "1", "1"]);
  });

  it("draws a disclosure's icon after its title under iconPlacement after, the marker last", () => {
    const c = ctx.newControl("");
    mount(
      <Disclosure title="How to find this">
        <TextField field={c} id="where" required />
      </Disclosure>,
      { disclosure: { icon: "›", iconPlacement: "after" } },
    );
    act(() => ctx.update((wc) => wc.setTouched(c, true)));
    const toggle = el.querySelector('[aria-expanded]')!;
    expect([...toggle.children].map((e) => e.textContent)).toEqual(["How to find this", "›", "●"]);
  });

  it("lands a look's shell on an inline group's one element, as html's wrapper", () => {
    mount(
      <InlineGroup look="pill">
        <Action actionId="a" text="Inside" />
      </InlineGroup>,
      { looks: { pill: { shell: { borderRadius: 9999 } } } },
    );
    const wrapper = button("Inside").parentElement!;
    expect(style(wrapper).borderRadius).toBe("9999px");
  });

  it("draws an inline group as one text its words and links flow in, not a row of blocks", () => {
    mount(
      <InlineGroup>
        <TextDisplay text="Go to the" inline />
        <Action actionId="a" text="profile" look="link" />
        <TextDisplay text="menu to update it." inline />
      </InlineGroup>,
    );
    const wrapper = button("profile").parentElement!;
    // the sentence and the link share one parent, and it is not a flex row (a row made each
    // child a block, so a long sentence pushed the link onto a line of its own)
    expect(wrapper.textContent).toBe("Go to the" + "profile" + "menu to update it.");
    expect(style(wrapper).flexDirection).not.toBe("row");
    expect(style(wrapper).flexWrap).not.toBe("wrap");
  });
});
