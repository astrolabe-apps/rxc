import { beforeEach, describe, expect, it } from "vitest";
import { act, type ReactNode } from "react";
import { untrackedRead, type Control } from "@rx-controls/core";
import { useControl } from "@rx-controls/react";
import {
  Dialog,
  Disclosure,
  DisplayOnlyField,
  Form,
  FormProvider,
  Section,
  Tabs,
  TextField,
  useDisplayValue,
  useMultiSelectController,
  useFormValidation,
  useSelectController,
  useTextInput,
  useWizard,
  Wizard,
  type FieldOption,
  type WizardController,
  type OptionValue,
  type ValidationScope,
} from "../src/index";
import { flush, setupDom } from "./harness";
import { mounts, testRenderers } from "./testRenderers";

const dom = setupDom();
beforeEach(() => mounts.clear());

let root: ValidationScope;
function Owner({
  children,
  ...form
}: { children: ReactNode } & FormOpts) {
  root = useFormValidation();
  return (
    <Form validation={root} {...form}>
      {children}
    </Form>
  );
}
type FormOpts = { clearHidden?: boolean; designMode?: boolean; readOnly?: boolean };
function mount(ui: ReactNode, form: FormOpts = {}) {
  dom.mount(
    <FormProvider renderers={testRenderers}>
      <Owner {...form}>{ui}</Owner>
    </FormProvider>,
  );
}
const $ = <E extends Element = HTMLElement>(sel: string) =>
  dom.container.querySelector(sel) as E | null;
const $$ = (sel: string) => [...dom.container.querySelectorAll(sel)];
const click = (sel: string) => act(() => $<HTMLButtonElement>(sel)!.click());
const set = <T,>(c: Control<T>, v: T) =>
  act(() => dom.ctx.update((wc) => wc.setValue(c, v)));
const rc = untrackedRead;
const touch = <T,>(c: Control<T>) =>
  act(() => dom.ctx.update((wc) => wc.setTouched(c, true)));
const marked = (sel: string) => $(sel)!.hasAttribute("data-invalid");

describe("Tabs", () => {
  function Strip({ a, b }: { a: Control<string>; b: Control<string> }) {
    return (
      <Tabs
        validationKey="main"
        items={[
          { key: "one", title: "One", children: <TextField field={a} id="a" required /> },
          { key: "two", title: "Two", children: <TextField field={b} id="b" required /> },
        ]}
      />
    );
  }

  it("mounts every panel, and switching keeps each widget the same node", () => {
    const a = dom.ctx.newControl("x");
    const b = dom.ctx.newControl("y");
    mount(<Strip a={a} b={b} />, { clearHidden: true });
    const inputB = $("#b");
    expect(inputB).not.toBeNull();
    click('[data-tab="two"]');
    expect($("#b")).toBe(inputB);
    click('[data-tab="one"]');
    expect(mounts.get("a")).toBe(1);
    expect(mounts.get("b")).toBe(1);
    // An inactive tab is silent, not hidden: nothing was cleared.
    expect(rc.getValue(b)).toBe("y");
  });

  it("marks nothing on a form nobody has touched, though an inactive tab validates", () => {
    const b = dom.ctx.newControl("");
    mount(<Strip a={dom.ctx.newControl("")} b={b} />);
    expect(marked('[data-tab="one"]')).toBe(false);
    expect(marked('[data-tab="two"]')).toBe(false);
    expect(root.find(rc, "main")!.child(rc, "two")!.isValid(rc)).toBe(false);
  });

  it("touches the tab the user leaves, so it is marked and its errors show on return", () => {
    const a = dom.ctx.newControl("");
    mount(<Strip a={a} b={dom.ctx.newControl("x")} />);
    click('[data-tab="two"]');
    expect(rc.isTouched(a)).toBe(true);
    expect(marked('[data-tab="one"]')).toBe(true);
    // And up the tree: the strip and the form are showing it too.
    expect(root.find(rc, "main")!.showingErrors(rc)).toBe(true);
    expect(root.showingErrors(rc)).toBe(true);
    click('[data-tab="one"]');
    expect($("[data-error]")!.textContent).toBe("Please enter a value");
    set(a, "filled");
    expect(marked('[data-tab="one"]')).toBe(false);
  });

  it("marks the current tab once a field in it is touched and showing an error", () => {
    const a = dom.ctx.newControl("");
    mount(<Strip a={a} b={dom.ctx.newControl("")} />);
    touch(a);
    expect(marked('[data-tab="one"]')).toBe(true);
    expect(marked('[data-tab="two"]')).toBe(false);
  });

  it("does not touch on leave while the form is read-only", () => {
    const a = dom.ctx.newControl("");
    mount(<Strip a={a} b={dom.ctx.newControl("")} />, { readOnly: true });
    click('[data-tab="two"]');
    expect(rc.isTouched(a)).toBe(false);
    expect(marked('[data-tab="one"]')).toBe(false);
  });

  it("joins the validation tree, its tabs keyed by item key", () => {
    mount(<Strip a={dom.ctx.newControl("")} b={dom.ctx.newControl("")} />);
    const strip = root.find(rc, "main")!;
    expect(strip.kind).toBe("tabs");
    expect(strip.children(rc).map((t) => [t.kind, t.key])).toEqual([
      ["tab", "one"],
      ["tab", "two"],
    ]);
  });

  it("shows every panel at once in design mode", () => {
    mount(<Strip a={dom.ctx.newControl("")} b={dom.ctx.newControl("")} />, {
      designMode: true,
    });
    expect($<HTMLElement>('[data-panel="two"]')!.hidden).toBe(false);
  });
});

