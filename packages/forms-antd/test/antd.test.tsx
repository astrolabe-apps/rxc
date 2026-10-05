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
  CheckboxField,
  Dialog,
  Form,
  FormProvider,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  Wizard,
  Section,
} from "@rx-controls/forms-react";
import { antdRenderers } from "../src/index";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/**
 * What Ant gets wrong silently, beyond the shared suite: its chrome is runtime
 * theme tokens, with no class to put one in, so the frame styles the control
 * slot through `style`; its checkbox takes the label as a child, which a shell
 * cannot reach, so the trailing label is a sibling; its tabs and modal each
 * need telling to keep content mounted (`forceRender`, and
 * `destroyOnHidden={false}`); and Ant 6 renamed props the POC still passed —
 * which it reports only as a console warning.
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
        <FormProvider renderers={antdRenderers}>
          <Form>{ui}</Form>
        </FormProvider>
      </ControlContextProvider>,
    ),
  );

describe("Ant", () => {
  it("draws the frame's chrome from theme tokens through style", () => {
    mount(<TextField field={ctx.newControl("")} id="name" label="Name" />);
    const input = container.querySelector<HTMLInputElement>("#name")!;
    // The control slot carries the reset; the frame around it the border.
    expect(input.style.border).toMatch(/none/);
    const frame = input.parentElement!;
    expect(frame.style.border).toMatch(/1px solid/);
    // Full width with a border and padding: it fits its container only as
    // border-box, which it cannot leave to Ant's optional reset.css.
    expect(frame.style.boxSizing).toBe("border-box");
  });

  it("gives a checkbox its label as a sibling, with the required marker", () => {
    mount(<CheckboxField field={ctx.newControl(false)} id="ok" label="Agree" required />);
    const label = container.querySelector("label[for=ok]")!;
    expect(label.textContent).toContain("Agree");
    expect(label.textContent).toContain("*");
    expect(label.contains(container.querySelector("#ok"))).toBe(false);
  });

  it("mounts every tab from the start, and a modal before it first opens and after it closes", () => {
    const open = ctx.newControl(false);
    mount(
      <>
        <Tabs
          items={[
            { key: "a", title: "A", children: <TextField field={ctx.newControl("")} id="ta" /> },
            { key: "b", title: "B", children: <TextField field={ctx.newControl("")} id="tb" /> },
          ]}
        />
        <Dialog open={open} title="Details">
          <TextField field={ctx.newControl("")} id="inside" />
        </Dialog>
      </>,
    );
    // forceRender: the inactive tab and the never-opened modal are mounted.
    expect(document.getElementById("tb")).not.toBeNull();
    const inside = document.getElementById("inside");
    expect(inside).not.toBeNull();
    act(() => ctx.update((wc) => wc.setValue(open, true)));
    act(() => ctx.update((wc) => wc.setValue(open, false)));
    // destroyOnHidden={false}: still the same node after closing.
    expect(document.getElementById("inside")).toBe(inside);
  });

  it("colours a toned display from theme tokens, through Typography's own colour", () => {
    mount(<TextDisplay text="Bad" tone="error" />);
    const shell = document.querySelector<HTMLElement>('[data-tone="error"]')!;
    expect(shell.style.color).not.toBe("");
    // Ant's Typography sets a colour of its own; it must inherit the tone.
    expect(shell.querySelector<HTMLElement>(".ant-typography")!.style.color).toBe("inherit");
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
      "12px",
    ]);
    // No margin for an error to take over, so nothing pulls the display up.
    expect(document.querySelector(".ant-form-item-margin-offset")).toBeNull();
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
      "20px",
    ]);
    expect([heading("Inner").getAttribute("aria-level"), heading("Inner").style.fontSize]).toEqual([
      "3",
      "16px",
    ]);
  });

  it("offers no clear on a required select that has a value", () => {
    const opts = [{ name: "A", value: "a" }];
    mount(
      <>
        <SelectField field={ctx.newControl<string | undefined>("a")} id="req" options={opts} required />
        <SelectField field={ctx.newControl<string | undefined>("a")} id="opt" options={opts} />
      </>,
    );
    const clear = (id: string) =>
      document.getElementById(id)!.closest(".ant-select")!.querySelectorAll(".ant-select-clear").length;
    expect([clear("req"), clear("opt")]).toEqual([0, 1]);
  });

  it("passes no prop Ant 6 has deprecated", () => {
    const open = ctx.newControl(true);
    mount(
      <>
        <Action actionId="a" text="Before" icon={<span>i</span>} iconPlacement="before" />
        <Action actionId="b" text="After" icon={<span>i</span>} iconPlacement="after" />
        <Action actionId="c" text="Replace" icon={<span>i</span>} iconPlacement="replace" />
        <SelectField
          field={ctx.newControl<string | undefined>(undefined)}
          options={[{ name: "A", value: "a" }]}
        />
        <Wizard
          items={[
            { key: "1", title: "One", children: <p /> },
            { key: "2", title: "Two", children: <p /> },
          ]}
        />
        <Dialog open={open} title="Open">
          <p>open</p>
        </Dialog>
      </>,
    );
    // afterEach fails on any console output — Ant's deprecation warnings
    // arrive there, as `Warning: [antd: …] … is deprecated`.
    expect(document.body.textContent).toContain("open");
  });
});
