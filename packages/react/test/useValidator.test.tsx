import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  useAsyncValidator,
  useReactive,
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

function mount(ui: React.ReactNode, strict = false) {
  const tree = (
    <ControlContextProvider value={ctx}>{ui}</ControlContextProvider>
  );
  act(() => root.render(strict ? <StrictMode>{tree}</StrictMode> : tree));
}

const required = (v: string) => (v ? null : "required");

describe("useValidator", () => {
  function Required({ control }: { control: Control<string> }): Rendered {
    const { rendered } = useReactive();
    useValidator(control, required);
    return rendered(<span />);
  }

  it("publishes the error immediately and tracks value changes", () => {
    const c = ctx.newControl("");

    mount(<Required control={c} />);
    expect(c.errorNow).toBe("required");
    expect(c.validNow).toBe(false);

    act(() => ctx.update((wc) => wc.setValue(c, "x")));
    expect(c.errorNow).toBeNull();
    expect(c.validNow).toBe(true);

    act(() => ctx.update((wc) => wc.setValue(c, "")));
    expect(c.errorNow).toBe("required");
  });

  it("publishes under its own key alongside other keys", () => {
    const c = ctx.newControl("");

    function Comp(): Rendered {
      const { rendered } = useReactive();
      useValidator(c, required, "req");
      useValidator(c, (v) => (v.length > 3 ? "too long" : null), "len");
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(c.errorsNow).toEqual({ req: "required" });

    act(() => ctx.update((wc) => wc.setValue(c, "xxxx")));
    expect(c.errorsNow).toEqual({ len: "too long" });
  });

  it("re-runs when a cross-field read through rc changes", () => {
    const password = ctx.newControl("a");
    const confirm = ctx.newControl("a");

    function Comp(): Rendered {
      const { rendered } = useReactive();
      useValidator(confirm, (v, rc) =>
        v === rc.getValue(password) ? null : "mismatch",
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(confirm.errorNow).toBeNull();

    act(() => ctx.update((wc) => wc.setValue(password, "b")));
    expect(confirm.errorNow).toBe("mismatch");
  });

  it("re-publishes on validate() after the error was cleared externally", () => {
    const c = ctx.newControl("");

    mount(<Required control={c} />);
    expect(c.errorNow).toBe("required");

    act(() => ctx.update((wc) => wc.clearErrors(c)));
    expect(c.errorNow).toBeNull();

    act(() => ctx.update((wc) => wc.validate(c)));
    expect(c.errorNow).toBe("required");
  });

  it("clears its error key on unmount", () => {
    const c = ctx.newControl("");

    mount(<Required control={c} />);
    expect(c.errorNow).toBe("required");

    act(() => root.render(null));
    expect(c.errorNow).toBeNull();
    expect(c.validNow).toBe(true);
  });

  it("keeps the error published under StrictMode", () => {
    const c = ctx.newControl("");

    mount(<Required control={c} />, true);
    expect(c.errorNow).toBe("required");

    act(() => ctx.update((wc) => wc.setValue(c, "x")));
    expect(c.errorNow).toBeNull();
  });

  it("uses the latest validator", () => {
    const c = ctx.newControl("");
    const limit = ctx.newControl(0);

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      const max = rc.getValue(limit); // re-renders the component when bumped
      useValidator(c, (v) => (v.length > max ? `over ${max}` : null));
      return rendered(<span />);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(limit, 2)));
    act(() => ctx.update((wc) => wc.setValue(c, "xxx")));
    expect(c.errorNow).toBe("over 2");
  });
});

describe("useAsyncValidator", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Flush the debounce timer and the validator's promise chain. */
  async function settle(ms: number) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
      await Promise.resolve();
    });
  }

  it("debounces, then publishes the error and marks touched", async () => {
    const c = ctx.newControl("");
    const calls: string[] = [];

    function Comp(): Rendered {
      const { rendered } = useReactive();
      useAsyncValidator(
        c,
        async (control) => {
          calls.push(control.valueNow);
          return control.valueNow ? null : "required";
        },
        100,
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    // Nothing runs at mount — only on change.
    await settle(200);
    expect(calls).toEqual([]);

    // Writing the same value is not a change — still nothing.
    act(() => ctx.update((wc) => wc.setValue(c, "")));
    act(() => ctx.update((wc) => wc.setValue(c, "x")));
    expect(calls).toEqual([]); // debounce pending

    await settle(100);
    expect(calls).toEqual(["x"]);
    expect(c.errorNow).toBeNull();

    act(() => ctx.update((wc) => wc.setValue(c, "")));
    await settle(100);
    expect(calls).toEqual(["x", ""]);
    expect(c.errorNow).toBe("required");
    expect(c.touchedNow).toBe(true);
  });

  it("restarts the debounce on rapid changes — one validation for the burst", async () => {
    const c = ctx.newControl("a");
    const calls: string[] = [];

    function Comp(): Rendered {
      const { rendered } = useReactive();
      useAsyncValidator(
        c,
        async (control) => {
          calls.push(control.valueNow);
          return null;
        },
        100,
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(c, "ab")));
    await settle(50);
    act(() => ctx.update((wc) => wc.setValue(c, "abc")));
    await settle(50);
    act(() => ctx.update((wc) => wc.setValue(c, "abcd")));
    await settle(100);

    expect(calls).toEqual(["abcd"]);
  });

  it("drops a stale result when the value changed while in flight", async () => {
    const c = ctx.newControl("a");
    let release!: (v: string | null) => void;

    function Comp(): Rendered {
      const { rendered } = useReactive();
      useAsyncValidator(
        c,
        (control, signal) =>
          new Promise((resolve) => {
            release = resolve;
            signal.addEventListener("abort", () => resolve(null));
          }),
        100,
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    await settle(100); // validator for "b" now in flight

    // Value moves on before the result lands.
    act(() => ctx.update((wc) => wc.setValue(c, "c")));
    await act(async () => {
      release("stale error");
      await Promise.resolve();
    });

    expect(c.errorNow).toBeNull();
    expect(c.touchedNow).toBe(false);
  });

  it("aborts the in-flight run when superseded", async () => {
    const c = ctx.newControl("a");
    const aborted: string[] = [];

    function Comp(): Rendered {
      const { rendered } = useReactive();
      useAsyncValidator(
        c,
        (control, signal) => {
          const value = control.valueNow;
          return new Promise((resolve) => {
            signal.addEventListener("abort", () => {
              aborted.push(value);
              resolve(null);
            });
          });
        },
        100,
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    await settle(100); // "b" in flight

    act(() => ctx.update((wc) => wc.setValue(c, "c")));
    await settle(100); // supersedes: aborts "b", starts "c"

    expect(aborted).toEqual(["b"]);
  });
});
