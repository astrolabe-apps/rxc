import { describe, expect, it } from "vitest";
import {
  ControlChange,
  SubscriptionTracker,
  collectChanges,
  createEffect,
  newControl,
  trackedValue,
  unsafeRestoreControl,
  unwrapTrackedControl,
} from "../src/index";
import type { ChangeListenerFunc, Control } from "../src/index";

interface Person {
  name: string;
  pets: { kind: string }[];
  address?: { city: string } | null;
}

const sample = (): Control<Person> =>
  newControl<Person>({
    name: "Ada",
    pets: [{ kind: "cat" }, { kind: "dog" }],
    address: null,
  });

function recording(): {
  tracker: ChangeListenerFunc<any>;
  reads: [Control<any>, ControlChange][];
} {
  const reads: [Control<any>, ControlChange][] = [];
  return { tracker: (c, change) => reads.push([c, change]), reads };
}

describe("trackedValue", () => {
  it("proxies objects, arrays and scalars with live navigation", () => {
    const c = sample();
    const v = trackedValue(c);
    expect(v.name).toBe("Ada");
    expect(v.pets.length).toBe(2);
    expect(v.pets[1].kind).toBe("dog");
    expect(v.address).toBeNull();
    expect(v.pets.map((p) => p.kind)).toEqual(["cat", "dog"]);
  });

  it("reports per-step reads to the explicit tracker", () => {
    const c = sample();
    const { tracker, reads } = recording();
    const v = trackedValue(c, tracker);
    void v.name;
    const bits = reads.map(([ctl, ch]) => [ctl, ch] as const);
    // Root object → Structure on the root, then Value on the name leaf.
    expect(bits[0][0]).toBe(c);
    expect(bits[0][1]).toBe(ControlChange.Structure);
    expect(bits[1][0]).toBe(c.fields.name);
    expect(bits[1][1]).toBe(ControlChange.Value);
  });

  it("defaults to the ambient collector", () => {
    const c = sample();
    const { tracker, reads } = recording();
    collectChanges(tracker, () => {
      void trackedValue(c).name;
    });
    expect(reads.length).toBeGreaterThan(0);
  });

  it("null-ness reads report Structure (loading patterns)", () => {
    const c = sample();
    const { tracker, reads } = recording();
    const v = trackedValue(c, tracker);
    void v.address;
    const addressReads = reads.filter(([ctl]) => ctl === c.fields.address);
    expect(addressReads).toEqual([[c.fields.address, ControlChange.Structure]]);
  });

  it("drives an Effect through deep reads", () => {
    const c = sample();
    const kinds: string[] = [];
    createEffect(
      () =>
        trackedValue(c)
          .pets.map((p) => p.kind)
          .join(","),
      (v) => kinds.push(v),
    );
    expect(kinds).toEqual(["cat,dog"]);
    c.fields.pets.elements[0].fields.kind.value = "fish";
    expect(kinds).toEqual(["cat,dog", "fish,dog"]);
  });

  it("array structure changes re-run consumers of length", () => {
    const c = newControl<string[]>(["a"]);
    const lengths: number[] = [];
    createEffect(() => trackedValue(c).length, (l) => lengths.push(l));
    expect(lengths).toEqual([1]);
    c.value = ["a", "b"];
    expect(lengths).toEqual([1, 2]);
  });

  it("unsafeRestoreControl / unwrapTrackedControl round-trip", () => {
    const c = sample();
    const v = trackedValue(c);
    expect(unsafeRestoreControl(v)).toBe(c);
    expect(unsafeRestoreControl(v.pets)).toBe(c.fields.pets);
    expect(unwrapTrackedControl(v)).toEqual(c.current.value);
    // Non-proxied values pass through
    expect(unwrapTrackedControl("plain")).toBe("plain");
    expect(unsafeRestoreControl(undefined as unknown as object)).toBeUndefined();
  });

  it("SubscriptionTracker + trackedValue subscribe to exactly what was read", () => {
    const c = sample();
    let notified = 0;
    const tracker = new SubscriptionTracker(() => notified++);
    collectChanges(tracker.collectUsage, () => {
      void trackedValue(c).name;
    });
    tracker.update();
    c.fields.name.value = "Grace";
    expect(notified).toBe(1);
    // A pets change was never read as a leaf — the root Structure
    // subscription doesn't fire for a nested element edit.
    c.fields.pets.elements[0].fields.kind.value = "hamster";
    expect(notified).toBe(1);
    tracker.cleanup();
  });
});
