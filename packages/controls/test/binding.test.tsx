import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  Fcheckbox,
  Finput,
  FormEditProvider,
  Fselect,
  useControls,
  useValidator,
  type Control,
  type ControlContext,
  type Rendered,
} from "../src/index";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let ctx: ControlContext;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  ctx = createControlContext();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(ui: React.ReactNode) {
  act(() =>
    root.render(
      <ControlContextProvider value={ctx}>{ui}</ControlContextProvider>,
    ),
  );
}

/** Simulate the user typing: React tracks the value setter, so go native. */
function type(input: HTMLInputElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    "value",
  )!.set!;
  act(() => {
    set.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const input = () => container.querySelector("input")!;

describe("Finput", () => {
  it("renders the value and writes changes back to the control", () => {
    const c = ctx.newControl("a");
    mount(<Finput control={c} />);
    expect(input().value).toBe("a");

    type(input(), "ab");
    expect(c.valueNow).toBe("ab");
    expect(input().value).toBe("ab");
  });

  it("re-renders itself on an external change without re-rendering the parent", () => {
    const c = ctx.newControl("a");
    let parentRenders = 0;

    function Parent() {
      parentRenders++;
      return <Finput control={c} />;
    }

    mount(<Parent />);
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(input().value).toBe("b");
    expect(parentRenders).toBe(1);
  });

  it("marks the control touched on blur", () => {
    const c = ctx.newControl("a");
    mount(<Finput control={c} />);
    expect(c.touchedNow).toBe(false);

    act(() => {
      input().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(c.touchedNow).toBe(true);
  });

  it("reflects the control's disabled state", () => {
    const c = ctx.newControl("a");
    mount(<Finput control={c} />);
    expect(input().disabled).toBe(false);

    act(() => ctx.update((wc) => wc.setDisabled(c, true)));
    expect(input().disabled).toBe(true);
  });

  it("publishes the control error as custom validity", () => {
    const c = ctx.newControl("");

    function Comp(): Rendered {
      const { rendered } = useControls();
      useValidator(c, (v) => (v ? null : "required"));
      return rendered(<Finput control={c} />);
    }

    mount(<Comp />);
    // Present at mount (set by the ref callback)…
    expect(input().validity.customError).toBe(true);

    // …cleared when the error clears…
    type(input(), "x");
    expect(input().validity.customError).toBe(false);

    // …and restored when it comes back.
    type(input(), "");
    expect(input().validity.customError).toBe(true);
  });

  it("stores the element on control.meta.element", () => {
    const c = ctx.newControl("a");
    mount(<Finput control={c} />);
    expect(c.meta.element).toBe(input());
  });
});

describe("FormEditState", () => {
  it("disabled locks inputs regardless of control state", () => {
    const c = ctx.newControl("a");
    mount(
      <FormEditProvider disabled>
        <Finput control={c} />
      </FormEditProvider>,
    );
    expect(input().disabled).toBe(true);
  });

  it("is restriction-only — cannot re-enable a disabled control", () => {
    const c = ctx.newControl("a");
    ctx.update((wc) => wc.setDisabled(c, true));
    mount(
      <FormEditProvider disabled={false}>
        <Finput control={c} />
      </FormEditProvider>,
    );
    expect(input().disabled).toBe(true);
  });

  it("readonly renders a read-only input", () => {
    const c = ctx.newControl("a");
    mount(
      <FormEditProvider readonly>
        <Finput control={c} />
      </FormEditProvider>,
    );
    expect(input().readOnly).toBe(true);
    expect(input().disabled).toBe(false);
  });

  it("readonly folds into disabled for selects and checkboxes", () => {
    const s = ctx.newControl<string | undefined>("a");
    const b = ctx.newControl<boolean | undefined>(false);
    mount(
      <FormEditProvider readonly>
        <Fselect control={s}>
          <option value="a">A</option>
        </Fselect>
        <Fcheckbox control={b} />
      </FormEditProvider>,
    );
    expect(container.querySelector("select")!.disabled).toBe(true);
    expect(input().disabled).toBe(true);
  });
});

describe("Fselect", () => {
  it("renders the value and writes selection changes", () => {
    const c = ctx.newControl<string | undefined>("b");
    mount(
      <Fselect control={c}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Fselect>,
    );
    const select = container.querySelector("select")!;
    expect(select.value).toBe("b");

    const set = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(select),
      "value",
    )!.set!;
    act(() => {
      set.call(select, "a");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(c.valueNow).toBe("a");
  });
});

describe("Fcheckbox", () => {
  it("reflects and toggles a boolean control", () => {
    const c = ctx.newControl<boolean | undefined>(false);
    mount(<Fcheckbox control={c} />);
    expect(input().checked).toBe(false);

    act(() => input().click());
    expect(c.valueNow).toBe(true);
    expect(input().checked).toBe(true);
  });

  it("notValue inverts the mapping", () => {
    const c = ctx.newControl<boolean | undefined>(false);
    mount(<Fcheckbox control={c} notValue />);
    expect(input().checked).toBe(true);

    act(() => input().click());
    expect(c.valueNow).toBe(true);
    expect(input().checked).toBe(false);
  });

  it("renders as a radio when asked", () => {
    const c = ctx.newControl<boolean | undefined>(false);
    mount(<Fcheckbox control={c} type="radio" />);
    expect(input().type).toBe("radio");
  });
});
