import type {ControlContextInternal} from "./controlImpl";
import {ControlFlags, ControlImpl, noopNotify,} from "./controlImpl";
import type {Control, ControlContext, ControlSetup, WriteContext} from "./types";
import {ControlChange} from "./types";
import {WriteContextImpl} from "./writeContextImpl";
import {deepEquals} from "./deepEquals";
import type {SubscriptionReconciler} from "./readContextImpl";

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

  newControl<V>(value: V, setup?: ControlSetup<V>): Control<V> {
    const ctx = this.buildChildContext(setup);
    const control = new ControlImpl<V>(value, value, ControlFlags.None, ctx);
    if (setup) {
      this.initControl(control, setup);
    }
    return control;
  }

  update(cb: (wc: WriteContext) => void): void {
    const wc = new WriteContextImpl();
    cb(wc);
    wc.flush();
  }

  markTrackerDead(reconciler: SubscriptionReconciler): void {
    reconciler.alive = false;
    this.deadTrackers.add(reconciler);
    this.scheduleSweep();
  }

  reviveTracker(reconciler: SubscriptionReconciler): void {
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

  private buildChildContext(setup?: ControlSetup<any>): ControlContextInternal {
    const self = this;
    return {
      equals: this.equals,
      newControl: (value, setup?) => this.newControl(value, setup),
      createChild(value, initialValue, flags, fieldKey?) {
        const fieldSetup = fieldKey ? (setup?.fields as any)?.[fieldKey] : setup?.elems;
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

  private initControl(control: ControlImpl, setup: ControlSetup<any>): void {
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
        const fieldSetup = (setup.fields as any)[k] as ControlSetup<any> | undefined;
        if (fieldSetup?.validator !== undefined) {
          control.getField(k);
        }
      }
    }

    // 3. Eager element init
    if (setup.elems) {
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
