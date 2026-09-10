/**
 * Phase B hooks — mounted under the one-time root
 * `<ControlContextProvider value={getCompatContext()}>`; everything inside
 * is unchanged legacy-style code.
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ControlContextProvider,
  controlValues,
  getCompatContext,
  newControl,
  useComponentTracking,
  useComputed,
  useControl,
  useControlEffect,
  useControlGroup,
  useDebounced,
  usePreviousValue,
  useTrackedComponent,
  useValidator,
  useValueChangeEffect,
  type Control,
} from "../src/index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(ui: React.ReactNode) {
  // The one-time legacy migration step: the compat context provided once at
  // the root. Everything below is unchanged legacy-style code.
  act(() =>
    root.render(
      <ControlContextProvider value={getCompatContext()}>
        {ui}
      </ControlContextProvider>,
    ),
  );
}

const text = (sel: string) =>
  container.querySelector(sel)?.textContent ?? null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("useComponentTracking", () => {
  it("ambient .value reads re-render the component", () => {
    const c = newControl("first");
    let renders = 0;
    function Show() {
      const stop = useComponentTracking();
      try {
        renders++;
        return <span id="out">{c.value}</span>;
      } finally {
        stop();
      }
    }
    mount(<Show />);
    expect(text("#out")).toBe("first");
    const before = renders;
    act(() => {
      c.value = "second";
    });
    expect(text("#out")).toBe("second");
    expect(renders).toBe(before + 1);
  });

  it("only the facets actually read subscribe", () => {
    const c = newControl("v");
    let renders = 0;
    function Show() {
      const stop = useComponentTracking();
      try {
        renders++;
        return <span id="out">{String(c.touched)}</span>;
      } finally {
        stop();
      }
    }
    mount(<Show />);
    const before = renders;
    act(() => {
      c.value = "other"; // Value not read — no re-render
    });
    expect(renders).toBe(before);
    act(() => {
      c.touched = true;
    });
    expect(renders).toBe(before + 1);
    expect(text("#out")).toBe("true");
  });

  it("useTrackedComponent wraps a dynamic component", () => {
    const c = newControl(1);
    function Host() {
      const Inner = useTrackedComponent<{ label: string }>(
        ({ label }) => (
          <span id="out">
            {label}:{c.value}
          </span>
        ),
        [],
      );
      return <Inner label="n" />;
    }
    mount(<Host />);
    expect(text("#out")).toBe("n:1");
    act(() => {
      c.value = 5;
    });
    expect(text("#out")).toBe("n:5");
  });
});

describe("useControl / useComputed", () => {
  it("useControl creates once, applies setup validators, calls afterInit", () => {
    const seen: Control<string>[] = [];
    let control!: Control<string>;
    function Comp() {
      control = useControl("", { validator: (v) => (v ? undefined : "req") }, (c) =>
        seen.push(c),
      );
      return null;
    }
    mount(<Comp />);
    const first = control;
    expect(seen).toEqual([first]);
    expect(first.error).toBe("req");
    mount(<Comp />);
    expect(control).toBe(first);
    expect(seen.length).toBe(1);
  });

  it("useControl honours the `use` escape hatch (no afterInit)", () => {
    const supplied = newControl("outside");
    let called = 0;
    let control!: Control<string>;
    function Comp() {
      control = useControl("ignored", { use: supplied }, () => called++);
      return null;
    }
    mount(<Comp />);
    expect(control).toBe(supplied);
    expect(called).toBe(0);
  });

  it("useComputed derives from ambient reads", () => {
    const first = newControl("Ada");
    const last = newControl("Lovelace");
    function Comp() {
      const stop = useComponentTracking();
      try {
        const full = useComputed(() => `${first.value} ${last.value}`);
        return <span id="out">{full.value}</span>;
      } finally {
        stop();
      }
    }
    mount(<Comp />);
    expect(text("#out")).toBe("Ada Lovelace");
    act(() => {
      first.value = "Grace";
    });
    expect(text("#out")).toBe("Grace Lovelace");
  });

  it("controlValues tuples and records compose with useComputed", () => {
    const a = newControl(1);
    const b = newControl(2);
    function Comp() {
      const stop = useComponentTracking();
      try {
        const pair = useComputed(controlValues(a, b));
        const rec = useComputed(controlValues({ a, b }));
        return (
          <span id="out">
            {JSON.stringify(pair.value)}|{JSON.stringify(rec.value)}
          </span>
        );
      } finally {
        stop();
      }
    }
    mount(<Comp />);
    expect(text("#out")).toBe('[1,2]|{"a":1,"b":2}');
    act(() => {
      a.value = 10;
    });
    expect(text("#out")).toBe('[10,2]|{"a":10,"b":2}');
  });
});

describe("effects", () => {
  it("useControlEffect fires on ambient-computed change, with initial variants", () => {
    const c = newControl("x");
    const changes: string[] = [];
    const initials: string[] = [];
    function Comp() {
      useControlEffect(
        () => c.value,
        (v) => changes.push(v),
        (v) => initials.push(v),
      );
      return null;
    }
    mount(<Comp />);
    expect(initials).toEqual(["x"]);
    expect(changes).toEqual([]);
    act(() => {
      c.value = "y";
    });
    expect(changes).toEqual(["y"]);
  });

  it("useValueChangeEffect debounces", async () => {
    const c = newControl("");
    const seen: string[] = [];
    function Comp() {
      useValueChangeEffect(c, (v) => seen.push(v), 20);
      return null;
    }
    mount(<Comp />);
    act(() => {
      c.value = "a";
    });
    act(() => {
      c.value = "ab";
    });
    expect(seen).toEqual([]);
    await act(() => sleep(60));
    expect(seen).toEqual(["ab"]);
  });

  it("useValueChangeEffect without debounce fires synchronously", () => {
    const c = newControl(0);
    const seen: number[] = [];
    function Comp() {
      useValueChangeEffect(c, (v) => seen.push(v));
      return null;
    }
    mount(<Comp />);
    act(() => {
      c.value = 7;
    });
    expect(seen).toEqual([7]);
  });
});

describe("validators", () => {
  it("useValidator re-runs when ambiently-read other controls change", () => {
    const password = newControl("secret");
    const confirm = newControl("secret");
    function Comp() {
      useValidator(confirm, (v) =>
        v === password.value ? null : "Passwords must match",
      );
      return null;
    }
    mount(<Comp />);
    expect(confirm.error).toBeNull();
    act(() => {
      password.value = "changed";
    });
    expect(confirm.error).toBe("Passwords must match");
    act(() => {
      confirm.value = "changed";
    });
    expect(confirm.error).toBeNull();
  });
});

describe("groups / previous", () => {
  it("useControlGroup aggregates standalone controls", () => {
    const city = newControl("Hobart");
    const post = newControl("7000");
    let group!: Control<{ city: string; post: string }>;
    function Comp() {
      group = useControlGroup({ city, post });
      return null;
    }
    mount(<Comp />);
    expect(group.value).toEqual({ city: "Hobart", post: "7000" });
    act(() => {
      city.value = "Launceston";
    });
    expect(group.value).toEqual({ city: "Launceston", post: "7000" });
  });

  it("usePreviousValue tracks prior value", () => {
    const price = newControl(10);
    function Comp() {
      const stop = useComponentTracking();
      try {
        const prev = usePreviousValue(price);
        const { previous, current } = prev.value;
        return (
          <span id="out">
            {previous ?? "none"}/{current}
          </span>
        );
      } finally {
        stop();
      }
    }
    mount(<Comp />);
    expect(text("#out")).toBe("none/10");
    act(() => {
      price.value = 12;
    });
    expect(text("#out")).toBe("10/12");
  });

  // Regression: `useDebounced` must return the loose `(...args: any[]) => void`
  // legacy inferred, not `(...args: Parameters<T>) => void`. The debounced
  // function is normally handed straight to `useControlEffect`, whose `V` comes
  // from `compute` — so with precise parameters a `compute` returning `as const`
  // gives a readonly tuple that `strictFunctionTypes` refuses to pass to a
  // handler declared with a mutable one. That shape is exactly what broke a
  // real app on a version bump; it is the *types* here that matter, so keep the
  // `as const` and the mutable-tuple parameter.
  it("useDebounced result stays assignable to a mutable-tuple handler", async () => {
    const a = newControl(1);
    const b = newControl("x");
    const seen: [number, string][] = [];

    function handler([n, s]: [number, string]) {
      seen.push([n, s]);
    }

    function Comp() {
      useControlEffect(
        () => [a.value, b.value] as const,
        useDebounced(handler, 1),
      );
      return <div />;
    }
    mount(<Comp />);

    await act(async () => {
      a.value = 2;
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(seen).toEqual([[2, "x"]]);

    // Bursts collapse to the last value.
    await act(async () => {
      a.value = 3;
      a.value = 4;
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(seen).toEqual([
      [2, "x"],
      [4, "x"],
    ]);
  });
});
