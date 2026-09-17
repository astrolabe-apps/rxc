import { describe, expect, it } from "vitest";
import {
  untrackedRead,
  TrackingReadContext,
  addEscapedReadHook,
  setEscapedReadHook,
} from "../src/readContextImpl";
import { makeCtx } from "./index";

/**
 * The tracking-window flag, pinned from both implementations.
 *
 * The two implementations disagree on the literal — `untrackedRead` is
 * permanently `false`, a tracking scope starts `true` — which is exactly the
 * shape a careless edit gets backwards. Its only consumer is `forms-core`'s
 * escaped-read guard, whose warning that package's test setup suppresses, so
 * an inverted flag makes the suite quieter rather than redder. Assert the
 * values, not just the names.
 */
describe("ReadContext tracking window", () => {
  it("untrackedRead never accepts tracked reads", () => {
    expect(untrackedRead.isTracking).toBe(false);
  });

  it("a tracking scope accepts reads until it is finalized", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("a");
    const rc = new TrackingReadContext();

    expect(rc.isTracking).toBe(true);
    expect(rc.getValue(c)).toBe("a");
    expect(rc.tracked.size).toBe(1);

    rc.finalize();
    expect(rc.isTracking).toBe(false);

    // Reads still return current values, but register nothing.
    rc.tracked.clear();
    expect(rc.getValue(c)).toBe("a");
    expect(rc.tracked.size).toBe(0);

    // beginTracking() reopens the window for the next pass.
    rc.beginTracking();
    expect(rc.isTracking).toBe(true);
    expect(rc.getValue(c)).toBe("a");
    expect(rc.tracked.size).toBe(1);
  });
});

describe("escaped-read hooks compose", () => {
  /**
   * The slot used to be singular, so the second package to install a hook
   * silently disabled the first — and the two known installers are the React
   * adapter's captured-`rc` warning and a compat/diagnostics layer, i.e.
   * exactly the pair a user debugging a staleness bug has loaded at once.
   */
  it("calls every added hook, in installation order", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("a");
    const calls: string[] = [];
    const offA = addEscapedReadHook(() => calls.push("a"));
    const offB = addEscapedReadHook(() => calls.push("b"));
    try {
      const rc = new TrackingReadContext();
      rc.getValue(c);
      expect(calls).toEqual([]);
      rc.finalize();
      rc.getValue(c);
      expect(calls).toEqual(["a", "b"]);
    } finally {
      offA();
      offB();
    }
  });

  it("the disposer removes only its own hook", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("a");
    const calls: string[] = [];
    const offA = addEscapedReadHook(() => calls.push("a"));
    const offB = addEscapedReadHook(() => calls.push("b"));
    offA();
    try {
      const rc = new TrackingReadContext();
      rc.finalize();
      rc.getValue(c);
      expect(calls).toEqual(["b"]);
    } finally {
      offB();
    }
  });

  it("setEscapedReadHook replaces its own hook and leaves added ones alone", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("a");
    const calls: string[] = [];
    const off = addEscapedReadHook(() => calls.push("added"));
    setEscapedReadHook(() => calls.push("primary1"));
    setEscapedReadHook(() => calls.push("primary2"));
    try {
      const rc = new TrackingReadContext();
      rc.finalize();
      rc.getValue(c);
      expect(calls).toEqual(["added", "primary2"]);
      calls.length = 0;
      setEscapedReadHook(null);
      rc.getValue(c);
      expect(calls).toEqual(["added"]);
    } finally {
      off();
      setEscapedReadHook(null);
    }
  });
});
