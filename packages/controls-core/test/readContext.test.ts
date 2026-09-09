import { describe, expect, it } from "vitest";
import { noopReadContext, TrackingReadContext } from "../src/readContextImpl";
import { makeCtx } from "./index";

/**
 * The tracking-window flag, pinned from both implementations.
 *
 * This exists because the flag is about to be renamed `isFinalized` →
 * `isTracking` with its polarity flipped, and the only consumer
 * (`forms-core`'s escaped-read guard) has its warning suppressed in that
 * package's test setup. A rename that keeps `noopReadContext`'s literal at
 * `true` compiles, type-checks and passes every other test, while silently
 * killing the guard for every noop-rc consumer. Assert the value, not just
 * the name.
 */
describe("ReadContext tracking window", () => {
  it("noopReadContext never accepts tracked reads", () => {
    expect(noopReadContext.isFinalized).toBe(true);
  });

  it("a tracking scope accepts reads until it is finalized", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("a");
    const rc = new TrackingReadContext();

    expect(rc.isFinalized).toBe(false);
    expect(rc.getValue(c)).toBe("a");
    expect(rc.tracked.size).toBe(1);

    rc.finalize();
    expect(rc.isFinalized).toBe(true);

    // Reads still return current values, but register nothing.
    rc.tracked.clear();
    expect(rc.getValue(c)).toBe("a");
    expect(rc.tracked.size).toBe(0);

    // reset() reopens the window for the next pass.
    rc.reset();
    expect(rc.isFinalized).toBe(false);
    expect(rc.getValue(c)).toBe("a");
    expect(rc.tracked.size).toBe(1);
  });
});
