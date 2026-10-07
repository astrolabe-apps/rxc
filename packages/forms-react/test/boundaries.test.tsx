import { beforeEach, describe, expect, it } from "vitest";
import { act, type ReactNode } from "react";
import { untrackedRead, type Control } from "@rx-controls/core";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  actionRenderer,
  collectionRenderer,
  displayRenderer,
  fieldRenderer,
  Form,
  FormProvider,
  FormScopeProvider,
  narrowScope,
  useFormScope,
  getExternalEdit,
  groupRenderer,
  SelectField,
  TextField,
  useFormValidation,
  type ActionRenderProps,
  type FieldRenderProps,
  type TextDisplayExtra,
  type TextFieldExtra,
  type ValidationScope,
} from "../src/index";
import { flush, setupDom } from "./harness";
import { mounts, testRenderers } from "./testRenderers";

const dom = setupDom();
beforeEach(() => mounts.clear());

const Text = fieldRenderer<string | undefined | null, TextFieldExtra>({
  key: "textfield",
});
const Group = groupRenderer({ key: "contents" });
const Section = groupRenderer({ key: "contents" }, { scope: true });
const Inline = groupRenderer({ key: "inline" }, { inline: true });
const List = collectionRenderer<unknown>({ key: "elements" });
const Button = actionRenderer({ key: "action" });
const Show = displayRenderer<TextDisplayExtra>({ key: "text" });
const ReadOnlyText = fieldRenderer<string | undefined | null>(
  { key: "textfield" },
  { writes: false },
);

function mount(ui: ReactNode, formProps: Parameters<typeof Form>[0] | {} = {}) {
  dom.mount(
    <FormProvider renderers={testRenderers}>
      <Form {...(formProps as object)}>{ui}</Form>
    </FormProvider>,
  );
}
const $ = <E extends Element = HTMLElement>(sel: string) =>
  dom.container.querySelector(sel) as E | null;
const $$ = (sel: string) => [...dom.container.querySelectorAll(sel)];
const set = <T,>(c: Control<T>, v: T) =>
  act(() => dom.ctx.update((wc) => wc.setValue(c, v)));

