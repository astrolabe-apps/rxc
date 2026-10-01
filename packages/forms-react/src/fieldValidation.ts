import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import {
  deepEquals,
  effect,
  ensureMetaValue,
  untrackedRead,
} from "@rx-controls/core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
} from "@rx-controls/core/internal";
import { useControl, useControlContext } from "@rx-controls/react";
import type { Validator, ValidatorResult } from "./field.js";
import { getProp, type FormProp } from "./props.js";
import type { ScopeState } from "./scope.js";
import type { ValidationScopeImpl } from "./validationScope.js";

/**
 * `useLayoutEffect` on the client, `useEffect` on the server. Validation
 * publishes in the commit phase, before paint, so a sibling that rendered
 * first still sees the error on screen; on the server nothing commits, so a
 * passive effect is all it needs there.
 */
const useCommitEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

/*
 * The field boundary's validation engine. Not exported from the package; the
 * loader reaches `useDefaultValue` and `hiddenPending` through
 * `@rx-controls/forms-react/internal`.
 */

/** What a field's validators need from its boundary, as one mirrored value. */
export interface ValidationConfig {
  /** Shown and not pending: only then does anything validate. */
  active: boolean;
  required: boolean;
  requiredMessage: string;
}

/**
 * Mirror a render-time value onto a control, so code running in another
 * tracking window — a validator's — re-runs when it moves. The write happens
 * in the render body, which converges because `setValue` bails on equality.
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

/** The key the framework's `required` is published under: per boundary. */
export function requiredKey(owner: string): string {
  return `required@${owner}`;
}

/**
 * The key a bare-function `validate` is published under: per boundary, like
 * `required`. Never a plain `"default"` — the key hosts conventionally put a
 * server's rejection under, which a boundary claiming it would swallow — and
 * never shared by two boundaries on one control.
 */
export function bareValidatorKey(owner: string): string {
  return `default@${owner}`;
}

/**
 * Run a boundary's validators. In the boundary, so no implementation can see
 * one and therefore none can drop one — and it runs while presence is
 * `silent` and nothing is on screen.
 *
 * One key per validator, so each clears independently. Errors live on the
 * control and validators on the boundary, and one control is often bound by
 * two boundaries, so the framework's own `required` key carries the
 * boundary's id: a boundary clears only what it set — and so does a bare
 * validator's, which has no key of its own to keep. Author keys stay as
 * written.
 *
 * Each result is published twice: onto the data control, so the field's data
 * carries every error and `valid` on it means "the data is valid"; and onto
 * `verdict`, the boundary's own control, which is what it registers with its
 * validation scope and what it displays. A scope and a field therefore judge
 * only the rules written in them. Errors *no* boundary claims — a server
 * rejection set by hand — are about the value, so every boundary showing the
 * field copies them into its verdict while it is validating.
 *
 * A validator may return a promise. The run's tracking window closes when the
 * function returns — reads before the first `await` are what re-run it — and
 * the result publishes on resolve unless a newer run has started, in which
 * case it is dropped. The previous error stays up until the answer lands.
 * While a promise is outstanding the field is pending in `scope` and every
 * scope above it.
 */
