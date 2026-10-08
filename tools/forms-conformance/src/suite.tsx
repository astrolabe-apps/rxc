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
  CheckListField,
  Contents,
  DisplayOnlyField,
  Dialog,
  Disclosure,
  Elements,
  Form,
  FormProvider,
  FormRenderers as FormRenderersOverride,
  Section,
  combineClass,
  type GroupRenderProps,
  HtmlDisplay,
  InlineGroup,
  RadioField,
  RichText,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  useFormValidation,
  useWizard,
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
  /**
   * Its theme naming three looks, around `node`: a text variant `lead`, a
   * group variant `card` and an action variant `quiet`, each drawn
   * differently from the base look — however the implementation says looks.
   */
  looks: (node: ReactNode) => ReactNode;
  /**
   * What its platform cannot do, so the suite holds it to what it can
   * instead. None on the web; React Native has all three.
   */
  limits?: {
    /**
     * A dialog's content cannot keep one node across opening and closing —
     * React Native's Modal mounts its content only while visible. It is
     * still mounted, validating and out of reach while closed.
     */
    dialogMovesContent?: boolean;
    /** No form element: a `<Form onSubmit>` submits through its submit action. */
    noFormElement?: boolean;
    /** An html display draws its markup's text, not its markup. */
    htmlAsText?: boolean;
  };
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
    /**
     * The checkboxes or radios drawn: native inputs, or elements with the
     * role — React Native's, through react-native-web. Either is the control
     * a screen reader announces.
     */
    const choices = (kind: "checkbox" | "radio") => [
      ...container.querySelectorAll<HTMLElement>(`input[type="${kind}"], [role="${kind}"]`),
    ];
    const isChecked = (el: HTMLElement) =>
      el instanceof HTMLInputElement ? el.checked : el.getAttribute("aria-checked") === "true";
    // Text as assistive technology reads it: aria-hidden decoration (a
    // required marker) left out.
    const readable = (el: Element) => {
      const copy = el.cloneNode(true) as Element;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((h) => h.remove());
      return copy.textContent!.replace(/\s+/g, " ").trim();
    };
    const texts = (ids: string) =>
      ids
        .split(/\s+/)
        .map((id) => {
          const el = document.getElementById(id);
          return el ? readable(el) : `(no #${id})`;
        })
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
        const labelEl = forIt ?? el.closest("label");
        const name = by
          ? texts(by)
          : (el.getAttribute("aria-label") ??
            (labelEl ? readable(labelEl) : "(no name)"));
        return {
          name,
          description: texts(el.getAttribute("aria-describedby")!),
          invalid: el.getAttribute("aria-invalid") === "true",
          required: el.getAttribute("aria-required") === "true",
        };
      });
    /** Out of the Tab order: inert, hidden, in a closed `<dialog>`, or not drawn. */
    const outOfReach = (el: Element) => {
      if (el.closest("[inert], [hidden], dialog:not([open])")) return true;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden") return true;
      }
      return false;
    };
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
      // Read through the control's description, not announced on its own: a
      // live region per invalid field would talk over the form's own
      // (Fluent's Field makes its message an alert unless told not to).
      const error = document.getElementById(byId("name")!.getAttribute("aria-describedby")!)!;
      expect(error.closest('[role="alert"], [role="status"], [aria-live]')).toBeNull();
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

    it("ticks a set of choices into an array, and refuses an empty one when required", () => {
      const v = ctx.newControl<string[] | undefined>(undefined);
      mount(
        <CheckListField
          field={v}
          label="Reasons"
          required
          requiredMessage="Pick one"
          options={[
            { name: "Ay", value: "a" },
            { name: "Bee", value: "b" },
          ]}
        />,
      );
      const box = (name: string) =>
        choices("checkbox").find(
          // Its label: around it, or one `for` it (Fluent's is a sibling), or
          // its own name.
          (i) =>
            (
              (i.id
                ? container.querySelector(`label[for="${CSS.escape(i.id)}"]`)
                : null) ?? i.closest("label")
            )?.textContent?.includes(name) || i.getAttribute("aria-label")?.includes(name),
        )!;
      click(box("Bee"));
      click(box("Ay"));
      expect(rc.getValue(v)).toEqual(["b", "a"]);
      expect(isChecked(box("Ay"))).toBe(true);
      click(box("Bee"));
      click(box("Ay"));
      expect(rc.getValue(v)).toEqual([]);
      act(() => ctx.update((wc) => wc.setTouched(v, true)));
      expect(text()).toContain("Pick one");
    });

    for (const [kind, input, widget] of [
      [
        "a set of choices",
        "checkbox",
        (v: Control<string[] | undefined>) => (
          <CheckListField field={v} label="Reasons" required options={options} />
        ),
      ],
      [
        "a radio",
        "radio",
        (v: Control<string | undefined>) => (
          <RadioField field={v} label="Pick" required options={options} />
        ),
      ],
    ] as const)
      it(`touches ${kind} when focus leaves it, not when it moves between its options`, () => {
        const v = ctx.newControl<never>(undefined as never);
        mount(
          <>
            {widget(v)}
            <button type="button">Elsewhere</button>
          </>,
        );
        const [first, second] = choices(input);
        const focusOut = (from: HTMLElement, to: HTMLElement) =>
          act(() => {
            from.dispatchEvent(
              new FocusEvent("focusout", { bubbles: true, relatedTarget: to }),
            );
          });
        // A move inside must not touch it: in a centred dialog, the required
        // error appearing mid-click shifts the option away from the pointer.
        focusOut(first, second);
        expect(rc.isTouched(v)).toBe(false);
        focusOut(second, buttonNamed("Elsewhere")!);
        expect(rc.isTouched(v)).toBe(true);
      });

    it("toggles a checkbox", () => {
      const ok = ctx.newControl(false);
      mount(<CheckboxField field={ok} id="ok" label="Agree" />);
      expect(text()).toContain("Agree");
      click(choices("checkbox")[0]!);
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
      const radios = choices("radio");
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
        ["checklist", (c) => <CheckListField field={c} label="Checklist name" options={opts} required requiredMessage="Needed" helpText="Help" />],
      ];
      // A set of choices is one group, named and described; a field, none.
      // (A library's decoration — MUI's notch is a fieldset — is aria-hidden.)
      const groups = () =>
        [...container.querySelectorAll('fieldset, [role="group"], [role="radiogroup"]')].filter(
          (el) => !el.closest('[aria-hidden="true"]'),
        ).length;
      for (const [kind, ui] of cases) {
        const c = ctx.newControl<unknown>(undefined);
        mount(ui(c));
        const label = `${kind[0]!.toUpperCase()}${kind.slice(1)} name`.replace(
          "Checkbox",
          "Check",
        );
        // The exact name — the marker is not part of it — and required said
        // by the control. ARIA has neither aria-invalid nor aria-required on
        // role="group", so a check list's group is described as required
        // (first, before the help or error) and its checkboxes carry invalid.
        const group = kind === "checklist";
        const said = (d: string) => (group ? `Required ${d}` : d);
        const named = (description: string, invalid: boolean) => [
          kind,
          [{ name: label, description: said(description), invalid, required: !group }],
        ];
        expect([kind, read()]).toEqual(named("Help", false));
        expect([kind, groups()]).toEqual([
          kind,
          kind === "radio" || kind === "checklist" ? 1 : 0,
        ]);
        act(() => ctx.update((wc) => wc.setTouched(c, true)));
        expect([kind, read()]).toEqual(named("Needed", !group));
        if (group)
          expect(
            choices("checkbox").map((b) =>
              b.getAttribute("aria-invalid"),
            ),
          ).toEqual(["true", "true"]);
      }
    });

    it("names a field by a label it does not draw (hideLabel)", () => {
      const opts = [
        { name: "Ay", value: "a" },
        { name: "Bee", value: "b" },
      ];
      // Visually hidden: in the tree, clipped to nothing — by an inline style
      // or a library's screen-reader-only class.
      const clipped = (el: Element | null) => {
        for (let e = el; e; e = e.parentElement) {
          const st = (e as HTMLElement).style;
          if (st?.clipPath === "inset(50%)" || /^rect\(0/.test(st?.clip ?? ""))
            return true;
          if (/\b(sr-only|visually-hidden|visuallyhidden)\b/.test(e.className.toString()))
            return true;
        }
        return false;
      };
      const cases: [string, (c: Control<any>) => ReactNode][] = [
        ["text", (c) => <TextField field={c} id="f" label="Text name" hideLabel required helpText="Help" />],
        ["select", (c) => <SelectField field={c} id="f" label="Select name" hideLabel options={opts} required helpText="Help" />],
        ["radio", (c) => <RadioField field={c} id="f" label="Radio name" hideLabel options={opts} required helpText="Help" />],
        ["checkbox", (c) => <CheckboxField field={c} id="f" label="Check name" hideLabel required helpText="Help" />],
        ["checklist", (c) => <CheckListField field={c} id="f" label="Checklist name" hideLabel options={opts} required helpText="Help" />],
      ];
      for (const [kind, ui] of cases) {
        mount(ui(ctx.newControl<unknown>(undefined)));
        const label = `${kind[0]!.toUpperCase()}${kind.slice(1)} name`.replace("Checkbox", "Check");
        // Named exactly as with a drawn label, described the same.
        expect([kind, read().map((r) => [r.name, r.description])]).toEqual([
          kind,
          [[label, kind === "checklist" ? "Required Help" : "Help"]],
        ]);
        // The label is under its id and not drawn — or, where a platform
        // names a control by a string, not there at all — and with it goes the
        // required marker: nothing on screen reads the label's words.
        const el = byId("f-label");
        expect([kind, !el || clipped(el)]).toEqual([kind, true]);
        const drawn = [...container.querySelectorAll("*")].filter(
          (e) =>
            !clipped(e) &&
            !e.closest('[aria-hidden="true"]') &&
            [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.includes(label)),
        );
        expect([kind, drawn.length]).toEqual([kind, 0]);
        act(() => root.render(null));
      }
    });

    it("puts a field's help behind a button at the label's end, still its description (labelEnd)", () => {
      const opts = [
        { name: "Ay", value: "a" },
        { name: "Bee", value: "b" },
      ];
      const cases: [string, (c: Control<any>) => ReactNode][] = [
        ["text", (c) => <TextField field={c} label="Text name" helpText="Help words" helpPlacement="labelEnd" />],
        ["select", (c) => <SelectField field={c} label="Select name" options={opts} helpText="Help words" helpPlacement="labelEnd" />],
        ["radio", (c) => <RadioField field={c} label="Radio name" options={opts} helpText="Help words" helpPlacement="labelEnd" />],
        ["checkbox", (c) => <CheckboxField field={c} label="Check name" helpText="Help words" helpPlacement="labelEnd" />],
      ];
      for (const [kind, ui] of cases) {
        mount(ui(ctx.newControl<unknown>(undefined)));
        const label = `${kind[0]!.toUpperCase()}${kind.slice(1)} name`.replace("Checkbox", "Check");
        // The name stays exactly the label, and the help is still read with it.
        expect([kind, read().map((r) => [r.name, r.description])]).toEqual([kind, [[label, "Help words"]]]);
        // One button for it, named for help, outside every label element.
        const buttons = [...document.querySelectorAll('button, [role="button"]')].filter((b) =>
          b.getAttribute("aria-label")?.startsWith("Help"),
        );
        expect([kind, buttons.length, buttons.some((b) => b.closest("label"))]).toEqual([kind, 1, false]);
        act(() => root.render(null));
      }
    });

    it("draws a display-only field's and a select's icons either side of the value", () => {
      const v = ctx.newControl("12 Main St");
      const s = ctx.newControl<string | undefined>("a");
      mount(
        <>
          <DisplayOnlyField
            field={v}
            id="shown"
            label="Address"
            startIcon={<i data-icon="d-start" />}
            endIcon={<i data-icon="d-end" />}
          />
          <SelectField
            field={s}
            id="chosen"
            label="Choice"
            options={options}
            startIcon={<i data-icon="s-start" />}
            endIcon={<i data-icon="s-end" />}
          />
        </>,
      );
      const icon = (name: string) => container.querySelector(`[data-icon="${name}"]`);
      const before = (a: Node | null, b: Node | null) =>
        !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      // The display's value as text, and the select's control: an icon on
      // each side, in document order.
      const value = [...container.querySelectorAll("*")]
        .flatMap((e) => [...e.childNodes])
        .find((n) => n.nodeType === 3 && n.textContent === "12 Main St")!;
      const select = byId("chosen")!;
      expect([
        before(icon("d-start"), value),
        before(value, icon("d-end")),
        before(icon("s-start"), select),
        before(select, icon("s-end")),
      ]).toEqual([true, true, true, true]);
    });

    it("shows a character count as part of the field, describing the input", () => {
      const c = ctx.newControl("abc");
      const d = ctx.newControl("ab");
      mount(
        <>
          <TextField field={c} id="counted" label="Counted" maxLength={10} showCount helpText="Help" />
          <TextField
            field={d}
            id="worded"
            label="Worded"
            maxLength={10}
            showCount={{ format: (n, max) => `${n} of ${max} characters` }}
          />
        </>,
      );
      const count = (id: string) => byId(`${id}-count`)?.textContent;
      expect([count("counted"), count("worded")]).toEqual(["3 / 10", "2 of 10 characters"]);
      // In the input's description, after the help.
      expect(byId("counted")!.getAttribute("aria-describedby")).toBe("counted-help counted-count");
      expect(byId("worded")!.getAttribute("aria-describedby")).toBe("worded-count");
      set(c, "abcdef");
      expect(count("counted")).toBe("6 / 10");
    });

    it("caps a text field at maxLength, and reports a longer value as an error", () => {
      const c = ctx.newControl("too long already");
      mount(<TextField field={c} id="capped" label="Capped" maxLength={5} />);
      expect(byId<HTMLInputElement>("capped")!.maxLength).toBe(5);
      act(() => ctx.update((wc) => wc.setTouched(c, true)));
      expect(text()).toContain("At most 5 characters");
      expect(validation.isValid(rc)).toBe(false);
    });

    it("lets a FormRenderers override style sections only, over the implementation's own region", () => {
      const bordered = (outer: FormRenderers): Partial<FormRenderers> => ({
        contents: (p: GroupRenderProps) => (
          <outer.contents
            {...p}
            shellClassName={
              p.kind === "section" ? combineClass(p.shellClassName, "bordered") : p.shellClassName
            }
          />
        ),
      });
      mount(
        <FormRenderersOverride renderers={bordered}>
          <Section title="A section">
            <Contents>plain region</Contents>
          </Section>
        </FormRenderersOverride>,
      );
      const bordered$ = [...container.querySelectorAll(".bordered")];
      expect(bordered$).toHaveLength(1);
      // The implementation's own region: its heading inside, the plain one
      // nested and not bordered.
      expect(bordered$[0]!.querySelector('[role="heading"]')?.textContent).toBe("A section");
      expect(bordered$[0]!.textContent).toContain("plain region");
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

    it("draws a heading display at the outline's level, as a group title there would be", () => {
      mount(
        <>
          <TextDisplay text="Page title" heading />
          <Contents title="Section">
            <TextDisplay text="Card title" heading />
            <TextDisplay text="Body text" />
          </Contents>
          <InlineGroup>
            <TextDisplay text="In prose" heading />
          </InlineGroup>
        </>,
      );
      const headings = [...container.querySelectorAll('[role="heading"], h1, h2, h3, h4, h5, h6')].map(
        (h) => [h.textContent?.trim(), h.getAttribute("aria-level") ?? h.tagName.slice(1)],
      );
      // Never in prose: an inline group's text stays text.
      expect(headings).toEqual([
        ["Page title", "2"],
        ["Section", "2"],
        ["Card title", "3"],
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

    it("wires each tab to its panel, and the panel back to its tab", () => {
      mount(
        <Tabs
          items={[
            { key: "one", title: "First", children: <TextField field={ctx.newControl("")} id="a" /> },
            { key: "two", title: "Second", children: <TextField field={ctx.newControl("")} id="b" /> },
          ]}
        />,
      );
      // A strip whose library draws no panels (MUI's, Fluent's) leaves this
      // wiring to the implementation, and nothing else would notice it absent.
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      expect(tabs).toHaveLength(2);
      for (const [tab, field] of [
        [tabs[0]!, "a"],
        [tabs[1]!, "b"],
      ] as const) {
        const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
        expect([panel?.getAttribute("role"), panel?.getAttribute("aria-labelledby")]).toEqual([
          "tabpanel",
          tab.id,
        ]);
        expect(panel!.contains(byId(field))).toBe(true);
      }
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
        <>
          <Action actionId="openDetails" text="Open details" onClick={() => void set(open, true)} />
          <Dialog open={open} onClose={dismissed} title="Details">
            <TextField field={inside} id="inside" required />
          </Dialog>
        </>,
      );
      expect(byId("inside")).not.toBeNull();
      expect(validation.isValid(rc)).toBe(false);
      // Mounted, but out of reach: no Tab key lands in a dialog nobody can
      // see (Fluent's closed surface is only transparent and aria-hidden).
      // Checked before the first open only: after a close, MUI and Ant hide
      // the surface when their exit transition ends, which happy-dom never runs.
      expect(outOfReach(byId("inside")!)).toBe(true);
      const opener = buttonNamed("Open details")!;
      act(() => opener.focus());
      click(opener);
      const node = byId("inside");
      set(open, false);
      await flush();
      // Closed by the author's own code: not a dismissal.
      expect(dismissed).not.toHaveBeenCalled();
      if (impl.limits?.dialogMovesContent) {
        // Mounted again in place, still validating and out of reach.
        expect([!!byId("inside"), validation.isValid(rc), outOfReach(byId("inside")!)]).toEqual([
          true,
          false,
          true,
        ]);
        return;
      }
      expect(byId("inside")).toBe(node);
      // Focus goes back where it was, which no library does for a dialog it
      // did not open from its own trigger unless the implementation sees to it.
      expect(document.activeElement).toBe(opener);
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
      // Refused: it stays, and takes the user to what to fix.
      expect([rc.getValue(page), document.activeElement?.id]).toEqual([0, "w"]);
      set(name, "ok");
      click(buttonNamed("Next")!);
      await flush();
      expect(rc.getValue(page)).toBe(1);
    });

    it("draws only the pages of a wizard with no navigation, moved by its pages' own actions", async () => {
      const name = ctx.newControl("");
      const results: boolean[] = [];
      function Continue() {
        const wizard = useWizard();
        return (
          <Action
            actionId="continue"
            text="Continue"
            onClick={async () => void results.push(await wizard.next())}
          />
        );
      }
      function Finish() {
        const wizard = useWizard();
        return <Action actionId="finish" text="Finish" onClick={() => wizard.goTo("done")} />;
      }
      mount(
        <Wizard
          navigation="none"
          items={[
            {
              key: "who",
              title: "Who step",
              children: (
                <>
                  <TextField field={name} id="w" label="Name" required />
                  <Continue />
                </>
              ),
            },
            { key: "check", title: "Check step", children: <Finish /> },
            { key: "skipped", title: "Skipped step", children: <TextDisplay text="never" /> },
            { key: "done", title: "Done step", children: <TextDisplay text="all done" /> },
          ]}
        />,
      );
      // No strip, no Back / Next: the step titles are drawn nowhere.
      expect([buttonNamed("Next"), buttonNamed("Back"), text().includes("Who step")]).toEqual([
        undefined,
        undefined,
        false,
      ]);
      // The page's own action is the gate: refused while the page fails.
      click(buttonNamed("Continue")!);
      await flush();
      expect([results, onScreen(byId("w"))]).toEqual([[false], true]);
      set(name, "Ada");
      click(buttonNamed("Continue")!);
      await flush();
      expect([results, onScreen(buttonNamed("Finish"))]).toEqual([[false, true], true]);
      // An outcome the host decided: straight to it, unchecked.
      click(buttonNamed("Finish")!);
      await flush();
      expect(onScreen([...document.querySelectorAll("p, span, div")].find((e) => e.textContent === "all done"))).toBe(true);
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
      if (!impl.limits?.noFormElement) {
        // A real form element around the fields, and Save its submit button —
        // what Enter in a field presses.
        expect(form).not.toBeNull();
        expect(save.type).toBe("submit");
        expect(save.form).toBe(form);
      }
      click(save);
      await flush();
      expect(submitted).toEqual([]);
      expect(text()).toContain("Needed");
      set(name, "Ada");
      click(save);
      await flush();
      expect(submitted).toEqual(["Ada"]);
      if (impl.limits?.noFormElement) return;
      act(() => {
        form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
      await flush();
      expect(submitted).toEqual(["Ada", "Ada"]);
    });

    it("publishes a focus target for every widget kind", () => {
      const opts = [
        { name: "Ay", value: "a" },
        { name: "Bee", value: "b" },
      ];
      const cases: [string, Control<any>, (c: Control<any>) => ReactNode][] = [
        ["text", ctx.newControl(""), (c) => <TextField field={c} label="T" />],
        ["select", ctx.newControl(undefined), (c) => <SelectField field={c} label="S" options={opts} />],
        ["radio", ctx.newControl(undefined), (c) => <RadioField field={c} label="R" options={opts} />],
        ["checkbox", ctx.newControl(false), (c) => <CheckboxField field={c} label="C" />],
        ["checklist", ctx.newControl([]), (c) => <CheckListField field={c} label="L" options={opts} />],
      ];
      mount(<>{cases.map(([k, c, ui]) => <div key={k}>{ui(c)}</div>)}</>);
      expect(
        cases.map(([k, c]) => [k, typeof (c.meta.element as { focus?: unknown } | undefined)?.focus]),
      ).toEqual(cases.map(([k]) => [k, "function"]));
    });

    it("keeps a closed disclosure's content mounted and validating, and opens it to focus a refused field", async () => {
      const where = ctx.newControl("");
      function Submitting() {
        validation = useFormValidation();
        return (
          <Form validation={validation} onSubmit={() => {}}>
            <Disclosure title="How to find this">
              <TextField field={where} id="where" label="Where" required />
            </Disclosure>
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
      // The toggle: the element naming it that says whether it is expanded —
      // aria-expanded, or a native <summary>, whose <details> says.
      const toggle = () =>
        [...document.querySelectorAll("summary, [aria-expanded]")].find((e) =>
          e.textContent?.includes("How to find this"),
        ) as HTMLElement;
      const expanded = () => {
        const t = toggle();
        return t.tagName === "SUMMARY"
          ? (t.parentElement as HTMLDetailsElement).open
          : t.getAttribute("aria-expanded") === "true";
      };
      // Closed: the field is there, and still refuses the form — a check
      // that only touches leaves it closed.
      expect([
        expanded(),
        !!byId("where"),
        await act(() => validation.check({ focus: false })),
        expanded(),
      ]).toEqual([false, true, false, false]);
      // The toggle opens and closes it, the field the same node throughout.
      const input = byId("where");
      click(toggle());
      expect(expanded()).toBe(true);
      click(toggle());
      expect([expanded(), byId("where")]).toEqual([false, input]);
      // A refused submit opens it, then focuses the field inside.
      click(buttonNamed("Save")!);
      await flush();
      await flush();
      expect([expanded(), document.activeElement?.id]).toEqual([true, "where"]);
    });

    it("switches to the tab holding the first field in error before focusing it", async () => {
      const second = ctx.newControl("");
      function Submitting() {
        validation = useFormValidation();
        return (
          <Form validation={validation} onSubmit={() => {}}>
            <Tabs
              items={[
                { key: "one", title: "First", children: <TextField field={ctx.newControl("x")} id="t1" label="One" /> },
                { key: "two", title: "Second", children: <TextField field={second} id="t2" label="Two" required /> },
              ]}
            />
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
      // Focus has to land on a field that is on screen: the switch first.
      const seen: boolean[] = [];
      byId("t2")!.addEventListener("focus", () => seen.push(onScreen(byId("t2"))));
      click(buttonNamed("Save")!);
      await flush();
      await flush();
      const selected = [...document.querySelectorAll('[role="tab"]')].find(
        (t) => t.getAttribute("aria-selected") === "true",
      );
      expect([selected?.textContent?.includes("Second"), document.activeElement?.id, seen]).toEqual([
        true,
        "t2",
        [true],
      ]);
    });

    it("focuses the first field in error, in document order, when a submit is refused", async () => {
      const showTop = ctx.newControl(false);
      const top = ctx.newControl("");
      const first = ctx.newControl("");
      const second = ctx.newControl("");
      function Submitting() {
        validation = useFormValidation();
        return (
          <Form validation={validation} onSubmit={() => {}}>
            {/* Revealed after the others mounted, so it registers last. */}
            <TextField field={top} id="top" label="Top" required hidden={(r) => !r.getValue(showTop)} />
            <TextField field={ctx.newControl("")} id="optional" label="Optional" />
            <TextField field={first} id="first" label="First" required />
            <TextField field={second} id="second" label="Second" required />
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
      click(buttonNamed("Save")!);
      await flush();
      expect(document.activeElement?.id).toBe("first");
      set(first, "ok");
      set(showTop, true);
      click(buttonNamed("Save")!);
      await flush();
      expect(document.activeElement?.id).toBe("top");
    });

    it("draws a look the theme names, and the base look with one warning for a name it does not", () => {
      // Unique per run: the warning is once per name, for the whole process.
      const unknown = "unnamed" + Math.random().toString(36).slice(2);
      const clicked = vi.fn();
      const ui = (
        <>
          <TextDisplay text="Base words" />
          <TextDisplay text="Lead words" variant="lead" />
          <TextDisplay text="Unknown words" variant={unknown} />
          <Contents title="Base region">
            <TextDisplay text="in base" />
          </Contents>
          <Contents title="Card region" variant="card">
            <TextDisplay text="in card" />
          </Contents>
          <Contents title="Unknown region" variant={unknown}>
            <TextDisplay text="in unknown" />
          </Contents>
          <Action actionId="plain" text="Base button" />
          <Action actionId="quietly" text="Quiet button" variant="quiet" />
          <Action actionId="unnamed" text="Unknown button" variant={unknown} onClick={clicked} />
        </>
      );
      mount(impl.looks(ui));
      // What is drawn around some words: every element's class and style,
      // from the innermost holding exactly them out to the form. A look is
      // whatever the implementation styles with; only a difference counts.
      const look = (words: string) => {
        const holders = [...container.querySelectorAll("*")].filter(
          (e) => e.textContent?.trim() === words,
        );
        const chain: string[] = [];
        for (let e: Element | null = holders.pop()!; e && e !== container; e = e.parentElement)
          chain.push(`${e.getAttribute("class") ?? ""}|${e.getAttribute("style") ?? ""}`);
        return chain.join(" / ");
      };
      expect([
        look("Lead words") !== look("Base words"),
        look("Card region") !== look("Base region"),
        look("Quiet button") !== look("Base button"),
        look("Unknown words") === look("Base words"),
        look("Unknown region") === look("Base region"),
        look("Unknown button") === look("Base button"),
      ]).toEqual([true, true, true, true, true, true]);
      // One warning per kind, naming the variant — and none again on the
      // next render.
      const warnings = logged.splice(0);
      expect(
        ["text", "group", "action"].map(
          (kind) => warnings.filter((w) => w.includes(`${kind} variant "${unknown}"`)).length,
        ),
      ).toEqual([1, 1, 1]);
      expect(warnings).toHaveLength(3);
      mount(impl.looks(ui));
      click(buttonNamed("Unknown button")!);
      expect([logged.splice(0), clicked.mock.calls.length]).toEqual([[], 1]);
    });

    it("draws rich text in a label, a help text and a display, naming and describing by its words", () => {
      mount(
        <>
          <TextField
            field={ctx.newControl("")}
            id="rich"
            label={<RichText html="Is <b>UBER</b> over 1m<sup>3</sup>?" />}
            helpText={<RichText html={'See <a href="https://example.test/guide" target="_blank">the guide</a>'} />}
          />
          <TextDisplay
            text={<RichText html={'<i>Card</i>:<br><img src="https://example.test/card.png" alt="Licence card" width="260" height="160">'} />}
          />
        </>,
      );
      expect(read()).toEqual([
        { name: "Is UBER over 1m3?", description: "See the guide", invalid: false, required: false },
      ]);
      // Emphasis and the superscript each an element of their own.
      const holder = (words: string) =>
        [...container.querySelectorAll("*")].filter((e) => e.textContent === words).pop();
      expect([!!holder("UBER"), !!holder("3"), !!holder("Card")]).toEqual([true, true, true]);
      // A real link, going where the markup said.
      const link = holder("the guide")!.closest("a");
      expect(link?.getAttribute("href")).toBe("https://example.test/guide");
      // The image, named by its alt.
      expect(container.querySelector('[alt="Licence card"], [aria-label="Licence card"]')).not.toBeNull();
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

    it("announces a display as an alert or a status, and only when asked", () => {
      mount(
        <>
          <TextDisplay text="Submission refused" tone="error" announce />
          <TextDisplay text="Saved" tone="success" announce />
          <TextDisplay text="301 / 300 characters" tone="error" />
        </>,
      );
      const roleOf = (t: string) =>
        [...container.querySelectorAll('[role="alert"], [role="status"]')]
          .filter((e) => e.textContent?.includes(t))
          .map((e) => e.getAttribute("role"));
      expect(roleOf("Submission refused")).toEqual(["alert"]);
      expect(roleOf("Saved")).toEqual(["status"]);
      // A toned value the user is typing into is not read out on every key.
      expect(roleOf("301 / 300")).toEqual([]);
    });

    it("keeps an announced display's live region mounted while it is hidden or empty", () => {
      const error = ctx.newControl<string | undefined>(undefined);
      const note = ctx.newControl("");
      mount(
        <>
          <TextDisplay
            hidden={(r) => !r.getValue(error)}
            text={error}
            tone="error"
            announce
          />
          <TextDisplay text={note} announce />
        </>,
      );
      const alert = document.querySelector('[role="alert"]')!;
      const status = document.querySelector('[role="status"]')!;
      // Present but empty: nothing drawn, nothing to read.
      expect(alert).not.toBeNull();
      expect(alert.textContent).toBe("");
      expect(alert.childNodes).toHaveLength(0);
      expect(status.textContent).toBe("");
      expect(status.childNodes).toHaveLength(0);
      // Shown: the content arrives in the region already in the page.
      set(error, "Submission refused");
      set(note, "Saved");
      expect(document.querySelector('[role="alert"]')).toBe(alert);
      expect(alert.textContent).toContain("Submission refused");
      expect(document.querySelector('[role="status"]')).toBe(status);
      expect(status.textContent).toContain("Saved");
      // And hidden again, the same region, emptied.
      set(error, undefined);
      expect(document.querySelector('[role="alert"]')).toBe(alert);
      expect(alert.textContent).toBe("");
    });

    it("draws text and html displays", () => {
      mount(
        <>
          <TextDisplay text="plain words" />
          <HtmlDisplay html="<b>bold words</b>" />
        </>,
      );
      expect(text()).toContain("plain words");
      if (impl.limits?.htmlAsText) {
        expect([text().includes("bold words"), text().includes("<b>")]).toEqual([true, false]);
        return;
      }
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
