import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import {
  ControlContextProvider,
  createControlContext,
  type ControlContext,
} from "@rx-controls/react";
import {
  Action,
  CheckboxField,
  CheckListField,
  DisplayOnlyField,
  Dialog,
  Form,
  FormProvider,
  RadioField,
  Section,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  fieldErrorId,
  fieldHelpId,
} from "@rx-controls/forms-react";
import { FluentLooksProvider, fluentRenderers } from "../src/index";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/**
 * What Fluent gets wrong silently, beyond the shared suite: its `Field` hands
 * its own ids and ARIA to the control through context, and its `RadioGroup`
 * copies the group's description onto every radio; a kept-mounted dialog is
 * hidden only by opacity and `aria-hidden`, so its controls still take focus;
 * a second themed `FluentProvider` would replace the host app's theme; and
 * `TabList` draws a strip with no panel wiring. Plus what makes it worth
 * having: the frame is Fluent's own `Input`, the control in its slot.
 */
let ctx: ControlContext;
let root: Root;
let container: HTMLDivElement;
let logged: string[];
beforeEach(() => {
  logged = [];
  for (const level of ["error", "warn"] as const)
    vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logged.push(a.map(String).join(" ")));
  ctx = createControlContext();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  expect(logged).toEqual([]);
});
const form = (ui: ReactNode) => (
  <ControlContextProvider value={ctx}>
    <FormProvider renderers={fluentRenderers}>
      <Form>{ui}</Form>
    </FormProvider>
  </ControlContextProvider>
);
const mount = (ui: ReactNode) => act(() => root.render(form(ui)));
const set = <V,>(c: { value: V } | object, v: V) =>
  act(() => ctx.update((wc) => wc.setValue(c as never, v as never)));

