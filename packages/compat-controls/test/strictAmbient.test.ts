/**
 * Strict ambient diagnostics.
 *
 * The failure these exist to surface is silent by construction: an ambient
 * read with no collector installed returns a correct current value and
 * registers nothing, so the consumer never re-runs. Every assertion below is
 * therefore paired — the same read under `"off"` must keep behaving exactly
 * as it does in every release to date, because most no-collector reads
 * (event handlers, refs, effects) are deliberate and correct.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { TrackingReadContext } from "@rx-controls/core/internal";
import {
  collectChanges,
  getStrictAmbient,
  newControl,
  setStrictAmbient,
  trackControlChange,
  trackedValue,
  withAmbient,
  ControlChange,
  Effect,
  SubscriptionTracker,
} from "../src/index";
import type { ChangeListenerFunc, Control } from "../src/index";

afterEach(() => setStrictAmbient(false));

function collector(): {
  listener: ChangeListenerFunc<any>;
  reads: [Control<any>, ControlChange][];
} {
  const reads: [Control<any>, ControlChange][] = [];
  return { listener: (c, change) => reads.push([c, change]), reads };
}

describe("strict ambient — off (the shipped default)", () => {
  it("defaults to off", () => {
    expect(getStrictAmbient()).toBe("off");
  });

  it("a read with no collector returns the value and says nothing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const c = newControl("hello");
      expect(c.value).toBe("hello");
      expect(c.dirty).toBe(false);
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});

describe("strict ambient — throw", () => {
  it("throws on a read with no collector, naming the control and facet", () => {
    setStrictAmbient(true);
    const c = newControl({ name: "jo" });
    const name = c.fields.name;
    let caught: Error | undefined;
    try {
      void name.value;
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toContain("value");
    // uniqueId and the path through the parent both identify the control.
    expect(caught!.message).toContain(`#${(name as any).uniqueId}`);
    expect(caught!.message).toContain("path: name");
  });

  it("`true` is shorthand for \"throw\"", () => {
    setStrictAmbient(true);
    expect(getStrictAmbient()).toBe("throw");
    setStrictAmbient(false);
    expect(getStrictAmbient()).toBe("off");
  });

  it("stays silent inside collectChanges", () => {
    setStrictAmbient(true);
    const c = newControl("a");
    const { listener, reads } = collector();
    expect(collectChanges(listener, () => c.value)).toBe("a");
    expect(reads).toEqual([[c, ControlChange.Value]]);
  });

  it("stays silent inside withAmbient while the rc is still tracking", () => {
    setStrictAmbient(true);
    const c = newControl("a");
    const rc = new TrackingReadContext();
    expect(withAmbient(rc, () => c.value)).toBe("a");
    expect(rc.tracked.size).toBe(1);
  });

  it("throws again once the window closes", () => {
    setStrictAmbient(true);
    const c = newControl("a");
    const { listener } = collector();
    collectChanges(listener, () => c.value);
    expect(() => c.value).toThrow(/registered no dependency/);
  });

  it("covers trackControlChange and trackedValue, not just the getters", () => {
    setStrictAmbient(true);
    const c = newControl({ name: "jo" });
    expect(() => trackControlChange(c, ControlChange.Value)).toThrow(
      /registered no dependency/,
    );
    expect(() => trackedValue(c)).toThrow(/registered no dependency/);
    // Both are silent again with a collector installed.
    const { listener, reads } = collector();
    collectChanges(listener, () => {
      trackControlChange(c, ControlChange.Value);
      trackedValue(c);
    });
    expect(reads.length).toBeGreaterThan(0);
  });

  it("an explicit tracker on trackedValue counts as a collector", () => {
    setStrictAmbient(true);
    const c = newControl({ name: "jo" });
    const { listener, reads } = collector();
    expect(trackedValue(c, listener).name).toBe("jo");
    expect(reads.length).toBeGreaterThan(0);
  });

  it("`control.current.*` is untracked by contract and never reports", () => {
    setStrictAmbient(true);
    const c = newControl({ name: "jo" });
    // The documented escape hatch for a deliberate post-render read.
    expect(c.current.value).toEqual({ name: "jo" });
    expect(c.current.fields.name.current.value).toBe("jo");
    expect(c.current.dirty).toBe(false);
  });

  it("reports a bridge onto a ReadContext that has already finalized", () => {
    setStrictAmbient(true);
    const c = newControl("a");
    const rc = new TrackingReadContext();
    // The event-handler shape: the closure outlives its owner's render pass.
    const handler = () => withAmbient(rc, () => c.value);
    expect(handler()).toBe("a");
    rc.finalize();
    expect(handler).toThrow(/tracking window has already closed/);
  });
});

describe("strict ambient — warn", () => {
  it("warns once per site instead of throwing, and keeps the value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      setStrictAmbient("warn");
      const c = newControl("a");
      const read = () => c.value;
      expect(read()).toBe("a");
      expect(read()).toBe("a");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("registered no dependency");
    } finally {
      warn.mockRestore();
    }
  });

  it("names a second control at the same site rather than deduping it away", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      setStrictAmbient("warn");
      const controls = [newControl("a"), newControl("b")];
      expect(controls.map((c) => c.value).join("")).toBe("ab");
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("an event-handler-shaped read in each mode", () => {
  // The canonical *legitimate* no-collector read: a click handler closing
  // over a control. Off must not touch it; strict mode flags it precisely
  // because it cannot tell this apart from a stale render read — which is
  // why strict mode is opt-in and `current` is the way to opt a read out.
  function onClick(c: Control<string>): string {
    return c.value;
  }

  it("off: silent", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(onClick(newControl("a"))).toBe("a");
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("throw: flagged, and fixed by reading through `current`", () => {
    setStrictAmbient(true);
    const c = newControl("a");
    expect(() => onClick(c)).toThrow(/registered no dependency/);
    expect(c.current.value).toBe("a");
  });
});

describe("strict ambient — a collector that belongs to a dead tracker", () => {
  /**
   * The third shape, and the only one where a collector *is* installed. The
   * other two guards stay silent by construction, so without this a disposed
   * effect that is still consulted looks perfectly healthy: it collects
   * reads, it subscribes, and the subscriptions notify a listener attached
   * to nothing.
   */
  it("off: cleanup then collect is silent, and still subscribes as before", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const c = newControl("a");
      const tracker = new SubscriptionTracker(() => {});
      tracker.cleanup();
      collectChanges(tracker.collectUsage, () => c.value);
      expect(tracker.subscriptions.length).toBe(1);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("throw: names the control", () => {
    setStrictAmbient(true);
    const c = newControl("a");
    const tracker = new SubscriptionTracker(() => {});
    tracker.cleanup();
    expect(() => collectChanges(tracker.collectUsage, () => c.value)).toThrow(
      /already been cleaned up/,
    );
  });

  it("a live tracker is silent", () => {
    setStrictAmbient(true);
    const c = newControl("a");
    const tracker = new SubscriptionTracker(() => {});
    expect(collectChanges(tracker.collectUsage, () => c.value)).toBe("a");
    expect(tracker.subscriptions.length).toBe(1);
    tracker.cleanup();
  });

  it("an Effect disposed by its cleanup scope reports on its next read", () => {
    setStrictAmbient(true);
    const c = newControl(1);
    const seen: number[] = [];
    const effect = new Effect(() => c.value, (v) => seen.push(v));
    expect(seen).toEqual([1]);
    effect.cleanup();
    // Re-running a disposed effect is exactly the "still being consulted"
    // shape — silent today, named under strict mode.
    expect(() => effect.runEffect()).toThrow(/already been cleaned up/);
  });
});
