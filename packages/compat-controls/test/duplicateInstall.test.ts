/**
 * Duplicate-install detection.
 *
 * Two copies of this package in one process is the cardinal hazard of the
 * compat design, and it used to fail in total silence: the second copy found
 * the prototype already patched, returned, and kept its own module-global
 * `collectChange`. Reads report to whichever copy owns the prototype while a
 * tracker installed by the other copy hears nothing — so reads look
 * collected, subscriptions get created, and the component never re-renders.
 *
 * Every strict-ambient guard is blind to it by construction: from each copy's
 * point of view the read was collected perfectly normally. That is why this
 * check reports rather than relying on strict mode, and why it runs however
 * the process is built.
 *
 * A second copy can't be loaded into this process, so the tests drive
 * `ensurePatched()` directly — it is idempotent for the *owning* instance and
 * loud for any other, which is exactly the distinction under test.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ensurePatched, getCompatPatchInfo, newControl } from "../src/index";
import { setStrictAmbient } from "../src/index";

const PATCHED = Symbol.for("@react-typed-forms/core/compat-patched");

/** The prototype every control in this process is patched onto. */
function proto(): Record<symbol, unknown> {
  return Object.getPrototypeOf(newControl("a")) as Record<symbol, unknown>;
}

afterEach(() => setStrictAmbient(false));

describe("duplicate install", () => {
  it("a clean single install reports no duplicates", () => {
    const info = getCompatPatchInfo();
    expect(info.duplicatePackage).toBe(false);
    expect(info.duplicateEngine).toBe(false);
    expect(info.packageCopies).toBe(1);
    expect(info.engineCopies).toBe(1);
  });

  it("re-running the owning instance's patch is silent and idempotent", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const before = proto()[PATCHED];
      ensurePatched();
      ensurePatched();
      expect(proto()[PATCHED]).toBe(before);
      expect(error).not.toHaveBeenCalled();
      // The patch still works.
      expect(newControl("a").value).toBe("a");
    } finally {
      error.mockRestore();
    }
  });

  it("a second copy patching the same engine is reported, not swallowed", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = proto();
    const owner = p[PATCHED];
    try {
      // Stand in for another module instance: a token this copy does not own.
      p[PATCHED] = { notOurs: true };
      ensurePatched();
      expect(error).toHaveBeenCalledOnce();
      const msg = String(error.mock.calls[0][0]);
      expect(msg).toContain("More than one copy of @react-typed-forms/core");
      // The message has to name the fix — this is an install problem, and the
      // person reading it is looking at a stale component, not a stack trace.
      expect(msg).toContain("pnpm.overrides");
    } finally {
      p[PATCHED] = owner;
      error.mockRestore();
    }
  });

  it("throws instead of logging under strict ambient mode", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = proto();
    const owner = p[PATCHED];
    try {
      setStrictAmbient(true);
      p[PATCHED] = { notOurs: true };
      expect(() => ensurePatched()).toThrow(
        /More than one copy of @react-typed-forms\/core/,
      );
    } finally {
      p[PATCHED] = owner;
      error.mockRestore();
    }
  });

  it("the second copy still leaves the prototype patched and usable", () => {
    // The report is a diagnostic, not a bail-out: whichever copy owns the
    // prototype keeps working, so the app limps rather than dying outright.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = proto();
    const owner = p[PATCHED];
    try {
      p[PATCHED] = { notOurs: true };
      ensurePatched();
      const c = newControl({ name: "jo" });
      expect(c.fields.name.value).toBe("jo");
      expect(c.current.value).toEqual({ name: "jo" });
    } finally {
      p[PATCHED] = owner;
      error.mockRestore();
    }
  });
});
