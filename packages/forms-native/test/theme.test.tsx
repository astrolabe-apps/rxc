import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { untrackedRead } from "@rx-controls/core";
import { ControlContextProvider, createControlContext } from "@rx-controls/react";
import {
  Action,
  CheckboxField,
  Disclosure,
  DisplayOnlyField,
  Form,
  FormIconsProvider,
  FormProvider,
  IconDisplay,
  InlineGroup,
  RadioField,
  SelectField,
  TextDisplay,
  TextField,
  fieldLabelId,
} from "@rx-controls/forms-react";
import { Text } from "react-native";
import type { IconDrawArgs, IconSet } from "@rx-controls/forms-react";
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
  // react-native-web draws `role="link"` as an anchor.
  const link = (name: string) =>
    [...el.querySelectorAll<HTMLElement>("a, [role=link]")].find((e) => e.textContent === name)!;
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

  it("lays select.frame over a select's frame only, and draws select.icon after its value", () => {
    const state = ctx.newControl<string | null>("tas");
    const name = ctx.newControl("");
    mount(
      <>
        <SelectField field={state} id="state" options={[{ name: "Tasmania", value: "tas" }]} />
        <TextField field={name} id="name" />
      </>,
      { select: { frame: { minHeight: 42 }, icon: "⌄", iconStyle: { fontSize: 12 } } },
    );
    const trigger = el.querySelector('[role="combobox"]')!;
    expect([...trigger.children].map((e) => e.textContent)).toEqual(["Tasmania", "⌄"]);
    expect(trigger.children[1]!.getAttribute("aria-hidden")).toBe("true");
    expect(style(trigger.parentElement).minHeight).toBe("42px");
    expect(style(byId("name").parentElement).minHeight).not.toBe("42px");
  });

  it("draws a date as dd/mm/yyyy beside a button that opens the host's picker, and writes the ISO date", () => {
    const date = ctx.newControl("2024-03-05");
    const Picker = (p: { visible: boolean; value: string; onConfirm(iso: string): void; onCancel(): void }) =>
      p.visible ? (
        <div>
          <span data-testid="picker">{`on ${p.value}`}</span>
          <button onClick={() => p.onConfirm("2025-01-02")}>pick</button>
        </div>
      ) : null;
    mount(<TextField field={date} id="d" label="Date of birth" inputType="date" />, { date: { picker: Picker } });
    const input = byId("d") as HTMLInputElement;
    expect([input.value, input.readOnly || input.disabled || input.getAttribute("aria-disabled")]).toEqual([
      "05/03/2024",
      expect.anything(),
    ]);
    expect(el.querySelector('[data-testid="picker"]')).toBeNull();
    act(() => button("Choose a date").click());
    expect(el.querySelector('[data-testid="picker"]')!.textContent).toBe("on 2024-03-05");
    act(() => [...el.querySelectorAll("button")].find((b) => b.textContent === "pick")!.click());
    expect([untrackedRead.getValue(date), untrackedRead.isTouched(date), el.querySelector('[data-testid="picker"]')]).toEqual([
      "2025-01-02",
      true,
      null,
    ]);
    expect((byId("d") as HTMLInputElement).value).toBe("02/01/2025");
  });

  it("tells the icon sets the date button's icon size and colour, from date.iconStyle", () => {
    const asked: IconDrawArgs[] = [];
    const set: IconSet = (i) => (asked.push(i), <Text>{`[${i.name}]`}</Text>);
    const Picker = () => null;
    mount(
      <FormIconsProvider set={set}>
        <TextField field={ctx.newControl("2024-03-05")} id="d" label="Date of birth" inputType="date" />
      </FormIconsProvider>,
      { date: { picker: Picker, iconStyle: { fontSize: 20, color: "#343534" } } },
    );
    expect(asked).toEqual([expect.objectContaining({ name: "calendar", size: 20, color: "#343534" })]);
  });

  it("draws nothing for a display-only field with no value and no visible label, so a gap closes over it", () => {
    const name = ctx.newControl<string | null>(null);
    mount(<DisplayOnlyField field={name} id="n" label="Full name" hideLabel />);
    expect(el.textContent).toBe("");
    expect(byId("n")).toBeNull();
    // A value, or a label drawn, and it is there again.
    act(() => ctx.update((wc) => wc.setValue(name, "Ada Lovelace")));
    expect(el.textContent).toContain("Ada Lovelace");
    act(() => ctx.update((wc) => wc.setValue(name, null)));
    mount(<DisplayOnlyField field={name} id="n" label="Full name" />);
    expect(el.textContent).toContain("Full name");
  });

  it("leaves a date typed as text, as an ISO date, where the theme has no picker", () => {
    const date = ctx.newControl("2024-03-05");
    mount(<TextField field={date} id="d" label="Date of birth" inputType="date" />);
    const input = byId("d") as HTMLInputElement;
    expect([input.value, input.readOnly, el.querySelector('[aria-label="Choose a date"]')]).toEqual([
      "2024-03-05",
      false,
      null,
    ]);
  });

  it("draws a named icon through the icon sets, told the size and colour of its place", () => {
    const asked: IconDrawArgs[] = [];
    const set: IconSet = (i) => {
      asked.push(i);
      return i.family === "fa" || i.name === "check" ? <Text>{`[${i.name}]`}</Text> : undefined;
    };
    mount(
      <FormIconsProvider set={set}>
        <IconDisplay icon={{ family: "fa", name: "star" }} accessibleName="Star" />
        <Action actionId="go" text="Go" icon={{ family: "fa", name: "arrow" }} />
        <CheckboxField field={ctx.newControl(true)} id="c" label="Ticked" />
        <TextField field={ctx.newControl("")} id="t" label="Unit" startIcon="kg" />
      </FormIconsProvider>,
      {
        icon: { style: { fontSize: 30, color: "#010203" } },
        action: { textStyle: { fontSize: 13, color: "#0a0b0c" } },
      },
    );
    expect(asked).toEqual([
      { family: "fa", name: "star", size: 30, color: "#010203" },
      // The button's words' colour: the emphasis look's, over the theme's text style.
      { family: "fa", name: "arrow", size: 13, color: expect.any(String) },
      expect.objectContaining({ name: "check", family: undefined }),
    ]);
    // The theme's tick is a chrome name the set drew; words on an edge stay words.
    expect(el.textContent).toContain("[star]");
    expect(el.textContent).toContain("[arrow]");
    expect(el.textContent).toContain("[check]");
    expect(el.textContent).not.toContain("\u2713");
    expect(el.textContent).toContain("kg");
  });

  it("draws the default glyph for a chrome name no set draws, in the place's whole text style", () => {
    mount(
      <FormIconsProvider set={() => undefined}>
        <CheckboxField field={ctx.newControl(true)} id="c" label="Ticked" />
      </FormIconsProvider>,
      { checkbox: { mark: { fontSize: 17, fontWeight: "700" } } },
    );
    const tick = [...el.querySelectorAll("*")].filter((e) => e.textContent === "\u2713").pop() as HTMLElement;
    expect([tick.style.fontSize, tick.style.fontWeight]).toEqual(["17px", "700"]);
  });

  it("flips a disclosure's icon to iconOpen while open, in place of turning it", () => {
    mount(
      <Disclosure title="More">
        <TextDisplay text="inside" />
      </Disclosure>,
      { disclosure: { icon: "v", iconOpen: "^", iconPlacement: "after" } },
    );
    const toggle = el.querySelector("[aria-expanded]") as HTMLElement;
    const glyph = () => [...toggle.querySelectorAll("*")].map((e) => e.textContent).find((t) => t === "v" || t === "^");
    expect(glyph()).toBe("v");
    act(() => toggle.click());
    expect(glyph()).toBe("^");
  });

  it("styles a help button as labelled only when the field gives it words", () => {
    mount(
      <>
        <TextField field={ctx.newControl("")} id="a" label="Plain" helpText="h" helpPlacement="labelEnd" />
        <TextField field={ctx.newControl("")} id="b" label="Worded" helpText="h" helpPlacement="labelEnd" helpLabel="Why?" />
      </>,
      { shellFor: { textfield: { helpButton: { labelled: { backgroundColor: "rgb(1, 2, 3)" } } } } },
    );
    const bg = (name: string) => style(button(name)).backgroundColor;
    expect([bg("Help: Plain"), bg("Why?")]).toEqual(["", "rgba(1, 2, 3, 1.00)"]);
  });

  it("lands a look's shell on an inline group's one element, as html's wrapper", () => {
    mount(
      <InlineGroup look="pill">
        <Action actionId="a" text="Inside" />
      </InlineGroup>,
      { looks: { pill: { shell: { borderRadius: 9999 } } } },
    );
    const wrapper = link("Inside").parentElement!;
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
    // the link is words in the sentence's text, not a view embedded in it (Android's \uFFFC)
    expect(link("profile").tagName).not.toBe("DIV");
    expect(el.querySelector("[role=button]")).toBeNull();
    const wrapper = link("profile").parentElement!;
    // the sentence and the link share one parent, and it is not a flex row (a row made each
    // child a block, so a long sentence pushed the link onto a line of its own)
    expect(wrapper.textContent).toBe("Go to the" + "profile" + "menu to update it.");
    expect(style(wrapper).flexDirection).not.toBe("row");
    expect(style(wrapper).flexWrap).not.toBe("wrap");
  });
});
