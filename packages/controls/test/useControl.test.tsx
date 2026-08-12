import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  useControl,
  useControls,
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

describe("useControl", () => {
  it("returns the same control across re-renders", () => {
    const seen: Control<string>[] = [];
    const other = ctx.newControl("x");

    function Comp(): Rendered {
      const { rc, rendered } = useControls();
      const c = useControl("a");
      seen.push(c);
      // Read something else so the component re-renders on demand.
      return rendered(<span>{rc.getValue(other)}</span>);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(other, "y")));

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
    expect(seen[0].valueNow).toBe("a");
  });

  it("calls a lazy initializer exactly once", () => {
    let calls = 0;
    const other = ctx.newControl("x");

    function Comp(): Rendered {
      const { rc, rendered } = useControls();
      useControl(() => {
        calls++;
        return "computed";
      });
      return rendered(<span>{rc.getValue(other)}</span>);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(other, "y")));
    expect(calls).toBe(1);
  });

  it("creates one control under StrictMode's double render", () => {
    const seen: Control<string>[] = [];

    function Comp(): Rendered {
      const { rendered } = useControls();
      seen.push(useControl("a"));
      return rendered(<span />);
    }

    mount(<Comp />, true);
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it("defaults to an undefined value with no arguments", () => {
    let c: Control<string | undefined> | undefined;

    function Comp(): Rendered {
      const { rendered } = useControls();
      c = useControl<string>();
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(c!.valueNow).toBeUndefined();
  });

  it("applies ControlSetup when creating the control", () => {
    let c: Control<string> | undefined;

    function Comp(): Rendered {
      const { rendered } = useControls();
      c = useControl("a", { meta: { tag: "hello" } });
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(c!.meta.tag).toBe("hello");
  });

  it("is reactive — a write re-renders a component reading it", () => {
    let target: Control<string> | undefined;

    function Comp(): Rendered {
      const { rc, rendered } = useControls();
      const c = useControl("a");
      target = c;
      return rendered(<span>{rc.getValue(c)}</span>);
    }

    mount(<Comp />);
    expect(container.textContent).toBe("a");

    act(() => ctx.update((wc) => wc.setValue(target!, "b")));
    expect(container.textContent).toBe("b");
  });

  describe("the `use` escape hatch", () => {
    it("returns the supplied control instead of creating one", () => {
      const supplied = ctx.newControl("supplied");
      let seen: Control<string> | undefined;

      function Comp({ control }: { control?: Control<string> }): Rendered {
        const { rendered } = useControls();
        seen = useControl("fallback", { use: control });
        return rendered(<span />);
      }

      mount(<Comp control={supplied} />);
      expect(seen).toBe(supplied);
    });

    it("falls back to its own control when the supplied one is withdrawn", () => {
      const supplied = ctx.newControl("supplied");
      let seen: Control<string> | undefined;

      function Comp({ control }: { control?: Control<string> }): Rendered {
        const { rendered } = useControls();
        seen = useControl("fallback", { use: control });
        return rendered(<span />);
      }

      mount(<Comp control={supplied} />);
      expect(seen).toBe(supplied);

      mount(<Comp />);
      expect(seen).not.toBe(supplied);
      expect(seen!.valueNow).toBe("fallback");
    });
  });
});