describe("the field boundary", () => {
  it("hands the implementation resolved props, and an id when none is given", () => {
    const c = dom.ctx.newControl("ada");
    const label = dom.ctx.newControl("Name");
    mount(<Text field={c} label={label} required className="x" />);
    expect($("[data-label]")!.textContent).toBe("Name");
    expect($("[data-required]")).not.toBeNull();
    expect($<HTMLInputElement>("input")!.value).toBe("ada");
    expect($("input")!.className).toBe("x");
    expect($("input")!.id).toBeTruthy();
    set(label, "Given name");
    expect($("[data-label]")!.textContent).toBe("Given name");
  });

  it("hands over hideLabel resolved, with the label still there to name the field", () => {
    const hide = dom.ctx.newControl(true);
    mount(<Text field={dom.ctx.newControl("")} label="Name" hideLabel={hide} />);
    expect($("[data-label]")!.textContent).toBe("Name");
    expect($("[data-label]")!.hasAttribute("data-hidden-label")).toBe(true);
    set(hide, false);
    expect($("[data-label]")!.hasAttribute("data-hidden-label")).toBe(false);
  });

  it("hands over helpPlacement resolved", () => {
    const at = dom.ctx.newControl<"below" | "labelEnd">("labelEnd");
    mount(<Text field={dom.ctx.newControl("")} helpText="Help" helpPlacement={at} />);
    expect($("[data-field]")!.getAttribute("data-help-placement")).toBe("labelEnd");
    set(at, "below");
    expect($("[data-field]")!.getAttribute("data-help-placement")).toBe("below");
  });

  it("passes props outside the contract through unresolved", () => {
    const c = dom.ctx.newControl("");
    const placeholder = dom.ctx.newControl("type here");
    mount(<Text field={c} placeholder={placeholder} />);
    expect($("input")!.getAttribute("placeholder")).toBe("type here");
    set(placeholder, "changed");
    expect($("input")!.getAttribute("placeholder")).toBe("changed");
  });

  it("shows its own error once touched, and only its own", () => {
    const c = dom.ctx.newControl("");
    mount(
      <>
        <Text field={c} id="req" required />
        <Text field={c} id="plain" />
      </>,
    );
    expect($("[data-error]")).toBeNull();
    act(() => dom.ctx.update((wc) => wc.setTouched(c, true)));
    expect($('[data-field="req"] [data-error]')!.textContent).toBe(
      "Please enter a value",
    );
    // The same control, no `required` here: another boundary's rule.
    expect($('[data-field="plain"] [data-error]')).toBeNull();
  });

  it("shows an error no rule wrote — a server rejection — on every field of the value", () => {
    const c = dom.ctx.newControl("a@b");
    mount(
      <>
        <Text field={c} id="one" />
        <Text field={c} id="two" />
      </>,
    );
    act(() =>
      dom.ctx.update((wc) => {
        wc.setError(c, "server", "Already registered");
        wc.setTouched(c, true);
      }),
    );
    expect($$("[data-error]").map((e) => e.textContent)).toEqual([
      "Already registered",
      "Already registered",
    ]);
  });

  it.each([
    ["a bare validator", () => null],
    ["a validator keyed `default`", { default: () => null }],
  ] as const)("keeps showing a server error under `default` when it has %s", (_, validate) => {
    // HVAMS's repro: server 400s land under "default"; a bare `validate`
    // used to be keyed `default` too, claim the server's message as its own
    // rule's, and so neither show it nor count it. An author's `default` key
    // did the same until the key was reserved.
    const c = dom.ctx.newControl("a@b");
    let validation!: ValidationScope;
    function Owner() {
      validation = useFormValidation();
      return (
        <Form validation={validation}>
          <Text field={c} id="email" validate={validate} />
        </Form>
      );
    }
    dom.mount(
      <FormProvider renderers={testRenderers}>
        <Owner />
      </FormProvider>,
    );
    act(() =>
      dom.ctx.update((wc) => {
        wc.setError(c, "default", "Email already registered");
        wc.setTouched(c, true);
      }),
    );
    expect($("[data-error]")!.textContent).toBe("Email already registered");
    expect(validation.isValid(untrackedRead)).toBe(false);
    // Editing clears it (core's setValue), and the bare validator republishes.
    set(c, "c@d");
    expect($("[data-error]")).toBeNull();
    expect(validation.isValid(untrackedRead)).toBe(true);
  });

  it("keys a bare validator per boundary: two on one control clear only their own", () => {
    const c = dom.ctx.newControl("x");
    const failOne = dom.ctx.newControl(true);
    mount(
      <>
        <Text
          field={c}
          id="one"
          validate={(v) => (untrackedRead.getValue(failOne) && v ? "one says no" : null)}
        />
        <Text field={c} id="two" validate={() => "two says no"} />
      </>,
    );
    const errors = () => untrackedRead.getErrors(c);
    expect(errors()).toEqual({ "default@one": "one says no", "default@two": "two says no" });
    act(() => dom.ctx.update((wc) => wc.setValue(failOne, false)));
    set(c, "y");
    expect(errors()).toEqual({ "default@two": "two says no" });
  });

  it("registers a widget's implied rule beside the author's: TextField's maxLength", () => {
    const c = dom.ctx.newControl("abcdef");
    const max = dom.ctx.newControl(3);
    mount(
      <TextField
        field={c}
        id="t"
        maxLength={(rc) => rc.getValue(max)}
        validate={(v) => (v === "no" ? "Not that" : null)}
      />,
    );
    expect(untrackedRead.getErrors(c)).toEqual({ maxLength: "At most 3 characters" });
    // The limit is a FormProp: the rule re-runs when it moves.
    act(() => dom.ctx.update((wc) => wc.setValue(max, 10)));
    expect(untrackedRead.getErrors(c)).toEqual({});
    // The author's bare validator still runs, under its own key.
    set(c, "no");
    expect(untrackedRead.getErrors(c)).toEqual({ "default@t": "Not that" });
  });

  it("unmounts its widget when hidden, and keeps it mounted when silent", () => {
    const c = dom.ctx.newControl("x");
    const hide = dom.ctx.newControl(false);
    mount(<Text field={c} id="f" hidden={hide} />);
    const input = $("input");
    set(hide, true);
    expect($("input")).toBeNull();
    set(hide, false);
    expect($("input")).not.toBe(input);
    expect(mounts.get("f")).toBe(2);
  });

  it("keeps its widget mounted — the same node — while its container makes it silent", () => {
    const c = dom.ctx.newControl("x");
    const offScreen = dom.ctx.newControl(false);
    function Container({ children }: { children: ReactNode }) {
      const parent = useFormScope();
      const scope = narrowScope(parent, {
        presence: (rc) => (rc.getValue(offScreen) ? "silent" : "rendered"),
      });
      return <FormScopeProvider scope={scope}>{children}</FormScopeProvider>;
    }
    mount(
      <Container>
        <Text field={c} id="f" />
      </Container>,
      { clearHidden: true },
    );
    const input = $("input");
    set(offScreen, true);
    expect($("input")).toBe(input);
    // Silent is not hidden: nothing is cleared.
    expect(untrackedRead.getValue(c)).toBe("x");
    set(offScreen, false);
    expect($("input")).toBe(input);
    expect(mounts.get("f")).toBe(1);
  });

  it("clears its value when hidden under clearHidden, and defaults it when shown", () => {
    const c = dom.ctx.newControl<string | undefined>("typed");
    const hide = dom.ctx.newControl(false);
    mount(<Text field={c} hidden={hide} defaultValue="dflt" />, {
      clearHidden: true,
    });
    set(hide, true);
    expect(untrackedRead.getValue(c)).toBeUndefined();
    set(hide, false);
    expect(untrackedRead.getValue(c)).toBe("dflt");
  });

  it("clears to clearTo, and the default refills only what the boundary cleared", () => {
    const c = dom.ctx.newControl<string | null>("typed");
    const hide = dom.ctx.newControl(false);
    mount(
      <Text field={c} clearTo={null} defaultValue="dflt" hidden={(rc) => rc.getValue(hide)} />,
      { clearHidden: true },
    );
    set(hide, true);
    expect(untrackedRead.getValue(c)).toBeNull();
    // Shown again: the boundary's own null is empty, so the default refills.
    set(hide, false);
    expect(untrackedRead.getValue(c)).toBe("dflt");
    // The same null written by the user is a value, and stays.
    set(c, null);
    expect(untrackedRead.getValue(c)).toBeNull();
  });

  it("clears a stale select to clearTo, and a default refills it", () => {
    const list = dom.ctx.newControl([{ name: "A", value: "a" }]);
    const v = dom.ctx.newControl<string | null>("a");
    mount(<SelectField field={v} options={list} clearTo={null} />);
    set(list, [{ name: "B", value: "b" }]);
    expect(untrackedRead.getValue(v)).toBeNull();
    const w = dom.ctx.newControl<string | null>("a");
    const list2 = dom.ctx.newControl([{ name: "A", value: "a" }]);
    mount(
      <SelectField
        field={w}
        options={list2}
        clearTo={null}
        defaultValue={(rc) => rc.getValue(list2)[0]?.value}
      />,
    );
    set(list2, [{ name: "B", value: "b" }]);
    expect(untrackedRead.getValue(w)).toBe("b");
  });

  it("clears a collection to clearTo", () => {
    const arr = dom.ctx.newControl<string[]>(["x"]);
    const hide = dom.ctx.newControl(false);
    mount(
      <List field={arr as Control<unknown[]>} clearTo={[]} hidden={(rc) => rc.getValue(hide)}>
        {() => null}
      </List>,
      { clearHidden: true },
    );
    set(hide, true);
    expect(untrackedRead.getValue(arr)).toEqual([]);
  });

  it("clears under a group's clearHidden, and keeps outside it", () => {
    const inside = dom.ctx.newControl<string | undefined>("in");
    const outside = dom.ctx.newControl<string | undefined>("out");
    const hide = dom.ctx.newControl(false);
    const kept = dom.ctx.newControl<string | undefined>("kept");
    mount(
      <>
        <Group clearHidden>
          <Text field={inside} hidden={hide} />
          {/* A nested group can turn it back off. */}
          <Group clearHidden={false}>
            <Text field={kept} hidden={hide} />
          </Group>
        </Group>
        <Text field={outside} hidden={hide} />
      </>,
    );
    set(hide, true);
    expect([
      untrackedRead.getValue(inside),
      untrackedRead.getValue(kept),
      untrackedRead.getValue(outside),
    ]).toEqual([undefined, "kept", "out"]);
  });

  it("keeps its value with dontClearHidden, or without the form's clearHidden", () => {
    const a = dom.ctx.newControl("a");
    const b = dom.ctx.newControl("b");
    mount(
      <>
        <Text field={a} hidden dontClearHidden />
      </>,
      { clearHidden: true },
    );
    expect(untrackedRead.getValue(a)).toBe("a");
    mount(<Text field={b} hidden />);
    expect(untrackedRead.getValue(b)).toBe("b");
  });

  it("never writes when built { writes: false }", () => {
    const c = dom.ctx.newControl<string | undefined>("shown");
    const d = dom.ctx.newControl<string | undefined>(undefined);
    mount(
      <>
        <ReadOnlyText field={c} hidden />
        <ReadOnlyText field={d} defaultValue="never" />
      </>,
      { clearHidden: true },
    );
    expect(untrackedRead.getValue(c)).toBe("shown");
    expect(untrackedRead.getValue(d)).toBeUndefined();
  });

  it("hands its folded locks down as FormEditState", () => {
    const c = dom.ctx.newControl("x");
    const lock = dom.ctx.newControl(false);
    mount(<Text field={c} disabled={lock} />, { readOnly: true });
    const input = $<HTMLInputElement>("input")!;
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    set(lock, true);
    expect($<HTMLInputElement>("input")!.disabled).toBe(true);
    // A lock toggling never remounts the widget.
    expect($("input")).toBe(input);
  });

  it("outlines itself in design mode, and adds no element otherwise", () => {
    const c = dom.ctx.newControl("x");
    mount(<Text field={c} />);
    expect($(".rxf-boundary")).toBeNull();
    expect($("[data-field]")!.parentElement).toBe(dom.container);
    mount(<Text field={c} />, { designMode: true });
    expect($(".rxf-boundary")!.hasAttribute("data-design")).toBe(true);
  });

  it("validates even when its implementation renders nothing", () => {
    const c = dom.ctx.newControl("");
    const Invisible = fieldRenderer<string>(() => null);
    let root!: ValidationScope;
    function Owner() {
      root = useFormValidation();
      return (
        <Form validation={root}>
          <Invisible field={c} required />
        </Form>
      );
    }
    dom.mount(
      <FormProvider renderers={testRenderers}>
        <Owner />
      </FormProvider>,
    );
    expect(root.isValid(untrackedRead)).toBe(false);
  });
});

