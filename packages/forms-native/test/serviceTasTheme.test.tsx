import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControlContextProvider, createControlContext } from "@rx-controls/react";
import {
  Action,
  Contents,
  Form,
  FormProvider,
  RadioField,
  SelectField,
  TextDisplay,
  TextField,
} from "@rx-controls/forms-react";
import { NativeThemeProvider, nativeRenderers } from "../src/index";
import { serviceTasNativeTheme } from "./fixtures/serviceTasTheme";

/**
 * ServiceTas's native renderer options, restated as a `NativeTheme`, is the
 * fixture that proves a real host's look fits in the theme: applied as a host
 * would apply it (one `NativeThemeProvider`), every renderer mounts under it
 * with a clean console, and its classes land where ServiceTas put them.
 */
describe("the ServiceTas native theme", () => {
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
  const mount = (ui: ReactNode) =>
    act(() =>
      root.render(
        <ControlContextProvider value={ctx}>
          <FormProvider renderers={nativeRenderers}>
            <NativeThemeProvider theme={serviceTasNativeTheme}>
              <Form>{ui}</Form>
            </NativeThemeProvider>
          </FormProvider>
        </ControlContextProvider>,
      ),
    );
  const style = (e: Element | null) => (e as HTMLElement).style;
  const options = [
    { name: "Phone", value: "phone" },
    { name: "Email", value: "email" },
  ];

  it("mounts every renderer under it, with nothing on the console", () => {
    mount(
      <Contents title="Your details">
        <TextField field={ctx.newControl("")} id="name" label="Name" required />
        <SelectField field={ctx.newControl("phone")} label="Contact" options={options} />
        <RadioField field={ctx.newControl("phone")} label="How" options={options} />
        <TextDisplay text="Hello" look="title1" />
        <Action actionId="a" text="Go" look="primary" onClick={() => {}} />
        <Action actionId="b" text="Back" look="secondary" onClick={() => {}} />
        <Action actionId="c" text="More" look="link" onClick={() => {}} />
      </Contents>,
    );
    expect(logged).toEqual([]);
  });

  it("draws an input as ServiceTas's form-control: a square 1px #E7E7E8 box on white", () => {
    mount(<TextField field={ctx.newControl("")} id="name" label="Name" />);
    const frame = document.getElementById("name")!.parentElement!;
    expect(style(frame).borderWidth).toBe("1px");
    expect(style(frame).borderRadius).toBe("0px");
    expect(style(frame).borderColor).toMatch(/231, 231, 232|#e7e7e8/i);
    expect(style(frame).backgroundColor).toMatch(/255, 255, 255|#fff/i);
  });

  it("draws the emphases as ServiceTas's buttons: a solid accent primary, an outlined secondary", () => {
    mount(
      <>
        <Action actionId="a" text="Go" look="primary" onClick={() => {}} />
        <Action actionId="b" text="Back" look="secondary" onClick={() => {}} />
      </>,
    );
    const [go, back] = [...el.querySelectorAll("button")];
    expect(style(go).backgroundColor).toMatch(/38, 113, 81|#267151/i);
    expect(style(go).minHeight).toBe("54px");
    expect(style(go.firstElementChild).color).toMatch(/255, 255, 255|#fff/i);
    expect(style(back).borderWidth).toBe("1px");
    expect(style(back.firstElementChild).color).toMatch(/38, 113, 81|#267151/i);
  });

  it("draws a radio option as a bordered rounded card, ServiceTas's entryClass", () => {
    mount(<RadioField field={ctx.newControl("phone")} id="r" label="How" options={options} />);
    const option = el.querySelector('[role="radio"]')!.parentElement!;
    expect([style(option).borderWidth, style(option).borderRadius, style(option).padding]).toEqual([
      "1px",
      "10.5px",
      "16px",
    ]);
  });
});
