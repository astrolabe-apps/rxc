/**
 * The ambient trace.
 *
 * Strict mode answers "was this read collected at all?". It cannot answer
 * "which collector got it" — and a read collected by the *wrong* owner looks
 * perfectly healthy: a collector is installed, its rc is live, a subscription
 * is created, just not on the computation that needed it. Every strict-mode
 * guard stays silent on that shape, which is what the trace is for.
 *
 * The trace is not exported from `src/index.ts` (see the note there), so these
 * import it from the module directly. What is pinned here is the observable
 * surface a debugging session actually reads: the tag vocabulary, the `anon`
 * fallback naming the installing frame, the compute bracketing, and the fact
 * that the whole thing is inert until installed.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackingReadContext } from "@rx-controls/core/internal";
import {
  ambientTracing,
  collectChange,
  describeCollector,
  setAmbientTrace,
  tagCollector,
} from "../src/ambient";
import {
  collectChanges,
  newControl,
  setStrictAmbient,
  trackControlChange,
  trackedValue,
  updateComputedValue,
  withAmbient,
  ControlChange,
  SubscriptionTracker,
} from "../src/index";
import type { ChangeListenerFunc, Control } from "../src/index";

afterEach(() => {
  setAmbientTrace(undefined);
  setStrictAmbient(false);
});

interface Traced {
  control: Control<any>;
  change: ControlChange;
  listener: string;
}

/** Install a trace and collect what it sees. */
function trace(): Traced[] {
  const seen: Traced[] = [];
  setAmbientTrace((control, change, listener) =>
    seen.push({ control, change, listener }),
  );
  return seen;
}

/** The tag half of a trace line, without the ` depth=N` suffix. */
function tags(seen: Traced[]): string[] {
  return seen.map((t) => t.listener.split(" depth=")[0]);
}

