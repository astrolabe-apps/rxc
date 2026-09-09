/**
 * Interop — the design's goal 2: compat controls and new-API controls are
 * the same objects. Both directions are exercised: a control created through
 * the new explicit API gains the legacy surface via the prototype patch, and
 * a compat-created control drives new-API primitives (`computeInto`,
 * `rc`-tracked reads) through `withAmbient`.
 */

import { describe, expect, it } from "vitest";
import {
  computeInto,
  createControlContext,
  effect,
  ControlChange as CoreControlChange,
} from "@rxc/controls-core";
import {
  asCore,
  asLegacy,
  groupedChanges,
  newControl,
  withAmbient,
} from "../src/index";

describe("interop with the new API", () => {
  it("a new-API control carries the legacy surface", () => {
    const ctx = createControlContext();
    const core = ctx.newControl({ name: "n" });
    const legacy = asLegacy(core);
    expect(legacy.value).toEqual({ name: "n" });
    legacy.fields.name.value = "changed";
    expect(core.valueNow).toEqual({ name: "changed" });
    expect(legacy.dirty).toBe(true);
  });

  it("compat mutations notify new-API subscribers, batched", () => {
    const ctx = createControlContext();
    const core = ctx.newControl(0);
    let calls = 0;
    core.subscribe(() => calls++, CoreControlChange.Value);
    groupedChanges(() => {
      const legacy = asLegacy(core);
      legacy.value = 1;
      legacy.value = 2;
    });
    expect(calls).toBe(1);
    expect(core.valueNow).toBe(2);
  });

  it("withAmbient drives a core computeInto from legacy ambient reads", () => {
    const ctx = createControlContext();
    const first = newControl("Ada");
    const last = newControl("Lovelace");
    const target = ctx.newControl("");
    const ref = computeInto(ctx, target, (rc) =>
      withAmbient(rc, () => `${first.value} ${last.value}`),
    );
    expect(target.valueNow).toBe("Ada Lovelace");
    first.value = "Grace";
    expect(target.valueNow).toBe("Grace Lovelace");
    ref.cleanup();
    last.value = "Hopper";
    expect(target.valueNow).toBe("Grace Lovelace");
  });

  it("withAmbient maps every facet, not just Value", () => {
    const ctx = createControlContext();
    const c = newControl("x");
    const seen: string[] = [];
    const ref = effect(ctx, (rc) => {
      const snapshot = withAmbient(rc, () => ({
        touched: c.touched,
        error: c.error,
      }));
      seen.push(`${snapshot.touched}/${snapshot.error ?? "none"}`);
    });
    expect(seen).toEqual(["false/none"]);
    c.touched = true;
    expect(seen).toEqual(["false/none", "true/none"]);
    c.error = "bad";
    expect(seen).toEqual(["false/none", "true/none", "true/bad"]);
    // Setting a value clears errors (engine semantics, legacy parity) — the
    // Error facet changed, so the effect re-runs once more…
    c.value = "y";
    expect(seen).toEqual(["false/none", "true/none", "true/bad", "true/none"]);
    // …but with no error to clear and touched unchanged, a further value
    // change doesn't re-run: Value itself was never read.
    c.value = "z";
    expect(seen.length).toBe(4);
    ref.cleanup();
  });

  it("core rc reads see compat writes (same objects, same engine)", () => {
    const ctx = createControlContext();
    const legacy = newControl<string[]>(["a"]);
    const core = asCore(legacy);
    const lengths: number[] = [];
    const ref = effect(ctx, (rc) => {
      lengths.push(rc.getElements(core).length);
    });
    legacy.value = ["a", "b", "c"];
    expect(lengths).toEqual([1, 3]);
    ref.cleanup();
  });
});
