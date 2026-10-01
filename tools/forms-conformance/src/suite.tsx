import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { untrackedRead as rc, type Control } from "@rx-controls/core";
import {
  ControlContextProvider,
  createControlContext,
  type ControlContext,
} from "@rx-controls/react";
import {
  Action,
  CheckboxField,
  Contents,
  Dialog,
  Elements,
  Form,
  FormProvider,
  HtmlDisplay,
  RadioField,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  useFormValidation,
  Wizard,
  type FormRenderers,
  type ValidationScope,
} from "@rx-controls/forms-react";
import { JsonForm } from "@rx-controls/forms-json";
import { Stars } from "./widgets/Stars.js";
import { PetCards } from "./widgets/PetCards.js";
import { demoControls, demoSchema } from "./fixtures/demoForm.js";

/** An implementation under test. */
export interface Implementation {
  /** For the test names. */
  name: string;
  /** What it draws with. */
  renderers: FormRenderers;
  /** Providers it needs above the form beyond its own `root` — a theme. */
  wrap?: (node: ReactNode) => ReactNode;
}

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const options = [
  { name: "Ay", value: "a" },
  { name: "Bee", value: "b" },
];

/**
 * The conformance suite: what the contract promises, asserted the same way
 * under every implementation. It reads the DOM only through what every
 * implementation must produce — an input by its id, a label's text, a button
 * by its name, `role="tab"` — and searches `document` rather than the
 * container, since a library may portal a dialog out of it. Every case also
 * fails on anything printed to the console: a library's deprecation warning
 * or a React key warning is a defect even when the behaviour is right.
 *
 * Library-specific failure modes — MUI's notch and `inputComponent`, Ant's
 * token chrome — are tested in the implementation's own package, beside this.
 */
