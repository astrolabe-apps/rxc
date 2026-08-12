import { StrictMode, useState } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  ensureSelectableValues,
  useControlGroup,
  usePreviousValue,
  useControls,
  useSelectableArray,
  type Control,
  type ControlContext,
  type Rendered,
  type SelectionGroup,
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

const groupsOf = (c: Control<SelectionGroup<string>[]>) =>
  (c.elements as Control<SelectionGroup<string>>[]).map((g) => ({
    selected: g.fields.selected.valueNow,
    value: g.fields.value.valueNow,
  }));

describe("useSelectableArray", () => {
  it("defaults to one selected group per element", () => {
    const arr = ctx.newControl(["a", "b"]);
    let selectable!: Control<SelectionGroup<string>[]>;

    function Comp(): Rendered {
      const { rendered } = useControls();
      selectable = useSelectableArray(arr);
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(groupsOf(selectable)).toEqual([
      { selected: true, value: "a" },
      { selected: true, value: "b" },
    ]);
    expect(arr.valueNow).toEqual(["a", "b"]);
  });

  it("deselecting removes the value from the original array", () => {
    const arr = ctx.newControl(["a", "b"]);
    let selectable!: Control<SelectionGroup<string>[]>;

    function Comp(): Rendered {
      const { rendered } = useControls();
      selectable = useSelectableArray(arr);
      return rendered(<span />);
    }

    mount(<Comp />);
    const first = (selectable.elements as Control<SelectionGroup<string>>[])[0];
    act(() =>
      ctx.update((wc) => wc.setValue(first.fields.selected, false)),
    );
    expect(arr.valueNow).toEqual(["b"]);

    act(() => ctx.update((wc) => wc.setValue(first.fields.selected, true)));
    expect(arr.valueNow).toEqual(["a", "b"]);
  });

  it("shares value controls with the original array", () => {
    const arr = ctx.newControl(["a"]);
    let selectable!: Control<SelectionGroup<string>[]>;

    function Comp(): Rendered {
      const { rendered } = useControls();
      selectable = useSelectableArray(arr);
      return rendered(<span />);
    }

    mount(<Comp />);
    const group = (selectable.elements as Control<SelectionGroup<string>>[])[0];
    act(() => ctx.update((wc) => wc.setValue(group.fields.value, "edited")));
    expect(arr.valueNow).toEqual(["edited"]);
  });

  it("ensureSelectableValues covers all candidate values", () => {
    const arr = ctx.newControl(["b"]);
    let selectable!: Control<SelectionGroup<string>[]>;

    function Comp(): Rendered {
      const { rendered } = useControls();
      selectable = useSelectableArray(
        arr,
        ensureSelectableValues(["a", "b", "c"], (v) => v),
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(groupsOf(selectable)).toEqual([
      { selected: false, value: "a" },
      { selected: true, value: "b" },
      { selected: false, value: "c" },
    ]);
    // The initial sync keeps only selected values.
    expect(arr.valueNow).toEqual(["b"]);

    const groups = selectable.elements as Control<SelectionGroup<string>>[];
    act(() =>
      ctx.update((wc) => wc.setValue(groups[2].fields.selected, true)),
    );
    expect(arr.valueNow).toEqual(["b", "c"]);
  });

  it("appends array elements not present in the candidate values", () => {
    const arr = ctx.newControl(["z", "a"]);
    let selectable!: Control<SelectionGroup<string>[]>;

    function Comp(): Rendered {
      const { rendered } = useControls();
      selectable = useSelectableArray(
        arr,
        ensureSelectableValues(["a"], (v) => v),
      );
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(groupsOf(selectable)).toEqual([
      { selected: true, value: "a" },
      { selected: true, value: "z" },
    ]);
  });

  it("re-syncs when reset changes, keeping the selectable identity fresh", () => {
    const arr = ctx.newControl(["a"]);
    const seen: Control<SelectionGroup<string>[]>[] = [];

    function Comp({ reset }: { reset: number }): Rendered {
      const { rendered } = useControls();
      seen.push(useSelectableArray(arr, undefined, undefined, reset));
      return rendered(<span />);
    }

    mount(<Comp reset={1} />);
    // External structural change — not reflected until reset.
    act(() => ctx.update((wc) => wc.addElement(arr, "b")));
    expect(groupsOf(seen[seen.length - 1])).toEqual([
      { selected: true, value: "a" },
    ]);

    mount(<Comp reset={2} />);
    expect(seen[0]).not.toBe(seen[seen.length - 1]);
    expect(groupsOf(seen[seen.length - 1])).toEqual([
      { selected: true, value: "a" },
      { selected: true, value: "b" },
    ]);
  });

  it("is StrictMode-safe", () => {
    const arr = ctx.newControl(["a", "b"]);
    let selectable!: Control<SelectionGroup<string>[]>;

    function Comp(): Rendered {
      const { rendered } = useControls();
      selectable = useSelectableArray(arr);
      return rendered(<span />);
    }

    mount(<Comp />, true);
    expect(groupsOf(selectable)).toEqual([
      { selected: true, value: "a" },
      { selected: true, value: "b" },
    ]);

    const first = (selectable.elements as Control<SelectionGroup<string>>[])[0];
    act(() =>
      ctx.update((wc) => wc.setValue(first.fields.selected, false)),
    );
    expect(arr.valueNow).toEqual(["b"]);
  });
});

describe("useControlGroup", () => {
  it("groups controls and keeps a stable identity", () => {
    const name = ctx.newControl("alice");
    const age = ctx.newControl(30);
    const seen: Control<{ name: string; age: number }>[] = [];

    function Comp(): Rendered {
      const { rc, rendered } = useControls();
      const group = useControlGroup({ name, age });
      seen.push(group);
      return rendered(<span>{rc.getValue(group).name}</span>);
    }

    mount(<Comp />);
    expect(container.textContent).toBe("alice");

    act(() => ctx.update((wc) => wc.setValue(name, "bob")));
    expect(container.textContent).toBe("bob");
    expect(new Set(seen).size).toBe(1);
  });

  it("swaps in a new field control when its identity changes", () => {
    const first = ctx.newControl("one");
    const second = ctx.newControl("two");
    let setWhich!: (n: number) => void;
    let group!: Control<{ field: string }>;

    function Comp(): Rendered {
      const { rendered } = useControls();
      const [which, set] = useState(1);
      setWhich = set;
      group = useControlGroup({ field: which === 1 ? first : second });
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(group.valueNow).toEqual({ field: "one" });

    act(() => setWhich(2));
    expect(group.fields.field).toBe(second);
    expect(group.valueNow).toEqual({ field: "two" });
  });
});

describe("usePreviousValue", () => {
  it("tracks previous and current across changes", () => {
    const c = ctx.newControl("a");
    let withPrev!: Control<{ previous?: string; current: string }>;

    function Comp(): Rendered {
      const { rendered } = useControls();
      withPrev = usePreviousValue(c);
      return rendered(<span />);
    }

    mount(<Comp />);
    expect(withPrev.valueNow).toEqual({ current: "a" });

    act(() => ctx.update((wc) => wc.setValue(c, "b")));
    expect(withPrev.valueNow).toEqual({ previous: "a", current: "b" });

    act(() => ctx.update((wc) => wc.setValue(c, "c")));
    expect(withPrev.valueNow).toEqual({ previous: "b", current: "c" });
  });
});