export function useFieldValidation<T>(
  control: Control<T>,
  validate: Validator<T> | Record<string, Validator<T>> | undefined,
  cfg: Control<ValidationConfig>,
  scope: ValidationScopeImpl | undefined,
  owner: string,
  verdict: Control<unknown>,
): void {
  const ctx = useControlContext();
  const entries: Record<string, Validator<T>> =
    typeof validate === "function"
      ? { [bareValidatorKey(owner)]: validate }
      : (validate ?? {});

  const ref = useRef(entries);
  ref.current = entries;

  const keys = ["required", ...Object.keys(entries)];
  const keyId = JSON.stringify(keys);

  useCommitEffect(() => {
    const disposers = (JSON.parse(keyId) as string[]).map((key) => {
      const errorKey = key === "required" ? requiredKey(owner) : key;
      const rc = new TrackingReadContext();
      const reconciler = new SubscriptionReconciler();
      let runId = 0;
      let release: (() => void) | undefined;
      const settle = () => {
        release?.();
        release = undefined;
      };
      const publish = (m: ValidatorResult) =>
        ctx.update((wc) => {
          wc.setError(control, errorKey, m ?? null);
          wc.setError(verdict, errorKey, m ?? null);
        });
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
        // Reads after an `await` land past the window, untracked.
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
        ctx.update((wc) => {
          wc.setError(control, errorKey, null);
          wc.setError(verdict, errorKey, null);
        });
      };
    });
    return () => disposers.forEach((d) => d());
  }, [ctx, control, cfg, keyId, scope, owner, verdict]);

  // Claim this boundary's keys on the control, and mirror what nobody claims.
  const ownId = JSON.stringify(
    keys.map((k) => (k === "required" ? requiredKey(owner) : k)),
  );
  useCommitEffect(() => {
    const claims = errorClaims(ctx, control);
    const own = JSON.parse(ownId) as string[];
    ctx.update((wc) =>
      wc.updateValue(claims, (c) => {
        const next = { ...c };
        for (const k of own) next[k] = (next[k] ?? 0) + 1;
        return next;
      }),
    );
    let copied = new Set<string>();
    const mirror = effect(ctx, (rc) => {
      const active = rc.getValue(cfg).active;
      const claimed = rc.getValue(claims);
      const errors = rc.getErrors(control);
      const now = new Set(
        active
          ? Object.keys(errors).filter((k) => errors[k] && !claimed[k])
          : [],
      );
      ctx.update((wc) => {
        for (const k of copied) if (!now.has(k)) wc.setError(verdict, k, null);
        for (const k of now) wc.setError(verdict, k, errors[k]);
      });
      copied = now;
    });
    return () => {
      mirror.cleanup();
      ctx.update((wc) => {
        for (const k of copied) wc.setError(verdict, k, null);
        wc.updateValue(claims, (c) => {
          const next = { ...c };
          for (const k of own) if (--next[k] <= 0) delete next[k];
          return next;
        });
      });
    };
  }, [ctx, control, cfg, ownId, verdict]);
}

/**
 * The error keys some mounted boundary publishes on a control, counted — two
 * boundaries may share an author key. Anything on the control outside this
 * set was set by hand, and counts for every boundary showing it.
 */
function errorClaims(
  ctx: ControlContext,
  control: Control<unknown>,
): Control<Record<string, number>> {
  return ensureMetaValue(control, "$errorClaims", () =>
    ctx.newControl<Record<string, number>>({}),
  );
}

/**
 * What a boundary last cleared its own binding to — so the default cycle can
 * refill a value the boundary itself emptied, and leave alone one the user
 * did. `undefined` once the value has moved off it.
 */
export type ClearedTo = RefObject<{ value: unknown } | undefined>;

/**
 * Clear a boundary's binding when it is hidden under `clearHidden`: write
 * `clearTo` (default `undefined`) and mark it in `cleared`. `clearTo` is read
 * through a ref, so an inline array or object does not re-run the effect.
 */
export function useClearHidden<T>(
  control: Control<T>,
  clear: boolean,
  clearTo: T | undefined,
  cleared: ClearedTo,
): void {
  const ctx = useControlContext();
  const to = useRef(clearTo);
  to.current = clearTo;
  useEffect(() => {
    if (!clear) return;
    cleared.current = { value: to.current };
    ctx.update((wc) => wc.setValue(control, to.current as T));
  }, [clear, control, ctx, cleared]);
}

/**
 * The default-value cycle, as a core `effect` so it costs the component no
 * re-render: while the scope is not `hidden`, `hidden` is not pending and the
 * value is empty, write the default. Empty is `undefined` — or, when the
 * boundary cleared it to a `clearTo` (`cleared`), that value while it is
 * still there: an emptied field refills on reveal, while a `""` the user
 * typed does not. Re-runs when presence, value or
 * the default move — so after `clearHidden` empties a hidden field, showing it
 * again defaults it again. `null` is a value and is left alone. `enabled` is
 * the boundary's `writes` flag: a boundary that only shows its value never
 * writes it.
 */