describe("Tabs: a refused check", () => {
  it("switches to the tab holding the first field in error, then focuses it", async () => {
    const b = dom.ctx.newControl("");
    mount(
      <Tabs
        items={[
          { key: "one", title: "One", children: <TextField field={dom.ctx.newControl("x")} id="a" /> },
          { key: "two", title: "Two", children: <TextField field={b} id="b" required /> },
        ]}
      />,
    );
    // Whether the panel was on screen when focus arrived: the switch has
    // to have committed first.
    const seen: boolean[] = [];
    $("#b")!.addEventListener("focus", () =>
      seen.push(!$('[data-panel="two"]')!.hidden),
    );
    b.meta.element = $("#b");
    expect(await act(() => root.check())).toBe(false);
    await flush();
    expect([$("[data-tab][data-active]")!.getAttribute("data-tab"), seen]).toEqual([
      "two",
      [true],
    ]);
  });

  it("only touches with { focus: false }, leaving the tab and focus where they are", async () => {
    const b = dom.ctx.newControl("");
    mount(
      <Tabs
        items={[
          { key: "one", title: "One", children: <TextField field={dom.ctx.newControl("x")} id="a" /> },
          { key: "two", title: "Two", children: <TextField field={b} id="b" required /> },
        ]}
      />,
    );
    b.meta.element = $("#b");
    expect(await act(() => root.check({ focus: false }))).toBe(false);
    await flush();
    expect([
      rc.isTouched(b),
      $("[data-tab][data-active]")!.getAttribute("data-tab"),
      document.activeElement?.id,
    ]).toEqual([true, "one", ""]);
  });
});

