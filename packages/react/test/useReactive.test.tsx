import { Component, StrictMode, useEffect, type ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  useComputed,
  useControlContext,
  useReactive,
  type Control,
  type ControlContext,
  type ReactiveScope,
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

/** Catches a render-time throw so an abandoned render can be observed. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <span>caught</span> : this.props.children;
  }
}

describe("useReactive — subscription boundary", () => {
  it("re-renders when a control read through rc changes", () => {
    const c = ctx.newControl("a");
    let renders = 0;

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      renders++;
      return rendered(<span>{rc.getValue(c)}</span>);
    }

    mount(<Comp />);
    expect(container.textContent).toBe("a");
    expect(renders).toBe(1);

    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(container.textContent).toBe("b");
    expect(renders).toBe(2);
  });

  it("does not re-render for a control it never read", () => {
    const read = ctx.newControl("x");
    const unread = ctx.newControl("y");
    let renders = 0;

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      renders++;
      return rendered(<span>{rc.getValue(read)}</span>);
    }

    mount(<Comp />);
    expect(renders).toBe(1);

    act(() => ctx.update((wc) => wc.setValue(unread, "z")));
    expect(renders).toBe(1);
  });

  it("drops the subscription once a control stops being read", () => {
    const a = ctx.newControl("a");
    const b = ctx.newControl("b");
    const which = ctx.newControl<"a" | "b">("a");
    let renders = 0;

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      renders++;
      const pick = rc.getValue(which);
      return rendered(<span>{rc.getValue(pick === "a" ? a : b)}</span>);
    }

    mount(<Comp />);
    expect(container.textContent).toBe("a");

    // Switch to reading `b`; `a` should no longer be subscribed.
    act(() => ctx.update((wc) => wc.setValue(which, "b")));
    expect(container.textContent).toBe("b");
    const afterSwitch = renders;

    act(() => ctx.update((wc) => wc.setValue(a, "a2")));
    expect(renders).toBe(afterSwitch);

    act(() => ctx.update((wc) => wc.setValue(b, "b2")));
    expect(renders).toBe(afterSwitch + 1);
    expect(container.textContent).toBe("b2");
  });

  it("tracks non-value facets independently (error)", () => {
    const c = ctx.newControl("v");
    let renders = 0;

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      renders++;
      return rendered(<span>{rc.getError(c) ?? "none"}</span>);
    }

    mount(<Comp />);
    expect(container.textContent).toBe("none");

    act(() => ctx.update((wc) => wc.setError(c, "default", "bad")));
    expect(container.textContent).toBe("bad");
    expect(renders).toBe(2);
  });
});

describe("useReactive — rendered() is the boundary", () => {
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => error.mockRestore());

  it("warns, and does not subscribe, when a return path skips rendered()", () => {
    const c = ctx.newControl("a");
    let renders = 0;

    // Deliberately bypasses the boundary — the shape the `Rendered` type
    // prevents at compile time, and the dev guard catches at runtime.
    function Bad(): Rendered {
      const { rc } = useReactive();
      renders++;
      return (<span>{rc.getValue(c)}</span>) as unknown as Rendered;
    }

    mount(<Bad />);
    expect(container.textContent).toBe("a");
    expect(renders).toBe(1);

    // No subscription was reconciled, so the change is missed.
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(renders).toBe(1);
    expect(container.textContent).toBe("a");

    expect(error).toHaveBeenCalledOnce();
    const msg = String(error.mock.calls[0]![0]);
    expect(msg).toContain("returned without calling rendered");
    // The component identifies itself — no name argument is passed to
    // `useReactive()`; it's recovered from a one-per-instance stack capture
    // taken during render (the warning fires from an effect, where the
    // component's frame is long gone).
    expect(msg).toContain("Bad");
    expect(msg).toMatch(/useReactive\.test\.tsx:\d+/);
  });

  it("names the component even when useReactive is wrapped in a custom hook", () => {
    function useMyRenderer() {
      return useReactive();
    }
    function WrappedRenderer(): Rendered {
      const { rc } = useMyRenderer();
      return (
        <span>{rc.getValue(ctx.newControl("x"))}</span>
      ) as unknown as Rendered;
    }

    mount(<WrappedRenderer />);
    // Frame scan skips the consumer's hook and reports the PascalCase caller.
    expect(String(error.mock.calls[0]![0])).toContain("WrappedRenderer");
  });

  it("does not warn when every path calls rendered()", () => {
    function Good(): Rendered {
      const { rendered } = useReactive();
      return rendered(null);
    }
    mount(<Good />);
    expect(error).not.toHaveBeenCalled();
  });

  it("stops tracking after rendered() (reads still return current values)", () => {
    const tracked = ctx.newControl("t");
    const late = ctx.newControl("l");
    let renders = 0;
    let lateRead: unknown;

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      renders++;
      const out = rendered(<span>{rc.getValue(tracked)}</span>);
      // Past the boundary: still readable, but must not become a dependency.
      lateRead = rc.getValue(late);
      return out;
    }

    mount(<Comp />);
    expect(lateRead).toBe("l");
    expect(renders).toBe(1);

    act(() => ctx.update((wc) => wc.setValue(late, "l2")));
    expect(renders).toBe(1);

    act(() => ctx.update((wc) => wc.setValue(tracked, "t2")));
    expect(renders).toBe(2);
  });
});

describe("useReactive — StrictMode", () => {
  it("converges under double-invoked renders and effects", () => {
    const c = ctx.newControl(1);
    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      return rendered(<span>{rc.getValue(c)}</span>);
    }

    mount(<Comp />, true);
    expect(container.textContent).toBe("1");

    act(() => ctx.update((wc) => wc.setValue(c, 2)));
    expect(container.textContent).toBe("2");

    act(() => ctx.update((wc) => wc.setValue(c, 3)));
    expect(container.textContent).toBe("3");
  });
});

describe("useComputed", () => {
  it("derives a control and updates when its inputs change", () => {
    const first = ctx.newControl("Ada");
    const last = ctx.newControl("Lovelace");

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      const full = useComputed(
        (crc) => `${crc.getValue(first)} ${crc.getValue(last)}`,
      );
      return rendered(<span>{rc.getValue(full)}</span>);
    }

    mount(<Comp />);
    expect(container.textContent).toBe("Ada Lovelace");

    act(() => ctx.update((wc) => wc.setValue(last, "Byron")));
    expect(container.textContent).toBe("Ada Byron");
  });

  it("does not re-render when a dependency moves but the result does not", () => {
    const n = ctx.newControl(1);
    let renders = 0;

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      renders++;
      const positive = useComputed((crc) => crc.getValue(n) > 0);
      return rendered(<span>{String(rc.getValue(positive))}</span>);
    }

    mount(<Comp />);
    expect(renders).toBe(1);

    // The component subscribes to the *result*, not to `n`. This is the only
    // reason the hook allocates a control instead of calling `compute(rc)`
    // inline, so it is worth pinning.
    act(() => ctx.update((wc) => wc.setValue(n, 5)));
    expect(renders).toBe(1);

    act(() => ctx.update((wc) => wc.setValue(n, -1)));
    expect(renders).toBe(2);
    expect(container.textContent).toBe("false");
  });

  it("a render that never commits leaves nothing tracking", () => {
    const n = ctx.newControl(1);
    let computes = 0;

    function Boom(): Rendered {
      useReactive();
      useComputed((crc) => {
        computes++;
        return crc.getValue(n) * 2;
      });
      throw new Error("abandon this render");
    }

    // React logs the caught error; stderr fails `rush test`.
    const realError = console.error;
    console.error = () => {};
    try {
      mount(
        <Boundary>
          <Boom />
        </Boundary>,
      );
    } finally {
      console.error = realError;
    }
    expect(container.textContent).toBe("caught");

    // Tracking starts at commit, so there is no orphan left subscribed to `n`
    // and recomputing forever with no component to show the result to.
    const abandoned = computes;
    act(() => ctx.update((wc) => wc.setValue(n, 2)));
    expect(computes).toBe(abandoned);
  });

  it("stops computing as soon as it unmounts", () => {
    const n = ctx.newControl(1);
    let computes = 0;

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      const doubled = useComputed((crc) => {
        computes++;
        return crc.getValue(n) * 2;
      });
      return rendered(<span>{rc.getValue(doubled)}</span>);
    }

    mount(<Comp />);
    act(() => root.render(<ControlContextProvider value={ctx} />));

    // Cleanup is deterministic — nothing waits on the five-second sweep,
    // because nothing was created during a render.
    const unmounted = computes;
    act(() => ctx.update((wc) => wc.setValue(n, 2)));
    expect(computes).toBe(unmounted);
  });

  it("reflects a dependency written by a descendant mounting under it", () => {
    const n = ctx.newControl(1);

    function Child(): null {
      // React commits child-first, so this runs before the parent's computed
      // starts tracking — the window the commit-time run exists to close.
      useEffect(() => {
        ctx.update((wc) => wc.setValue(n, 99));
      }, []);
      return null;
    }

    function Parent(): Rendered {
      const { rc, rendered } = useReactive();
      const doubled = useComputed((crc) => crc.getValue(n) * 2);
      return rendered(
        <>
          <span>{rc.getValue(doubled)}</span>
          <Child />
        </>,
      );
    }

    mount(<Parent />);
    expect(container.textContent).toBe("198");
  });
});

describe("useReactive — update", () => {
  it("batches writes against the ambient context, so writes need no second hook", () => {
    const c = ctx.newControl("a");

    function Comp(): Rendered {
      const { rc, rendered, update } = useReactive();
      expect(update).toBe(ctx.update);
      return rendered(
        <button onClick={() => update((wc) => wc.setValue(c, "b"))}>
          {rc.getValue(c)}
        </button>,
      );
    }

    mount(<Comp />);
    expect(container.textContent).toBe("a");
    act(() => container.querySelector("button")!.click());
    expect(container.textContent).toBe("b");
  });

  it("tracks a swapped provider rather than freezing at first mount", () => {
    const other = createControlContext();
    const seen: Array<ReactiveScope["update"]> = [];

    function Comp(): Rendered {
      const { rendered, update } = useReactive();
      seen.push(update);
      return rendered(null);
    }

    mount(<Comp />);
    act(() =>
      root.render(
        <ControlContextProvider value={other}>
          <Comp />
        </ControlContextProvider>,
      ),
    );
    expect(seen).toEqual([ctx.update, other.update]);
  });
});

describe("useControlContext", () => {
  it("throws outside a provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Comp() {
      useControlContext();
      return null;
    }
    expect(() =>
      act(() => root.render(<Comp />)),
    ).toThrow(/no ControlContext found/);
    spy.mockRestore();
  });

  it("exposes a stable `update` identity across renders", () => {
    const c = ctx.newControl(0);
    const seen: Array<(cb: unknown) => void> = [];

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      const { update } = useControlContext();
      seen.push(update as unknown as (cb: unknown) => void);
      return rendered(<span>{rc.getValue(c)}</span>);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(c, 1)));
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});
