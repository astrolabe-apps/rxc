"use client";

import { useEffect, useRef } from "react";
import { untrackedRead } from "@rxc/controls-core";
import type { Control, ReadContext } from "@rxc/controls-core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
} from "@rxc/controls-core/internal";
import { useControlContext } from "./useControls.js";
import { useControlEffect } from "./useControlEffect.js";

/**
 * Attach a validator to a control for this component's lifetime.
 *
 * The dynamic counterpart of `ControlOptions.validator`, with the same
 * publication contract: the error (under `key`) is computed immediately,
 * recomputed when anything the validator read changes, and **re-published on
 * `WriteContext.validate()`** — so an error cleared externally (e.g.
 * `clearErrors`) comes back on the next validate pass, exactly like a setup
 * validator's. On unmount the key is cleared, so a conditionally rendered
 * component doesn't leave its error behind.
 *
 * The validator receives an `rc`; reads through it (other controls, for
 * cross-field rules) are tracked, so this re-runs when they change too:
 *
 * ```tsx
 * useValidator(confirm, (v, rc) =>
 *   v === rc.getValue(password) ? null : "Passwords must match",
 * );
 * ```
 *
 * The latest `validator` is always used. `control` and `key` are fixed at
 * mount — remount (`key` prop) to re-point the hook.
 */
export function useValidator<V>(
  control: Control<V>,
  validator: (value: V, rc: ReadContext) => string | null | undefined,
  key: string = "default",
): void {
  const ctx = useControlContext();
  const validatorRef = useRef(validator);
  validatorRef.current = validator;

  const state = useRef<{
    run: () => void;
    reconciler: SubscriptionReconciler;
  } | null>(null);
  if (!state.current) {
    const rc = new TrackingReadContext();
    const reconciler = new SubscriptionReconciler();
    const run = () => {
      rc.reset();
      // Re-run (and re-publish) on validate() broadcasts, like the
      // built-in `ControlOptions.validator` subscription (Value | Validate).
      rc.trackValidate(control);
      const message = validatorRef.current(rc.getValue(control), rc);
      reconciler.reconcile(rc.tracked);
      ctx.update((wc) => wc.setError(control, key, message));
    };
    reconciler.setListener(run);
    run();
    state.current = { run, reconciler };
  }
  const { run, reconciler } = state.current;

  useEffect(() => {
    ctx.retainTracker(reconciler);
    // Republish: a StrictMode unmount/remount cycle ran the cleanup below,
    // clearing the key, before this second setup.
    run();
    return () => {
      ctx.releaseTracker(reconciler);
      ctx.update((wc) => wc.setError(control, key, null));
    };
    // control/key are fixed at mount by contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, reconciler]);
}

/**
 * Attach a debounced, abortable async validator to a control.
 *
 * Watches `validCheckValue` (by default the control's value); when it
 * changes, waits `delay` ms — restarting on further changes and aborting any
 * in-flight run — then calls `validator`. The result is published to the
 * control's default error key (and the control marked touched, so it shows)
 * only if the watched value is still current when it arrives; a stale result
 * is dropped.
 *
 * ```tsx
 * useAsyncValidator(username, async (c, signal) => {
 *   const taken = await checkUsername(c.valueNow, signal);
 *   return taken ? "Username is taken" : null;
 * }, 500);
 * ```
 *
 * The `AbortSignal` is aborted when the run is superseded or the component
 * unmounts — pass it to `fetch` (or check it) so abandoned runs stop.
 */
export function useAsyncValidator<V>(
  control: Control<V>,
  validator: (
    control: Control<V>,
    abortSignal: AbortSignal,
  ) => Promise<string | null | undefined>,
  delay: number,
  validCheckValue: (rc: ReadContext, control: Control<V>) => unknown = (
    rc,
    c,
  ) => rc.getValue(c),
): void {
  const ctx = useControlContext();
  const validatorRef = useRef(validator);
  validatorRef.current = validator;
  const checkRef = useRef(validCheckValue);
  checkRef.current = validCheckValue;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aborter = useRef<AbortController | null>(null);

  useControlEffect(
    (rc) => checkRef.current(rc, control),
    (version) => {
      if (timer.current != null) clearTimeout(timer.current);
      aborter.current?.abort();
      timer.current = setTimeout(() => {
        const controller = new AbortController();
        aborter.current = controller;
        validatorRef.current(control, controller.signal).then(
          (error) => {
            if (controller.signal.aborted) return;
            // Only publish for the value that was validated.
            const live = checkRef.current(untrackedRead, control);
            if (ctx.equals(live, version)) {
              ctx.update((wc) => {
                wc.setTouched(control, true);
                wc.setError(control, "default", error);
              });
            }
          },
          (e) => {
            // Aborted runs reject with AbortError by convention; anything
            // else is a real failure the console should show.
            if (!(e instanceof DOMException && e.name === "AbortError")) {
              throw e;
            }
          },
        );
      }, delay);
    },
  );

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
      aborter.current?.abort();
    },
    [],
  );
}
