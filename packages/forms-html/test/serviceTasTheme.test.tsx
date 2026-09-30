import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import {
  Action,
  Contents,
  Form,
  FormProvider,
  RadioField,
  SelectField,
  TextField,
} from "@rx-controls/forms-react";
import { htmlRenderers, HtmlThemeProvider, tailwindHtmlTheme } from "../src/index";
import { formStyles, overlayFor, serviceTasOverlay } from "./fixtures/serviceTasTheme";
import { setupDom } from "./harness";

/**
 * ServiceTas's legacy renderer options, restated as an overlay on the
 * Tailwind theme, is the fixture that proves a real host's look fits in the
 * theme: applied as a host would apply it — three nested providers — every
 * renderer mounts under it, its classes land where legacy put them, and a
 * per-form overlay still wins over it.
 */
const dom = setupDom();
const $ = <E extends Element = HTMLElement>(sel: string) =>
  dom.container.querySelector(sel) as E | null;

function mount(style?: string) {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const warns = vi.spyOn(console, "warn").mockImplementation(() => {});
  const name = dom.ctx.newControl("");
  const status = dom.ctx.newControl<string | undefined>(undefined);
  const options = [
    { name: "Active", value: "active" },
    { name: "Inactive", value: "inactive" },
  ];
  dom.mount(
    <FormProvider renderers={htmlRenderers}>
      <HtmlThemeProvider theme={tailwindHtmlTheme}>
        <HtmlThemeProvider theme={serviceTasOverlay}>
          <HtmlThemeProvider theme={overlayFor(style)}>
            <Form>
              <Contents title="Your details">
                <TextField field={name} id="name" label="Name" required className="from-def" />
                <SelectField field={status} label="Status" options={options} />
                <RadioField field={status} label="Status" options={options} />
              </Contents>
              <Action actionId="save" text="Save" variant="primary" />
              <Action actionId="back" text="Back" variant="secondary" />
            </Form>
          </HtmlThemeProvider>
        </HtmlThemeProvider>
      </HtmlThemeProvider>
    </FormProvider>,
  );
  const logged = [...errors.mock.calls, ...warns.mock.calls];
  errors.mockRestore();
  warns.mockRestore();
  return { name, logged };
}

describe("the ServiceTas theme", () => {
  it("mounts every renderer under it, with nothing on the console", () => {
    const { logged } = mount();
    expect(logged).toEqual([]);
  });

  it("puts Bootstrap's form-control and the definition's class on the input", () => {
    mount();
    const input = $<HTMLInputElement>("#name")!;
    expect(input.className).toContain("form-control");
    expect(input.className).toContain("from-def");
  });

  it("draws the variants' classes and its own error message", () => {
    const { name } = mount();
    const buttons = [...dom.container.querySelectorAll("button")];
    expect(buttons.find((b) => b.textContent === "Save")!.className).toContain("bg-accent");
    expect(buttons.find((b) => b.textContent === "Back")!.className).toContain("border-border");
    act(() => dom.ctx.update((wc) => wc.setTouched(name, true)));
    // layout.renderError: the warning glyph and the message.
    expect(dom.container.querySelector(".error svg")).not.toBeNull();
    expect(dom.container.textContent).toContain("Please enter a value");
  });

  it("lets a per-form overlay win over it", () => {
    mount("compact");
    expect(dom.container.innerHTML).toContain(formStyles.compact.contents.title);
  });

  it("resolves every formStyles overlay", () => {
    for (const style of Object.keys(formStyles)) {
      const { logged } = mount(style);
      expect(logged).toEqual([]);
    }
  });
});
