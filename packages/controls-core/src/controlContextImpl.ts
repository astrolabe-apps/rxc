import type {ControlContextInternal} from "./controlImpl.js";
import {ControlFlags, ControlImpl, noopNotify,} from "./controlImpl.js";
import type {Control, ControlContext, ControlOptions, WriteContext} from "./types.js";
import {ControlChange} from "./types.js";
import {WriteContextImpl} from "./writeContextImpl.js";
import {deepEquals} from "./deepEquals.js";
import type {SubscriptionReconciler} from "./readContextImpl.js";

export interface ControlContextOptions {
  equals?: (a: unknown, b: unknown) => boolean;
}

export function createControlContext(
  options?: ControlContextOptions,
): ControlContext {
  return new ControlContextImpl(options?.equals ?? deepEquals);
}

class ControlContextImpl implements ControlContext {
  private deadTrackers = new Set<SubscriptionReconciler>();
  private sweepTimer: ReturnType<typeof setTimeout> | undefined;
  /**
   * Per-context counter for `Control.uniqueId`. Lives on the root
   * `ControlContextImpl`; child contexts created via `buildChildContext`
   * close over `self` and share this counter, so siblings get sequential
   * ids regardless of how deep they sit. Two independent ControlContexts
   * each start from 0 — that's the property that makes SSR/hydration
   * produce identical ids.
   */
  private _uniqueIdCounter = 0;

  constructor(public readonly equals: (a: unknown, b: unknown) => boolean) {}

  nextUniqueId(): number {
    return ++this._uniqueIdCounter;
  }

  newControl<V>(value: V, setup?: ControlOptions<V>): Control<V> {
    const ctx = this.buildChildContext(setup);
    const control = new ControlImpl<V>(value, value, ControlFlags.None, ctx);
    if (setup) {
      this.initControl(control, setup);
    }
    return control;
  }

  /**
   * Run a batch of writes and notify subscribers once, after `cb` returns.
   *
   * Writes take effect on the controls immediately; it is *notification*
   * that is batched. There is no staging, so no atomicity and no rollback —
   * see `docs/CONTROL-SEMANTICS.md` section I.
   *
   * The flush is in a `finally` because the alternative is worse: if `cb`
   * throws part-way, the writes it already made are applied but their
   * pending notifications would be discarded with the `wc`, leaving
   * subscribers stale indefinitely — until some unrelated change happened to
   * touch the same controls. Flushing publishes the partial write and then
   * rethrows, so the tree and its subscribers stay consistent with each
   * other whichever way `cb` exits.
   *
   * Batching does not nest: an `update` called from inside a listener gets
   * its own `WriteContext`, which flushes inline rather than joining the
   * outer batch.
   */
  update(cb: (wc: WriteContext) => void): void {
    const wc = new WriteContextImpl();
    try {
      cb(wc);
    } finally {
      wc.flush();
    }
  }

  releaseTracker(reconciler: SubscriptionReconciler): void {
    reconciler.alive = false;
    this.deadTrackers.add(reconciler);
    this.scheduleSweep();
  }

  retainTracker(reconciler: SubscriptionReconciler): void {
    reconciler.alive = true;
    this.deadTrackers.delete(reconciler);
  }

  // ── Private ───────────────────────────────────────────────────

  private scheduleSweep(): void {
    if (this.sweepTimer !== undefined) return;
    this.sweepTimer = setTimeout(() => {
      this.sweepTimer = undefined;
      for (const tracker of this.deadTrackers) {
        if (!tracker.alive) {
          tracker.cleanup();
        }
      }
      this.deadTrackers.clear();
    }, 5000);
  }

  private buildChildContext(setup?: ControlOptions<any>): ControlContextInternal {
    const self = this;
    return {
      equals: this.equals,
      newControl: (value, setup?) => this.newControl(value, setup),
      createChild(value, initialValue, flags, fieldKey?) {
        const fieldSetup = fieldKey ? (setup?.fields as any)?.[fieldKey] : setup?.elements;
        const childCtx = self.buildChildContext(fieldSetup);
        const child = new ControlImpl(value, initialValue, flags, childCtx);
        if (fieldSetup) {
          self.initControl(child, fieldSetup);
        }
        return child;
      },
      nextUniqueId: () => self.nextUniqueId(),
    };
  }

  private initControl(control: ControlImpl, setup: ControlOptions<any>): void {
    // 0. Errors published from outside this control survive value writes.
    if (setup.keepErrors) control._flags |= ControlFlags.DontClearError;

    // 1. Validator
    if (setup.validator !== undefined) {
      const v = setup.validator;
      // Run immediately
      if (v) {
        control.setErrorImpl("default", v(control._value), noopNotify);
      }
      control._flags |= ControlFlags.DontClearError;
      // Subscribe for re-running
      if (v) {
        control.subscribe(
          (c, _change, wc) => {
            const impl = c as unknown as ControlImpl;
            impl.setErrorImpl("default", v(impl._value), (ctrl) => {
              (wc as WriteContextImpl).pending.add(ctrl);
            });
          },
          ControlChange.Value | ControlChange.Validate,
        );
      }
    }

    // 2. Eager field creation (fields with validators)
    if (setup.fields) {
      for (const k of Object.keys(setup.fields)) {
        const fieldSetup = (setup.fields as any)[k] as ControlOptions<any> | undefined;
        if (fieldSetup?.validator !== undefined) {
          control.getField(k);
        }
      }
    }

    // 3. Eager element init
    if (setup.elements) {
      control.getOrCreateElements();
    }

    // 4. Meta
    if (setup.meta) {
      Object.assign(control.meta, setup.meta);
    }

    // 5. afterCreate
    setup.afterCreate?.(control);
  }
}
