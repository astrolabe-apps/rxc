import { describe, expect, it } from "vitest";
import { deepEquals } from "../src/deepEquals";
import { computeInto } from "../src/computed";
import { ControlChange } from "../src/types";
import { makeCtx } from "./index";

describe("deepEquals", () => {
  it("compares Maps by key and deep value", () => {
    expect(deepEquals(new Map([["a", { n: 1 }]]), new Map([["a", { n: 1 }]]))).toBe(true);
    expect(deepEquals(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false);
    expect(deepEquals(new Map([["a", 1]]), new Map([["b", 1]]))).toBe(false);
    expect(deepEquals(new Map([["a", 1]]), new Map([["a", 1], ["b", 2]]))).toBe(false);
  });

  it("compares Sets by membership", () => {
    expect(deepEquals(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(deepEquals(new Set([1, 2]), new Set([1, 3]))).toBe(false);
    expect(deepEquals(new Set([1]), new Set([1, 2]))).toBe(false);
  });

  it("does not equate a Map with a Set or a plain object", () => {
    expect(deepEquals(new Map(), new Set())).toBe(false);
    expect(deepEquals(new Map(), {})).toBe(false);
  });

  it("a computed returning an equal new Map does not notify", () => {
    const ctx = makeCtx();
    const source = ctx.newControl(["x", "x", "y"]);
    const target = ctx.newControl<Map<string, number> | undefined>(undefined);
    const count = (rc: Parameters<Parameters<typeof computeInto>[2]>[0]) => {
      const m = new Map<string, number>();
      for (const v of rc.getValue(source)) m.set(v, (m.get(v) ?? 0) + 1);
      return m;
    };
    const handle = computeInto(ctx, target, count);
    const changes: ControlChange[] = [];
    target.subscribe((_, c) => changes.push(c), ControlChange.Value);

    // A component passes a new inline compute on every render.
    handle.replaceCompute((rc) => count(rc));
    handle.replaceCompute((rc) => count(rc));
    expect(changes).toStrictEqual([]);

    ctx.update((wc) => wc.setValue(source, ["x"]));
    expect(changes).toStrictEqual([ControlChange.Value]);
    handle.cleanup();
  });
});