describe("Tabs: a hidden item", () => {
  function Strip({
    a,
    b,
    hideB,
  }: {
    a: Control<string>;
    b: Control<string>;
    hideB: Control<boolean>;
  }) {
    return (
      <Tabs
        validationKey="main"
        items={[
          { key: "one", title: "One", children: <TextField field={a} id="a" /> },
          {
            key: "two",
            title: "Two",
            hidden: (rc) => rc.getValue(hideB),
            children: (
              <>
                <TextField field={b} id="b" required />
                <p data-plain />
              </>
            ),
          },
        ]}
      />
    );
  }

  it("leaves the strip, keeps its panel mounted, and stops validating", () => {
    const b = dom.ctx.newControl("");
    const hideB = dom.ctx.newControl(false);
    mount(<Strip a={dom.ctx.newControl("x")} b={b} hideB={hideB} />);
    const plain = $("[data-plain]");
    expect($('[data-tab="two"]')).not.toBeNull();
    expect(root.isValid(rc)).toBe(false);
    set(hideB, true);
    expect($('[data-tab="two"]')).toBeNull();
    expect($("[data-plain]")).toBe(plain);
    expect($<HTMLElement>('[data-panel="two"]')!.hidden).toBe(true);
    // Its field is hidden, not silent: its required rule no longer counts.
    expect($("#b")).toBeNull();
    expect(root.isValid(rc)).toBe(true);
    set(hideB, false);
    expect($('[data-tab="two"]')).not.toBeNull();
    expect($("[data-plain]")).toBe(plain);
  });

  it("is cleared under clearHidden", () => {
    const b = dom.ctx.newControl("typed");
    const hideB = dom.ctx.newControl(false);
    mount(<Strip a={dom.ctx.newControl("x")} b={b} hideB={hideB} />, {
      clearHidden: true,
    });
    set(hideB, true);
    expect(rc.getValue(b)).toBeUndefined();
  });

  it("hands the active tab to the first shown one when it hides", () => {
    const hideB = dom.ctx.newControl(false);
    mount(
      <Strip a={dom.ctx.newControl("x")} b={dom.ctx.newControl("y")} hideB={hideB} />,
    );
    click('[data-tab="two"]');
    expect($('[data-tab="two"]')!.hasAttribute("data-active")).toBe(true);
    set(hideB, true);
    expect($('[data-tab="one"]')!.hasAttribute("data-active")).toBe(true);
    expect($<HTMLElement>('[data-panel="one"]')!.hidden).toBe(false);
    // It stays handed over: showing the tab again does not jump back.
    set(hideB, false);
    expect($('[data-tab="one"]')!.hasAttribute("data-active")).toBe(true);
  });
});

describe("Wizard", () => {
  function Signup({
    name,
    page,
    slow,
  }: {
    name: Control<string>;
    page?: Control<number | undefined>;
    slow?: boolean;
  }) {
    return (
      <Wizard
        validationKey="signup"
        page={page}
        items={[
          {
            key: "who",
            title: "Who",
            children: (
              <TextField
                field={name}
                id="name"
                required
                validate={
                  slow
                    ? {
                        taken: async (v) => {
                          await new Promise((r) => setTimeout(r, 20));
                          return v === "Smith" ? "Taken" : null;
                        },
                      }
                    : undefined
                }
              />
            ),
          },
          { key: "detail", title: "Detail", children: <p data-detail /> },
        ]}
      />
    );
  }
  const index = () => $("[data-wizard]")!.getAttribute("data-index");

  it("refuses Next while the page is invalid, touching it so the errors show", async () => {
    const name = dom.ctx.newControl("");
    mount(<Signup name={name} />);
    click("[data-next]");
    await flush();
    expect(index()).toBe("0");
    expect(rc.isTouched(name)).toBe(true);
    expect($("[data-error]")!.textContent).toBe("Please enter a value");
  });

  it("waits for the page's asynchronous validators before it decides", async () => {
    const name = dom.ctx.newControl("Smith");
    mount(<Signup name={name} slow />);
    click("[data-next]");
    await flush(40);
    expect(index()).toBe("0");
    set(name, "Jones");
    click("[data-next]");
    await flush(40);
    expect(index()).toBe("1");
  });

  it("keeps its page index in a bound control when given one", async () => {
    const name = dom.ctx.newControl("Ada");
    const page = dom.ctx.newControl<number | undefined>(undefined);
    mount(<Signup name={name} page={page} />);
    click("[data-next]");
    await flush();
    expect(rc.getValue(page)).toBe(1);
    click("[data-back]");
    expect(rc.getValue(page)).toBe(0);
  });

  it("validates a page not reached yet, but marks it only once it has been left", async () => {
    const name = dom.ctx.newControl("");
    function Reversed() {
      return (
        <Wizard
          items={[
            { key: "first", title: "1", children: <p /> },
            { key: "later", title: "2", children: <TextField field={name} required /> },
          ]}
        />
      );
    }
    mount(<Reversed />);
    // Silent, so it validates — Next from it would refuse — but untouched.
    expect(marked('[data-page="later"]')).toBe(false);
    click("[data-next]");
    await flush();
    expect(marked('[data-page="later"]')).toBe(false);
    click("[data-back]");
    expect(rc.isTouched(name)).toBe(true);
    expect(marked('[data-page="later"]')).toBe(true);
  });

  it("touches the page it leaves when the bound index moves, not just on a click", () => {
    const name = dom.ctx.newControl("");
    const page = dom.ctx.newControl<number | undefined>(0);
    mount(<Signup name={name} page={page} />);
    expect(marked('[data-page="who"]')).toBe(false);
    set(page, 1);
    expect(rc.isTouched(name)).toBe(true);
    expect(marked('[data-page="who"]')).toBe(true);
  });
});

