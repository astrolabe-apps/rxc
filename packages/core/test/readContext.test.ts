import { describe, expect, it } from "vitest";
import { untrackedRead, TrackingReadContext } from "../src/readContextImpl";
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
