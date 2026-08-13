import { describe, expect, it } from "vitest";
import {
  ControlChange,
  addAfterChangesCallback,
  groupedChanges,
  newControl,
  runTransaction,
} from "../src/index";

describe("ambient write transactions", () => {
  it("each bare mutation flushes its own transaction", () => {
    const c = newControl(0);
    let calls = 0;
    c.subscribe(() => calls++, ControlChange.Value);
    c.value = 1;
    c.value = 2;
    expect(calls).toBe(2);
  });

  it("groupedChanges coalesces into a single flush", () => {
    const c = newControl(0);
    const d = newControl("a");
    let cCalls = 0;
    let dCalls = 0;
    c.subscribe(() => cCalls++, ControlChange.Value);
    d.subscribe(() => dCalls++, ControlChange.Value);
    groupedChanges(() => {
      c.value = 1;
      c.value = 2;
      d.value = "b";
    });
    expect(c.value).toBe(2);
    expect(cCalls).toBe(1);
    expect(dCalls).toBe(1);
  });

  it("nested groupedChanges joins the open transaction", () => {
    const c = newControl(0);
    let calls = 0;
    c.subscribe(() => calls++, ControlChange.Value);
    groupedChanges(() => {
      c.value = 1;
      groupedChanges(() => {
        c.value = 2;
      });
      // inner group did not flush
      expect(calls).toBe(0);
    });
    expect(calls).toBe(1);
  });

  it("runTransaction batches like groupedChanges", () => {
    const c = newControl(0);
    let calls = 0;
    c.subscribe(() => calls++, ControlChange.Value);
    runTransaction(c, () => {
      c.value = 1;
      c.value = 2;
    });
    expect(calls).toBe(1);
  });

  it("returns the callback result", () => {
    expect(groupedChanges(() => 42)).toBe(42);
  });

  it("addAfterChangesCallback runs after the open transaction settles", () => {
    const c = newControl(0);
    const order: string[] = [];
    c.subscribe(() => order.push("listener"), ControlChange.Value);
    groupedChanges(() => {
      c.value = 1;
      addAfterChangesCallback(() => order.push("after"));
      order.push("body");
    });
    expect(order).toEqual(["body", "listener", "after"]);
  });

  it("flushes even when the callback throws", () => {
    const c = newControl(0);
    let calls = 0;
    c.subscribe(() => calls++, ControlChange.Value);
    expect(() =>
      groupedChanges(() => {
        c.value = 1;
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(calls).toBe(1);
    // and the ambient wc was cleared — later writes get fresh transactions
    c.value = 2;
    expect(calls).toBe(2);
  });
});
