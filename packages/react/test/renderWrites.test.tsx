/**
 * Writing controls from a render body — the Case-B "adjust derived state
 * during render" shape.
 *
 * The write applies immediately; only *notification* is policed. Two
 * branches, and these tests pin the split:
 *
 *  - the writer's own re-render stays a React **render-phase update**
 *    (same fiber → output discarded and the component re-invoked at once,
 *    no intervening commit);
 *  - notification to any component that has **already committed** is
 *    deferred out of the render phase, so React never sees a cross-component
 *    update during render.
 */

import { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  useReactive,
  type Control,
  type ControlContext,
  type Rendered,
} from "../src/index";

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

const set = <V,>(c: Control<V>, v: V) => ctx.update((wc) => wc.setValue(c, v));

/** Capture `console.error` so React's dev warnings are assertable. */
function captureErrors(): { messages: string[]; restore: () => void } {
  const messages: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...args) => void messages.push(String(args[0])));
  return { messages, restore: () => spy.mockRestore() };
}

describe("writes from a render body", () => {
  it("the value is visible to the rest of the writer's own body", () => {
    const src = ctx.newControl(3);
    const derived = ctx.newControl(0);
    let seen: number | undefined;

    function Comp(): Rendered {
      const { rc, rendered, update } = useReactive();
      const s = rc.getValue(src);
      update((wc) => wc.setValue(derived, s * 10));
      seen = derived.valueNow;
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(seen).toBe(30);
  });

  it("the value is visible to a descendant rendering later in the pass", () => {
    const derived = ctx.newControl(0);

    function Parent(): Rendered {
      const { rendered, update } = useReactive();
      update((wc) => wc.setValue(derived, 42));
      return rendered(<Child />);
    }
    function Child(): Rendered {
      const { rc, rendered } = useReactive();
      return rendered(<span>{rc.getValue(derived)}</span>);
    }

    mount(<Parent />);
    expect(container.textContent).toBe("42");
  });

  it("a guarded write converges, and the writer re-renders in-pass", () => {
    const src = ctx.newControl(1);
    const derived = ctx.newControl(0);
    let renders = 0;

    function Comp(): Rendered {
      const { rc, rendered, update } = useReactive();
      renders++;
      const s = rc.getValue(src);
      if (rc.getValue(derived) !== s * 10)
        update((wc) => wc.setValue(derived, s * 10));
      return rendered(<span>{rc.getValue(derived)}</span>);
    }

    mount(<Comp />);
    expect(container.textContent).toBe("10");

    const before = renders;
    act(() => set(src, 5));
    expect(container.textContent).toBe("50");
    // Two passes: the write lands as a render-phase update, so React discards
    // the first output and re-invokes immediately rather than committing it.
    expect(renders - before).toBe(2);
  });

  it("notifies an already-committed observer without warning, in-pass", () => {
    const tick = ctx.newControl(0);
    const shared = ctx.newControl(0);

    function Writer(): Rendered {
      const { rc, rendered, update } = useReactive();
      const t = rc.getValue(tick);
      if (rc.getValue(shared) !== t * 10)
        update((wc) => wc.setValue(shared, t * 10));
      return rendered(<span>a{rc.getValue(shared)}</span>);
    }
    function Observer(): Rendered {
      const { rc, rendered } = useReactive();
      return rendered(<span>b{rc.getValue(shared)}</span>);
    }

    mount(
      <>
        <Writer />
        <Observer />
      </>,
    );

    expect(container.textContent).toBe("a0b0");

    const { messages, restore } = captureErrors();
    // Synchronous `act`: the commit-phase drain means the observer catches up
    // inside React's own work, before paint — no microtask needed, and no
    // "update was not wrapped in act(...)" either.
    act(() => set(tick, 5));
    restore();

    expect(container.textContent).toBe("a50b50");
    expect(messages).toEqual([]);
  });

  it("converges even if the commit-phase drain never runs", async () => {
    const tick = ctx.newControl(0);
    const shared = ctx.newControl(0);

    function Writer(): Rendered {
      const { rc, rendered, update } = useReactive();
      const t = rc.getValue(tick);
      if (rc.getValue(shared) !== t * 10)
        update((wc) => wc.setValue(shared, t * 10));
      return rendered(<span>a{rc.getValue(shared)}</span>);
    }
    function Observer(): Rendered {
      const { rc, rendered } = useReactive();
      return rendered(<span>b{rc.getValue(shared)}</span>);
    }

    mount(
      <>
        <Writer />
        <Observer />
      </>,
    );
    expect(container.textContent).toBe("a0b0");

    // The microtask backstop covers the render-never-commits case. Awaiting
    // here lets it run; it normally finds the queue already drained.
    await act(async () => {
      set(tick, 5);
    });
    expect(container.textContent).toBe("a50b50");
  });

  it("an observer that renders after the write needs no extra pass", async () => {
    const tick = ctx.newControl(0);
    const shared = ctx.newControl(0);
    let childRenders = 0;

    function Parent(): Rendered {
      const { rc, rendered, update } = useReactive();
      const t = rc.getValue(tick);
      if (rc.getValue(shared) !== t * 10)
        update((wc) => wc.setValue(shared, t * 10));
      return rendered(<Child />);
    }
    function Child(): Rendered {
      const { rc, rendered } = useReactive();
      childRenders++;
      return rendered(<span>{rc.getValue(shared)}</span>);
    }

    mount(<Parent />);
    const before = childRenders;

    await act(async () => {
      set(tick, 5);
    });
    expect(container.textContent).toBe("50");
    // The child read the post-write value as it rendered, so `rendered(…)`
    // dropped the queued re-render rather than paying for it.
    expect(childRenders - before).toBe(1);
  });

  it("works under StrictMode", async () => {
    const tick = ctx.newControl(0);
    const shared = ctx.newControl(0);

    function Writer(): Rendered {
      const { rc, rendered, update } = useReactive();
      const t = rc.getValue(tick);
      if (rc.getValue(shared) !== t * 10)
        update((wc) => wc.setValue(shared, t * 10));
      return rendered(<span>a{rc.getValue(shared)}</span>);
    }
    function Observer(): Rendered {
      const { rc, rendered } = useReactive();
      return rendered(<span>b{rc.getValue(shared)}</span>);
    }

    mount(
      <>
        <Writer />
        <Observer />
      </>,
      true,
    );

    const { messages, restore } = captureErrors();
    await act(async () => {
      set(tick, 5);
    });
    restore();

    expect(container.textContent).toBe("a50b50");
    expect(
      messages.filter((m) => m.includes("while rendering a different component")),
    ).toEqual([]);
  });

  it("an unguarded write converges on the engine's equality alone", () => {
    const src = ctx.newControl(1);
    const derived = ctx.newControl(0);
    let renders = 0;

    function Comp(): Rendered {
      const { rc, rendered, update } = useReactive();
      renders++;
      const s = rc.getValue(src);
      // No `if` guard: `setValue` bails on `ControlContext.equals` before it
      // touches a subscription, so the second pass notifies nobody.
      update((wc) => wc.setValue(derived, s * 10));
      return rendered(<span>{rc.getValue(derived)}</span>);
    }

    mount(<Comp />);
    const before = renders;
    act(() => set(src, 5));

    expect(container.textContent).toBe("50");
    // Same cost as the guarded form above — the guard buys nothing here.
    expect(renders - before).toBe(2);
  });

  it("converges for a fresh object or array literal, via deepEquals", () => {
    const src = ctx.newControl(1);
    const obj = ctx.newControl<{ n: number }>({ n: 0 });
    const arr = ctx.newControl<number[]>([]);
    let renders = 0;

    function Comp(): Rendered {
      const { rc, rendered, update } = useReactive();
      renders++;
      const s = rc.getValue(src);
      // Newly allocated every pass, so reference equality would never
      // settle. The default `deepEquals` does.
      update((wc) => {
        wc.setValue(obj, { n: s });
        wc.setValue(arr, [s, s]);
      });
      return rendered(
        <span>
          {rc.getValue(obj).n}/{rc.getValue(arr).join(",")}
        </span>,
      );
    }

    mount(<Comp />);
    const before = renders;
    act(() => set(src, 5));

    expect(container.textContent).toBe("5/5,5");
    expect(renders - before).toBe(2);
  });

  it("a non-converging write survives mount and is stopped on the next render", () => {
    const src = ctx.newControl(1);
    const counter = ctx.newControl(0);

    function Comp(): Rendered {
      const { rc, rendered, update } = useReactive();
      const s = rc.getValue(src);
      // A different value on every pass — no equality can settle this.
      update((wc) => wc.updateValue(counter, (n) => n + 1));
      return rendered(
        <span>
          {rc.getValue(counter)}
          {s}
        </span>,
      );
    }

    const { messages, restore } = captureErrors();
    // Mount is quiet: `reconcile()` has not run yet, so the write notifies
    // nobody and there is nothing to re-render. The trap only springs on the
    // second render, once the subscription from the first pass is live.
    expect(() => mount(<Comp />)).not.toThrow();
    expect(() => act(() => set(src, 5))).toThrow(/Too many re-renders/);
    restore();
    void messages;
  });

  it("a write outside render still notifies synchronously", () => {
    const shared = ctx.newControl(0);
    const seen: number[] = [];

    function Observer(): Rendered {
      const { rc, rendered } = useReactive();
      const v = rc.getValue(shared);
      seen.push(v);
      return rendered(<span>{v}</span>);
    }

    mount(<Observer />);
    expect(seen).toEqual([0]);

    // No render window is open, so this takes the immediate branch.
    act(() => set(shared, 7));
    expect(seen).toEqual([0, 7]);
    expect(container.textContent).toBe("7");
  });
});
