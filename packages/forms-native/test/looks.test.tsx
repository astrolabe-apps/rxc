import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControlContextProvider, createControlContext } from "@rx-controls/react";
import {
  Action,
  Contents,
  Form,
  FormProvider,
  NO_LOOK_STATE,
  RadioField,
  TextDisplay,
  TextField,
} from "@rx-controls/forms-react";
import {
  NativeThemeProvider,
  nativeRenderers,
  resolvePart,
  type PartialNativeTheme,
} from "../src/index";

/**
 * Looks on React Native: a name resolved from the theme to plain styles —
 * no class, no NativeWind. The suites see React Native's styles as
 * react-native-web writes them, inline.
 */
describe("looks (native)", () => {
  const ctx = createControlContext();
  let root: Root;
  let el: HTMLElement;
  let logged: string[];
  beforeEach(() => {
    logged = [];
    for (const l of ["error", "warn", "log"] as const)
      vi.spyOn(console, l).mockImplementation((...a) => void logged.push(a.map(String).join(" ")));
    el = document.createElement("div");
    document.body.appendChild(el);
    root = createRoot(el);
  });
  afterEach(() => {
    act(() => root.unmount());
    el.remove();
    vi.restoreAllMocks();
  });
  const theme: PartialNativeTheme = {
    tokens: { colors: { accent: "#ff0000", danger: "#00f" } },
    looks: {
      card: {
        shell: { padding: 8, backgroundColor: "$accent/50" },
        control: { borderWidth: 1, color: "$accent", gap: 4 },
        text: { fontSize: 18 },
        labelText: { fontSize: 20, fontWeight: "bold" },
      },
      bare: { control: { replace: { padding: 2 } } },
    },
  };
  const mount = (ui: ReactNode, t: PartialNativeTheme = theme) =>
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={nativeRenderers}>
            <NativeThemeProvider theme={t}>
              <Form>{ui}</Form>
            </NativeThemeProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
  const style = (e: Element | null) => (e as HTMLElement).style;
  /** The innermost element whose text is exactly `t`: the words, not the wrapper around them. */
  const words = (t: string) =>
    [...el.querySelectorAll("div")].filter((d) => d.textContent === t).pop()!;

  it("styles each part of a field: shell, frame, label and the input's own text", () => {
    mount(<TextField field={ctx.newControl("")} id="t" label="Name" look="card" />);
    const input = document.getElementById("t")!;
    const frame = input.parentElement!;
    const shell = frame.parentElement!;
    const label = document.getElementById("t-label")!;
    expect(style(shell).padding).toBe("8px");
    // a token with a tint: red at 50%
    expect(style(shell).backgroundColor).toMatch(/rgba\(255, 0, 0, 0\.5/);
    expect(style(frame).borderWidth).toBe("1px");
    expect(style(frame).gap).toBe("4px");
    expect(style(label).fontSize).toBe("20px");
    expect(style(label).fontWeight).toBe("bold");
    // a text property in `control` follows the words, not the frame
    expect(style(input).color).toMatch(/rgba\(255, 0, 0, 1/);
    expect(style(frame).color).toBe("");
    expect(style(input).fontSize).toBe("18px");
    expect(logged).toEqual([]);
  });

  it("styles a group's wrapper, title and body, and keeps hiding", () => {
    mount(
      <>
        <Contents look="card" title="Hi" id="g">
          x
        </Contents>
        <Contents look="card" hidden>
          y
        </Contents>
      </>,
    );
    const title = el.querySelector("h2")!;
    const wrapper = title.parentElement!;
    expect(style(wrapper).padding).toBe("8px");
    expect(style(title).fontSize).toBe("20px");
    expect(style(title.nextElementSibling).borderWidth).toBe("1px");
    // body text reaches the words inside it
    expect(style(title.nextElementSibling!.firstElementChild).color).toMatch(/255, 0, 0/);
    const hidden = [...el.children].find((c) => c.textContent === "y") as HTMLElement;
    expect(hidden.style.display).toBe("none");
    expect(hidden.style.padding).toBe("8px");
  });

  it("styles an action and a text display", () => {
    mount(
      <>
        <Action actionId="go" text="Go" look="card" onClick={() => {}} />
        <TextDisplay text="hello" look="card" />
      </>,
    );
    const button = el.querySelector("button")!;
    expect(style(button.parentElement).padding).toBe("8px");
    expect(style(button).borderWidth).toBe("1px");
    expect(style(button.firstElementChild).color).toMatch(/255, 0, 0/);
    const text = words("hello");
    expect(style(text).fontSize).toBe("18px");
  });

  it("applies the author's style after the look, and shellStyle to the wrapper", () => {
    mount(
      <TextDisplay
        text="hello"
        look="card"
        style={{ fontSize: 30, fontWeight: "bold" }}
        shellStyle={{ padding: 1 }}
      />,
    );
    const text = words("hello");
    expect(style(text).fontSize).toBe("30px"); // the author's style wins over every part
    expect(style(text).fontWeight).toBe("bold");
    expect(style(text.parentElement).padding).toBe("1px");

    mount(<Action actionId="go" text="Go" look="card" style={{ borderWidth: 3 }} onClick={() => {}} />);
    expect(style(el.querySelector("button")).borderWidth).toBe("3px");
  });

  it("follows a derived look, and draws the base look for an unknown name once", () => {
    const which = ctx.newControl("card");
    mount(
      <TextDisplay text="hello" look={(rc) => rc.getValue(which)} />,
    );
    const text = () => words("hello");
    expect(style(text()).fontSize).toBe("18px");
    act(() => ctx.update((wc) => wc.setValue(which, "nope")));
    expect(style(text()).fontSize).toBe("");
    act(() => ctx.update((wc) => wc.setValue(which, "nope2")));
    act(() => ctx.update((wc) => wc.setValue(which, "nope")));
    expect(logged.filter((l) => l.includes('look "nope"'))).toHaveLength(1);
    expect(logged.filter((l) => l.includes('look "nope2"'))).toHaveLength(1);
    logged.length = 0;
  });

  it("replaces the theme's own styling of an element only when asked", () => {
    mount(
      <>
        <Action actionId="a" text="A" look="bare" onClick={() => {}} />
        <Action actionId="b" text="B" onClick={() => {}} />
      </>,
    );
    const [a, b] = [...el.querySelectorAll("button")];
    expect(a.className).not.toContain("rounded-md");
    expect(b.className).toContain("rounded-md");
    expect(style(a).padding).toBe("2px");
  });

  it("puts a radio look's entry on every option and selected / notSelected on its two states", () => {
    const options = [
      { name: "One", value: "1" },
      { name: "Two", value: "2" },
    ];
    mount(<RadioField field={ctx.newControl("1")} id="r" label="Pick" options={options} look="opts" />, {
      looks: {
        opts: { entry: "k-entry", selected: "k-on", notSelected: "k-off" },
      },
    });
    const entry = (name: string) => words(name).closest('[role="radio"]')?.parentElement ?? words(name).parentElement!.parentElement!;
    const cls = (name: string) => (entry(name).getAttribute("class") ?? "").split(/\s+/);
    expect(cls("One")).toEqual(expect.arrayContaining(["k-entry", "k-on"]));
    expect(cls("One")).not.toContain("k-off");
    expect(cls("Two")).toEqual(expect.arrayContaining(["k-entry", "k-off"]));
    expect(cls("Two")).not.toContain("k-on");
  });

  it("lets a radio's replacing entry drop the theme's own entry class and keep its own", () => {
    mount(<RadioField field={ctx.newControl("1")} id="r" label="Pick" options={[{ name: "One", value: "1" }]} look="rep" />, {
      looks: { rep: { entry: { replace: "k-only" } } },
    });
    const el = words("One").closest('[role="radio"]')?.parentElement ?? words("One").parentElement!.parentElement!;
    const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    expect(classes).toContain("k-only");
    expect(classes).not.toContain("gap-1");
  });

  it("reports a colour token the theme lacks once, and leaves the colour out", () => {
    mount(
      <TextDisplay text="hello" look="x" />,
      { looks: { x: { control: { color: "$missing", fontSize: 11 } } } },
    );
    const text = words("hello");
    expect(style(text).fontSize).toBe("11px");
    expect(style(text).color).toBe("");
    expect(logged.filter((l) => l.includes('"$missing"'))).toHaveLength(1);
    logged.length = 0;
  });
});

describe("resolvePart", () => {
  const colors = { accent: "#abc" };
  it("evaluates a function of state, and lets the author's style win", () => {
    const look = {
      control: (s: typeof NO_LOOK_STATE) => ({
        backgroundColor: s.pressed ? "$accent" : "#fff",
        color: "#000",
        padding: 4,
      }),
    };
    const idle = resolvePart(look, "control", NO_LOOK_STATE, colors);
    expect(idle.box).toEqual({ backgroundColor: "#fff", padding: 4 });
    expect(idle.text).toEqual({ color: "#000" });
    const pressed = resolvePart(look, "control", { ...NO_LOOK_STATE, pressed: true }, colors, {
      padding: 0,
    });
    expect(pressed.box).toEqual({ backgroundColor: "#abc", padding: 0 });
  });

  it("puts everything on the words for an element that is only words", () => {
    const r = resolvePart({ text: { padding: 2, fontSize: 9 } }, "text", NO_LOOK_STATE, colors, undefined, true);
    expect(r.box).toBeUndefined();
    expect(r.text).toEqual({ padding: 2, fontSize: 9 });
  });

  it("says when a part replaces", () => {
    expect(resolvePart({ control: { replace: { padding: 1 } } }, "control", NO_LOOK_STATE, colors).replace).toBe(true);
    expect(resolvePart({ control: { padding: 1 } }, "control", NO_LOOK_STATE, colors).replace).toBe(false);
  });
});
