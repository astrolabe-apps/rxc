import { useEffect, useLayoutEffect, useRef } from "react";
import type { Control } from "@rx-controls/core";
import { deepEquals, effect, untrackedRead } from "@rx-controls/core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
} from "@rx-controls/core/internal";
import { useControl, useControlContext } from "@rx-controls/react";
import type { FormProp, Validator, ValidatorResult } from "./types.js";
import type { ValidationScope } from "./validationScope.js";
import { getProp } from "./prop.js";
import type { ScopeState } from "./scope.js";

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
 * **Errors are keyed per control; validators are per boundary.** Two
 * boundaries binding one control — the field the modal shows *is* the field
 * (finding 43), a select and a radio over one status, a branch that requires
 * what another region merely shows — each run their own `required` and each
 * publish a verdict, and if they share a key the last writer wins on a
 * timing that nothing controls. The framework's own key therefore carries
 * the boundary's id, so a boundary clears only what it set; a `required` on
 * one boundary survives a `required: false` (or a hidden) sibling on the
 * same control. Author keys stay as written — legacy's `jsonata` is still
 * `jsonata` — since two authored validators under one name on one control is
 * the author's collision to resolve. README finding 58.
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
  /** The boundary's id — namespaces the framework's `required` key. */
  owner = "",
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
      const errorKey = key === "required" ? `required@${owner}` : key;
      const rc = new TrackingReadContext();
      const reconciler = new SubscriptionReconciler();
      let runId = 0;
      let release: (() => void) | undefined;
      const settle = () => {
        release?.();
        release = undefined;
      };
      const publish = (m: ValidatorResult) =>
        ctx.update((wc) => wc.setError(control, errorKey, m ?? null));
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
        ctx.update((wc) => wc.setError(control, errorKey, null));
      };
    });
    return () => disposers.forEach((d) => d());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, control, cfg, keyId, scope, owner]);
}

/**
 * Legacy's default-value cycle (`formStateNode.ts`), as a core `effect` so it
 * costs the component no re-render: while the field is not hidden and its
 * value is `undefined`, write the default. Re-runs when presence, value or
 * the default move — so after `clearHidden` wipes a hidden field, showing it
 * again defaults it again. `null` is a value and is left alone, as legacy
 * left it. `enabled` is the boundary's `writes` flag: a display-only boundary
 * never writes (README finding 54, and 65).
 */
export function useDefaultValue<T>(
  control: Control<T>,
  defaultValue: FormProp<T> | undefined,
  scope: ScopeState,
  enabled: boolean,
): void {
  const ctx = useControlContext();
  useEffect(() => {
    if (!enabled || defaultValue === undefined) return;
    const h = effect(ctx, (rc) => {
      if (scope.presence(rc) === "hidden") return;
      if (rc.getValue(control) !== undefined) return;
      const d = getProp(rc, defaultValue);
      if (d === undefined || d === null) return;
      ctx.update((wc) => wc.setValue(control, d));
    });
    return () => h.cleanup();
  }, [ctx, control, defaultValue, scope, enabled]);
}
