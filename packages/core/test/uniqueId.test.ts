import { describe, expect, it } from "vitest";
import { makeCtx } from "./index";

describe("Control.uniqueId", () => {
  it("a fresh context starts allocating ids from 1", () => {
    const ctx = makeCtx();
    const a = ctx.newControl("a");
    const b = ctx.newControl("b");
    expect(a.uniqueId).toBe(1);
    expect(b.uniqueId).toBe(2);
  });

  it("two independent contexts produce identical id sequences (SSR/hydration determinism)", () => {
    const ctxA = makeCtx();
    const a1 = ctxA.newControl("x");
    const a2 = ctxA.newControl({ name: "y" });
    const a2name = a2.fields.name;

    const ctxB = makeCtx();
    const b1 = ctxB.newControl("x");
    const b2 = ctxB.newControl({ name: "y" });
    const b2name = b2.fields.name;

    expect(a1.uniqueId).toBe(b1.uniqueId);
    expect(a2.uniqueId).toBe(b2.uniqueId);
    expect(a2name.uniqueId).toBe(b2name.uniqueId);
  });

  it("child controls share the parent context's counter", () => {
    const ctx = makeCtx();
    const root = ctx.newControl({ a: 1, b: 2 });
    const fa = root.fields.a;
    const fb = root.fields.b;
    // root is 1; fields are allocated lazily. Both must come from the
    // same monotonic counter — no duplicates, no jumps to a different
    // sequence.
    const ids = [root.uniqueId, fa.uniqueId, fb.uniqueId];
    expect(new Set(ids).size).toBe(3);
    expect(Math.min(...ids)).toBe(1);
  });
});