describe("Wizard: a hidden page", () => {
  function Steps({
    hideMiddle,
    page,
    field,
  }: {
    hideMiddle: Control<boolean>;
    page?: Control<number | undefined>;
    field?: Control<string>;
  }) {
    return (
      <Wizard
        page={page}
        items={[
          { key: "a", title: "A", children: <p /> },
          {
            key: "b",
            title: "B",
            hidden: (rc) => rc.getValue(hideMiddle),
            children: field ? <TextField field={field} id="mid" required /> : <p />,
          },
          { key: "c", title: "C", children: <p /> },
        ]}
      />
    );
  }
  const index = () => $("[data-wizard]")!.getAttribute("data-index");

  it("is skipped by Next and Back, and does not block Next from before it", async () => {
    const hide = dom.ctx.newControl(true);
    mount(<Steps hideMiddle={hide} field={dom.ctx.newControl("")} />);
    expect($('[data-page="b"]')!.hasAttribute("data-step-hidden")).toBe(true);
    click("[data-next]");
    await flush();
    expect(index()).toBe("2");
    expect($<HTMLButtonElement>("[data-next]")!.disabled).toBe(true);
    click("[data-back]");
    expect(index()).toBe("0");
  });

  it("moves the wizard on when the current page hides, writing the bound index", async () => {
    const hide = dom.ctx.newControl(false);
    const page = dom.ctx.newControl<number | undefined>(1);
    mount(<Steps hideMiddle={hide} page={page} />);
    expect(index()).toBe("1");
    set(hide, true);
    expect(index()).toBe("2");
    expect(rc.getValue(page)).toBe(2);
  });

  it("falls back to the previous page when no later one is shown", () => {
    const hide = dom.ctx.newControl(false);
    const page = dom.ctx.newControl<number | undefined>(1);
    function Last() {
      return (
        <Wizard
          page={page}
          items={[
            { key: "a", title: "A", children: <p /> },
            { key: "b", title: "B", hidden: (rc) => rc.getValue(hide), children: <p /> },
          ]}
        />
      );
    }
    mount(<Last />);
    expect(index()).toBe("1");
    set(hide, true);
    expect(index()).toBe("0");
    expect($<HTMLButtonElement>("[data-next]")!.disabled).toBe(true);
  });
});