describe("an options field's value follows its options", () => {
  const byState: Record<string, { name: string; value: string }[]> = {
    tas: [
      { name: "Hobart", value: "hobart" },
      { name: "Launceston", value: "launceston" },
    ],
    vic: [{ name: "Melbourne", value: "melbourne" }],
  };
  const rc = untrackedRead;

  it("clears a value the derived list no longer names, and a default refills it", () => {
    const state = dom.ctx.newControl("tas");
    const agency = dom.ctx.newControl<string | undefined>("launceston");
    mount(
      <SelectField
        field={agency}
        options={(r) => byState[r.getValue(state)]}
        defaultValue={(r) => byState[r.getValue(state)]?.[0]?.value}
      />,
    );
    expect(rc.getValue(agency)).toBe("launceston");
    set(state, "vic");
    // Cleared as stale, then the default cycle fills the new first choice.
    expect(rc.getValue(agency)).toBe("melbourne");
  });

  it("keeps a value the first list does not name — the data's, not a move", () => {
    const list = dom.ctx.newControl<{ name: string; value: string }[] | undefined>(undefined);
    const a = dom.ctx.newControl<string | undefined>("old");
    mount(<SelectField field={a} options={(r) => r.getValue(list)} />);
    // Pending, then decided without it (a host's effect filled the list late).
    set(list, [{ name: "New", value: "new" }]);
    expect(rc.getValue(a)).toBe("old");
    // A host writing a value outside the list is kept too.
    set(a, "elsewhere");
    set(list, [{ name: "Newer", value: "newer" }]);
    expect(rc.getValue(a)).toBe("elsewhere");
  });

  it("clears only when the list moves away from the value, and not with restrictToOptions={false}", () => {
    const list = dom.ctx.newControl([
      { name: "X", value: "x" },
      { name: "Y", value: "y" },
    ]);
    const a = dom.ctx.newControl<string | undefined>("x");
    const b = dom.ctx.newControl<string | undefined>("x");
    mount(
      <>
        <SelectField field={a} options={list} />
        <SelectField field={b} options={list} restrictToOptions={false} />
      </>,
    );
    set(list, [{ name: "X", value: "x" }]);
    expect(rc.getValue(a)).toBe("x");
    set(list, [{ name: "Y", value: "y" }]);
    expect(rc.getValue(a)).toBeUndefined();
    expect(rc.getValue(b)).toBe("x");
  });

  it("compares as strings, and leaves a locked or hidden field alone", () => {
    const options = dom.ctx.newControl([
      { name: "One", value: "1" },
      { name: "Gone", value: "gone" },
    ]);
    const num = dom.ctx.newControl<number | undefined>(1);
    const locked = dom.ctx.newControl<string | undefined>("gone");
    const hidden = dom.ctx.newControl<string | undefined>("gone");
    mount(
      <>
        <SelectField field={num} options={options} />
        <SelectField field={locked} options={options} readOnly />
        <SelectField field={hidden} options={options} hidden />
      </>,
    );
    set(options, [{ name: "One", value: "1" }]);
    expect(rc.getValue(num)).toBe(1);
    expect(rc.getValue(locked)).toBe("gone");
    expect(rc.getValue(hidden)).toBe("gone");
  });
});

