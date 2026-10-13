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
  const classes = (e: Element) => (e.getAttribute("class") ?? "").split(/\s+/);
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
          radio: { className: "question-card" },
          checkbox: { label: "big-label", helpButton: { text: "More" } },
        },
      },
    );
    const cards = [...el.querySelectorAll(".question-card")];
    expect(cards.map((c) => c.contains(byId(fieldLabelId("r"))))).toEqual([true]);
    expect([
      classes(byId(fieldLabelId("c"))).includes("big-label"),
      classes(byId(fieldLabelId("t"))).includes("big-label"),
    ]).toEqual([true, false]);
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
    expect(classes(glyph("Next", "→"))).toEqual(expect.arrayContaining(["text-white", "no-underline"]));
    const link = classes(glyph("Elsewhere", "↗"));
    expect([link.includes("text-blue-600"), link.includes("underline"), link.includes("no-underline")]).toEqual([
      true,
      false,
      true,
    ]);
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
      classes(label).includes("shrink"),
      classes(label.parentElement!).includes("shrink"),
      classes(text).includes("shrink"),
    ]).toEqual([true, true, true]);
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
      { looks: { pill: { shell: "rounded-full" } } },
    );
    expect(button("Inside").closest(".rounded-full")).not.toBeNull();
  });
});
