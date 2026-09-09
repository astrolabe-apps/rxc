import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  NotDefinedContext,
  RenderArrayElements,
  Reactive,
  RenderElements,
  RenderOptional,
  whenAllDefined,
  useReactive,
  type ControlContext,
  type ReadContext,
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

describe("Reactive", () => {
  it("isolates its reads from the calling component", () => {
    const c = ctx.newControl("a");
    let outer = 0;
    let inner = 0;

    function Comp(): Rendered {
      const { rendered } = useReactive();
      outer++;
      return rendered(
        <Reactive>
          {(rc) => {
            inner++;
            return <span>{rc.getValue(c)}</span>;
          }}
        </Reactive>,
      );
    }

    mount(<Comp />);
    expect(container.textContent).toBe("a");
    expect([outer, inner]).toEqual([1, 1]);

    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(container.textContent).toBe("b");
    // Only the boundary re-rendered — the caller read nothing.
    expect([outer, inner]).toEqual([1, 2]);
  });

  it("does not isolate a value read in the caller and closed over", () => {
    const c = ctx.newControl("a");
    let outer = 0;

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      outer++;
      const value = rc.getValue(c); // read in the caller's scope
      return rendered(
        <Reactive>{() => <span>{value}</span>}</Reactive>,
      );
    }

    mount(<Comp />);
    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(container.textContent).toBe("b");
    expect(outer).toBe(2);
  });
});

describe("RenderElements", () => {
  it("re-renders only the changed element's scope", () => {
    const arr = ctx.newControl<string[]>(["a", "b", "c"]);
    // `container` runs once per RenderElements render, so it doubles as a
    // render probe for the list itself (the calling component reads nothing
    // and so would never re-render either way).
    let list = 0;
    const rows: number[] = [0, 0, 0];

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <RenderElements
          control={arr}
          container={(children) => {
            list++;
            return <>{children}</>;
          }}
        >
          {(rc, element, index) => {
            rows[index]++;
            return <span>{rc.getValue(element)}</span>;
          }}
        </RenderElements>,
      );
    }

    mount(<Comp />);
    expect(container.textContent).toBe("abc");
    expect(list).toBe(1);
    expect(rows).toEqual([1, 1, 1]);

    act(() => ctx.update((wc) => wc.setValue(arr.elementsNow[1] as any, "B")));
    expect(container.textContent).toBe("aBc");
    // The list subscribed to structure only; one row re-rendered.
    expect(list).toBe(1);
    expect(rows).toEqual([1, 2, 1]);
  });

  it("re-renders the list when the array structure changes", () => {
    const arr = ctx.newControl<string[]>(["a"]);
    let list = 0;

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <RenderElements
          control={arr}
          container={(children) => {
            list++;
            return <>{children}</>;
          }}
        >
          {(rc, element) => <span>{rc.getValue(element)}</span>}
        </RenderElements>,
      );
    }

    mount(<Comp />);
    expect(list).toBe(1);

    act(() => ctx.update((wc) => wc.setValue(arr, ["a", "b"])));
    expect(container.textContent).toBe("ab");
    expect(list).toBe(2);
  });

  it("renders `empty` for an empty array and `notDefined` for null", () => {
    const arr = ctx.newControl<string[] | null>(null);

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <RenderElements
          control={arr}
          notDefined={<i>none</i>}
          empty={<i>empty</i>}
        >
          {(rc, element) => <span>{rc.getValue(element)}</span>}
        </RenderElements>,
      );
    }

    mount(<Comp />);
    expect(container.textContent).toBe("none");

    act(() => ctx.update((wc) => wc.setValue(arr, [])));
    expect(container.textContent).toBe("empty");
  });

  it("wraps rendered rows in `container`", () => {
    const arr = ctx.newControl<string[]>(["a", "b"]);

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <RenderElements
          control={arr}
          container={(children, elements) => (
            <ul data-count={elements.length}>{children}</ul>
          )}
        >
          {(rc, element) => <li>{rc.getValue(element)}</li>}
        </RenderElements>,
      );
    }

    mount(<Comp />);
    expect(container.querySelector("ul")?.getAttribute("data-count")).toBe("2");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });
});