describe("the group boundary", () => {
  it("hides without unmounting what is inside", () => {
    const c = dom.ctx.newControl("x");
    const hide = dom.ctx.newControl(false);
    mount(
      <Group hidden={hide}>
        <p data-plain>plain JSX</p>
      </Group>,
    );
    const p = $("[data-plain]");
    set(hide, true);
    expect($<HTMLElement>("[data-group]")!.hidden).toBe(true);
    expect($("[data-plain]")).toBe(p);
    void c;
  });

  it("narrows its children: a hidden group hides the fields inside", () => {
    const c = dom.ctx.newControl("x");
    const hide = dom.ctx.newControl(false);
    mount(
      <Group hidden={hide}>
        <Text field={c} />
      </Group>,
    );
    set(hide, true);
    expect($("input")).toBeNull();
  });

  it("with { scope: true }, reports errors its content is showing and joins the tree", () => {
    const c = dom.ctx.newControl("");
    let root!: ValidationScope;
    function Owner() {
      root = useFormValidation();
      return (
        <Form validation={root}>
          <Section validationKey="s">
            <Text field={c} required />
          </Section>
        </Form>
      );
    }
    dom.mount(
      <FormProvider renderers={testRenderers}>
        <Owner />
      </FormProvider>,
    );
    // Invalid, but nothing is showing until the field is touched.
    expect(root.find(untrackedRead, "s")!.isValid(untrackedRead)).toBe(false);
    expect($("[data-group]")!.hasAttribute("data-invalid")).toBe(false);
    act(() => dom.ctx.update((wc) => wc.setTouched(c, true)));
    expect($("[data-group]")!.hasAttribute("data-invalid")).toBe(true);
    expect(root.find(untrackedRead, "s")!.kind).toBe("section");
    set(c, "filled");
    expect($("[data-group]")!.hasAttribute("data-invalid")).toBe(false);
  });

  it("heads each titled group one level below the one it sits in", () => {
    const levels = () =>
      $$("[data-title]").map((t) => [t.textContent, t.getAttribute("data-level")]);
    mount(
      <Group title="A">
        <Group>
          <Group title="B">
            <Group title="C">
              <Group title="D">
                <Group title="E">
                  <Group title="F">{null}</Group>
                </Group>
              </Group>
            </Group>
          </Group>
        </Group>
      </Group>,
    );
    // An untitled group is no level; the outline stops at 6.
    expect(levels()).toEqual([
      ["A", "2"],
      ["B", "3"],
      ["C", "4"],
      ["D", "5"],
      ["E", "6"],
      ["F", "6"],
    ]);
    mount(<Group title="Under an h2">{null}</Group>, { headingLevel: 3 });
    expect(levels()).toEqual([["Under an h2", "3"]]);
  });

  it("passes layout and extra props, and marks inline children", () => {
    const c = dom.ctx.newControl("x");
    mount(
      <>
        <Group layout={{ direction: "row", gap: 4 }}>{null}</Group>
        <Inline>
          <Text field={c} />
        </Inline>
      </>,
    );
    expect(JSON.parse($("[data-layout]")!.getAttribute("data-layout")!)).toEqual({
      direction: "row",
      gap: 4,
    });
    expect($("[data-field]")!.hasAttribute("data-inline")).toBe(true);
  });
});

