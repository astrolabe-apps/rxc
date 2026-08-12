import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  useControlEffect,
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

describe("useControlEffect", () => {
  it("runs onChange when the computed value changes", () => {
    const c = ctx.newControl("a");
    const seen: string[] = [];

    function Comp(): Rendered {
      const { rendered } = useControls();
      useControlEffect(
        (rc) => rc.getValue(c),
        (v) => seen.push(v),
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(seen).toEqual([]);

    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    act(() => ctx.update((wc) => wc.setValue(c, "c")));
    expect(seen).toEqual(["b", "c"]);
  });

  it("does not run onChange when a recompute produces an equal value", () => {
    const c = ctx.newControl("a");
    const seen: boolean[] = [];

    function Comp(): Rendered {
      const { rendered } = useControls();
      useControlEffect(
        (rc) => rc.getValue(c).length > 0,
        (v) => seen.push(v),
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    // "a" → "b": recomputes, but `length > 0` is still true.
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(seen).toEqual([]);

    act(() => ctx.update((wc) => wc.setValue(c, "")));
    expect(seen).toEqual([false]);
  });

  it("does not re-render the component when a dependency changes", () => {
    const c = ctx.newControl("a");
    let renders = 0;

    function Comp(): Rendered {
      const { rendered } = useControls();
      renders++;
      useControlEffect(
        (rc) => rc.getValue(c),
        () => {},
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(renders).toBe(1);
  });

  it("initial: true runs onChange once at mount", () => {
    const c = ctx.newControl("a");
    const seen: string[] = [];

    function Comp(): Rendered {
      const { rendered } = useControls();
      useControlEffect(
        (rc) => rc.getValue(c),
        (v) => seen.push(v),
        true,
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(seen).toEqual(["a"]);

    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(seen).toEqual(["a", "b"]);
  });

  it("initial: fn runs the fn at mount and onChange thereafter", () => {
    const c = ctx.newControl("a");
    const initials: string[] = [];
    const changes: string[] = [];

    function Comp(): Rendered {
      const { rendered } = useControls();
      useControlEffect(
        (rc) => rc.getValue(c),
        (v) => changes.push(v),
        (v) => initials.push(v),
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(initials).toEqual(["a"]);
    expect(changes).toEqual([]);

    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(initials).toEqual(["a"]);
    expect(changes).toEqual(["b"]);
  });

  it("runs the initial call once under StrictMode", () => {
    const c = ctx.newControl("a");
    const seen: string[] = [];

    function Comp(): Rendered {
      const { rendered } = useControls();
      useControlEffect(
        (rc) => rc.getValue(c),
        (v) => seen.push(v),
        true,
      );
      return rendered(<span />);
    }

    mount(<Comp />, true);
    expect(seen).toEqual(["a"]);

    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(seen).toEqual(["a", "b"]);
  });

  it("always calls the latest onChange", () => {
    const c = ctx.newControl("a");
    const gen = ctx.newControl(1);
    const seen: string[] = [];

    function Comp(): Rendered {
      const { rc, rendered } = useControls();
      const g = rc.getValue(gen); // re-renders the component when bumped
      useControlEffect(
        (rc) => rc.getValue(c),
        (v) => seen.push(`gen${g}:${v}`),
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(gen, 2)));
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(seen).toEqual(["gen2:b"]);
  });

  it("stops after unmount", () => {
    const c = ctx.newControl("a");
    const seen: string[] = [];

    function Comp(): Rendered {
      const { rendered } = useControls();
      useControlEffect(
        (rc) => rc.getValue(c),
        (v) => seen.push(v),
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(seen).toEqual(["b"]);

    act(() => root.render(null));
    act(() => ctx.update((wc) => wc.setValue(c, "c")));
    expect(seen).toEqual(["b"]);
  });

  it("onChange can write controls", () => {
    const source = ctx.newControl("a");
    const mirror = ctx.newControl("");

    function Comp(): Rendered {
      const { rendered } = useControls();
      useControlEffect(
        (rc) => rc.getValue(source),
        (v) => ctx.update((wc) => wc.setValue(mirror, v.toUpperCase())),
        true,
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(mirror.valueNow).toBe("A");

    act(() => ctx.update((wc) => wc.setValue(source, "b")));
    expect(mirror.valueNow).toBe("B");
  });
});
