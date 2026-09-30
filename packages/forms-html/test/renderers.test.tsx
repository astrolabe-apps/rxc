import { describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { untrackedRead, type Control } from "@rx-controls/core";
import {
  Action,
  ActionOverrideProvider,
  CheckboxField,
  Contents,
  Dialog,
  DisplayOnlyField,
  Form,
  FormProvider,
  InlineGroup,
  RadioField,
  SelectField,
  Stack,
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

  it("puts the control's className where the theme says the chrome is", () => {
    const c = dom.ctx.newControl("");
    mount(<TextField field={c} className="mine" />);
    expect($(".rxf-frame")!.className).toContain("mine");
    expect($("input")!.className).not.toContain("mine");
    mount(<TextField field={c} className="mine" />, {
      theme: { frame: { classNameOn: "input" } },
    });
    expect($("input")!.className).toContain("mine");
  });

  it("merges a string class and substitutes { replace }", () => {
    const c = dom.ctx.newControl("");
    mount(<TextField field={c} shellClassName={{ replace: "only" }} className="extra" />);
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

  it("RadioField labels the group with a legend and renders per-option content", () => {
    const c = dom.ctx.newControl<OptionValue>(3);
    mount(
      <RadioField field={c} label="Priority" options={options}>
        {(o, selected) => <i data-extra={`${o.value}:${selected}`} />}
      </RadioField>,
    );
    expect($("fieldset > legend")!.textContent).toBe("Priority");
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
    mount(<Contents hidden={hide}>{null}</Contents>, { theme: tailwindHtmlTheme });
    const el = $<HTMLElement>(".rxf-contents")!;
    expect(el.hidden).toBe(false);
    expect(el.hasAttribute("data-hidden")).toBe(true);
    expect(el.hasAttribute("inert")).toBe(true);
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
        variant="primary"
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

  it("draws the icon alone for iconPlacement replace", () => {
    mount(<Action actionId="x" text="Hidden text" icon={<i data-icon />} iconPlacement="replace" />);
    expect($("button")!.textContent).toBe("");
    expect($("[data-icon]")).not.toBeNull();
  });
});

describe("Stack and TextDisplay", () => {
  it("draws a flex box with its props as inline style", () => {
    mount(
      <Stack direction="row" gap={8} justify="space-between">
        <i />
      </Stack>,
    );
    const s = $<HTMLElement>(".rxf-stack")!;
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

  it("uses the theme's fade slot", () => {
    mount(<TextField field={dom.ctx.newControl("")} />, {
      fade: true,
      theme: { visibility: { fade: "my-fade" } },
    });
    expect($(".my-fade")).not.toBeNull();
    expect(defaultHtmlTheme.visibility.fade).toBe("rxf-fade");
  });
});
