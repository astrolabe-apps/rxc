import { describe, it, expect } from "vitest";
import { ControlChange } from "../src/types";
import {
  untrackedRead,
  TrackingReadContext,
  SubscriptionReconciler,
} from "../src/readContextImpl";
import { makeCtx } from "./index";

const rc = untrackedRead;

describe("getTrackedValue", () => {
  it("returns primitive values directly", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("hello");
    expect(rc.getTrackedValue(c)).toBe("hello");
  });

  it("returns null/undefined directly", () => {
    const ctx = makeCtx();
    const c = ctx.newControl<string | null>(null);
    expect(rc.getTrackedValue(c)).toBeNull();
  });

  it("proxies object field access through child controls", () => {
    const ctx = makeCtx();
    const c = ctx.newControl({ name: "Alice", age: 30 });
    const proxy = rc.getTrackedValue(c);

    expect(proxy.name).toBe("Alice");
    expect(proxy.age).toBe(30);
  });

  it("reflects mutations to child controls", () => {
    const ctx = makeCtx();
    const c = ctx.newControl({ name: "Alice", age: 30 });

    ctx.update((wc) => wc.setValue(c.fields.name, "Bob"));

    const proxy = rc.getTrackedValue(c);
    expect(proxy.name).toBe("Bob");
    expect(proxy.age).toBe(30);
  });

  it("recurses into nested objects", () => {
    const ctx = makeCtx();
    const c = ctx.newControl({
      address: { city: "NYC", zip: "10001" },
    });
    const proxy = rc.getTrackedValue(c);

    expect(proxy.address.city).toBe("NYC");
    expect(proxy.address.zip).toBe("10001");
  });

  it("proxies array index access through element controls", () => {
    const ctx = makeCtx();
    const c = ctx.newControl(["a", "b", "c"]);
    const proxy = rc.getTrackedValue(c);

    expect(proxy.length).toBe(3);
    expect(proxy[0]).toBe("a");
    expect(proxy[1]).toBe("b");
    expect(proxy[2]).toBe("c");
  });

  it("proxies array of objects", () => {
    const ctx = makeCtx();
    const c = ctx.newControl([
      { name: "Alice" },
      { name: "Bob" },
    ]);
    const proxy = rc.getTrackedValue(c);

    expect(proxy[0].name).toBe("Alice");
    expect(proxy[1].name).toBe("Bob");
  });

  // ── Tracking tests ──────────────────────────────────────────────────

  it("tracks Value for primitive controls", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("hello");
    const trc = new TrackingReadContext();

    trc.getTrackedValue(c);

    expect(trc.tracked.size).toBe(1);
    expect(trc.tracked.get(c as any)).toBe(ControlChange.Value);
  });

  it("tracks Structure for null controls", () => {
    const ctx = makeCtx();
    const c = ctx.newControl<string | null>(null);
    const trc = new TrackingReadContext();

    trc.getTrackedValue(c);

    expect(trc.tracked.size).toBe(1);
    expect(trc.tracked.get(c as any)).toBe(ControlChange.Structure);
  });

  it("tracks only accessed child fields, not the parent value", () => {
    const ctx = makeCtx();
    const c = ctx.newControl({ name: "Alice", age: 30 });
    const trc = new TrackingReadContext();

    const proxy = trc.getTrackedValue(c);
    // Only access name, not age
    const _ = proxy.name;

    // Should track: parent (Structure) + name child (Value or Structure depending on depth)
    // Parent is tracked for Structure (null transition detection)
    // name child is tracked for Value (it's a primitive)
    const entries = [...trc.tracked.entries()];
    expect(entries.length).toBe(2);

    // Verify name's child control was tracked, not just the parent
    const nameControl = c.fields.name;
    expect(trc.tracked.has(nameControl as any)).toBe(true);
  });

  it("does not track unaccessed child fields", () => {
    const ctx = makeCtx();
    const c = ctx.newControl({ name: "Alice", age: 30 });
    const trc = new TrackingReadContext();

    const proxy = trc.getTrackedValue(c);
    const _ = proxy.name; // only access name

    const ageControl = c.fields.age;
    expect(trc.tracked.has(ageControl as any)).toBe(false);
  });

  // ── Existence checks (jsonata ≥ 2.2 asks hasOwnProperty before reading) ──

  describe("existence checks track like reads", () => {
    interface Docs {
      docs: { other: number; attend?: boolean };
    }

    /** Run `check` over a tracked value whose `docs` has no `attend` key at
     * all (not `attend: null`, which always worked), subscribe to what it
     * touched, and count notifications. */
    function subscribed(check: (docs: Docs["docs"]) => boolean) {
      const ctx = makeCtx();
      const c = ctx.newControl<Docs>({ docs: { other: 1 } });
      const trc = new TrackingReadContext();
      const answer = check(trc.getTrackedValue(c).docs);
      let notified = 0;
      const reconciler = new SubscriptionReconciler();
      reconciler.setListener(() => notified++);
      reconciler.reconcile(trc.tracked);
      const attend = () =>
        ctx.update((wc) => wc.setValue(c.fields.docs.fields.attend, true));
      return { c, trc, answer, attend, notified: () => notified };
    }

    it("hasOwnProperty on a missing key tracks the child", () => {
      const s = subscribed((d) =>
        Object.prototype.hasOwnProperty.call(d, "attend"),
      );
      expect(s.answer).toBe(false);
      expect(s.trc.tracked.has(s.c.fields.docs.fields.attend as any)).toBe(
        true,
      );
      s.attend();
      expect(s.notified()).toBe(1);
    });

    it("`in` on a missing key tracks the child", () => {
      const s = subscribed((d) => "attend" in d);
      expect(s.answer).toBe(false);
      s.attend();
      expect(s.notified()).toBe(1);
    });

    it("enumerating an object's keys re-runs when a key is added", () => {
      const s = subscribed((d) => Object.keys(d).length === 2);
      expect(s.answer).toBe(false);
      s.attend();
      expect(s.notified()).toBe(1);
    });

    it("answers from the live value once the key exists", () => {
      const ctx = makeCtx();
      const c = ctx.newControl<Docs>({ docs: { other: 1 } });
      const docs = rc.getTrackedValue(c).docs;
      ctx.update((wc) => wc.setValue(c.fields.docs.fields.attend, true));
      expect("attend" in docs).toBe(true);
      expect(Object.keys(docs)).toEqual(["other", "attend"]);
      expect(Object.getOwnPropertyDescriptor(docs, "attend")?.value).toBe(
        true,
      );
      expect({ ...docs }).toEqual({ other: 1, attend: true });
    });

    it("arrays: index existence tracks the element; length and methods unchanged", () => {
      const ctx = makeCtx();
      const c = ctx.newControl([{ kind: "cat" }]);
      const trc = new TrackingReadContext();
      const v = trc.getTrackedValue(c);
      expect(0 in v).toBe(true);
      expect(1 in v).toBe(false);
      expect("length" in v).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(v, 0)).toBe(true);
      expect(trc.tracked.has(c.elementsNow[0] as any)).toBe(true);
      expect(Object.keys(v)).toEqual(["0"]);
      expect(Array.isArray(v)).toBe(true);
      expect(v.length).toBe(1);
      expect(v.map((p) => p.kind)).toEqual(["cat"]);
      ctx.update((wc) => wc.setValue(c, [{ kind: "cat" }, { kind: "dog" }]));
      expect(1 in v).toBe(true);
      expect(Object.keys(v)).toEqual(["0", "1"]);
    });
  });
});