describe("transitions", () => {
  // A visibility slot that marks what it wraps, and a group that reports
  // the `transitions` it was handed.
  const fading: typeof testRenderers = {
    ...testRenderers,
    visibility: ({ visible, children }) =>
      visible ? <div data-fade>{children}</div> : null,
    contents: (p) => (
      <div data-group data-transitions={String(p.transitions)} hidden={p.hidden || undefined}>
        {p.children}
      </div>
    ),
  };
  const mountFading = (ui: ReactNode, formProps: object = {}) =>
    dom.mount(
      <FormProvider renderers={fading}>
        <Form {...formProps}>{ui}</Form>
      </FormProvider>,
    );

  it("are on by default: every boundary renders through the visibility slot", () => {
    const c = dom.ctx.newControl("x");
    mountFading(
      <Group>
        <Text field={c} />
        <Show text="hi" />
      </Group>,
    );
    expect($$("[data-fade]")).toHaveLength(2);
    expect($("[data-group]")!.getAttribute("data-transitions")).toBe("true");
  });

  it("off under a group, its children skip the slot and leave at once", () => {
    const c = dom.ctx.newControl("x");
    const hide = dom.ctx.newControl(false);
    const arr = dom.ctx.newControl(["a"]);
    mountFading(
      <Group transitions={false}>
        <Text field={c} hidden={(rc) => rc.getValue(hide)} />
        <Show text="hi" />
        <List field={arr as Control<unknown[]>}>{() => null}</List>
      </Group>,
    );
    expect($$("[data-fade]")).toHaveLength(0);
    expect($("[data-field]")).not.toBeNull();
    set(hide, true);
    expect($("[data-field]")).toBeNull();
    set(hide, false);
    expect($("[data-field]")).not.toBeNull();
  });

  it("the group itself hides as its parent scope says; nesting turns them back on", () => {
    const c = dom.ctx.newControl("x");
    mountFading(
      <Group transitions={false}>
        <Group transitions>
          <Text field={c} />
        </Group>
      </Group>,
    );
    const [outer, inner] = $$("[data-group]");
    expect(outer.getAttribute("data-transitions")).toBe("true");
    expect(inner.getAttribute("data-transitions")).toBe("false");
    expect($$("[data-fade]")).toHaveLength(1);
  });

  it("can be turned off for a whole form", () => {
    const c = dom.ctx.newControl("x");
    mountFading(<Text field={c} />, { transitions: false });
    expect($$("[data-fade]")).toHaveLength(0);
    expect($("[data-field]")).not.toBeNull();
  });
});

