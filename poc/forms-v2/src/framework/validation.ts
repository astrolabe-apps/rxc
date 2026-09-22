import { useLayoutEffect, useRef } from "react";
import type { Control } from "@rx-controls/core";
import { deepEquals, untrackedRead } from "@rx-controls/core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
} from "@rx-controls/core/internal";
import { useControl, useControlContext } from "@rx-controls/react";
import type { Validator, ValidatorResult } from "./types.js";
import type { ValidationScope } from "./validationScope.js";

export interface ValidationConfig {
  active: boolean;
  required: boolean;
  requiredMessage: string;
}

/**
 * Mirror a render-time value onto a control, so code running in some *other*
 * tracking window (here: a validator's) re-runs when it moves.
 *
 * The write happens in the render body, which `docs/RENDER-BOUNDARY.md`
 * sanctions: it converges because `setValue` bails on `ControlContext.equals`.
 */
export function useMirror<V>(value: V): Control<V> {
  const ctx = useControlContext();
  const control = useControl<V>(value);
  if (!deepEquals(untrackedRead.getValue(control), value))
    ctx.update((wc) => wc.setValue(control, value));
  return control;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Register the field's validators. Runs in the **boundary**, so an
 * implementation cannot see one and therefore cannot drop one — and it keeps
 * running when presence is `silent` and nothing is on screen.
 *
 * One key per validator, so each clears independently. `useValidator` from
 * `@rx-controls/react` does exactly this for a *fixed* key; the record makes
 * the key set dynamic, which is why this is hand-rolled.
 *
 * A validator may return a promise. The run's tracking window closes when the
 * function returns — reads before the first `await` are what re-run it — and
 * the result publishes on resolve unless a newer run has started, in which
 * case it is dropped. The previous error stays up until the answer lands, so
 * nothing flickers. While a promise is outstanding the field counts as
 * *pending* in `scope` and every scope above it; that is what `settled()`
 * waits on. No debounce here — that is the validator's own business.
 */
export function useFieldValidation<T>(
  control: Control<T>,
  validate: Validator<T> | Record<string, Validator<T>> | undefined,
  cfg: Control<ValidationConfig>,
  scope?: ValidationScope,
): void {
  const ctx = useControlContext();
  const entries: Record<string, Validator<T>> = typeof validate === "function"
    ? { default: validate }
    : (validate ?? {});

  const ref = useRef(entries);
  ref.current = entries;

  const keys = ["required", ...Object.keys(entries)];
  const keyId = keys.join("|");

  useLayoutEffect(() => {
    const disposers = keys.map((key) => {
      const rc = new TrackingReadContext();
      const reconciler = new SubscriptionReconciler();
      let runId = 0;
      let release: (() => void) | undefined;
      const settle = () => {
        release?.();
        release = undefined;
      };
      const publish = (m: ValidatorResult) =>
        ctx.update((wc) => wc.setError(control, key, m ?? null));
      const run = () => {
        // A newer run supersedes an outstanding one: it stops counting as
        // pending now, and its answer is dropped when it arrives.
        settle();
        const id = ++runId;
        rc.beginTracking();
        rc.trackValidate(control);
        const { active, required, requiredMessage } = rc.getValue(cfg);
        const value = rc.getValue(control);
        let result: ValidatorResult | Promise<ValidatorResult> = null;
        if (active) {
          if (key === "required")
            result = required && isEmpty(value) ? requiredMessage : null;
          else result = ref.current[key]?.(value, rc);
        }
        reconciler.reconcile(rc.tracked);
        // Reads after an `await` land here — past the window, untracked.
        rc.finalize();
        if (result instanceof Promise) {
          release = scope?.beginPending();
          result.then(
            (m) => {
              if (id !== runId) return;
              settle();
              publish(m);
            },
            (e) => {
              if (id !== runId) return;
              settle();
              publish(null);
              console.error(`validator "${key}" rejected`, e);
            },
          );
        } else publish(result);
      };
      reconciler.setListener(run);
      run();
      return () => {
        runId++; // drop any answer still in flight
        settle();
        reconciler.cleanup();
        ctx.update((wc) => wc.setError(control, key, null));
      };
    });
    return () => disposers.forEach((d) => d());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, control, cfg, keyId, scope]);
}
