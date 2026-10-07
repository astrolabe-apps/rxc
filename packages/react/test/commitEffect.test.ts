import { afterEach, describe, expect, it, vi } from "vitest";
import { useEffect, useLayoutEffect } from "react";

/**
 * `useCommitEffect` is chosen once, at module load. Each case re-imports the
 * module under the globals of one platform.
 */
async function load(globals: { document?: unknown; navigator?: unknown }) {
  vi.resetModules();
  vi.stubGlobal("document", globals.document);
  vi.stubGlobal("navigator", globals.navigator);
  return (await import("../src/useReactive")).useCommitEffect;
}

describe("useCommitEffect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("is a layout effect in a browser", async () => {
    expect(await load({ document: {}, navigator: { product: "Gecko" } })).toBe(useLayoutEffect);
  });

  it("is a layout effect on React Native, which has no document", async () => {
    expect(await load({ document: undefined, navigator: { product: "ReactNative" } })).toBe(
      useLayoutEffect,
    );
  });

  it("is a passive effect on the server, where layout effects warn", async () => {
    expect(await load({ document: undefined, navigator: undefined })).toBe(useEffect);
    expect(await load({ document: undefined, navigator: { userAgent: "Node.js/22" } })).toBe(
      useEffect,
    );
  });
});