describe("Wizard: useWizard", () => {
  let wizard!: WizardController;
  function Grab() {
    wizard = useWizard();
    return null;
  }

  it("moves from where the wizard is now, for a controller held across an await", async () => {
    const page = dom.ctx.newControl<number | undefined>(0);
    mount(
      <Wizard
        page={page}
        items={[
          { key: "a", title: "A", children: <Grab /> },
          { key: "b", title: "B", children: null },
          { key: "c", title: "C", children: null },
        ]}
      />,
    );
    const held = wizard;
    // The wizard moves while a handler is awaiting (a server call, say).
    set(page, 1);
    await act(async () => void (await held.next()));
    expect(rc.getValue(page)).toBe(2);
    act(() => held.back());
    expect(rc.getValue(page)).toBe(1);
    // The render-time facts follow too, on the current controller.
    expect([wizard.page, wizard.canBack, wizard.canNext]).toEqual(["b", true, true]);
  });

  it("checks the page without moving, focusing the first field in error", async () => {
    const page = dom.ctx.newControl<number | undefined>(0);
    const name = dom.ctx.newControl("");
    mount(
      <Wizard
        navigation="none"
        page={page}
        items={[
          { key: "a", children: <><Grab /><TextField field={name} id="w" required /></> },
          { key: "b", children: null },
        ]}
      />,
    );
    name.meta.element = $("#w");
    expect(await act(() => wizard.check())).toBe(false);
    expect([rc.isTouched(name), document.activeElement?.id, rc.getValue(page)]).toEqual([
      true,
      "w",
      0,
    ]);
    set(name, "Ada");
    expect(await act(() => wizard.check())).toBe(true);
    expect(rc.getValue(page)).toBe(0);
  });

  it("does not move on from a page left while its check was settling", async () => {
    const page = dom.ctx.newControl<number | undefined>(0);
    mount(
      <Wizard
        page={page}
        items={[
          {
            key: "a",
            title: "A",
            children: (
              <>
                <Grab />
                <TextField
                  field={dom.ctx.newControl("x")}
                  id="slow"
                  validate={{
                    slow: async () => {
                      await new Promise((r) => setTimeout(r, 20));
                      return null;
                    },
                  }}
                />
              </>
            ),
          },
          { key: "b", title: "B", children: null },
          { key: "c", title: "C", children: null },
        ]}
      />,
    );
    const next = wizard.next();
    // The user goes elsewhere while the page's validator is still out.
    act(() => wizard.goTo("c"));
    expect(await act(() => next)).toBe(true);
    expect(rc.getValue(page)).toBe(2);
  });

  it("goes to a page by key, and not to a hidden or unknown one", () => {
    const page = dom.ctx.newControl<number | undefined>(0);
    mount(
      <Wizard
        navigation="none"
        page={page}
        items={[
          { key: "a", title: "A", children: <Grab /> },
          { key: "b", title: "B", hidden: true, children: null },
          { key: "c", title: "C", children: null },
        ]}
      />,
    );
    act(() => wizard.goTo("b"));
    act(() => wizard.goTo("nope"));
    expect(rc.getValue(page)).toBe(0);
    act(() => wizard.goTo("c"));
    expect(rc.getValue(page)).toBe(2);
  });

  it("hands the implementation its navigation, builtin by default", () => {
    mount(<Wizard items={[{ key: "a", title: "A", children: null }]} />);
    expect($("[data-wizard]")!.getAttribute("data-navigation")).toBe("builtin");
    mount(<Wizard navigation="none" items={[{ key: "a", title: "A", children: null }]} />);
    expect($("[data-wizard]")!.getAttribute("data-navigation")).toBe("none");
  });

  it("throws outside a wizard", () => {
    expect(() => mount(<Grab />)).toThrow(/inside a <Wizard>/);
  });
});

