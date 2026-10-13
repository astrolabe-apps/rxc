import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ControlContextProvider,
  createControlContext,
  type ControlContext,
} from "@rx-controls/react";
import {
  Action,
  Dialog,
  Form,
  FormProvider,
  CheckboxField,
  CheckListField,
  DisplayOnlyField,
  RadioField,
  SelectField,
  TextDisplay,
  TextField,
  Section,
} from "@rx-controls/forms-react";
import { MuiLooksProvider, muiRenderers } from "../src/index";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/**
 * What MUI gets wrong silently, beyond the shared suite: the outlined frame
 * cuts its notch from a label the contract does not carry, so the shell hands
 * it over privately; the control slot must reach `OutlinedInput` as a stable
 * `inputComponent`, or the input remounts whenever the frame re-renders; and a
 * closed dialog must be `keepMounted`, hidden, for `silent`.
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
const mount = (ui: ReactNode) =>
  act(() =>
    root.render(
      <ControlContextProvider value={ctx}>
        <FormProvider renderers={muiRenderers}>
          <Form>{ui}</Form>
        </FormProvider>
      </ControlContextProvider>,
    ),
  );

describe("MUI", () => {
  it("cuts the outlined frame's notch from the field's label", () => {
    mount(<TextField field={ctx.newControl("")} id="name" label="Given name" />);
    // OutlinedInput sizes its notch from a copy of the label in its legend.
    const legend = container.querySelector("fieldset legend");
    expect(legend?.textContent).toContain("Given name");
    expect(container.querySelector("label[for=name]")?.textContent).toContain("Given name");
  });

  it("keeps the input through a frame re-render — focus, typing, blur", () => {
    const name = ctx.newControl("");
    mount(<TextField field={name} id="name" label="Name" />);
    const input = container.querySelector<HTMLInputElement>("#name")!;
    act(() => input.focus());
    // The frame's own focused state re-rendered it; the slot survived.
    expect(container.querySelector("#name")).toBe(input);
    expect(container.querySelector(".Mui-focused")).not.toBeNull();
    act(() => input.blur());
    expect(container.querySelector("#name")).toBe(input);
  });

  it("keeps a closed dialog mounted but hidden, and draws Close as an action", () => {
    const open = ctx.newControl(false);
    mount(
      <Dialog open={open} title="Details">
        <TextField field={ctx.newControl("")} id="inside" />
      </Dialog>,
    );
    const inside = document.getElementById("inside")!;
    expect(inside).not.toBeNull();
    // keepMounted: in the document, hidden from assistive tech.
    expect(inside.closest("[aria-hidden=true], [style*='visibility: hidden']")).not.toBeNull();
    act(() => ctx.update((wc) => wc.setValue(open, true)));
    expect(
      [...document.querySelectorAll("button")].some((b) => b.textContent === "Close"),
    ).toBe(true);
  });

  it("draws a named field look as MUI's own sx on the shell, label, frame and input text", () => {
    const c = ctx.newControl("");
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={muiRenderers}>
            <MuiLooksProvider
              looks={{
                field: {
                  tinted: {
                    shell: { marginBottom: "13px" },
                    label: (t) => ({ color: t.palette.secondary.main }),
                    control: { borderRadius: "11px", "&.Mui-focused": { backgroundColor: "rgb(250, 250, 200)" } },
                    text: { fontStyle: "italic" },
                  },
                },
              }}
            >
              <Form>
                <TextField field={c} id="t" label="Name" look="tinted" />
                <TextField field={ctx.newControl("")} id="u" label="Plain" />
              </Form>
            </MuiLooksProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
    const css = (el: Element, p: string) => getComputedStyle(el).getPropertyValue(p);
    const input = document.getElementById("t")!;
    const frame = input.closest(".MuiOutlinedInput-root")!;
    const shell = frame.closest(".MuiFormControl-root")!;
    expect(shell.getAttribute("data-look")).toBe("tinted");
    expect(css(shell, "margin-bottom")).toBe("13px");
    expect(css(frame, "border-radius")).toBe("11px");
    expect(css(input, "font-style")).toBe("italic");
    expect(css(document.querySelector("label")!, "color")).not.toBe("");
    // a field with no look is drawn as before
    const plain = document.getElementById("u")!.closest(".MuiFormControl-root")!;
    expect(plain.getAttribute("data-look")).toBeNull();
    expect(css(plain, "margin-bottom")).not.toBe("13px");
  });

  it("draws a named field look on a select, a radio group, a check list, a checkbox and a display-only field", () => {
    const options = [
      { name: "One", value: "1" },
      { name: "Two", value: "2" },
    ];
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={muiRenderers}>
            <MuiLooksProvider
              looks={{
                field: {
                  styled: {
                    shell: { marginBottom: "13px" },
                    control: { borderRadius: "11px" },
                    text: { fontStyle: "italic" },
                  },
                },
              }}
            >
              <Form>
                <SelectField field={ctx.newControl("1")} id="s" label="S" options={options} look="styled" />
                <RadioField field={ctx.newControl("1")} id="r" label="R" options={options} look="styled" />
                <CheckListField field={ctx.newControl<string[]>([])} id="l" label="L" options={options} look="styled" />
                <CheckboxField field={ctx.newControl(false)} id="c" label="C" look="styled" />
                <DisplayOnlyField field={ctx.newControl("shown")} id="d" label="D" look="styled" />
              </Form>
            </MuiLooksProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
    const css = (el: Element, p: string) => getComputedStyle(el).getPropertyValue(p);
    const shells = [...document.querySelectorAll('.MuiFormControl-root[data-look="styled"]')];
    expect(shells).toHaveLength(5);
    for (const sh of shells) expect(css(sh, "margin-bottom")).toBe("13px");
    // control and text land on each widget's own element
    expect(css(document.getElementById("s")!.closest(".MuiOutlinedInput-root")!, "border-radius")).toBe("11px");
    expect(css(document.querySelector(".MuiSelect-select")!, "font-style")).toBe("italic");
    const group = document.querySelector('[role="radiogroup"]')!;
    expect(css(group, "border-radius")).toBe("11px");
    expect(css(group.querySelector(".MuiFormControlLabel-label")!, "font-style")).toBe("italic");
    expect(css(document.querySelector('[role="group"]')!.querySelector(".MuiFormControlLabel-label")!, "font-style")).toBe("italic");
    expect(css(document.getElementById("d")!, "font-style")).toBe("italic");
    expect(css(document.getElementById("c")!.closest(".MuiCheckbox-root")!, "border-radius")).toBe("11px");
  });

  it("hands a look's function parts the window's width, for a group and a field, and follows a resize", () => {
    const width = window.innerWidth;
    const resize = (w: number) => {
      Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
      act(() => void window.dispatchEvent(new Event("resize")));
    };
    resize(900);
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={muiRenderers}>
            <MuiLooksProvider
              looks={{
                group: { w: { body: (_t, st) => ({ display: "flex", flexDirection: st.width >= 600 ? "row" : "column" }) } },
                field: { w: { shell: (_t, st) => ({ marginBottom: st.width >= 600 ? "21px" : "7px" }) } },
              }}
            >
              <Form>
                <Section title="T" look="w">
                  <TextDisplay text="x" />
                </Section>
                <TextField field={ctx.newControl("")} id="t" label="N" look="w" />
              </Form>
            </MuiLooksProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
    const body = () => document.querySelector('[role="heading"]')!.nextElementSibling as HTMLElement;
    const shell = () => getComputedStyle(document.getElementById("t")!.closest(".MuiFormControl-root")!);
    expect(body().style.flexDirection).toBe("row");
    expect(shell().getPropertyValue("margin-bottom")).toBe("21px");
    resize(400);
    expect(body().style.flexDirection).toBe("column");
    expect(shell().getPropertyValue("margin-bottom")).toBe("7px");
    resize(width);
  });

  it("colours a toned display from the palette", () => {
    mount(<TextDisplay text="Bad" tone="error" />);
    expect(document.querySelector<HTMLElement>('[data-tone="error"]')!.style.color).not.toBe("");
  });

  it("spaces every child of a group, a display after a field in error included", () => {
    const c = ctx.newControl<string | undefined>(undefined);
    mount(
      <Section title="S">
        <TextField field={c} id="f" label="F" required />
        <TextDisplay text="after" />
      </Section>,
    );
    act(() => ctx.update((wc) => wc.setTouched(c, true)));
    const heading = document.querySelector('[role="heading"]')!;
    const body = heading.nextElementSibling as HTMLElement;
    expect([body.style.display, body.style.flexDirection, body.style.gap]).toEqual([
      "flex",
      "column",
      "8px",
    ]);
  });

  it("sets section titles in the library's heading type, sized for a form", () => {
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
      "1.25rem",
    ]);
    expect([heading("Inner").getAttribute("aria-level"), heading("Inner").style.fontSize]).toEqual([
      "3",
      "1rem",
    ]);
  });

  it("offers no empty item on a required select that has a value", () => {
    const opts = [{ name: "A", value: "a" }];
    const items = (required: boolean) => {
      mount(<SelectField field={ctx.newControl<string | undefined>("a")} id="s" options={opts} required={required} />);
      act(() => {
        document
          .querySelector('[role="combobox"]')!
          .dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      return [...document.querySelectorAll('[role="option"]')].map((o) => o.textContent);
    };
    expect(items(true)).toEqual(["A"]);
    expect(items(false)).toEqual(["—", "A"]);
  });

  it("maps the built-in looks onto MUI's button variants", () => {
    mount(
      <>
        <Action actionId="a" text="Primary" look="primary" />
        <Action actionId="b" text="Secondary" look="secondary" />
        <Action actionId="c" text="Link" look="link" />
      </>,
    );
    const cls = (t: string) =>
      [...container.querySelectorAll("button")].find((b) => b.textContent === t)!.className;
    expect(cls("Primary")).toContain("MuiButton-contained");
    expect(cls("Secondary")).toContain("MuiButton-outlined");
    expect(cls("Link")).toContain("MuiButton-text");
  });
});