describe("RenderOptional", () => {
  it("renders children once the control is non-null", () => {
    const c = ctx.newControl<string | null>(null);

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <RenderOptional control={c} notDefined={<i>loading</i>}>
          {(rc, defined) => <span>{rc.getValue(defined)}</span>}
        </RenderOptional>,
      );
    }

    mount(<Comp />);
    expect(container.textContent).toBe("loading");

    act(() => ctx.update((wc) => wc.setValue(c, "here")));
    expect(container.textContent).toBe("here");
  });

  it("falls back to NotDefinedContext when `notDefined` is omitted", () => {
    const c = ctx.newControl<string | null>(null);

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <RenderOptional control={c}>
          {(rc, defined) => <span>{rc.getValue(defined)}</span>}
        </RenderOptional>,
      );
    }

    mount(
      <NotDefinedContext.Provider value={<i>ctx-fallback</i>}>
        <Comp />
      </NotDefinedContext.Provider>,
    );
    expect(container.textContent).toBe("ctx-fallback");
  });

  it("does not re-render itself for a value change that stays non-null", () => {
    const c = ctx.newControl<string | null>("a");
    let outer = 0;

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <RenderOptional control={c}>
          {(rc, defined) => {
            outer++;
            return <span>{rc.getValue(defined)}</span>;
          }}
        </RenderOptional>,
      );
    }

    mount(<Comp />);
    expect(outer).toBe(1);

    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(container.textContent).toBe("b");
    expect(outer).toBe(2);
  });
});

describe("whenAllDefined", () => {
  it("renders only once every control has a value", () => {
    const a = ctx.newControl<string | null>("a");
    const b = ctx.newControl<number | null>(null);

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <Reactive>
          {whenAllDefined(
            { a, b },
            ({ a, b }) => (
              <span>{`${a}${b}`}</span>
            ),
            <i>waiting</i>,
          )}
        </Reactive>,
      );
    }

    mount(<Comp />);
    expect(container.textContent).toBe("waiting");

    act(() => ctx.update((wc) => wc.setValue(b, 1)));
    expect(container.textContent).toBe("a1");
  });
});

describe("RenderArrayElements", () => {
  it("renders a plain array with keys", () => {
    function Comp() {
      return (
        <RenderArrayElements
          array={["x", "y"]}
          getKey={(e) => e}
          container={(children) => <ul>{children}</ul>}
        >
          {(element, index, total) => (
            <li>{`${element}${index}${total}`}</li>
          )}
        </RenderArrayElements>
      );
    }

    mount(<Comp />);
    expect(container.textContent).toBe("x02y12");
  });

  it("renders `notDefined` for a null array", () => {
    mount(
      <RenderArrayElements array={null} notDefined={<i>none</i>}>
        {(e) => <span>{String(e)}</span>}
      </RenderArrayElements>,
    );
    expect(container.textContent).toBe("none");
  });
});

describe("wrong-rc dev guard", () => {
  it("warns when a callback reads through the enclosing component's rc", () => {
    const c = ctx.newControl("a");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      return rendered(
        // Deliberately renamed so the outer `rc` is not shadowed — this is
        // the mistake the guard exists to catch.
        <Reactive>
          {(inner: ReadContext) => <span>{rc.getValue(c)}</span>}
        </Reactive>,
      );
    }

    mount(<Comp />);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain(
      "ReadContext belonging to an enclosing component",
    );
    spy.mockRestore();
  });

  it("stays silent for a legitimate finalized read in an event handler", () => {
    const c = ctx.newControl("a");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let seen = "";

    function Comp(): Rendered {
      const { rc, rendered } = useReactive();
      return rendered(
        <button onClick={() => (seen = rc.getValue(c))}>go</button>,
      );
    }

    mount(<Comp />);
    act(() => {
      container.querySelector("button")!.click();
    });
    expect(seen).toBe("a");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("stays silent when the callback uses the rc it was given", () => {
    const c = ctx.newControl("a");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    function Comp(): Rendered {
      const { rendered } = useReactive();
      return rendered(
        <Reactive>{(rc) => <span>{rc.getValue(c)}</span>}</Reactive>,
      );
    }

    mount(<Comp />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
