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
  SelectField,
  TextDisplay,
  TextField,
  Section,
} from "@rx-controls/forms-react";
import { muiRenderers } from "../src/index";

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

  it("maps variants onto MUI's button variants", () => {
    mount(
      <>
        <Action actionId="a" text="Primary" variant="primary" />
        <Action actionId="b" text="Secondary" variant="secondary" />
        <Action actionId="c" text="Link" variant="link" />
      </>,
    );
    const cls = (t: string) =>
      [...container.querySelectorAll("button")].find((b) => b.textContent === t)!.className;
    expect(cls("Primary")).toContain("MuiButton-contained");
    expect(cls("Secondary")).toContain("MuiButton-outlined");
    expect(cls("Link")).toContain("MuiButton-text");
  });
});
