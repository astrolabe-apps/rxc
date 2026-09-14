import { describe, expect, it, vi } from "vitest";
import type { FormStateNode } from "@rx-controls/forms-core";
import { runAsyncAction } from "../src/useAsyncAction";

function fakeNode() {
  const calls: boolean[] = [];
  const node = {
    setBusy(b: boolean) {
      calls.push(b);
    },
  } as unknown as FormStateNode;
  return { node, calls };
}

describe("runAsyncAction (busy lifecycle)", () => {
  it("synchronous handler does not toggle busy", () => {
    const { node, calls } = fakeNode();
    const handler = vi.fn(() => undefined);
    runAsyncAction(node, handler, "x", null);
    expect(handler).toHaveBeenCalledWith("x", null);
    expect(calls).toEqual([]);
  });

  it("resolved promise sets busy=true, then busy=false on .finally", async () => {
    const { node, calls } = fakeNode();
    let resolve!: () => void;
    const p = new Promise<void>((r) => {
      resolve = r;
    });
    runAsyncAction(node, () => p, "x", null);
    expect(calls).toEqual([true]);
    resolve();
    await p.catch(() => {});
    // microtask flush
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual([true, false]);
  });

  it("rejected promise still releases busy via .catch+.finally", async () => {
    const { node, calls } = fakeNode();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let reject!: (err: unknown) => void;
    const p = new Promise<void>((_, r) => {
      reject = r;
    });
    runAsyncAction(node, () => p, "x", null);
    expect(calls).toEqual([true]);
    reject(new Error("boom"));
    await p.catch(() => {});
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual([true, false]);
    errSpy.mockRestore();
  });

  it("synchronous throw does not touch busy", () => {
    const { node, calls } = fakeNode();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    runAsyncAction(
      node,
      () => {
        throw new Error("nope");
      },
      "x",
      null,
    );
    expect(calls).toEqual([]);
    errSpy.mockRestore();
  });

  it("null handler is a no-op", () => {
    const { node, calls } = fakeNode();
    runAsyncAction(node, null, "x", null);
    expect(calls).toEqual([]);
  });
});
