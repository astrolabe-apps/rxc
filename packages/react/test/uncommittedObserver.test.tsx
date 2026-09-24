/**
 * Notifying a component that has **not yet committed**.
 *
 * A tracker subscribes at `rendered(…)`, during render. Between that moment
 * and the component's first commit the fiber exists, has its `useState`
 * setter, and is not yet mounted — and React warns "Can't perform a React
 * state update on a component that hasn't mounted yet" if anything but the
 * fiber itself calls that setter. Two places a write can land in that window
 * from outside the render phase, so the render-body policy (`openRc`) cannot
 * see them:
 *
 *  - React's **deletion pass**. Layout-effect cleanups of an unmounting
 *    subtree run before the replacement subtree's fibers are placed, so a
 *    cleanup that writes a control notifies the replacements while they still
 *    carry `Placement`. This is what a form framework's per-field validator
 *    registration does when a whole renderer set is swapped.
 *  - A render that **never commits** (a suspend). The abandoned fiber keeps
 *    its subscriptions, and the next write to any of them reaches it.
 *
 * Both are deferred to the tracker's own commit effect. The value still lands:
 * the observer re-renders as soon as it is mounted, before paint.
 */

import { Suspense, useLayoutEffect } from "react";
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

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

const set = <V,>(c: Control<V>, v: V) => ctx.update((wc) => wc.setValue(c, v));

/** Capture `console.error` so React's dev warnings are assertable. */
function captureErrors(): { messages: string[]; restore: () => void } {
  const messages: string[] = [];
  const spy = vi
    .spyOn(console, "error")
    .mockImplementation((...args) => void messages.push(String(args[0])));
  return { messages, restore: () => spy.mockRestore() };
}

const NOT_MOUNTED = "hasn't mounted yet";

describe("notifying an observer that has not yet committed", () => {
  it("a cleanup write during the deletion pass waits for the replacement's commit", () => {
    const shared = ctx.newControl("stale");
    let newRenders = 0;

    function Old(): Rendered {
      const { rendered } = useReactive();
      // Runs in React's deletion pass — after `New` has rendered and
      // subscribed, before `New` is placed.
      useLayoutEffect(() => () => set(shared, "fresh"), []);
      return rendered(<span>old</span>);
    }
    function New(): Rendered {
      const { rc, rendered } = useReactive();
      newRenders++;
      return rendered(<span>{rc.getValue(shared)}</span>);
    }
    const Host = ({ which }: { which: "old" | "new" }) =>
      which === "old" ? <Old key="old" /> : <New key="new" />;

    mount(<Host which="old" />);
    expect(container.textContent).toBe("old");

    const { messages, restore } = captureErrors();
    mount(<Host which="new" />);
    restore();

    // `New` read "stale" as it rendered; the cleanup then wrote "fresh". The
    // re-render that catches it up lands in the same commit, before paint.
    expect(container.textContent).toBe("fresh");
    expect(newRenders).toBe(2);
    expect(messages.filter((m) => m.includes(NOT_MOUNTED))).toEqual([]);
  });

  it("a write after an abandoned render is held until that component mounts", async () => {
    const shared = ctx.newControl(0);
    let ready = false;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    function Gate() {
      if (!ready) throw gate;
      return <span>|gate</span>;
    }
    function Observer(): Rendered {
      const { rc, rendered } = useReactive();
      return rendered(<span>{rc.getValue(shared)}</span>);
    }

    // `Observer` renders and subscribes, then its sibling suspends: the pass
    // is thrown away and only the fallback commits.
    mount(
      <Suspense fallback={<span>…</span>}>
        <Observer />
        <Gate />
      </Suspense>,
    );
    expect(container.textContent).toBe("…");

    const { messages, restore } = captureErrors();
    // Reaches the abandoned pass's subscription. Nothing is mounted to show
    // it, so nothing may be told to re-render yet.
    await act(async () => {
      set(shared, 1);
    });
    ready = true;
    release();
    await act(async () => {
      await gate;
    });
    restore();

    expect(container.textContent).toBe("1|gate");
    expect(messages.filter((m) => m.includes(NOT_MOUNTED))).toEqual([]);
  });
});
