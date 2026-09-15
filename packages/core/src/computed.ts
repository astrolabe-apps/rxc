import type { Control, ControlContext, ReadContext } from "./types.js";
import { TrackingReadContext, SubscriptionReconciler } from "./readContextImpl.js";

export interface ComputedHandle extends SubscriptionReconciler {
  replaceCompute(newCompute: (rc: ReadContext) => any): void;
}

/**
 * Creates a reactive computation that tracks dependencies via ReadContext
 * and writes the result to a target control. Re-runs when any dependency changes.
 *
 * Returns a ComputedHandle (extends SubscriptionReconciler) for lifecycle management:
 * - Non-React: call reconciler.cleanup() to dispose
 * - React: use controlContext.releaseTracker/retainTracker for strict mode safety
 * - Call replaceCompute(fn) to swap the compute function and re-run
 */
export function computeInto<V>(
  ctx: ControlContext,
  target: Control<V>,
  compute: (rc: ReadContext) => V,
): ComputedHandle {
  const rc = new TrackingReadContext();
  const reconciler = new SubscriptionReconciler() as ComputedHandle;

  let currentCompute: (rc: ReadContext) => V = compute;

  function run() {
    rc.beginTracking();
    const value = currentCompute(rc);
    reconciler.reconcile(rc.tracked);
    ctx.update((wc) => wc.setValue(target, value));
  }

  reconciler.replaceCompute = (newCompute: (rc: ReadContext) => any) => {
    if (newCompute !== currentCompute) {
      currentCompute = newCompute;
      run();
    }
  };

  reconciler.setListener(() => run());
  run();

  return reconciler;
}

export interface EffectHandle extends SubscriptionReconciler {
  replaceEffect(newFn: (rc: ReadContext) => (() => void) | void): void;
  /**
   * Run the effect again now, re-tracking its dependencies.
   *
   * For hosts whose effect body closes over state the reactive graph knows
   * nothing about — React props, a callback identity — so a change there has
   * to be pushed in rather than observed. `replaceEffect` covers the case
   * where the function itself is swapped; this covers the case where the same
   * function needs to see fresh surroundings.
   */
  rerun(): void;
}

/**
 * Creates a reactive effect that tracks dependencies via ReadContext and
 * re-runs when any dependency changes. Like computeInto() but for side effects —
 * no target control, no return value written.
 *
 * If the effect function returns a cleanup function, it's called before each
 * re-run and on dispose.
 */
export function effect(
  ctx: ControlContext,
  fn: (rc: ReadContext) => (() => void) | void,
): EffectHandle {
  const rc = new TrackingReadContext();
  const reconciler = new SubscriptionReconciler() as EffectHandle;

  let currentFn = fn;
  let cleanupFn: (() => void) | void;

  function run() {
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = undefined;
    }
    rc.beginTracking();
    cleanupFn = currentFn(rc);
    reconciler.reconcile(rc.tracked);
  }

  reconciler.replaceEffect = (newFn: (rc: ReadContext) => (() => void) | void) => {
    if (newFn !== currentFn) {
      currentFn = newFn;
      run();
    }
  };

  reconciler.rerun = run;

  const origCleanup = reconciler.cleanup.bind(reconciler);
  reconciler.cleanup = () => {
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = undefined;
    }
    origCleanup();
  };

  reconciler.setListener(() => run());
  run();

  return reconciler;
}
