import { describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { untrackedRead, type Control } from "@rx-controls/core";
import {
  Action,
  ActionOverrideProvider,
  CheckboxField,
  CheckListField,
  Contents,
  Dialog,
  Disclosure,
  DisplayOnlyField,
  Form,
  FormProvider,
  InlineGroup,
  RadioField,
  Section,
  SelectField,
  Tabs,
  TextDisplay,
  TextField,
  Wizard,
  StandardActionIds,
  type ActionRenderProps,
  type OptionValue,
} from "@rx-controls/forms-react";
import {
  defaultHtmlTheme,
  DefaultVisibility,
  htmlRenderers,
  HtmlThemeProvider,
  tailwindHtmlTheme,
  type PartialHtmlTheme,
} from "../src/index";
import { flush, setupDom } from "./harness";

const dom = setupDom();

/** Mounted with DefaultVisibility unless a test is about the fade. */
function mount(
  ui: ReactNode,
  opts: { theme?: PartialHtmlTheme; fade?: boolean; clearHidden?: boolean } = {},
) {
  const renderers = opts.fade
    ? htmlRenderers
    : { ...htmlRenderers, visibility: DefaultVisibility };
  dom.mount(
    <FormProvider renderers={renderers}>
      <HtmlThemeProvider theme={opts.theme ?? {}}>
        <Form clearHidden={opts.clearHidden}>{ui}</Form>
      </HtmlThemeProvider>
    </FormProvider>,
  );
}
const $ = <E extends Element = HTMLElement>(sel: string) =>
  dom.container.querySelector(sel) as E | null;
const $$ = (sel: string) => [...dom.container.querySelectorAll(sel)];
const set = <T,>(c: Control<T>, v: T) =>
  act(() => dom.ctx.update((wc) => wc.setValue(c, v)));
const touch = (c: Control<unknown>) =>
  act(() => dom.ctx.update((wc) => wc.setTouched(c, true)));
function type(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value",
  )!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("TextField", () => {
  it("labels its input, marks required, and wires help and error to it", () => {
    const c = dom.ctx.newControl("");
    mount(<TextField field={c} id="name" label="Name" required helpText="Your name" />);
    const input = $<HTMLInputElement>("input")!;
    expect($("label")!.getAttribute("for")).toBe("name");
    expect($(".rxf-required")!.textContent).toBe("*");
    expect(input.getAttribute("aria-describedby")).toBe("name-help");
    touch(c as Control<unknown>);
    expect($("#name-error")!.textContent).toBe("Please enter a value");
    expect(input.getAttribute("aria-describedby")).toBe("name-error");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("shows labelEnd help on its button's press, in the tree either way", () => {
    mount(
      <TextField field={dom.ctx.newControl("")} id="f" label="Name" helpText="As on your licence" helpPlacement="labelEnd" />,
    );
    // Named for its field, so two on a page are told apart.
    const button = $<HTMLButtonElement>('button[aria-label="Help: Name"]')!;
    const help = $("#f-help")!;
    // Collapsed: clipped, still there to describe the input.
    expect([button.getAttribute("aria-expanded"), help.style.clipPath]).toEqual(["false", "inset(50%)"]);
    expect([button.getAttribute("aria-controls"), $("#f")!.getAttribute("aria-describedby")]).toEqual(["f-help", "f-help"]);
    act(() => button.click());
    expect([button.getAttribute("aria-expanded"), help.style.clipPath]).toEqual(["true", ""]);
    // The button sits beside the label, in the theme's row.
    expect(button.parentElement!.className).toBe("rxf-label-row");
  });

  it("writes what is typed, and passes inputMode, autoComplete and placeholder", () => {
    const c = dom.ctx.newControl("");
    mount(
      <TextField field={c} inputMode="tel" autoComplete="tel" placeholder="Phone" />,
    );
    const input = $<HTMLInputElement>("input")!;
    expect(input.getAttribute("inputmode")).toBe("tel");
    expect(input.getAttribute("autocomplete")).toBe("tel");
    expect(input.placeholder).toBe("Phone");
    type(input, "0400");
    expect(untrackedRead.getValue(c)).toBe("0400");
  });

  it("puts a look's control where the theme says the chrome is", () => {
    const c = dom.ctx.newControl("");
    const looks = { mine: { control: "mine" } };
    mount(<TextField field={c} look="mine" />, { theme: { looks } });
    expect($(".rxf-frame")!.className).toContain("mine");
    expect($("input")!.className).not.toContain("mine");
    mount(<TextField field={c} look="mine" />, {
      theme: { looks, frame: { classNameOn: "input" } },
    });
    expect($("input")!.className).toContain("mine");
  });

  it("adds a look's string parts and substitutes { replace }", () => {
    const c = dom.ctx.newControl("");
    mount(<TextField field={c} look="both" />, {
      theme: { looks: { both: { shell: { replace: "only" }, control: "extra" } } },
    });
    expect($("div.only")).not.toBeNull();
    expect($(".rxf-frame")!.className).toBe("rxf-frame extra");
  });

  it("draws a textarea when multiline", () => {
    mount(<TextField field={dom.ctx.newControl("")} multiline />);
    expect($("textarea")).not.toBeNull();
  });
});

describe("the options widgets", () => {
  const options = [
    { name: "Low", value: 1 },
    { name: "High", value: 3 },
  ];

  it("SelectField drops the empty choice once a required one has a value", () => {
    mount(
      <>
        <SelectField field={dom.ctx.newControl<OptionValue>(3)} id="req" options={options} required />
        <SelectField field={dom.ctx.newControl<OptionValue>(3)} id="opt" options={options} />
        <SelectField field={dom.ctx.newControl<OptionValue>(undefined)} id="unset" options={options} required />
      </>,
    );
    const empty = (id: string) => $(`#${id}`)!.querySelectorAll('option[value=""]').length;
    expect([empty("req"), empty("opt"), empty("unset")]).toEqual([0, 1, 1]);
  });

  it("SelectField keeps a numeric option numeric", () => {
    const c = dom.ctx.newControl<OptionValue>(undefined);
    mount(<SelectField field={c} options={options} />);
    const select = $<HTMLSelectElement>("select")!;
    act(() => {
      select.value = "3";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(untrackedRead.getValue(c)).toBe(3);
  });

  it("RadioField names its radiogroup from the caption and renders per-option content", () => {
    const c = dom.ctx.newControl<OptionValue>(3);
    mount(
      <RadioField field={c} label="Priority" options={options}>
        {(o, selected) => <i data-extra={`${o.value}:${selected}`} />}
      </RadioField>,
    );
    const group = $('[role="radiogroup"]')!;
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)!.textContent).toBe(
      "Priority",
    );
    expect($$('input[type="radio"]').map((r) => (r as HTMLInputElement).checked)).toEqual([
      false,
      true,
    ]);
    expect($$("[data-extra]").map((e) => e.getAttribute("data-extra"))).toEqual([
      "1:false",
      "3:true",
    ]);
  });

  it("CheckboxField puts its label after the control", () => {
    const c = dom.ctx.newControl<boolean | undefined>(false);
    mount(<CheckboxField field={c} label="Agree" />);
    const label = $("label.rxf-label-after")!;
    expect(label.querySelector("input")).not.toBeNull();
    act(() => $<HTMLInputElement>("input")!.click());
    expect(untrackedRead.getValue(c)).toBe(true);
  });

  it("CheckboxField draws labelPosition before as label, help, then the control, in a row", () => {
    mount(
      <CheckboxField
        field={dom.ctx.newControl<boolean | undefined>(false)}
        id="uvi"
        label="Commercial vessel"
        helpText="Its UVI"
        helpPlacement="labelEnd"
        labelPosition="before"
      />,
    );
    const order = $$("label, button, input").map((e) => e.tagName.toLowerCase());
    // The drawn order is the focus order: no theme has to reverse it.
    expect([order, $("label")!.getAttribute("for"), !!$(".rxf-shell--horizontal")]).toEqual([
      ["label", "button", "input"],
      "uvi",
      true,
    ]);
  });
});

describe("Disclosure", () => {
  it("draws the theme's icon before its title, marked open while open", () => {
    mount(
      <Disclosure title="How to find this">
        <TextDisplay text="Inside" />
      </Disclosure>,
      { theme: tailwindHtmlTheme },
    );
    const icon = () => $("summary > .rxf-disclosure-icon")!;
    expect([icon().getAttribute("aria-hidden"), icon().hasAttribute("data-open")]).toEqual(["true", false]);
    act(() => $("summary")!.click());
    expect(icon().hasAttribute("data-open")).toBe(true);
    // The default theme keeps the browser's own marker: no icon of its own.
    mount(<Disclosure title="Plain">{null}</Disclosure>);
    expect($(".rxf-disclosure-icon")).toBeNull();
  });

  it("draws the icon after the title under iconPlacement after, the marker still last", () => {
    const theme = {
      ...tailwindHtmlTheme,
      disclosure: { ...tailwindHtmlTheme.disclosure, iconPlacement: "after" as const },
    };
    const c = dom.ctx.newControl("");
    mount(
      <Disclosure title="How to find this">
        <TextField field={c} id="where" required />
      </Disclosure>,
      { theme },
    );
    act(() => dom.ctx.update((wc) => wc.setTouched(c, true)));
    const parts = [...$("summary")!.childNodes].map((n) =>
      n.nodeType === 3 ? "title" : (n as Element).className.split(" ")[0],
    );
    expect(parts).toEqual(["title", "rxf-disclosure-icon", "rxf-disclosure-dot"]);
  });
});

describe("DisplayOnlyField", () => {
  it("shows the value as text, a span inside an inline group", () => {
    const c = dom.ctx.newControl<unknown>("a");
    const options = [{ name: "Active", value: "a" }];
    mount(
      <>
        <DisplayOnlyField field={c} options={options} />
        <InlineGroup>
          <DisplayOnlyField field={c} options={options} />
        </InlineGroup>
      </>,
    );
    expect($("div.rxf-readonly")!.textContent).toBe("Active");
    expect($(".rxf-inline span.rxf-readonly-inline")!.textContent).toBe("Active");
  });
});

describe("hiding with no CSS at all", () => {
  it("takes a hidden region off screen with the hidden attribute, keeping its children", () => {
    const hide = dom.ctx.newControl(false);
    mount(
      <Contents hidden={hide}>
        <p data-plain />
      </Contents>,
    );
    const p = $("[data-plain]");
    set(hide, true);
    expect($<HTMLElement>(".rxf-contents")!.hidden).toBe(true);
    expect($("[data-plain]")).toBe(p);
  });

  it("leaves hiding to the theme's class under hideWith: class", () => {
    const hide = dom.ctx.newControl(true);
    mount(<Contents hidden={hide}>{null}</Contents>, {
      theme: { contents: { hideWith: "class", hidden: "gone" } },
    });
    const el = $<HTMLElement>(".rxf-contents")!;
    expect(el.hidden).toBe(false);
    expect(el.classList.contains("gone")).toBe(true);
    expect(el.hasAttribute("inert")).toBe(true);
  });

  it("collapses through one inner element under hideWith: collapse", () => {
    const hide = dom.ctx.newControl(true);
    mount(
      <Contents hidden={hide} title="T" look="body">
        {null}
      </Contents>,
      { theme: { ...tailwindHtmlTheme, looks: { ...tailwindHtmlTheme.looks, body: { control: "body" } } } },
    );
    const el = $<HTMLElement>(".rxf-contents")!;
    expect(el.hidden).toBe(false);
    expect(el.hasAttribute("data-hidden")).toBe(true);
    expect(el.className).toContain("grid-rows-[1fr]");
    expect(el.children).toHaveLength(1);
    expect(el.firstElementChild!.className).toContain("rxf-contents-inner");
  });

  it("puts the title and body straight under the wrapper otherwise", () => {
    mount(
      <Contents title="T" look="body">
        {null}
      </Contents>,
      { theme: { looks: { body: { control: "body", shell: "flex flex-col gap-4" } } } },
    );
    const el = $<HTMLElement>(".rxf-contents")!;
    expect([...el.children].map((c) => c.className)).toEqual([
      "rxf-group-title",
      "rxf-contents-body body",
    ]);
  });

  it("hides at once under transitions={false}, whatever the theme animates", () => {
    const hide = dom.ctx.newControl(true);
    mount(
      <Contents transitions={false}>
        <Contents hidden={hide} look="body" title="T">
          {null}
        </Contents>
      </Contents>,
      { theme: { ...tailwindHtmlTheme, looks: { ...tailwindHtmlTheme.looks, body: { control: "body" } } } },
    );
    const el = $<HTMLElement>(".body")!.parentElement!;
    expect(el.hasAttribute("data-hidden")).toBe(true);
    expect(el.hidden).toBe(true);
    expect(el.style.display).toBe("none");
    // No collapse: neither its classes nor its inner element.
    expect(el.className).not.toContain("grid-rows");
    expect(el.children).toHaveLength(2);
  });

  it("hides inactive tabs and unreached wizard pages with the attribute", () => {
    mount(
      <>
        <Tabs
          items={[
            { key: "a", title: "A", children: <p data-a /> },
            { key: "b", title: "B", children: <p data-b /> },
          ]}
        />
        <Wizard
          items={[
            { key: "one", title: "One", children: <p data-one /> },
            { key: "two", title: "Two", children: <p data-two /> },
          ]}
        />
      </>,
    );
    const panels = $$('[role="tabpanel"]') as HTMLElement[];
    expect(panels.map((p) => p.hidden)).toEqual([false, true]);
    expect($("[data-b]")).not.toBeNull();
    const pages = $$(".rxf-wizard-page") as HTMLElement[];
    expect(pages.map((p) => p.hidden)).toEqual([false, true]);
  });

  it("keeps a closed dialog's content mounted inside the dialog element", () => {
    const open = dom.ctx.newControl(false);
    mount(
      <Dialog open={open} title="Details">
        <p data-inside />
      </Dialog>,
    );
    const dialog = $<HTMLDialogElement>("dialog")!;
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector("[data-inside]")).not.toBeNull();
  });

  it("draws Close as an action a host can restyle by id", () => {
    const onClose = vi.fn();
    const FancyClose = (p: ActionRenderProps) => (
      <button data-fancy onClick={p.onClick}>
        {p.text}
      </button>
    );
    mount(
      <ActionOverrideProvider value={{ [StandardActionIds.close]: FancyClose }}>
        <Dialog open title="Details" onClose={onClose}>
          <p />
        </Dialog>
      </ActionOverrideProvider>,
    );
    const close = $<HTMLButtonElement>("dialog [data-fancy]")!;
    expect(close.textContent).toBe("Close");
    act(() => close.click());
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("options", () => {
  it("renders a repeated option value without a key collision", () => {
    const c = dom.ctx.newControl<OptionValue>("a");
    const repeated = [
      { name: "A", value: "a" },
      { name: "A again", value: "a" },
    ];
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    mount(
      <>
        <SelectField field={c} options={repeated} />
        <RadioField field={c} options={repeated} />
      </>,
    );
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    expect($$("option")).toHaveLength(3);
    expect($$("input[type=radio]")).toHaveLength(2);
  });
});

describe("Action", () => {
  it("layers the style's classes and shows busy in place of the icon", async () => {
    let resolve!: () => void;
    mount(
      <Action
        actionId="save"
        text="Save"
        look="primary"
        icon={<i data-icon />}
        onClick={() => new Promise<void>((r) => (resolve = r))}
      />,
    );
    const btn = $<HTMLButtonElement>("button")!;
    expect(btn.className).toBe("rxf-btn rxf-btn--primary");
    expect($("[data-icon]")).not.toBeNull();
    act(() => btn.click());
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect($(".rxf-spinner")).not.toBeNull();
    await act(async () => resolve());
    await flush();
    expect($("[data-icon]")).not.toBeNull();
  });

  it("wraps the icon, and the busy spinner in its place, in the theme's icon classes", async () => {
    let resolve!: () => void;
    mount(
      <>
        <Action actionId="p" text="P" look="primary" icon={<i data-icon="p" />} onClick={() => new Promise<void>((r) => (resolve = r))} />
        <Action actionId="l" text="L" look="link" icon={<i data-icon="l" />} />
        <Action actionId="none" text="No icon" />
      </>,
      {
        theme: {
          action: { iconClassName: "icon" },
          looks: { primary: { icon: "icon-24" }, link: { icon: "icon-18" } },
        },
      },
    );
    const wrapper = (sel: string) => $(sel)!.parentElement!.className;
    expect([wrapper('[data-icon="p"]'), wrapper('[data-icon="l"]')]).toEqual(["icon icon-24", "icon icon-18"]);
    // No icon, no wrapper.
    expect($$("button")[2]!.querySelector(".icon")).toBeNull();
    act(() => ($$("button")[0] as HTMLButtonElement).click());
    expect(wrapper(".rxf-spinner")).toBe("icon icon-24");
    await act(async () => resolve());
    await flush();
  });

  it("draws the icon alone for iconPlacement replace", () => {
    mount(<Action actionId="x" text="Hidden text" icon={<i data-icon />} iconPlacement="replace" />);
    expect($("button")!.textContent).toBe("");
    expect($("[data-icon]")).not.toBeNull();
  });
});

describe("a layout body and TextDisplay", () => {
  it("draws a group's layout as an inline-style flex body", () => {
    mount(
      <Contents layout={{ direction: "row", gap: 8, justify: "space-between" }} look="b">
        <i />
      </Contents>,
      { theme: { looks: { b: { control: "b" } } } },
    );
    const s = $<HTMLElement>(".b")!;
    expect(s.style.display).toBe("flex");
    expect(s.style.flexDirection).toBe("row");
    expect(s.style.gap).toBe("8px");
    expect(s.style.justifyContent).toBe("space-between");
  });

  it("renders text as a paragraph, and as a span in prose", () => {
    mount(
      <>
        <TextDisplay text="Block" />
        <InlineGroup>
          <TextDisplay text="Inline" />
        </InlineGroup>
      </>,
    );
    expect($("p.rxf-text")!.textContent).toBe("Block");
    expect($(".rxf-inline span.rxf-text")!.textContent).toBe("Inline");
  });
});

describe("display tones", () => {
  it("adds the theme's tone class to the display's wrapper, and data-tone", () => {
    mount(<TextDisplay text="Bad" tone="error" />, { theme: tailwindHtmlTheme });
    const shell = $<HTMLElement>("[data-tone]")!;
    expect(shell.getAttribute("data-tone")).toBe("error");
    expect(shell.className).toContain("rxf-tone-error");
    expect(shell.className).toContain("text-red-700");
  });
});

describe("form submission", () => {
  function mountSubmitting(ui: ReactNode, onSubmit: () => void) {
    dom.mount(
      <FormProvider renderers={htmlRenderers}>
        <Form onSubmit={onSubmit}>{ui}</Form>
      </FormProvider>,
    );
  }

  it("ignores a stray button's native submit, and submits on one with no submitter", async () => {
    let submitted = 0;
    mountSubmitting(
      // A third-party button with no type defaults to submit.
      <button id="stray">Stray</button>,
      () => void submitted++,
    );
    act(() => $<HTMLButtonElement>("#stray")!.click());
    await flush();
    expect(submitted).toBe(0);
    act(() => {
      $("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();
    expect(submitted).toBe(1);
  });

  it("keeps Enter in a dialog's field from pressing the form's default button", () => {
    mountSubmitting(
      <Dialog open={false} title="More">
        <TextField field={dom.ctx.newControl("")} id="in-dialog" />
      </Dialog>,
      () => {},
    );
    const e = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    act(() => void $("#in-dialog")!.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(true);
  });
});

describe("FadeVisibility", () => {
  it("holds the leaving content for the exit, marked data-leaving, then unmounts it", () => {
    vi.useFakeTimers();
    try {
      const hide = dom.ctx.newControl(false);
      mount(<TextField field={dom.ctx.newControl("")} hidden={hide} />, { fade: true });
      set(hide, true);
      expect($(".rxf-fade")!.hasAttribute("data-leaving")).toBe(true);
      expect($("input")).not.toBeNull();
      act(() => vi.advanceTimersByTime(250));
      expect($("input")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("is skipped under transitions={false}: no wrapper, and gone at once", () => {
    const hide = dom.ctx.newControl(false);
    mount(
      <Contents transitions={false}>
        <TextField field={dom.ctx.newControl("")} hidden={hide} />
      </Contents>,
      { fade: true },
    );
    expect($(".rxf-fade")).toBeNull();
    expect($("input")).not.toBeNull();
    set(hide, true);
    expect($("input")).toBeNull();
  });

  it("uses the theme's fade slot", () => {
    mount(<TextField field={dom.ctx.newControl("")} />, {
      fade: true,
      theme: { visibility: { fade: "my-fade" } },
    });
    expect($(".my-fade")).not.toBeNull();
    expect(defaultHtmlTheme.visibility.fade).toBe("rxf-fade");
  });
});

describe("what the theme reaches", () => {
  // The innermost body with this text: an outer body contains it too.
  const body = (text: string) =>
    $$(".rxf-contents-body").findLast((e) => e.textContent === text)!.className;

  it("applies the theme's body layout only when the author gives none", () => {
    mount(
      <>
        <Contents>plain</Contents>
        <Contents look="grid">grid</Contents>
        <Contents look="replaced">replaced</Contents>
      </>,
      {
        theme: {
          ...tailwindHtmlTheme,
          looks: {
            ...tailwindHtmlTheme.looks,
            grid: { control: "grid grid-cols-2 gap-1" },
            replaced: { control: { replace: "flex gap-1" } },
          },
        },
      },
    );
    expect(body("plain")).toBe("rxf-contents-body flex flex-col gap-4");
    // The author's class is the whole layout, the hook kept: no flex-col or
    // gap-4 left to fight the grid.
    expect(body("grid")).toBe("rxf-contents-body grid grid-cols-2 gap-1");
    expect($$("div").some((e) => e.className === "flex gap-1")).toBe(true);
  });

  it("adds the section slots to a section only", () => {
    mount(
      <Section title="S">
        <Contents>inner</Contents>
      </Section>,
      {
        theme: {
          contents: { section: { wrapper: "card", title: "card-title", body: "card-body" } },
        },
      },
    );
    expect($$(".card")).toHaveLength(1);
    expect($(".card")!.querySelector('[role="heading"]')!.className).toContain("card-title");
    expect($$(".card-body")).toHaveLength(1);
    // The plain region inside is not a card.
    expect(body("inner")).not.toContain("card");
  });

  it("gives a display one colour by precedence: message, else tone, else base", () => {
    mount(
      <>
        <TextDisplay text="refused" tone="error" announce />
        <TextDisplay text="301 / 300" tone="error" />
        <TextDisplay text="12 / 300" />
      </>,
      {
        theme: {
          displayShell: {
            display: "d",
            color: "base",
            tones: { error: "red" },
            message: { error: "box" },
          },
        },
      },
    );
    const shell = (t: string) =>
      $$(".d").find((e) => e.textContent === t)!.className;
    // Never two colours competing by CSS order.
    expect([shell("refused"), shell("301 / 300"), shell("12 / 300")]).toEqual([
      "d box",
      "d red",
      "d base",
    ]);
  });

  it("styles a shell per widget: shellFor over shell, and data-widget", () => {
    mount(
      <>
        <TextField field={dom.ctx.newControl("")} id="t" label="Text" required />
        <SelectField field={dom.ctx.newControl<OptionValue>(undefined)} id="s" label="Pick" options={[{ name: "A", value: "a" }]} required />
      </>,
      {
        theme: {
          shell: { label: "big", required: { className: "mark", text: "*" } },
          shellFor: { select: { label: "small", required: { text: "!" } } },
        },
      },
    );
    const shell = (id: string) => $(`#${id}`)!.closest("[data-widget]")!;
    expect([shell("t").getAttribute("data-widget"), shell("s").getAttribute("data-widget")]).toEqual([
      "textfield",
      "select",
    ]);
    const label = (id: string) => shell(id).querySelector(`#${id}-label`)!;
    expect([label("t").className, label("s").className]).toEqual(["big", "small"]);
    // A nested slot merges too: the select's marker text, the shell's class.
    expect(shell("s").querySelector(".mark")!.textContent).toBe("!");
    expect(shell("t").querySelector(".mark")!.textContent).toBe("*");
  });

  it("draws a count past its limit with countOver in place of count", () => {
    const c = dom.ctx.newControl("abcdef");
    mount(<TextField field={c} id="t" maxLength={5} showCount />, {
      theme: { shell: { count: "n", countOver: "over" } },
    });
    expect([$("#t-count")!.className, $("#t-count")!.textContent]).toEqual(["over", "6 / 5"]);
    set(c, "abc");
    expect([$("#t-count")!.className, $("#t-count")!.textContent]).toEqual(["n", "3 / 5"]);
  });

  it("turns transitions off from the theme: no fade wrapper, gone at once", () => {
    const hide = dom.ctx.newControl(false);
    mount(<TextField field={dom.ctx.newControl("")} id="f" hidden={hide} />, {
      fade: true,
      theme: { visibility: { transitions: false } },
    });
    expect($(".rxf-fade")).toBeNull();
    set(hide, true);
    expect($("#f")).toBeNull();
  });
});

describe("looks on fields", () => {
  const card = {
    shell: "k-shell",
    label: "k-label",
    labelText: "k-labeltext",
    control: "k-control",
    text: "k-text",
  };
  const options = [
    { name: "One", value: "1" },
    { name: "Two", value: "2" },
  ];
  const classes = (e: Element | null) => (e?.getAttribute("class") ?? "").split(/\s+/);

  it("styles a text field's shell, label, frame and the input's own text", () => {
    mount(<TextField field={dom.ctx.newControl("")} id="t" label="Name" look="card" />, {
      theme: { looks: { card } },
    });
    const input = $("#t")!;
    const frame = input.parentElement!;
    const shell = frame.parentElement!.parentElement!;
    expect(classes(shell)).toContain("k-shell");
    expect(shell.getAttribute("data-look")).toBe("card");
    expect(classes($("#t-label"))).toEqual(expect.arrayContaining(["k-label", "k-labeltext"]));
    // the control lands on the frame (the theme's `classNameOn`), the text on the input
    expect(classes(frame)).toContain("k-control");
    expect(classes(input)).toContain("k-text");
    expect(classes(input)).not.toContain("k-control");
  });

  it("sends the control to the input where the theme puts the author's className there", () => {
    mount(<TextField field={dom.ctx.newControl("")} id="t" look="card" />, {
      theme: { looks: { card }, frame: { classNameOn: "input" } },
    });
    expect(classes($("#t"))).toEqual(expect.arrayContaining(["k-control", "k-text"]));
    expect(classes($("#t")!.parentElement)).not.toContain("k-control");
  });

  it("applies the look to a select, a radio group, a check list, a checkbox and a display-only field", () => {
    mount(
      <>
        <SelectField field={dom.ctx.newControl("")} id="s" label="S" options={options} look="card" />
        <RadioField field={dom.ctx.newControl("")} id="r" label="R" options={options} look="card" />
        <CheckListField field={dom.ctx.newControl<string[]>([])} id="l" label="L" options={options} look="card" />
        <CheckboxField field={dom.ctx.newControl(false)} id="c" label="C" look="card" />
        <DisplayOnlyField field={dom.ctx.newControl("v")} id="d" label="D" look="card" />
      </>,
      { theme: { looks: { card } } },
    );
    expect(classes($("#s")!.parentElement)).toContain("k-control");
    expect(classes($("#s"))).toContain("k-text");
    expect(classes($('[role="radiogroup"]'))).toContain("k-control");
    expect(classes($('[role="radiogroup"] label span'))).toContain("k-text");
    expect(classes($('[role="group"]'))).toContain("k-control");
    expect(classes($('[role="group"] label span'))).toContain("k-text");
    expect(classes($("#c"))).toContain("k-control");
    expect(classes($("#d"))).toEqual(expect.arrayContaining(["k-control", "k-text"]));
    // every shell: its part, the name as a hook, the label's two parts
    const shells = $$("[data-widget]");
    expect(shells).toHaveLength(5);
    for (const sh of shells) {
      expect(classes(sh)).toContain("k-shell");
      expect(sh.getAttribute("data-look")).toBe("card");
    }
    expect(classes($("#s-label"))).toContain("k-labeltext");
  });

  it("lets a `{ replace }` part drop the theme's own classes and the parts before it", () => {
    mount(
      <>
        <TextField field={dom.ctx.newControl("")} id="a" look="plus" />
        <TextField field={dom.ctx.newControl("")} id="b" look="only" />
        <TextField field={dom.ctx.newControl("")} id="c" look={["plus", "only"]} />
      </>,
      {
        theme: {
          looks: {
            plus: { control: "mine", shell: "mine-shell" },
            only: { control: { replace: "only" }, shell: { replace: "only-shell" } },
          },
        },
      },
    );
    const frame = (id: string) => $(`#${id}`)!.parentElement!;
    const shell = (id: string) => frame(id).parentElement!.parentElement!;
    expect(classes(frame("a"))).toEqual(expect.arrayContaining(["rxf-frame", "mine"]));
    expect(classes(shell("a"))).toEqual(expect.arrayContaining(["rxf-shell", "mine-shell"]));
    expect(classes(frame("b")).filter(Boolean)).toEqual(["only"]);
    expect(classes(shell("b")).filter(Boolean)).toEqual(["only-shell"]);
    // layered: the later look's replace drops the earlier look's parts as well
    expect(classes(frame("c")).filter(Boolean)).toEqual(["only"]);
  });

  it("draws the base look for a name the theme lacks, with one warning per name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(
      <>
        <TextField field={dom.ctx.newControl("")} id="u" label="Unknown" look="nope" />
        <SelectField field={dom.ctx.newControl("")} id="v" label="V" options={options} look="nope" />
        <TextField field={dom.ctx.newControl("")} id="base" label="Base" />
      </>,
    );
    const shellOf = (id: string) => $(`#${id}`)!.closest("[data-widget]")!;
    expect(shellOf("u").className).toBe(shellOf("base").className);
    expect(warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('field look "nope"'))).toHaveLength(1);
    warn.mockRestore();
  });
});

describe("looks: layering, replace and the slots they share with className", () => {
  const classes = (e: Element | null) => (e?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

  it("layers a list of looks in order, and lets `{ replace }` drop what came before", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(
      <>
        <Action actionId="a" text="A" look={["primary", "wide"]} />
        <Action actionId="b" text="B" look={["primary", "alone"]} />
        <Action actionId="c" text="C" look={["primary", "wide", "nope"]} />
      </>,
      { theme: { looks: { wide: { control: "k-wide" }, alone: { control: { replace: "k-alone" } } } } },
    );
    const [a, b, c] = $$("button");
    expect(classes(a)).toEqual(expect.arrayContaining(["rxf-btn", "rxf-btn--primary", "k-wide"]));
    expect(a.getAttribute("data-look")).toBe("primary wide");
    // `replace` stands in for the theme's own button classes and the emphasis before it
    expect(classes(b)).toEqual(["k-alone"]);
    // a name nobody knows is reported and the rest still draws
    expect(classes(c)).toContain("k-wide");
    expect(warn.mock.calls.map((x) => String(x[0]))).toEqual([expect.stringContaining('action look "nope"')]);
    warn.mockRestore();
  });

  it("puts a group look's control on a flex body, and in place of the default layout otherwise", () => {
    mount(
      <>
        <Contents look="row" layout={{ direction: "row" }}>
          <TextDisplay text="x" />
        </Contents>
        <Contents look="row">
          <TextDisplay text="y" />
        </Contents>
        <Contents>
          <TextDisplay text="z" />
        </Contents>
      </>,
      { theme: { looks: { row: { control: "k-row" } }, contents: { layout: "k-default-layout" } } },
    );
    const body = (s: string) => $$("p").find((p) => p.textContent === s)!.closest(".rxf-contents-body, .rxf-contents-flex")!;
    expect(classes(body("x"))).toEqual(expect.arrayContaining(["rxf-contents-flex", "k-row"]));
    expect(classes(body("y"))).toContain("k-row");
    expect(classes(body("y"))).not.toContain("k-default-layout");
    expect(classes(body("z"))).toContain("k-default-layout");
  });

  it("draws a boundary's `style` as an inline style: lengths in px, fonts in rem, tokens from the theme", () => {
    mount(
      <>
        <TextDisplay
          text="hi"
          style={{ paddingTop: 8, fontSize: 24, color: "$accent", borderWidth: 1, marginHorizontal: 4 }}
          shellStyle={{ opacity: 0.5, flexGrow: 1 }}
        />
        <TextField
          field={dom.ctx.newControl("")}
          id="t"
          style={{ borderRadius: 6, color: "$accent/50", padding: 2 }}
          shellStyle={{ marginTop: 12 }}
        />
      </>,
      { theme: { tokens: { colors: { accent: "#ff0000" } } } },
    );
    const p = $("p")!;
    expect([p.style.paddingTop, p.style.fontSize, p.style.borderStyle, p.style.marginLeft, p.style.marginRight]).toEqual([
      "8px", "1.5rem", "solid", "4px", "4px",
    ]);
    expect(p.style.color).toMatch(/#ff0000|255, 0, 0/);
    expect([p.parentElement!.style.opacity, p.parentElement!.style.flexGrow]).toEqual(["0.5", "1"]);
    // a field: the box properties on the frame, the text properties on the input, margin on the shell
    const input = $("#t")!;
    expect(input.parentElement!.style.borderRadius).toBe("6px");
    expect(input.style.color).toMatch(/rgba\(255, 0, 0, 0\.5/);
    expect(input.style.borderRadius).toBe("");
    expect($("[data-widget]")!.style.marginTop).toBe("12px");
  });

  it("reports a colour token the theme lacks, and leaves the colour out", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(<TextDisplay text="x" style={{ color: "$nope", padding: 2 }} />);
    expect($("p")!.style.color).toBe("");
    expect($("p")!.style.padding).toBe("2px");
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([expect.stringContaining('"$nope"')]);
    warn.mockRestore();
  });
});

describe("looks given as portable styles", () => {
  const theme = (looks: NonNullable<PartialHtmlTheme["looks"]>): PartialHtmlTheme => ({
    tokens: { colors: { accent: "#ff0000" } },
    looks,
  });
  const dispatch = (el: Element, type: string) =>
    act(() => void el.dispatchEvent(new Event(type, { bubbles: true })));

  it("draws a look's style parts inline, tokens resolved, and layers them over a class look", () => {
    mount(
      <>
        <TextDisplay text="a" look={["tw", "ink"]} />
        <TextField field={dom.ctx.newControl("")} id="t" look="boxed" />
      </>,
      {
        theme: theme({
          tw: { control: "tw-class" },
          ink: { control: { color: "$accent", paddingTop: 8 }, text: { fontSize: 32 } },
          boxed: { control: { borderRadius: 6 }, text: { color: "$accent/50" } },
        }),
      },
    );
    const p = $("p")!;
    // classes and styles from different looks in one list: both land
    expect(p.classList.contains("tw-class")).toBe(true);
    expect([p.style.paddingTop, p.style.color]).toEqual(["8px", expect.stringMatching(/#ff0000|255, 0, 0/)]);
    expect(p.querySelector("span")!.style.fontSize).toBe("2rem");
    // a field: the control's style on the frame, the text part's on the input
    expect($("#t")!.parentElement!.style.borderRadius).toBe("6px");
    expect($("#t")!.style.color).toMatch(/rgba\(255, 0, 0, 0\.5/);
  });

  it("lets a style `{ replace }` drop the earlier classes and styles, and the author's style win", () => {
    mount(
      <>
        <TextDisplay text="a" look={["base", "swap"]} />
        <TextDisplay text="b" look="base" style={{ paddingTop: 1 }} />
      </>,
      {
        theme: theme({
          base: { control: "from-base" },
          swap: { control: { replace: { margin: 2 } } },
        }),
      },
    );
    const [a, b] = $$("p") as HTMLElement[];
    expect(a.classList.contains("from-base")).toBe(false);
    expect(a.style.margin).toBe("2px");
    expect(b.style.paddingTop).toBe("1px");
  });

  it("tells a function of the state when an action is pressed and hovered, and drops it again", () => {
    mount(<Action actionId="a" text="Go" look="press" />, {
      theme: theme({
        press: {
          control: (s) => ({ opacity: s.pressed ? 0.5 : s.hovered ? 0.8 : 1 }),
        },
      }),
    });
    const button = $("button")!;
    expect(button.style.opacity).toBe("1");
    dispatch(button, "pointerover");
    expect(button.style.opacity).toBe("0.8");
    dispatch(button, "pointerdown");
    expect(button.style.opacity).toBe("0.5");
    dispatch(button, "pointerup");
    expect(button.style.opacity).toBe("0.8");
    dispatch(button, "pointerout");
    expect(button.style.opacity).toBe("1");
  });

  it("tells a function of the state a field's focus and error", () => {
    const c = dom.ctx.newControl("");
    mount(<TextField field={c} id="t" required look="frame" />, {
      theme: theme({
        frame: {
          control: (s) => ({
            borderColor: s.invalid ? "#ff0000" : s.focused ? "#0000ff" : "#cccccc",
            borderWidth: 1,
          }),
        },
      }),
    });
    const frame = () => $("#t")!.parentElement!;
    expect(frame().style.borderColor).toBe("#cccccc");
    act(() => $<HTMLInputElement>("#t")!.focus());
    expect(frame().style.borderColor).toBe("#0000ff");
    touch(c as Control<unknown>);
    expect(frame().style.borderColor).toBe("#ff0000");
  });

  it("tells a function of the state the window's width, and follows a resize", () => {
    const saved = window.innerWidth;
    (window as { innerWidth: number }).innerWidth = 500;
    try {
      mount(<Contents look="wide">x</Contents>, {
        theme: theme({
          wide: { control: (s) => ({ flexDirection: s.width >= 1024 ? "row" : "column" }) },
        }),
      });
      const body = () => $(".rxf-contents-body")!;
      expect(body().style.flexDirection).toBe("column");
      (window as { innerWidth: number }).innerWidth = 1200;
      act(() => void window.dispatchEvent(new Event("resize")));
      expect(body().style.flexDirection).toBe("row");
    } finally {
      (window as { innerWidth: number }).innerWidth = saved;
    }
  });
});