describe("the display boundary", () => {
  it("resolves tone and announce, a derived tone following the data", () => {
    const n = dom.ctx.newControl(3);
    mount(
      <>
        <Show text="count" tone={(rc) => (rc.getValue(n) > 5 ? "error" : undefined)} />
        <Show text="saved" tone="success" announce />
      </>,
    );
    const [count, saved] = $$("[data-text]");
    expect(count.hasAttribute("data-tone")).toBe(false);
    expect(saved.getAttribute("data-tone")).toBe("success");
    expect(saved.hasAttribute("data-announce")).toBe(true);
    expect(count.hasAttribute("data-announce")).toBe(false);
    set(n, 9);
    expect(count.getAttribute("data-tone")).toBe("error");
  });

  it("renders content, its accessible name, and leaves when hidden", () => {
    const hide = dom.ctx.newControl(false);
    mount(<Show text="Hello" accessibleName="greeting" hidden={hide} />);
    expect($("[data-text]")!.textContent).toBe("Hello");
    expect($("[data-text]")!.getAttribute("aria-label")).toBe("greeting");
    set(hide, true);
    expect($("[data-text]")).toBeNull();
  });
});

describe("form submission", () => {
  it("submits through a submit action only once check() passes, busy until it settles", async () => {
    const name = dom.ctx.newControl("");
    const submitted: string[] = [];
    let finish!: () => void;
    mount(
      <>
        <Text field={name} id="n" required />
        <Button actionId="save" submit onClick={() => submitted.push("onClick")} />
      </>,
      {
        onSubmit: () => {
          submitted.push(untrackedRead.getValue(name));
          return new Promise<void>((r) => (finish = r));
        },
      },
    );
    const save = () => $<HTMLButtonElement>('[data-action="save"]')!;
    expect(save().hasAttribute("data-submit")).toBe(true);
    // Refused: nothing submitted, and the field touched so its error shows.
    act(() => save().click());
    await flush();
    expect(submitted).toEqual([]);
    expect($("[data-error]")).not.toBeNull();
    set(name, "Ada");
    act(() => save().click());
    await flush();
    expect(submitted).toEqual(["Ada"]);
    expect(save().hasAttribute("data-busy")).toBe(true);
    await act(async () => finish());
    expect(save().hasAttribute("data-busy")).toBe(false);
  });

  it("draws the form element only around a submitting form, and only the outermost", async () => {
    const submitted: string[] = [];
    mount(
      <Form onSubmit={() => void submitted.push("inner")}>
        <Form>
          <Button actionId="go" submit />
        </Form>
      </Form>,
      { onSubmit: () => void submitted.push("outer") },
    );
    expect($$("[data-form]")).toHaveLength(1);
    // A <Form> without onSubmit submits through the enclosing one.
    act(() => $<HTMLButtonElement>('[data-action="go"]')!.click());
    await flush();
    expect(submitted).toEqual(["inner"]);
    // The element's own submit event — Enter in a lone field — submits too.
    act(() => {
      $("[data-form]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();
    expect(submitted).toEqual(["inner", "outer"]);
    mount(<Button actionId="plain" />);
    expect($$("[data-form]")).toHaveLength(0);
  });

  it("falls back to onClick outside any submitting form", () => {
    let clicked = 0;
    mount(<Button actionId="x" submit onClick={() => void clicked++} />);
    expect($('[data-action="x"]')!.hasAttribute("data-submit")).toBe(false);
    act(() => $<HTMLButtonElement>('[data-action="x"]')!.click());
    expect(clicked).toBe(1);
  });
});

describe("the action boundary", () => {
  it("runs its handler, shows busy and holds itself while a promise runs", async () => {
    let resolve!: () => void;
    const clicks: number[] = [];
    mount(
      <Button
        actionId="save"
        text="Save"
        onClick={() => {
          clicks.push(1);
          return new Promise<void>((r) => (resolve = r));
        }}
      />,
    );
    const btn = () => $<HTMLButtonElement>("[data-action=save]")!;
    act(() => btn().click());
    expect(clicks).toHaveLength(1);
    expect(btn().disabled).toBe(true);
    expect(btn().hasAttribute("data-busy")).toBe(true);
    act(() => btn().click());
    expect(clicks).toHaveLength(1);
    await act(async () => resolve());
    await flush();
    expect(btn().disabled).toBe(false);
  });

  it("is busy for any thenable a handler returns, and ignores any other value", async () => {
    let resolve!: () => void;
    // Not a Promise — a library's thenable — and a handler resolving to a value.
    const thenable = { then: (ok: () => void) => void (resolve = ok) };
    mount(
      <>
        <Button actionId="lib" onClick={() => thenable} />
        <Button actionId="value" onClick={() => 42} />
      </>,
    );
    const btn = (id: string) => $<HTMLButtonElement>(`[data-action=${id}]`)!;
    act(() => btn("value").click());
    expect(btn("value").hasAttribute("data-busy")).toBe(false);
    act(() => btn("lib").click());
    expect(btn("lib").hasAttribute("data-busy")).toBe(true);
    // A thenable is adopted a microtask later; then it settles.
    await act(async () => {});
    await act(async () => resolve());
    await flush();
    expect(btn("lib").hasAttribute("data-busy")).toBe(false);
  });

  it("with disableType global, locks the whole form while it runs", async () => {
    let resolve!: () => void;
    const c = dom.ctx.newControl("x");
    mount(
      <>
        <Text field={c} />
        <Button
          actionId="save"
          disableType="global"
          onClick={() => new Promise<void>((r) => (resolve = r))}
        />
      </>,
    );
    act(() => $<HTMLButtonElement>("[data-action=save]")!.click());
    expect($<HTMLInputElement>("input")!.disabled).toBe(true);
    await act(async () => resolve());
    await flush();
    expect($<HTMLInputElement>("input")!.disabled).toBe(false);
  });

  it("does nothing in design mode", () => {
    let clicked = false;
    mount(<Button actionId="go" onClick={() => void (clicked = true)} />, {
      designMode: true,
    });
    act(() => $<HTMLButtonElement>("[data-action=go]")!.click());
    expect(clicked).toBe(false);
  });

  it("is replaced by an override for its id", async () => {
    const { ActionOverrideProvider } = await import("../src/index");
    const Fancy = (p: ActionRenderProps) => <a data-fancy={p.actionId}>fancy</a>;
    dom.mount(
      <FormProvider renderers={testRenderers}>
        <ActionOverrideProvider value={{ add: Fancy }}>
          <Form>
            <Button actionId="add" />
            <Button actionId="remove" />
          </Form>
        </ActionOverrideProvider>
      </FormProvider>,
    );
    expect($("[data-fancy=add]")).not.toBeNull();
    expect($("[data-action=remove]")).not.toBeNull();
  });
});

describe("the collection boundary", () => {
  type Pet = { name: string };
  function Pets({
    pets,
    minLength,
    maxLength,
    disabled,
  }: {
    pets: Control<Pet[]>;
    minLength?: number;
    maxLength?: number;
    disabled?: boolean;
  }) {
    return (
      <List
        field={pets as Control<unknown[]>}
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
        empty={<i data-empty />}
      >
        {(item, index, actions) => (
          <>
            <Text field={(item as Control<Pet>).fields.name} id={`pet${index}`} />
            <span data-can={`${actions.canAdd}|${actions.canRemove}`} />
          </>
        )}
      </List>
    );
  }

  it("renders a row per element, keyed by the element's control", () => {
    const pets = dom.ctx.newControl<Pet[]>([{ name: "Rex" }, { name: "Tom" }]);
    mount(<Pets pets={pets} />);
    expect($$("[data-row]")).toHaveLength(2);
    const first = $("#pet0");
    act(() => dom.ctx.update((wc) => wc.addElement(pets, { name: "Zed" }, 0)));
    // The row that was first is now second, and was not remounted.
    expect($$("input").map((i) => (i as HTMLInputElement).value)).toEqual([
      "Zed",
      "Rex",
      "Tom",
    ]);
    expect($$("input")[1]).toBe(first);
  });

  it("shows the empty slot with no elements", () => {
    mount(<Pets pets={dom.ctx.newControl<Pet[]>([])} />);
    expect($("[data-empty]")).not.toBeNull();
  });

  it("registers its length bounds on the array and reports can* from them", () => {
    const pets = dom.ctx.newControl<Pet[]>([{ name: "Rex" }]);
    mount(<Pets pets={pets} minLength={1} maxLength={2} />);
    expect($("[data-can]")!.getAttribute("data-can")).toBe("true|false");
    act(() => dom.ctx.update((wc) => wc.removeElement(pets, 0)));
    expect(untrackedRead.getErrors(pets).length).toBe("At least 1 required");
  });

  it("reports every can* false when locked", () => {
    const pets = dom.ctx.newControl<Pet[]>([{ name: "Rex" }]);
    mount(<Pets pets={pets} disabled />);
    expect($("[data-can]")!.getAttribute("data-can")).toBe("false|false");
  });

  it("re-renders one row, not the list, when one element changes", () => {
    const pets = dom.ctx.newControl<Pet[]>([{ name: "Rex" }, { name: "Tom" }]);
    const renders = new Map<string, number>();
    function Counting({ id, field }: FieldRenderProps<string>): Rendered {
      const { rc, rendered } = useReactive();
      renders.set(id, (renders.get(id) ?? 0) + 1);
      return rendered(<i>{rc.getValue(field)}</i>);
    }
    const Counted = fieldRenderer<string>(Counting);
    mount(
      <List field={pets as Control<unknown[]>}>
        {(item, index) => (
          <Counted field={(item as Control<Pet>).fields.name} id={`r${index}`} />
        )}
      </List>,
    );
    const before = { ...Object.fromEntries(renders) };
    act(() =>
      dom.ctx.update((wc) =>
        wc.setValue(untrackedRead.getElements(pets)[1].fields.name, "Tim"),
      ),
    );
    expect(renders.get("r0")).toBe(before.r0);
    expect(renders.get("r1")).toBeGreaterThan(before.r1);
  });

  it("stages an edit: the draft is a copy until applied", () => {
    const pets = dom.ctx.newControl<Pet[]>([{ name: "Rex" }]);
    mount(<Pets pets={pets} />);
    const edit = getExternalEdit(dom.ctx, pets);
    act(() => edit.beginEdit(0));
    const session = edit.session(untrackedRead)!;
    set(session.draft.fields.name, "Rex II");
    expect(untrackedRead.getValue(pets)[0].name).toBe("Rex");
    act(() => edit.apply());
    expect(untrackedRead.getValue(pets)[0].name).toBe("Rex II");
    expect(edit.session(untrackedRead)).toBeUndefined();
  });

  it("ends a staged edit it began when it locks", () => {
    const pets = dom.ctx.newControl<Pet[]>([{ name: "Rex" }]);
    const lock = dom.ctx.newControl(false);
    let beginEdit!: () => void;
    const Row = actionRenderer((p) => {
      beginEdit = p.onClick;
      return null;
    });
    mount(
      <List field={pets as Control<unknown[]>} disabled={lock}>
        {(_item, index, actions) => (
          <Row actionId="edit" onClick={() => actions.edit(index)} />
        )}
      </List>,
    );
    act(() => beginEdit());
    const edit = getExternalEdit(dom.ctx, pets);
    expect(edit.session(untrackedRead)).toBeDefined();
    set(lock, true);
    expect(edit.session(untrackedRead)).toBeUndefined();
  });

  it("clears the array itself when hidden under clearHidden", () => {
    const pets = dom.ctx.newControl<Pet[] | undefined>([{ name: "Rex" }]);
    mount(
      <List field={pets as Control<unknown[]>} hidden>
        {() => null}
      </List>,
      { clearHidden: true },
    );
    expect(untrackedRead.getValue(pets)).toBeUndefined();
  });
});
