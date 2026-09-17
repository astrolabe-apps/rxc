/**
 * The legacy effects API — `SubscriptionTracker`, `Effect`, `AsyncEffect`
 * and their factories, ported near-verbatim from `@astroapps/controls@1.4.2`.
 *
 * Everything here runs on surfaces compat already provides: per-control
 * `subscribe`/`unsubscribe` (identical in the new engine), the Bridge-1
 * ambient collector (`collectChanges`), and Bridge-2's
 * `addAfterChangesCallback` — which, because the ambient wc stays open
 * through its own flush (see `transactions.ts`), coalesces an effect's
 * re-run to once per transaction exactly as legacy did.
 */

import { ControlChange } from "@rx-controls/core";
import type { Subscription } from "@rx-controls/core";
import {
  collectChanges,
  reportDeadTracker,
  strictAmbient,
  tagCollector,
} from "./ambient.js";

declare const process: { env: { NODE_ENV?: string } } | undefined;
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
import { createCleanupScope } from "./functions.js";
import { addAfterChangesCallback } from "./transactions.js";
import type {
  ChangeListenerFunc,
  CleanupScope,
  Control,
} from "./types.js";

/** One tracked control: `[control, live subscription (if any), latest mask]`. */
export type TrackedSubscription = [
  Control<any>,
  Subscription | undefined,
  ControlChange,
];

type TrackerListener = ChangeListenerFunc<any> & {
  tracker?: SubscriptionTracker;
};

/**
 * Maintains per-control subscriptions from ambient usage collection: install
 * `collectUsage` as the collector while reading, then `update()` to
 * reconcile subscription masks to what was actually used.
 */
export class SubscriptionTracker {
  listen: TrackerListener;
  subscriptions: TrackedSubscription[] = [];

  /**
   * Set by {@link cleanup}, and never cleared. Read only by the strict
   * ambient diagnostics — `collectUsage` will happily subscribe on behalf of
   * a disposed tracker, and the resulting subscription notifies a listener
   * nobody is listening to.
   */
  dead = false;

  collectUsage: ChangeListenerFunc<any> = tagCollector((c, change) => {
    if (IS_DEV && strictAmbient && this.dead) reportDeadTracker(c, change);
    const existing = this.subscriptions.find((x) => x[0] === c);
    if (existing) {
      existing[2] |= change;
    } else {
      this.subscriptions.push([
        c,
        c.subscribe(this.listen, change),
        change,
      ]);
    }
  }, "tracker");

  constructor(listen: ChangeListenerFunc<any>) {
    this.listen = listen;
    this.listen.tracker = this;
  }

  /** Reconcile subscriptions to the masks collected since the last update;
   * controls not read at all this round are unsubscribed. */
  update(): void {
    let removed = false;
    this.subscriptions.forEach((sub) => {
      const [c, s, latest] = sub;
      if (s) {
        if (s.mask !== latest) {
          c.unsubscribe(s);
          if (!latest) {
            removed = true;
            sub[1] = undefined;
          } else sub[1] = c.subscribe(this.listen, latest);
        }
      } else {
        sub[1] = c.subscribe(this.listen, latest);
      }
      sub[2] = ControlChange.None;
    });
    if (removed) {
      this.subscriptions = this.subscriptions.filter((x) => x[1]);
    }
  }

  cleanup(): void {
    this.subscriptions.forEach((x) => x[1] && x[0].unsubscribe(x[1]));
    this.subscriptions = [];
    if (IS_DEV) this.dead = true;
  }
}

/**
 * A reactive computation with a side-effecting `run`. Eager: runs once at
 * construction; re-runs (once per transaction) when anything `calculate`
 * read ambiently changes.
 */
export class Effect<V> extends SubscriptionTracker {
  calculate: () => V;
  run: (v: V) => void;
  changedDetected = false;

  runEffect(): void {
    this.run(this.updateCalc());
  }

  updateCalc(): V {
    const result = collectChanges(this.collectUsage, () => this.calculate());
    this.update();
    return result;
  }

  constructor(calculate: () => V, run: (v: V) => void) {
    super(() => {
      if (this.changedDetected) return;
      this.changedDetected = true;
      addAfterChangesCallback(() => {
        this.changedDetected = false;
        this.runEffect();
      });
    });
    this.calculate = calculate;
    this.run = run;
    this.run(this.updateCalc());
  }
}

export function createEffect<V>(
  calculate: () => V,
  run: (v: V) => void,
  cleanupScope?: CleanupScope,
): Effect<V> {
  const effect = new Effect(calculate, run);
  cleanupScope?.addCleanup(() => effect.cleanup());
  return effect;
}

/** An effect whose whole body is the tracked computation. */
export function createSyncEffect<V>(
  process: () => V,
  cleanupScope: CleanupScope,
): Effect<V> {
  const effect = new Effect(process, () => {});
  cleanupScope.addCleanup(() => effect.cleanup());
  return effect;
}

/** A sync effect handed a per-run cleanup scope, drained before each re-run
 * and on teardown. */
export function createScopedEffect<V>(
  process: (scope: CleanupScope) => V,
  parentScope: CleanupScope,
): Effect<V> {
  const cleanup = createCleanupScope();
  const effect = new Effect(
    () => {
      cleanup.cleanup();
      return process(cleanup);
    },
    () => {},
  );
  parentScope.addCleanup(() => {
    effect.cleanup();
    cleanup.cleanup();
  });
  return effect;
}

/**
 * An async reactive process. Reads made ambiently while the (async) process
 * runs are collected; a dependency change aborts any in-flight run and
 * queues a fresh one. Not started until `start()` (legacy contract).
 */
export class AsyncEffect<V> extends SubscriptionTracker {
  process: (effect: AsyncEffect<V>, signal: AbortSignal) => Promise<V>;
  running = false;
  abortController?: AbortController;
  changedDetected = false;
  destroyed = false;
  pendingRun = false;

  runProcess(): void {
    if (this.running) {
      // Already running: abort the in-flight run and queue a fresh one.
      this.abortController?.abort();
      this.pendingRun = true;
      return;
    }
    this.running = true;
    const aborter = new AbortController();
    this.abortController = aborter;
    collectChanges(this.collectUsage, () =>
      this.process(this, aborter.signal),
    ).finally(() => {
      if (!this.destroyed) {
        this.update();
        this.abortController = undefined;
        this.running = false;
        if (this.pendingRun) {
          this.pendingRun = false;
          this.runProcess();
        }
      }
    });
  }

  start(): void {
    this.runProcess();
  }

  cleanup(): void {
    this.destroyed = true;
    this.abortController?.abort();
    super.cleanup();
  }

  constructor(
    process: (effect: AsyncEffect<V>, signal: AbortSignal) => Promise<V>,
  ) {
    super(() => {
      if (this.changedDetected) return;
      this.changedDetected = true;
      addAfterChangesCallback(() => {
        this.changedDetected = false;
        this.runProcess();
      });
    });
    this.process = process;
  }
}

export function createAsyncEffect<V>(
  process: (effect: AsyncEffect<V>, signal: AbortSignal) => Promise<V>,
  cleanupScope: CleanupScope,
): AsyncEffect<V> {
  const effect = new AsyncEffect(process);
  cleanupScope.addCleanup(() => effect.cleanup());
  return effect;
}
