import { useLayoutEffect, useRef } from "react";
import type { Control } from "@rx-controls/core";
import { deepEquals, untrackedRead } from "@rx-controls/core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
} from "@rx-controls/core/internal";
import { useControl, useControlContext } from "@rx-controls/react";
import type { Validator } from "./types.js";

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
 */
export function useFieldValidation<T>(
  control: Control<T>,
  validate: Validator<T> | Record<string, Validator<T>> | undefined,
  cfg: Control<ValidationConfig>,
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
      const run = () => {
        rc.beginTracking();
        rc.trackValidate(control);
        const { active, required, requiredMessage } = rc.getValue(cfg);
        const value = rc.getValue(control);
        let message: string | null | undefined = null;
        if (active) {
          if (key === "required")
            message = required && isEmpty(value) ? requiredMessage : null;
          else message = ref.current[key]?.(value, rc);
        }
        reconciler.reconcile(rc.tracked);
        ctx.update((wc) => wc.setError(control, key, message ?? null));
      };
      reconciler.setListener(run);
      run();
      return () => {
        reconciler.cleanup();
        ctx.update((wc) => wc.setError(control, key, null));
      };
    });
    return () => disposers.forEach((d) => d());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, control, cfg, keyId]);
}