describe("Fluent", () => {
  it("draws a named field look on a text field, a select, a radio group, a check list, a checkbox and a display-only field", () => {
    const options = [
      { name: "One", value: "1" },
      { name: "Two", value: "2" },
    ];
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={fluentRenderers}>
            <FluentLooksProvider
              looks={{
                action: { styled: { style: { opacity: 0.4 } } },
                field: {
                  styled: {
                    shell: { marginBottom: "13px" },
                    label: { fontStyle: "italic" },
                    control: { borderRadius: "11px" },
                    text: { fontWeight: 700 },
                  },
                },
              }}
            >
              <Form>
                <TextField field={ctx.newControl("")} id="t" label="T" look="styled" />
                <SelectField field={ctx.newControl("1")} id="s" label="S" options={options} look="styled" />
                <RadioField field={ctx.newControl("1")} id="r" label="R" options={options} look="styled" />
                <CheckListField field={ctx.newControl<string[]>([])} id="l" label="L" options={options} look="styled" />
                <CheckboxField field={ctx.newControl(false)} id="c" label="C" look="styled" />
                <DisplayOnlyField field={ctx.newControl("shown")} id="d" label="D" look="styled" />
                <Action actionId="go" text="Go" look="styled" />
              </Form>
            </FluentLooksProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
    const shells = [...document.querySelectorAll<HTMLElement>('[data-look="styled"]')];
    expect(shells.length).toBeGreaterThanOrEqual(6);
    expect(shells.filter((e) => e.style.marginBottom === "13px")).toHaveLength(6);
    const italic = [...document.querySelectorAll<HTMLElement>("label, div")].filter((e) => e.style.fontStyle === "italic");
    expect(italic.length).toBeGreaterThanOrEqual(6);
    // the control on the input's frame, the text on the input itself
    const input = document.getElementById("t")!;
    expect(input.closest(".fui-Input")!.getAttribute("style")).toContain("border-radius: 11px");
    expect(input.style.fontWeight).toBe("700");
    expect(document.getElementById("s")!.style.fontWeight === "700" || document.getElementById("s")!.getAttribute("style")?.includes("11px")).toBe(true);
    expect((document.querySelector('[role="radiogroup"]') as HTMLElement).style.borderRadius).toBe("11px");
    expect((document.querySelector('[role="group"]') as HTMLElement).style.fontWeight).toBe("700");
    expect((document.getElementById("d") as HTMLElement).style.fontWeight).toBe("700");
    // an action look's `style` survives the button's own
    expect(([...document.querySelectorAll("button")].find((b) => b.textContent === "Go") as HTMLElement).style.opacity).toBe("0.4");
    expect((document.getElementById("c")!.closest(".fui-Checkbox") as HTMLElement).style.borderRadius).toBe("11px");
  });

  it("hands a look's function parts the window's width, for a group, a field and a text, and follows a resize", () => {
    const width = window.innerWidth;
    const resize = (w: number) => {
      Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
      act(() => void window.dispatchEvent(new Event("resize")));
    };
    resize(900);
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={fluentRenderers}>
            <FluentLooksProvider
              looks={{
                group: { w: { body: (st) => ({ display: "flex", flexDirection: st.width >= 600 ? "row" : "column" }) } },
                field: { w: { shell: (st) => ({ marginBottom: st.width >= 600 ? "21px" : "7px" }) } },
                text: { w: { style: (st) => ({ letterSpacing: st.width >= 600 ? "3px" : "1px" }) } },
              }}
            >
              <Form>
                <Section title="T" look="w">
                  <TextDisplay text="x" look="w" />
                </Section>
                <TextField field={ctx.newControl("")} id="t" label="N" look="w" />
              </Form>
            </FluentLooksProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
    const body = () => document.querySelector('[role="heading"]')!.nextElementSibling as HTMLElement;
    const shell = () => document.querySelector<HTMLElement>('[data-look="w"].fui-Field')!;
    const text = () => [...document.querySelectorAll<HTMLElement>("span")].find((e) => e.textContent === "x")!;
    expect([body().style.flexDirection, shell().style.marginBottom, text().style.letterSpacing]).toEqual(["row", "21px", "3px"]);
    resize(400);
    expect([body().style.flexDirection, shell().style.marginBottom, text().style.letterSpacing]).toEqual(["column", "7px", "1px"]);
    resize(width);
  });

  it("draws the frame as Fluent's own Input, the control in its slot", () => {
    mount(
      <TextField
        field={ctx.newControl("")}
        id="name"
        label="Name"
        startIcon={<span data-start="">$</span>}
        endIcon={<span data-end="">.00</span>}
      />,
    );
    const input = container.querySelector<HTMLInputElement>("#name")!;
    const frame = input.parentElement!;
    expect(frame.classList.contains("fui-Input")).toBe(true);
    // Fluent's own adornment slots, inside its border; one control.
    expect(frame.querySelector("[data-start]")).not.toBeNull();
    expect(frame.querySelector("[data-end]")).not.toBeNull();
    expect(container.querySelectorAll("input")).toHaveLength(1);
    // Fluent's styling of the control reaches it through the slot.
    expect(input.classList.contains("fui-Input__input")).toBe(true);
  });

  it("styles the frame invalid from the slot's aria-invalid", () => {
    const c = ctx.newControl<string | undefined>(undefined);
    mount(<TextField field={c} id="f" label="F" required />);
    const valid = container.querySelector("#f")!.parentElement!.className;
    act(() => ctx.update((wc) => wc.setTouched(c, true)));
    const input = container.querySelector("#f")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    // Fluent adds its invalid classes to the root only from the slot's props.
    expect(input.parentElement!.className).not.toBe(valid);
  });

  it("describes a field by the contract's ids alone, with none of Field's", () => {
    const c = ctx.newControl<string | undefined>(undefined);
    mount(<TextField field={c} id="f" label="F" required helpText="Help" />);
    const input = container.querySelector("#f")!;
    // Left to Field's context: "error help" prepended, an aria-labelledby
    // added, and the label's `for` pointing at an id of Field's own.
    expect(input.getAttribute("aria-describedby")).toBe(fieldHelpId("f"));
    expect(input.hasAttribute("aria-labelledby")).toBe(false);
    expect(container.querySelector("label")!.htmlFor).toBe("f");
    act(() => ctx.update((wc) => wc.setTouched(c, true)));
    expect(input.getAttribute("aria-describedby")).toBe(fieldErrorId("f"));
    // Read through the description, not announced as an alert of its own.
    expect(document.getElementById(fieldErrorId("f"))!.getAttribute("role")).toBeNull();
  });

  it("describes a radio group once, not every radio in it", () => {
    mount(
      <RadioField
        field={ctx.newControl<string | undefined>(undefined)}
        id="r"
        label="R"
        helpText="Help"
        options={[
          { name: "A", value: "a" },
          { name: "B", value: "b" },
        ]}
      />,
    );
    const described = [...container.querySelectorAll("[aria-describedby]")];
    expect(described.map((e) => e.getAttribute("role"))).toEqual(["radiogroup"]);
  });

  it("keeps a closed dialog mounted but inert, and returns focus on a programmatic close", () => {
    const open = ctx.newControl(false);
    mount(
      <>
        <Action actionId="open" text="Open" onClick={() => void set(open, true)} />
        <Dialog open={open} title="Details">
          <TextField field={ctx.newControl("")} id="inside" />
        </Dialog>
      </>,
    );
    const inside = document.getElementById("inside")!;
    const surface = inside.closest('[role="dialog"]')!;
    // Fluent hides it with opacity and aria-hidden only: without `inert`
    // the field inside would still take focus, invisible.
    expect([surface.getAttribute("aria-hidden"), surface.hasAttribute("inert")]).toEqual([
      "true",
      true,
    ]);
    const opener = container.querySelector<HTMLButtonElement>("button")!;
    // Lifted before Fluent moves focus in on open: a browser refuses focus
    // to an inert element, so focus would stay on the opener. happy-dom does
    // not, so what is checked is the surface's state when focus arrives.
    const inertOnFocus: boolean[] = [];
    surface.addEventListener("focusin", () => inertOnFocus.push(surface.hasAttribute("inert")));
    act(() => opener.focus());
    act(() => opener.click());
    expect(surface.hasAttribute("inert")).toBe(false);
    expect(surface.contains(document.activeElement)).toBe(true);
    expect(inertOnFocus).toEqual([false]);
    act(() => inside.focus());
    set(open, false);
    expect(document.getElementById("inside")).toBe(inside);
    expect(surface.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it("supplies a theme only when the host has none", () => {
    mount(<TextField field={ctx.newControl("")} id="f" />);
    expect(container.querySelectorAll(".fui-FluentProvider")).toHaveLength(1);
    act(() =>
      root.render(
        <FluentProvider theme={webDarkTheme} id="host">
          {form(<TextField field={ctx.newControl("")} id="g" />)}
        </FluentProvider>,
      ),
    );
    // A second themed provider would replace the host's theme.
    expect(container.querySelectorAll(".fui-FluentProvider")).toHaveLength(1);
    expect(document.getElementById("g")!.closest(".fui-FluentProvider")!.id).toBe("host");
  });

  it("wires the tab strip to panels it does not own, a hidden tab off it", () => {
    mount(
      <Tabs
        items={[
          { key: "a", title: "A", children: <p>pa</p> },
          { key: "b", title: "B", children: <p>pb</p> },
          { key: "c", title: "C", hidden: true, children: <p>pc</p> },
        ]}
      />,
    );
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    // By id: Fluent draws each title twice, one copy reserving bold width.
    expect(tabs.map((t) => t.id.replace(/.*-tab-/, ""))).toEqual(["a", "b"]);
    for (const t of tabs) {
      const panel = document.getElementById(t.getAttribute("aria-controls")!)!;
      expect(panel.getAttribute("role")).toBe("tabpanel");
      expect(panel.getAttribute("aria-labelledby")).toBe(t.id);
    }
    // Every panel mounted, the hidden tab's included.
    expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(3);
  });

  it("colours a toned display from Fluent's status tokens", () => {
    mount(<TextDisplay text="Bad" tone="error" />);
    const shell = document.querySelector<HTMLElement>('[data-tone="error"]')!;
    expect(shell.style.color).toBe("var(--colorStatusDangerForeground1)");
    // Fluent's Text sets a colour of its own; it must inherit the tone.
    expect(shell.querySelector<HTMLElement>(".fui-Text")!.style.color).toBe("inherit");
  });

  it("sets section titles in Fluent's type ramp, sized for a form", () => {
    mount(
      <Section title="Outer">
        <Section title="Inner">x</Section>
      </Section>,
    );
    const heading = (t: string) =>
      [...document.querySelectorAll<HTMLElement>('[role="heading"]')].find(
        (h) => h.textContent === t,
      )!;
    expect([heading("Outer").getAttribute("aria-level"), heading("Outer").style.fontSize]).toEqual([
      "2",
      "var(--fontSizeBase500)",
    ]);
    expect([heading("Inner").getAttribute("aria-level"), heading("Inner").style.fontSize]).toEqual([
      "3",
      "var(--fontSizeBase400)",
    ]);
  });

  it("offers no empty choice on a required select that has a value", () => {
    const opts = [{ name: "A", value: "a" }];
    mount(
      <>
        <SelectField field={ctx.newControl<string | undefined>("a")} id="req" options={opts} required />
        <SelectField field={ctx.newControl<string | undefined>("a")} id="opt" options={opts} />
        <SelectField field={ctx.newControl<string | undefined>(undefined)} id="unset" options={opts} required />
      </>,
    );
    const empty = (id: string) =>
      [...document.querySelectorAll<HTMLOptionElement>(`#${id} option`)].filter((o) => o.value === "").length;
    // Still offered while empty: a native <select> shows its first option.
    expect([empty("req"), empty("opt"), empty("unset")]).toEqual([0, 1, 1]);
  });

  it("shows a busy action with a spinner, Fluent's Button having no loading state", async () => {
    let finish!: () => void;
    mount(
      <Action
        actionId="save"
        text="Save"
        onClick={() => new Promise<void>((r) => (finish = r))}
      />,
    );
    const button = container.querySelector("button")!;
    act(() => button.click());
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.querySelector(".fui-Spinner")).not.toBeNull();
    await act(async () => finish());
    expect(button.querySelector(".fui-Spinner")).toBeNull();
  });
});