describe("ambient trace — off (the shipped default)", () => {
  it("is not installed by default", () => {
    expect(ambientTracing).toBe(false);
  });

  it("costs nothing and says nothing while unset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const c = newControl("hello");
      const seen: Traced[] = [];
      // No trace installed: the reads below must behave exactly as they do in
      // every release to date.
      expect(withAmbient(new TrackingReadContext(), () => c.value)).toBe(
        "hello",
      );
      expect(c.value).toBe("hello");
      expect(seen).toEqual([]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("stops firing once uninstalled", () => {
    const c = newControl("a");
    const seen = trace();
    withAmbient(new TrackingReadContext(), () => c.value);
    expect(seen.length).toBeGreaterThan(0);

    setAmbientTrace(undefined);
    expect(ambientTracing).toBe(false);
    const before = seen.length;
    withAmbient(new TrackingReadContext(), () => c.value);
    expect(seen.length).toBe(before);
  });
});

describe("ambient trace — the tag vocabulary", () => {
  /**
   * The three tags a healthy app produces. Getting these wrong is what makes
   * the trace useless: the entire diagnostic is "the tag is not the one you
   * expected here".
   */
  it("tags the withAmbient bridge `rc`", () => {
    const c = newControl("a");
    const seen = trace();
    withAmbient(new TrackingReadContext(), () => c.value);
    expect(tags(seen)).toEqual([expect.stringMatching(/^rc#\d+$/)]);
    expect(seen[0].control).toBe(c);
    expect(seen[0].change & ControlChange.Value).toBeTruthy();
  });

  it("tags a SubscriptionTracker's collector `tracker`", () => {
    const c = newControl("a");
    const tracker = new SubscriptionTracker(() => {});
    const seen = trace();
    collectChanges(tracker.collectUsage, () => c.value);
    expect(tags(seen)).toEqual([expect.stringMatching(/^tracker#\d+$/)]);
    tracker.cleanup();
  });

  it("reports `<none>` when nothing is collecting", () => {
    const c = newControl("a");
    const seen = trace();
    // A deliberate untracked read — the shape strict mode exists to flag, and
    // the trace should name the absence rather than stay quiet.
    expect(c.value).toBe("a");
    expect(tags(seen)).toEqual(["<none>"]);
  });

  it("gives one collector a stable tag across reads", () => {
    const c = newControl("a");
    const d = newControl("b");
    const seen = trace();
    const rc = new TrackingReadContext();
    withAmbient(rc, () => {
      void c.value;
      void d.value;
    });
    const [first, second] = tags(seen);
    expect(first).toMatch(/^rc#\d+$/);
    expect(second).toBe(first);
  });

  it("gives two collectors different tags", () => {
    const c = newControl("a");
    const seen = trace();
    withAmbient(new TrackingReadContext(), () => c.value);
    withAmbient(new TrackingReadContext(), () => c.value);
    const [first, second] = tags(seen);
    expect(second).not.toBe(first);
  });
});

describe("ambient trace — the `anon` fallback", () => {
  /**
   * A collector installed from outside this package has no tag. Collapsing
   * every such collector into one anonymous bucket would defeat the trace
   * precisely in the case you most need it — a third party installing its own
   * collector — so an untagged collector is named on first sight together
   * with the frame that installed it.
   */
  it("names an untagged collector `anon` plus the installing frame", () => {
    const c = newControl("a");
    const seen = trace();
    const plain: ChangeListenerFunc<any> = () => {};
    collectChanges(plain, () => c.value);
    const [tag] = tags(seen);
    expect(tag).toMatch(/^anon#\d+ \(/);
    // The frame must point back at this test file, not at ambient.ts.
    expect(tag).toContain("ambientTrace.test");
  });

  it("keeps the assigned tag stable for that collector", () => {
    const c = newControl("a");
    const seen = trace();
    const plain: ChangeListenerFunc<any> = () => {};
    collectChanges(plain, () => c.value);
    collectChanges(plain, () => c.value);
    const [first, second] = tags(seen);
    expect(second).toBe(first);
  });

  it("tagCollector wins over the anon fallback", () => {
    const c = newControl("a");
    const tagged = tagCollector((() => {}) as ChangeListenerFunc<any>, "mine");
    const seen = trace();
    collectChanges(tagged, () => c.value);
    expect(tags(seen)).toEqual([expect.stringMatching(/^mine#\d+$/)]);
  });

  it("describeCollector reports `<none>` for no collector", () => {
    expect(describeCollector(undefined)).toBe("<none>");
    expect(describeCollector(collectChange)).toBe("<none>");
  });
});

describe("ambient trace — report sites", () => {
  /**
   * Three code paths report ambient reads. A trace that covers only some of
   * them is worse than none: the missing site looks like "the read never
   * happened", which is the exact wrong conclusion.
   */
  it("traces reads through the patched getters", () => {
    const c = newControl("a");
    const seen = trace();
    withAmbient(new TrackingReadContext(), () => {
      void c.value;
      void c.touched;
    });
    expect(seen.map((t) => t.change)).toEqual([
      ControlChange.Value,
      ControlChange.Touched,
    ]);
  });

  it("traces a manual trackControlChange report", () => {
    const c = newControl("a");
    const seen = trace();
    withAmbient(new TrackingReadContext(), () =>
      trackControlChange(c, ControlChange.Dirty),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].control).toBe(c);
    expect(seen[0].change).toBe(ControlChange.Dirty);
    expect(tags(seen)[0]).toMatch(/^rc#\d+$/);
  });

  it("traces reads through a trackedValue proxy", () => {
    const c = newControl({ name: "a" });
    const seen = trace();
    withAmbient(new TrackingReadContext(), () => {
      void trackedValue(c).name;
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(tags(seen).every((t) => /^rc#\d+$/.test(t))).toBe(true);
  });
});

describe("ambient trace — compute bracketing", () => {
  /**
   * The depth is what separates "the compute never ran" from "the compute ran
   * while something else was collecting". Without it a trace of a broken
   * computed and a trace of an absent one look identical.
   */
  it("reports depth 0 outside any compute", () => {
    const c = newControl("a");
    const seen = trace();
    withAmbient(new TrackingReadContext(), () => c.value);
    expect(seen[0].listener).toContain(" depth=0");
    expect(seen[0].listener).not.toContain("entered=");
  });

  it("reports depth 1 and the entry collector inside a compute", () => {
    const source = newControl("a");
    const target = newControl("");
    const seen = trace();
    updateComputedValue(target, () => source.value.toUpperCase());
    expect(target.current.value).toBe("A");

    const inCompute = seen.filter((t) => t.listener.includes(" depth=1"));
    expect(inCompute.length).toBeGreaterThan(0);
    // Inside the compute the collector must be the `withAmbient` bridge — a
    // non-`rc` tag here means the swap did not hold for the compute's reads.
    expect(inCompute[0].listener).toMatch(/^rc#\d+ depth=1 entered=/);
    expect(inCompute[0].control).toBe(source);
    target.cleanup();
  });

  it("unwinds the depth after the compute returns", () => {
    const source = newControl("a");
    const target = newControl("");
    updateComputedValue(target, () => source.value.toUpperCase());
    expect(target.current.value).toBe("A");

    const seen = trace();
    const plain = newControl("z");
    withAmbient(new TrackingReadContext(), () => plain.value);
    expect(seen[0].listener).toContain(" depth=0");
    target.cleanup();
  });

  it("unwinds the depth even when the compute throws", () => {
    const target = newControl("");
    expect(() =>
      updateComputedValue(target, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    const seen = trace();
    const c = newControl("a");
    withAmbient(new TrackingReadContext(), () => c.value);
    expect(seen[0].listener).toContain(" depth=0");
  });
});
