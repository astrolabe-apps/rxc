// @vitest-environment node
/**
 * Duplicate-install detection on a development server.
 *
 * Next.js re-evaluates its server modules once per route it compiles, so a
 * `next dev` log reported "more than one copy" for every route after the
 * first — the earlier copies being dead re-evaluations of the same file, not
 * a duplicate install. A copy loaded from the same file on a development
 * server is now one warning per process, naming that cause; another file is
 * reported as before.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ensurePatched, newControl, setStrictAmbient } from "../src/index";

const PATCHED = Symbol.for("@react-typed-forms/core/compat-patched");
const REGISTRY = Symbol.for("@react-typed-forms/core/compat-instances");

interface Registry {
  files?: WeakMap<object, string>;
  reEvaluationReported?: boolean;
}

function proto(): Record<symbol, unknown> {
  return Object.getPrototypeOf(newControl("a")) as Record<symbol, unknown>;
}
const registry = () => (globalThis as unknown as Record<symbol, Registry>)[REGISTRY];

/** Stand in for another copy, loaded from `file`, owning the prototype. */
function withOtherOwner(file: string | undefined, run: () => void) {
  const p = proto();
  const owner = p[PATCHED];
  const other = { notOurs: true };
  if (file !== undefined) registry().files!.set(other, file);
  p[PATCHED] = other;
  try {
    run();
  } finally {
    p[PATCHED] = owner;
  }
}

afterEach(() => {
  setStrictAmbient(false);
  registry().reEvaluationReported = false;
  vi.restoreAllMocks();
});

describe("duplicate install on a development server", () => {
  it("knows the file each copy came from", () => {
    expect(registry().files?.get(proto())).toMatch(/patch\.ts$/);
  });

  it("a copy from the same file is one warning naming a re-evaluation, once per process", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const same = registry().files!.get(proto());
    withOtherOwner(same, () => {
      ensurePatched();
      ensurePatched();
    });
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain("re-evaluated its modules");
    expect(msg).toContain("getCompatPatchInfo()");
  });

  it("does not throw for a re-evaluation under strict ambient mode", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setStrictAmbient(true);
    const same = registry().files!.get(proto());
    withOtherOwner(same, () => expect(() => ensurePatched()).not.toThrow());
  });

  it("a copy from another file is reported as a duplicate, as before", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    withOtherOwner("file:///elsewhere/node_modules/@react-typed-forms/core/lib/patch.js", () =>
      ensurePatched(),
    );
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    expect(String(error.mock.calls[0][0])).toContain("pnpm.overrides");
  });

  it("a copy whose file is unknown (an older copy's registry entry) is reported", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    withOtherOwner(undefined, () => ensurePatched());
    expect(error).toHaveBeenCalledOnce();
  });
});
