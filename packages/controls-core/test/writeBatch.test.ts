import { describe, expect, it } from "vitest";
import { ControlChange } from "../src/types";
import { makeCtx } from "./index";

describe("write batching", () => {
  it("notifies once per batch, however many writes", () => {
    const ctx = makeCtx();
    const a = ctx.newControl("a");
    const b = ctx.newControl("b");
    const notifications: string[] = [];
    a.subscribe(() => notifications.push("a"), ControlChange.Value);
    b.subscribe(() => notifications.push("b"), ControlChange.Value);

    ctx.update((wc) => {
      wc.setValue(a, "1");
      wc.setValue(a, "2");
      wc.setValue(b, "3");
    });

    expect(notifications).toStrictEqual(["a", "b"]);
    expect(a.valueNow).toBe("2");
  });

  it("publishes writes made before a throw, and rethrows", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("initial");
    const seen: string[] = [];
    c.subscribe((ctrl) => seen.push(ctrl.valueNow), ControlChange.Value);

    const boom = new Error("boom");
    expect(() =>
      ctx.update((wc) => {
        wc.setValue(c, "written");
        throw boom;
      }),
    ).toThrow(boom);

    // The write is applied, so a subscriber that never heard about it would be
    // permanently stale — the flush has to happen even on the failure path.
    expect(c.valueNow).toBe("written");
    expect(seen).toStrictEqual(["written"]);
  });

  it("still notifies for a throw from a listener during flush", () => {
    const ctx = makeCtx();
    const c = ctx.newControl(0);
    const boom = new Error("listener boom");
    c.subscribe(() => {
      throw boom;
    }, ControlChange.Value);

    expect(() => ctx.update((wc) => wc.setValue(c, 1))).toThrow(boom);
    expect(c.valueNow).toBe(1);
  });

  it("does not nest: a nested update flushes inline, not into the outer batch", () => {
    const ctx = makeCtx();
    const trigger = ctx.newControl("t0");
    const followed = ctx.newControl("f0");
    const order: string[] = [];

    followed.subscribe(() => order.push("followed notified"), ControlChange.Value);
    // A listener that writes via ctx.update rather than the wc it was handed.
    trigger.subscribe(() => {
      order.push("trigger notified");
      ctx.update((wc) => wc.setValue(followed, "f1"));
      order.push("nested update returned");
    }, ControlChange.Value);

    ctx.update((wc) => wc.setValue(trigger, "t1"));

    // "followed notified" lands *inside* the listener, before the nested
    // update returns — the inner batch flushed on its own rather than
    // deferring to the outer flush.
    expect(order).toStrictEqual([
      "trigger notified",
      "followed notified",
      "nested update returned",
    ]);
  });

  it("a listener writing through its own wc joins the outer batch", () => {
    const ctx = makeCtx();
    const trigger = ctx.newControl("t0");
    const followed = ctx.newControl("f0");
    const order: string[] = [];

    followed.subscribe(() => order.push("followed notified"), ControlChange.Value);
    trigger.subscribe((_c, _change, wc) => {
      order.push("trigger notified");
      wc.setValue(followed, "f1");
      order.push("listener returned");
    }, ControlChange.Value);

    ctx.update((wc) => wc.setValue(trigger, "t1"));

    // Threading the handed-down wc defers the notification to the outer
    // drain loop, so it arrives after the listener returns.
    expect(order).toStrictEqual([
      "trigger notified",
      "listener returned",
      "followed notified",
    ]);
  });

  it("runs afterChanges callbacks once listeners have drained", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("a");
    const order: string[] = [];
    c.subscribe(() => order.push("listener"), ControlChange.Value);

    ctx.update((wc) => {
      wc.afterChanges(() => order.push("afterChanges"));
      wc.setValue(c, "b");
    });

    expect(order).toStrictEqual(["listener", "afterChanges"]);
  });
});
