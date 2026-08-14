import { describe, expect, it } from "vitest";
import {
  AsyncEffect,
  ControlChange,
  SubscriptionTracker,
  addDependent,
  collectChanges,
  createAsyncEffect,
  createCleanupScope,
  createEffect,
  createScopedEffect,
  createSyncEffect,
  groupedChanges,
  newControl,
} from "../src/index";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("SubscriptionTracker", () => {
  it("subscribes per collected control with merged masks and reconciles", () => {
    const a = newControl("a");
    const b = newControl("b");
    let notified = 0;
    const tracker = new SubscriptionTracker(() => notified++);

    collectChanges(tracker.collectUsage, () => {
      void a.value;
      void a.touched;
      void b.value;
    });
    tracker.update();
    expect(tracker.subscriptions.length).toBe(2);

    a.value = "a2";
    expect(notified).toBe(1);
    a.touched = true;
    expect(notified).toBe(2);

    // Next round reads only b — a's subscription is dropped by update()
    collectChanges(tracker.collectUsage, () => {
      void b.value;
    });
    tracker.update();
    a.value = "a3";
    expect(notified).toBe(2);
    b.value = "b2";
    expect(notified).toBe(3);

    tracker.cleanup();
    b.value = "b3";
    expect(notified).toBe(3);
  });
});

describe("Effect", () => {
  it("runs eagerly and re-runs when ambient dependencies change", () => {
    const a = newControl(1);
    const b = newControl(2);
    const runs: number[] = [];
    const scope = createCleanupScope();
    createEffect(() => a.value + b.value, (v) => runs.push(v), scope);
    expect(runs).toEqual([3]);
    a.value = 10;
    expect(runs).toEqual([3, 12]);
    scope.cleanup();
    b.value = 100;
    expect(runs).toEqual([3, 12]);
  });

  it("coalesces several changes in one transaction into one run", () => {
    const a = newControl(1);
    const b = newControl(2);
    const runs: number[] = [];
    createEffect(() => a.value + b.value, (v) => runs.push(v));
    groupedChanges(() => {
      a.value = 10;
      b.value = 20;
    });
    expect(runs).toEqual([3, 30]);
  });

  it("re-tracks dependencies per run (conditional reads)", () => {
    const which = newControl(true);
    const a = newControl("a");
    const b = newControl("b");
    const runs: string[] = [];
    createEffect(
      () => (which.value ? a.value : b.value),
      (v) => runs.push(v),
    );
    expect(runs).toEqual(["a"]);
    b.value = "b2"; // not currently tracked
    expect(runs).toEqual(["a"]);
    which.value = false;
    expect(runs).toEqual(["a", "b2"]);
    a.value = "a2"; // no longer tracked
    expect(runs).toEqual(["a", "b2"]);
  });

  it("createSyncEffect / createScopedEffect run their body reactively", () => {
    const c = newControl(0);
    const scope = createCleanupScope();
    const bodies: number[] = [];
    createSyncEffect(() => bodies.push(c.value), scope);
    expect(bodies).toEqual([0]);
    c.value = 1;
    expect(bodies).toEqual([0, 1]);

    const cleanups: number[] = [];
    createScopedEffect((run) => {
      const v = c.value;
      run.addCleanup(() => cleanups.push(v));
    }, scope);
    c.value = 2;
    // Previous run's scope drained before the re-run
    expect(cleanups).toEqual([1]);
    scope.cleanup();
    expect(cleanups).toEqual([1, 2]);
    c.value = 3;
    expect(bodies).toEqual([0, 1, 2]);
  });

  it("effect writes inside the run join the same transaction storm", () => {
    const source = newControl(1);
    const target = newControl(0);
    let targetNotifications = 0;
    target.subscribe(() => targetNotifications++, ControlChange.Value);
    createEffect(
      () => source.value * 2,
      (v) => (target.value = v),
    );
    expect(target.value).toBe(2);
    const before = targetNotifications;
    source.value = 5;
    expect(target.value).toBe(10);
    expect(targetNotifications).toBe(before + 1);
  });
});

describe("AsyncEffect", () => {
  it("starts on start(), tracks async reads, re-runs on change", async () => {
    const c = newControl("x");
    const results: string[] = [];
    const scope = createCleanupScope();
    const effect = createAsyncEffect(async (_e: AsyncEffect<void>, signal) => {
      const v = c.value; // ambient read collected during the run
      await tick();
      if (!signal.aborted) results.push(v);
    }, scope);
    expect(results).toEqual([]);
    effect.start();
    await tick();
    await tick();
    expect(results).toEqual(["x"]);

    c.value = "y";
    await tick();
    await tick();
    expect(results).toEqual(["x", "y"]);

    scope.cleanup();
    c.value = "z";
    await tick();
    await tick();
    expect(results).toEqual(["x", "y"]);
  });

  it("aborts an in-flight run when superseded and runs the latest", async () => {
    const c = newControl(1);
    const seen: number[] = [];
    const aborted: number[] = [];
    const scope = createCleanupScope();
    const effect = createAsyncEffect(async (_e: AsyncEffect<void>, signal) => {
      const v = c.value;
      await tick();
      await tick();
      if (signal.aborted) aborted.push(v);
      else seen.push(v);
    }, scope);
    effect.start();
    c.value = 2; // supersedes the in-flight run for value 1
    await tick();
    await tick();
    await tick();
    await tick();
    await tick();
    expect(aborted).toEqual([1]);
    expect(seen).toEqual([2]);
    scope.cleanup();
  });
});

describe("addDependent", () => {
  it("cleans the child when the parent scope cleans up", () => {
    const parent = createCleanupScope();
    const child = newControl(0);
    let cleaned = 0;
    child.addCleanup(() => cleaned++);
    addDependent(parent, child);
    parent.cleanup();
    expect(cleaned).toBe(1);
  });
});