describe("Disclosure", () => {
  it("binds open to a control, and opens for design mode without writing it", () => {
    const open = dom.ctx.newControl(false);
    mount(
      <Disclosure title="More" open={open}>
        <TextField field={dom.ctx.newControl("")} id="in" />
      </Disclosure>,
    );
    expect($("[data-disclosure]")!.hasAttribute("data-open")).toBe(false);
    click("[data-toggle]");
    expect(rc.getValue(open)).toBe(true);
    set(open, false);
    expect($("[data-disclosure]")!.hasAttribute("data-open")).toBe(false);
    mount(
      <Disclosure title="More" open={open}>
        <TextField field={dom.ctx.newControl("")} id="in" />
      </Disclosure>,
      { designMode: true },
    );
    expect($("[data-disclosure]")!.hasAttribute("data-open")).toBe(true);
    click("[data-toggle]");
    expect(rc.getValue(open)).toBe(false);
  });

  it("touches its content when it closes, so the toggle can say what was left", () => {
    const c = dom.ctx.newControl("");
    mount(
      <Disclosure title="More" defaultOpen>
        <TextField field={c} id="in" required />
      </Disclosure>,
    );
    expect(marked("[data-disclosure]")).toBe(false);
    click("[data-toggle]");
    expect([rc.isTouched(c), marked("[data-disclosure]")]).toEqual([true, true]);
  });

  it("reveals nested disclosures outside in before focusing a refused field", async () => {
    const c = dom.ctx.newControl("");
    mount(
      <Disclosure title="Outer">
        <Disclosure title="Inner">
          <TextField field={c} id="deep" required />
        </Disclosure>
      </Disclosure>,
    );
    const focused: string[] = [];
    // The test renderer's input is the widget's own element; record focus.
    $("#deep")!.addEventListener("focus", () => focused.push("deep"));
    // The field publishes no focus target in the test renderer, so give it one.
    c.meta.element = $("#deep");
    touch(c);
    await act(async () => void root.focusInvalid());
    await flush();
    const open = $$("[data-disclosure]").map((d) => d.hasAttribute("data-open"));
    expect([open, focused]).toEqual([[true, true], ["deep"]]);
  });
});

describe("Dialog", () => {
  function Details({ open, c }: { open: Control<boolean>; c: Control<string> }) {
    return (
      <Dialog open={open} title="Details" validationKey="details">
        <TextField field={c} id="inside" required />
      </Dialog>
    );
  }

  it("keeps its content mounted and validating while closed, and never clears it", () => {
    const open = dom.ctx.newControl(false);
    const c = dom.ctx.newControl("");
    mount(<Details open={open} c={c} />, { clearHidden: true });
    expect($<HTMLElement>("[data-dialog]")!.hidden).toBe(true);
    expect($("#inside")).not.toBeNull();
    expect(root.find(rc, "details")!.isValid(rc)).toBe(false);
    set(c, "typed");
    set(open, true);
    expect($<HTMLElement>("[data-dialog]")!.hidden).toBe(false);
    set(open, false);
    expect(rc.getValue(c)).toBe("typed");
  });

  it("touches its content when it closes, however it closes", () => {
    const open = dom.ctx.newControl(false);
    const c = dom.ctx.newControl("");
    mount(<Details open={open} c={c} />);
    expect(marked("[data-dialog]")).toBe(false);
    set(open, true);
    expect(rc.isTouched(c)).toBe(false);
    set(open, false);
    expect(rc.isTouched(c)).toBe(true);
    expect(marked("[data-dialog]")).toBe(true);
  });

  it("draws inline in design mode", () => {
    mount(<Details open={dom.ctx.newControl(false)} c={dom.ctx.newControl("")} />, {
      designMode: true,
    });
    expect($("[data-dialog]")!.hasAttribute("data-inline")).toBe(true);
  });
});

describe("the built-ins", () => {
  it("DisplayOnlyField never writes: it neither clears nor defaults", () => {
    const c = dom.ctx.newControl<string | undefined>("server value");
    const d = dom.ctx.newControl<string | undefined>(undefined);
    mount(
      <>
        <DisplayOnlyField field={c} hidden />
        <DisplayOnlyField field={d} defaultValue="never" />
      </>,
      { clearHidden: true },
    );
    expect(rc.getValue(c)).toBe("server value");
    expect(rc.getValue(d)).toBeUndefined();
  });

  it("Section is a validation scope in the tree", () => {
    mount(
      <Section validationKey="s">
        <TextField field={dom.ctx.newControl("")} required />
      </Section>,
    );
    expect(root.find(rc, "s")!.isValid(rc)).toBe(false);
  });
});