export function describeConformance(impl: Implementation): void {
  describe(`${impl.name}: conformance`, () => {
    let ctx: ControlContext;
    let root: Root;
    let container: HTMLDivElement;
    let logged: string[];
    let validation: ValidationScope;

    beforeEach(() => {
      logged = [];
      for (const level of ["error", "warn"] as const)
        vi.spyOn(console, level).mockImplementation((...a: unknown[]) => {
          logged.push(a.map(String).join(" "));
        });
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

    function Owner({ children }: { children: ReactNode }) {
      validation = useFormValidation();
      return <Form validation={validation}>{children}</Form>;
    }
    const mount = (ui: ReactNode) => {
      const tree = (
        <FormProvider renderers={impl.renderers}>
          <Owner>{ui}</Owner>
        </FormProvider>
      );
      act(() =>
        root.render(
          <ControlContextProvider value={ctx}>
            {impl.wrap ? impl.wrap(tree) : tree}
          </ControlContextProvider>,
        ),
      );
    };
    const byId = <E extends HTMLElement>(id: string) =>
      document.getElementById(id) as E | null;
    const text = () => document.body.textContent ?? "";
    /**
     * In the document and drawn: neither it nor an ancestor hidden,
     * `display: none` or `visibility: hidden` (which also takes it out of the
     * accessibility tree).
     */
    const onScreen = (el: Element | null | undefined) => {
      if (!el) return false;
      if (getComputedStyle(el).visibility === "hidden") return false;
      for (let e: Element | null = el; e; e = e.parentElement)
        if ((e as HTMLElement).hidden || getComputedStyle(e).display === "none")
          return false;
      return true;
    };
    const buttonNamed = (name: string) =>
      [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === name || b.getAttribute("aria-label") === name,
      ) as HTMLButtonElement | undefined;
    const set = <T,>(c: Control<T>, v: T) =>
      act(() => ctx.update((wc) => wc.setValue(c, v)));
    const click = (el: Element) => act(() => (el as HTMLElement).click());
    const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
      act(() => {
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    const blur = (el: HTMLElement) =>
      act(() => {
        el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
        el.dispatchEvent(new FocusEvent("blur"));
      });
    const flush = (ms = 0) =>
      act(async () => {
        await new Promise((r) => setTimeout(r, ms));
      });

    it("draws a text field that takes typing and keeps its input across keystrokes", () => {
      const name = ctx.newControl("");
      mount(<TextField field={name} id="name" label="Name" helpText="Your given name" />);
      expect(text()).toContain("Name");
      expect(text()).toContain("Your given name");
      const input = byId<HTMLInputElement>("name")!;
      type(input, "A");
      type(input, "Ad");
      type(input, "Ada");
      expect(rc.getValue(name)).toBe("Ada");
      // The same element all the way: a control slot that remounts on every
      // keystroke loses focus and caret.
      expect(byId("name")).toBe(input);
      expect(input.value).toBe("Ada");
    });

    it("shows a required field's message once it is touched", () => {
      const name = ctx.newControl("");
      mount(<TextField field={name} id="name" label="Name" required />);
      expect(text()).not.toContain("Please enter a value");
      blur(byId("name")!);
      expect(text()).toContain("Please enter a value");
    });

    it("locks a field in a disabled form", () => {
      const name = ctx.newControl("x");
      act(() =>
        root.render(
          <ControlContextProvider value={ctx}>
            {(impl.wrap ?? ((n: ReactNode) => n))(
              <FormProvider renderers={impl.renderers}>
                <Form disabled>
                  <TextField field={name} id="name" label="Name" />
                </Form>
              </FormProvider>,
            )}
          </ControlContextProvider>,
        ),
      );
      expect(byId<HTMLInputElement>("name")!.disabled).toBe(true);
    });

    it("toggles a checkbox", () => {
      const ok = ctx.newControl(false);
      mount(<CheckboxField field={ok} id="ok" label="Agree" />);
      expect(text()).toContain("Agree");
      click(document.querySelector("input[type=checkbox]")!);
      expect(rc.getValue(ok)).toBe(true);
    });

    it("selects a radio option, and draws each option's content", () => {
      const v = ctx.newControl<string | undefined>(undefined);
      mount(
        <RadioField field={v} id="r" label="Pick" options={options}>
          {(o) => <TextDisplay text={`about ${o.name}`} />}
        </RadioField>,
      );
      expect(text()).toContain("about Bee");
      const radios = [...document.querySelectorAll<HTMLInputElement>("input[type=radio]")];
      expect(radios).toHaveLength(2);
      click(radios[1]);
      expect(rc.getValue(v)).toBe("b");
    });

    it("shows the chosen option of a select", () => {
      const v = ctx.newControl<string | undefined>(undefined);
      mount(<SelectField field={v} id="s" label="Pick" options={options} />);
      set(v, "b");
      expect(text()).toContain("Bee");
    });

    it("names and describes every control through the accessibility tree", () => {
      const opts = [
        { name: "Ay", value: "a" },
        { name: "Bee", value: "b" },
      ];
      const cases: [string, (c: Control<any>) => ReactNode][] = [
        ["text", (c) => <TextField field={c} label="Text name" required requiredMessage="Needed" helpText="Help" />],
        ["select", (c) => <SelectField field={c} label="Select name" options={opts} required requiredMessage="Needed" helpText="Help" />],
        ["radio", (c) => <RadioField field={c} label="Radio name" options={opts} required requiredMessage="Needed" helpText="Help" />],
        ["checkbox", (c) => <CheckboxField field={c} label="Check name" required requiredMessage="Needed" helpText="Help" />],
      ];
      const texts = (ids: string) =>
        ids
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? `(no #${id})`)
          .join(" ");
      // What assistive technology reads off the control that is described:
      // its name — aria-labelledby, else a label for it or around it — and
      // the text of the elements its aria-describedby names, which must exist.
      const read = () =>
        [...container.querySelectorAll("[aria-describedby]")].map((el) => {
          const by = el.getAttribute("aria-labelledby");
          const forIt = el.id
            ? container.querySelector(`label[for="${CSS.escape(el.id)}"]`)
            : null;
          const name = by
            ? texts(by)
            : (el.getAttribute("aria-label") ??
              (forIt ?? el.closest("label"))?.textContent?.trim() ??
              "(no name)");
          return { name, description: texts(el.getAttribute("aria-describedby")!) };
        });
      for (const [kind, ui] of cases) {
        const c = ctx.newControl<unknown>(undefined);
        mount(ui(c));
        const label = `${kind[0]!.toUpperCase()}${kind.slice(1)} name`.replace("Checkbox", "Check");
        const named = (description: string) => [
          kind,
          [{ name: expect.stringContaining(label), description }],
        ];
        expect([kind, read()]).toEqual(named("Help"));
        act(() => ctx.update((wc) => wc.setTouched(c, true)));
        expect([kind, read()]).toEqual(named("Needed"));
      }
    });

    it("caps a text field at maxLength, and reports a longer value as an error", () => {
      const c = ctx.newControl("too long already");
      mount(<TextField field={c} id="capped" label="Capped" maxLength={5} />);
      expect(byId<HTMLInputElement>("capped")!.maxLength).toBe(5);
      act(() => ctx.update((wc) => wc.setTouched(c, true)));
      expect(text()).toContain("At most 5 characters");
      expect(validation.isValid(rc)).toBe(false);
    });

    it("draws group titles as headings, one level deeper per titled group", () => {
      mount(
        <Contents title="Outer section">
          <Contents title="Inner section">
            <TextDisplay text="x" />
          </Contents>
        </Contents>,
      );
      const headings = [...container.querySelectorAll('[role="heading"], h1, h2, h3, h4, h5, h6')].map(
        (h) => [
          h.textContent?.trim(),
          h.getAttribute("aria-level") ?? h.tagName.slice(1),
        ],
      );
      expect(headings).toEqual([
        ["Outer section", "2"],
        ["Inner section", "3"],
      ]);
    });

    it("unmounts a hidden field's widget", () => {
      mount(<TextField field={ctx.newControl("")} id="gone" label="Gone" hidden />);
      expect(byId("gone")).toBeNull();
    });

    it("with transitions off, takes a field and a region off screen at once", () => {
      const hide = ctx.newControl(false);
      mount(
        <Contents transitions={false}>
          <TextField field={ctx.newControl("")} id="leaves" label="Leaves" hidden={hide} />
          <Contents hidden={hide}>
            <p id="kept">Plain content</p>
          </Contents>
        </Contents>,
      );
      const kept = byId("kept");
      set(hide, true);
      // No timer has run: nothing is held for an exit transition.
      expect(byId("leaves")).toBeNull();
      // The region keeps its plain content mounted, and hides it now.
      expect(byId("kept")).toBe(kept);
      expect(onScreen(kept)).toBe(false);
    });

    it("draws each boundary as one element under a body, its shellClassName on it", () => {
      const arr = ctx.newControl(["a"]);
      const boundaries: [string, ReactNode][] = [
        ["field", <TextField field={ctx.newControl("")} label="F" shellClassName="cell" />],
        ["display", <TextDisplay text="T" shellClassName="cell" />],
        ["group", <Contents shellClassName="cell">x</Contents>],
        [
          "collection",
          <Elements field={arr} shellClassName="cell">
            {() => <TextDisplay text="row" />}
          </Elements>,
        ],
      ];
      // A class layout on the body sees exactly these elements: what a
      // grid places, and where a child's `col-span-*` has to land.
      for (const [kind, ui] of boundaries) {
        mount(
          <Contents transitions={false} className="layout-body">
            {ui}
          </Contents>,
        );
        const kids = [...document.querySelector(".layout-body")!.children];
        expect([kind, kids.length, kids[0]?.classList.contains("cell")]).toEqual([
          kind,
          1,
          true,
        ]);
      }
    });

    it("keeps every tab mounted and validating, and the same node across a switch", () => {
      const a = ctx.newControl("x");
      const b = ctx.newControl("");
      mount(
        <Tabs
          items={[
            { key: "one", title: "First", children: <TextField field={a} id="a" /> },
            { key: "two", title: "Second", children: <TextField field={b} id="b" required /> },
          ]}
        />,
      );
      const inputB = byId("b");
      expect(inputB).not.toBeNull();
      expect(validation.isValid(rc)).toBe(false);
      const second = [...document.querySelectorAll('[role="tab"]')].find((t) =>
        t.textContent?.includes("Second"),
      )!;
      click(second);
      expect(byId("b")).toBe(inputB);
      expect(rc.getValue(b)).toBe("");
    });

    it("takes a hidden tab off the strip, its panel kept mounted and no longer validating", () => {
      const hide = ctx.newControl(false);
      mount(
        <Tabs
          items={[
            { key: "one", title: "First", children: <TextField field={ctx.newControl("x")} id="a" /> },
            {
              key: "two",
              title: "Second",
              hidden: (rc) => rc.getValue(hide),
              children: (
                <>
                  <TextField field={ctx.newControl("")} id="b" required />
                  <p id="plain-two">Plain</p>
                </>
              ),
            },
          ]}
        />,
      );
      const tab = () =>
        [...document.querySelectorAll('[role="tab"]')].find((t) =>
          t.textContent?.includes("Second"),
        ) as HTMLElement | undefined;
      const plain = byId("plain-two");
      expect(onScreen(tab())).toBe(true);
      expect(validation.isValid(rc)).toBe(false);
      set(hide, true);
      expect(onScreen(tab())).toBe(false);
      expect(byId("plain-two")).toBe(plain);
      expect(validation.isValid(rc)).toBe(true);
      set(hide, false);
      expect(onScreen(tab())).toBe(true);
      expect(byId("plain-two")).toBe(plain);
    });

    it("skips a hidden wizard page with Next and Back", async () => {
      const page = ctx.newControl<number | undefined>(0);
      mount(
        <Wizard
          page={page}
          items={[
            { key: "p1", title: "One", children: <TextDisplay text="page one" /> },
            {
              key: "p2",
              title: "Two",
              hidden: true,
              children: <TextField field={ctx.newControl("")} id="skipped" required />,
            },
            { key: "p3", title: "Three", children: <TextDisplay text="page three" /> },
          ]}
        />,
      );
      click(buttonNamed("Next")!);
      await flush();
      expect(rc.getValue(page)).toBe(2);
      click(buttonNamed("Back")!);
      expect(rc.getValue(page)).toBe(0);
    });

    it("keeps a closed dialog's content mounted and validating", async () => {
      const open = ctx.newControl(false);
      const inside = ctx.newControl("");
      const dismissed = vi.fn();
      mount(
        <Dialog open={open} onClose={dismissed} title="Details">
          <TextField field={inside} id="inside" required />
        </Dialog>,
      );
      expect(byId("inside")).not.toBeNull();
      expect(validation.isValid(rc)).toBe(false);
      set(open, true);
      const node = byId("inside");
      set(open, false);
      await flush();
      expect(byId("inside")).toBe(node);
      // Closed by the author's own code: not a dismissal.
      expect(dismissed).not.toHaveBeenCalled();
    });

    it("refuses the wizard's Next on an invalid page, and advances on a valid one", async () => {
      const page = ctx.newControl<number | undefined>(0);
      const name = ctx.newControl("");
      mount(
        <Wizard
          page={page}
          items={[
            { key: "p1", title: "One", children: <TextField field={name} id="w" required /> },
            { key: "p2", title: "Two", children: <TextDisplay text="page two" /> },
          ]}
        />,
      );
      click(buttonNamed("Next")!);
      await flush();
      expect(rc.getValue(page)).toBe(0);
      set(name, "ok");
      click(buttonNamed("Next")!);
      await flush();
      expect(rc.getValue(page)).toBe(1);
    });

    it("submits a form through its submit action, and through the form element's own submit", async () => {
      const name = ctx.newControl("");
      const submitted: unknown[] = [];
      function Submitting() {
        validation = useFormValidation();
        return (
          <Form validation={validation} onSubmit={() => void submitted.push(rc.getValue(name))}>
            <TextField field={name} id="sub" label="Name" required requiredMessage="Needed" />
            <Action actionId="save" text="Save" submit variant="primary" />
          </Form>
        );
      }
      act(() =>
        root.render(
          <ControlContextProvider value={ctx}>
            {(impl.wrap ?? ((t: ReactNode) => t))(
              <FormProvider renderers={impl.renderers}>
                <Submitting />
              </FormProvider>,
            )}
          </ControlContextProvider>,
        ),
      );
      const input = byId<HTMLInputElement>("sub")!;
      const form = input.closest("form");
      const save = buttonNamed("Save")!;
      // A real form element around the fields, and Save its submit button —
      // what Enter in a field presses.
      expect(form).not.toBeNull();
      expect(save.type).toBe("submit");
      expect(save.form).toBe(form);
      click(save);
      await flush();
      expect(submitted).toEqual([]);
      expect(text()).toContain("Needed");
      set(name, "Ada");
      click(save);
      await flush();
      expect(submitted).toEqual(["Ada"]);
      act(() => {
        form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await flush();
      expect(submitted).toEqual(["Ada", "Ada"]);
    });

    it("runs an action, and locks it while an async handler is busy", async () => {
      let finish!: () => void;
      const clicked = vi.fn(() => new Promise<void>((r) => (finish = r)));
      mount(<Action actionId="save" text="Save" variant="primary" onClick={clicked} />);
      click(buttonNamed("Save")!);
      expect(clicked).toHaveBeenCalledOnce();
      expect(buttonNamed("Save")?.disabled ?? true).toBe(true);
      await act(async () => finish());
      await flush();
      expect(buttonNamed("Save")!.disabled).toBe(false);
    });

    it("draws a collection's rows, and one element's edit re-renders into its row", () => {
      const pets = ctx.newControl([{ name: "Rex" }, { name: "Tiddles" }]);
      mount(
        <Elements field={pets}>
          {(p, i) => <TextField field={p.fields.name} id={`pet${i}`} />}
        </Elements>,
      );
      expect(byId<HTMLInputElement>("pet1")!.value).toBe("Tiddles");
      type(byId<HTMLInputElement>("pet0")!, "Max");
      expect(rc.getValue(pets)[0].name).toBe("Max");
    });

    it("draws text and html displays", () => {
      mount(
        <>
          <TextDisplay text="plain words" />
          <HtmlDisplay html="<b>bold words</b>" />
        </>,
      );
      expect(text()).toContain("plain words");
      expect(document.querySelector("b")?.textContent).toBe("bold words");
    });

    it("hosts a third-party field in its own shell", () => {
      const rating = ctx.newControl<number | undefined>(undefined);
      mount(<Stars field={rating} label="Rate us" maxStars={3} />);
      expect(text()).toContain("Rate us");
      click(buttonNamed("2 of 3")!);
      expect(rc.getValue(rating)).toBe(2);
    });

    it("hosts a third-party collection, its buttons drawn by the implementation", () => {
      const pets = ctx.newControl([{ name: "Rex" }]);
      mount(
        <PetCards field={pets} label="Pets" maxLength={3}>
          {(p, i) => <TextField field={p.fields.name} id={`card${i}`} />}
        </PetCards>,
      );
      click(buttonNamed("Add card")!);
      expect(rc.getValue(pets)).toHaveLength(2);
      click(buttonNamed("Remove")!);
      expect(rc.getValue(pets)).toHaveLength(1);
    });

    it("renders the JSON fixture form", async () => {
      const data = ctx.newControl<Record<string, unknown>>({
        firstName: "Ada",
        pets: [{ name: "Rex" }],
        address: { street: "", city: "" },
        status: "active",
        hasPets: true,
      });
      mount(
        <JsonForm
          controls={demoControls}
          schema={demoSchema}
          data={data}
          actionHandler={() => () => {}}
          displays={{ greeting: () => <TextDisplay text="host greeting" /> }}
        />,
      );
      await flush();
      expect(text()).toContain("Pet 1 of 1");
      expect(text()).toContain("host greeting");
    });
  });
}