export function useDefaultValue<T>(
  control: Control<T>,
  defaultValue: FormProp<T> | undefined,
  scope: ScopeState,
  enabled: boolean,
  hidden?: FormProp<boolean | undefined>,
  cleared?: ClearedTo,
): void {
  const ctx = useControlContext();
  useEffect(() => {
    if (!enabled || defaultValue === undefined) return;
    const h = effect(ctx, (rc) => {
      if (scope.presence(rc) === "hidden") return;
      if (hiddenPending(rc, hidden)) return;
      const v = rc.getValue(control);
      if (v !== undefined) {
        const mark = cleared?.current;
        if (!mark || !ctx.equals(v, mark.value)) {
          if (cleared) cleared.current = undefined;
          return;
        }
      }
      const d = getProp(rc, defaultValue);
      if (d === undefined || d === null) return;
      // Refilled: the boundary's clear is spent, so the same empty value
      // written later is the user's.
      if (cleared) cleared.current = undefined;
      ctx.update((wc) => wc.setValue(control, d));
    });
    return () => h.cleanup();
  }, [ctx, control, defaultValue, scope, enabled, hidden, cleared]);
}

/** An asynchronous `hidden` that has not answered yet. */
export function hiddenPending(
  rc: ReadContext,
  hidden: FormProp<boolean | undefined> | undefined,
): boolean {
  return hidden !== undefined && getProp(rc, hidden) === undefined;
}

/**
 * Clear a value when the widget's own list **moves away from it** — the
 * value was among the last decided list and is not among this one (the state
 * changed; the old state's agency is not an option now). Not "whenever the
 * value is not listed": a value that arrives outside the list — loaded
 * before a host's effect fills the options, written by a host, a choice an
 * older version of the form offered — is the data's and is kept, as legacy
 * keeps it. Only a move the boundary saw does anything, so it never races
 * the host code or `clearHidden` that reshape a list during mount.
 *
 * As a core `effect`, like the default cycle, so it costs no re-render, and
 * with the same gates: never while `hidden` (that is `clearHidden`'s), while
 * `hidden` is pending, while locked (a read-only or disabled form shows data,
 * it does not repair it), in design mode, or for a boundary that does not
 * write. The last decided list is tracked through the gates, so a move made
 * while gated is a move all the same. `null` and `undefined` are no choice.
 * `allowed` is read through a ref so a fresh closure each render does not
 * re-create the effect.
 */
export function useRestrictToAllowed<T>(
  control: Control<T>,
  allowed: (rc: ReadContext) => ((value: T) => boolean) | undefined,
  scope: ScopeState,
  enabled: boolean,
  hidden?: FormProp<boolean | undefined>,
  clearTo?: T,
  cleared?: ClearedTo,
): void {
  const ctx = useControlContext();
  const latest = useRef(allowed);
  latest.current = allowed;
  const to = useRef(clearTo);
  to.current = clearTo;
  useEffect(() => {
    if (!enabled || scope.designMode) return;
    // The last decided list; a pending one in between keeps it.
    let last: ((value: T) => boolean) | undefined;
    const h = effect(ctx, (rc) => {
      const ok = latest.current(rc);
      const prev = last;
      if (ok !== undefined) last = ok;
      if (ok === undefined || prev === undefined) return;
      if (scope.presence(rc) === "hidden") return;
      if (hiddenPending(rc, hidden)) return;
      if (scope.disabled(rc) || scope.readOnly(rc) || rc.isDisabled(control))
        return;
      const v = rc.getValue(control);
      if (v === undefined || v === null) return;
      // Moved away: listed before, not now. Cleared to `clearTo`, and marked
      // so the default cycle refills it.
      if (prev(v) && !ok(v)) {
        if (cleared) cleared.current = { value: to.current };
        ctx.update((wc) => wc.setValue(control, to.current as T));
      }
    });
    return () => h.cleanup();
  }, [ctx, control, scope, enabled, hidden, cleared]);
}