describe("controllers", () => {
  it("useTextInput reads, writes and touches", () => {
    const c = dom.ctx.newControl<string | null>(null);
    let ctl!: ReturnType<typeof useTextInput>;
    function Probe() {
      ctl = useTextInput(c);
      return ctl.rendered(<i>{ctl.value}</i>);
    }
    mount(<Probe />);
    expect(ctl.value).toBe("");
    expect(ctl.filled).toBe(false);
    act(() => ctl.setValue("hi"));
    expect(rc.getValue(c)).toBe("hi");
    expect(ctl.filled).toBe(true);
    act(() => ctl.onBlur());
    expect(rc.isTouched(c)).toBe(true);
  });

  it("useSelectController round-trips a numeric option through the list", () => {
    const c = dom.ctx.newControl<OptionValue>(undefined);
    const options: FieldOption[] = [
      { name: "Low", value: 1 },
      { name: "High", value: 3 },
    ];
    let ctl!: ReturnType<typeof useSelectController>;
    function Probe() {
      ctl = useSelectController(c, options);
      return ctl.rendered(<i />);
    }
    mount(<Probe />);
    act(() => ctl.setFromString("3"));
    expect(rc.getValue(c)).toBe(3);
    expect(ctl.stringValue).toBe("3");
    act(() => ctl.setFromString(""));
    expect(rc.getValue(c)).toBeUndefined();
  });

  it("useMultiSelectController adds and removes by string, keeping what the options do not list", () => {
    const c = dom.ctx.newControl<(string | number)[] | undefined>(["kept", 2]);
    const options: FieldOption[] = [
      { name: "One", value: 1 },
      { name: "Two", value: 2 },
    ];
    let ctl!: ReturnType<typeof useMultiSelectController>;
    function Probe() {
      ctl = useMultiSelectController(c, options);
      return ctl.rendered(<i />);
    }
    mount(<Probe />);
    expect(options.map((o) => ctl.isSelected(o))).toEqual([false, true]);
    act(() => ctl.setSelected(options[0]!, true));
    expect(rc.getValue(c)).toEqual(["kept", 2, 1]);
    act(() => ctl.setSelected(options[1]!, false));
    expect(rc.getValue(c)).toEqual(["kept", 1]);
    // Already in: no write. `"1"` and `1` are the same choice.
    act(() => ctl.setSelected({ name: "One", value: "1" }, true));
    expect(rc.getValue(c)).toEqual(["kept", 1]);
  });

  it("useDisplayValue formats through the options, and falls back when empty", () => {
    function Probe({ c, design }: { c: Control<unknown>; design?: boolean }) {
      const ctl = useDisplayValue(c, {
        options: [{ name: "Active", value: "a" }],
        format: (v) => `#${String(v)}`,
        emptyText: "none",
        sampleText: "sample",
      });
      return ctl.rendered(<i data-dv={design ? "d" : "n"}>{ctl.content}</i>);
    }
    function Probes() {
      const one = useControl<unknown>("a");
      const many = useControl<unknown>(["a", 7]);
      const empty = useControl<unknown>(null);
      return (
        <>
          <Probe c={one} />
          <Probe c={many} />
          <Probe c={empty} />
        </>
      );
    }
    mount(<Probes />);
    expect([...dom.container.querySelectorAll("[data-dv]")].map((e) => e.textContent)).toEqual([
      "Active",
      "Active, #7",
      "none",
    ]);
    function Designed() {
      const empty = useControl<unknown>(undefined);
      return <Probe c={empty} design />;
    }
    mount(<Designed />, { designMode: true });
    expect($('[data-dv="d"]')!.textContent).toBe("sample");
  });
});
