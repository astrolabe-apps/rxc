/**
 * The `ControlImpl.prototype` patch — the runtime half of the compat
 * `Control<V>` type.
 *
 * Adds every legacy member to the engine's control class, so *all* controls
 * in the process (compat- or new-API-created — they are the same class)
 * carry both surfaces. Getters report to the Bridge-1 ambient collector and
 * return the engine's `*Now` snapshots; mutators funnel through the
 * Bridge-2 ambient write transaction.
 *
 * Collisions: zero — audited against `ControlImpl` (core renamed its element
 * accessor to `elementsNow` and its internal validate to `validateImpl` to
 * keep the legacy names free). A dev-mode assert below re-checks on every
 * load so a future core member can't be silently shadowed.
 */

import { ControlChange } from "@rx-controls/core";
import { ControlImpl, toImpl } from "@rx-controls/core/internal";
import { lookupControl as coreLookupControl } from "@rx-controls/core";
import type { Control as CoreControl } from "@rx-controls/core";
import {
  ambientTracing,
  collectChange,
  reportAmbientMiss,
  strictAmbient,
  traceAmbient,
} from "./ambient.js";
import { runInWc } from "./transactions.js";
import type { Control, ControlProperties } from "./types.js";

declare const process: { env: { NODE_ENV?: string } } | undefined;
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const CLEANUP_KEY = "$compatCleanup";

/**
 * Report a tracked read of `impl` to the ambient collector, if one is
 * installed.
 *
 * The chokepoint for every patched legacy getter, so the no-collector branch
 * stays as cheap as it was: when strict diagnostics are off this is one
 * module-scope boolean load, and `IS_DEV` folds the whole thing away in a
 * production build.
 */
function collect(impl: ControlImpl<any>, change: ControlChange): void {
  const cb = collectChange;
  if (IS_DEV && ambientTracing)
    traceAmbient(impl as unknown as Control<any>, change, cb);
  if (cb !== undefined) cb(impl as unknown as Control<any>, change);
  else if (IS_DEV && strictAmbient)
    reportAmbientMiss(impl as unknown as Control<any>, change);
}

/**
 * Untracked snapshot view over a control — legacy `control.current`.
 * Property reads collect nothing, by contract.
 */
class ControlPropertiesSnapshot<V> implements ControlProperties<V> {
  constructor(private readonly impl: ControlImpl<V>) {}

  get value(): V {
    return this.impl.valueNow;
  }
  get initialValue(): V {
    return this.impl.initialValueNow;
  }
  get error(): string | null | undefined {
    return this.impl.errorNow;
  }
  get errors(): { [k: string]: string } {
    return this.impl.errorsNow;
  }
  get valid(): boolean {
    return this.impl.validNow;
  }
  get dirty(): boolean {
    return this.impl.dirtyNow;
  }
  get disabled(): boolean {
    return this.impl.disabledNow;
  }
  get touched(): boolean {
    return this.impl.touchedNow;
  }
  get fields() {
    return this.impl.fields as any;
  }
  get elements() {
    return this.impl.elementsNow as any;
  }
  get isNull(): boolean {
    return this.impl.isNullNow;
  }
}

type Accessor = {
  get?: (this: ControlImpl<any>) => unknown;
  set?: (this: ControlImpl<any>, v: any) => void;
  value?: (this: ControlImpl<any>, ...args: any[]) => unknown;
};

/** Every legacy member, keyed by name. */
const PATCH: Record<string, Accessor> = {
  // ── Tracked getters / assignment setters ─────────────────────────
  value: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Value);
      return this.valueNow;
    },
    set(this: ControlImpl<any>, v) {
      runInWc((wc) => wc.setValue(this as CoreControl<any>, v));
    },
  },
  initialValue: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.InitialValue);
      return this.initialValueNow;
    },
    // The legacy property setter moves the clean baseline only — unlike the
    // `setInitialValue(v)` method below, which resets value + initial.
    set(this: ControlImpl<any>, v) {
      runInWc((wc) => wc.setInitialValue(this as CoreControl<any>, v));
    },
  },
  error: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Error);
      return this.errorNow;
    },
    set(this: ControlImpl<any>, v) {
      runInWc((wc) => wc.setError(this as CoreControl<any>, "default", v));
    },
  },
  errors: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Error);
      return this.errorsNow;
    },
  },
  valid: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Valid);
      return this.validNow;
    },
  },
  dirty: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Dirty);
      return this.dirtyNow;
    },
  },
  touched: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Touched);
      return this.touchedNow;
    },
    set(this: ControlImpl<any>, v) {
      runInWc((wc) => wc.setTouched(this as CoreControl<any>, v));
    },
  },
  disabled: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Disabled);
      return this.disabledNow;
    },
    set(this: ControlImpl<any>, v) {
      runInWc((wc) => wc.setDisabled(this as CoreControl<any>, v));
    },
  },
  isNull: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Structure);
      return this.isNullNow;
    },
  },
  elements: {
    get(this: ControlImpl<any>) {
      collect(this, ControlChange.Structure);
      return this.elementsNow;
    },
  },

  // ── Untracked views ───────────────────────────────────────────────
  current: {
    get(this: ControlImpl<any>) {
      return new ControlPropertiesSnapshot(this);
    },
  },
  element: {
    get(this: ControlImpl<any>) {
      return this.meta.element ?? null;
    },
    set(this: ControlImpl<any>, v) {
      this.meta.element = v;
    },
  },
  isEqual: {
    get(this: ControlImpl<any>) {
      return (a: unknown, b: unknown) => this._ctx.equals(a, b);
    },
  },

  // ── Mutators ──────────────────────────────────────────────────────
  setValue: {
    value(this: ControlImpl<any>, cb: (v: any) => any) {
      runInWc((wc) => wc.updateValue(this as CoreControl<any>, cb));
    },
  },
  setValueAndInitial: {
    value(this: ControlImpl<any>, v: any, iv: any) {
      runInWc((wc) => wc.setValueAndInitial(this as CoreControl<any>, v, iv));
    },
  },
  // Legacy `setInitialValue(v)` is `setValueAndInitial(v, v)` — a reset, not
  // a baseline move, which is what `wc.reset` is called. Do not "fix" this to
  // `wc.setInitialValue`: that now means the baseline move, and the swap
  // still compiles.
  setInitialValue: {
    value(this: ControlImpl<any>, v: any) {
      runInWc((wc) => wc.reset(this as CoreControl<any>, v));
    },
  },
  setTouched: {
    value(this: ControlImpl<any>, touched: boolean, notChildren?: boolean) {
      runInWc((wc) =>
        wc.setTouched(this as CoreControl<any>, touched, notChildren),
      );
    },
  },
  setDisabled: {
    value(this: ControlImpl<any>, disabled: boolean, notChildren?: boolean) {
      runInWc((wc) =>
        wc.setDisabled(this as CoreControl<any>, disabled, notChildren),
      );
    },
  },
  setError: {
    value(this: ControlImpl<any>, key: string, error?: string | null) {
      runInWc((wc) => wc.setError(this as CoreControl<any>, key, error));
    },
  },
  setErrors: {
    value(
      this: ControlImpl<any>,
      errors?: Record<string, string | null | undefined> | null,
    ) {
      runInWc((wc) => wc.setErrors(this as CoreControl<any>, errors));
    },
  },
  markAsClean: {
    value(this: ControlImpl<any>) {
      runInWc((wc) => wc.markClean(this as CoreControl<any>));
    },
  },
  clearErrors: {
    value(this: ControlImpl<any>) {
      runInWc((wc) => wc.clearErrors(this as CoreControl<any>));
    },
  },
  validate: {
    value(this: ControlImpl<any>): boolean {
      return runInWc((wc) => wc.validate(this as CoreControl<any>));
    },
  },

  // ── Navigation / cleanup ──────────────────────────────────────────
  lookupControl: {
    value(this: ControlImpl<any>, path: (string | number)[]) {
      return coreLookupControl(this as CoreControl<any>, path);
    },
  },
  // Type-level widening cast; the runtime is the identity, as in legacy.
  as: {
    value(this: ControlImpl<any>) {
      return this;
    },
  },
  addCleanup: {
    value(this: ControlImpl<any>, cleanup: () => void) {
      ((this.meta[CLEANUP_KEY] ??= []) as (() => void)[]).push(cleanup);
    },
  },
  cleanup: {
    value(this: ControlImpl<any>) {
      const list = this.meta[CLEANUP_KEY] as (() => void)[] | undefined;
      if (list) {
        delete this.meta[CLEANUP_KEY];
        list.forEach((fn) => fn());
      }
      // Recurse into children, as legacy's `cleanup()` does via
      // `_logic.withChildren`. Callers clean up a subtree by calling this on
      // its root — `@astroapps/forms-core` detaches an array element by
      // calling `cleanup()` on the element's base control, and the effects
      // and evaluators being torn down are registered on *descendant*
      // controls. Without the recursion nothing below the root was released.
      //
      // Only exclusively-owned children: a control attached to more than one
      // parent (`attachFields`/`controlGroup`) is shared, so tearing it down
      // from one parent would pull it out from under the others. Legacy
      // guards this the same way, with `parents?.length == 1`.
      // `cleanup` is installed by this patch, so it is not on the core type.
      const recurse = (c: ControlImpl<any>) => {
        if (c._parents?.length === 1)
          (c as unknown as { cleanup(): void }).cleanup();
      };
      if (this._fields) for (const k in this._fields) recurse(this._fields[k]);
      this._elems?.forEach(recurse);
    },
  },
};

// Guard against a second copy of this module re-patching (or a bundler
// duplicating the package): a well-known symbol on the prototype.
const PATCHED = Symbol.for("@react-typed-forms/core/compat-patched");

export function ensurePatched(): void {
  const proto = ControlImpl.prototype as any;
  if (proto[PATCHED]) return;
  proto[PATCHED] = true;
  for (const [name, acc] of Object.entries(PATCH)) {
    if (IS_DEV && name in proto) {
      // eslint-disable-next-line no-console
      console.error(
        `[@react-typed-forms/core] ControlImpl already defines "${name}" — ` +
          `the compat patch would shadow a core member. The core contract ` +
          `is that every legacy name stays free (see COMPAT-CONTROLS-DESIGN.md ` +
          `"Collisions audit"); skipping this member.`,
      );
      continue;
    }
    Object.defineProperty(
      proto,
      name,
      acc.value !== undefined
        ? { value: acc.value, writable: true, configurable: true }
        : { get: acc.get, set: acc.set, configurable: true },
    );
  }
}

ensurePatched();

/**
 * View a core control through the legacy surface.
 *
 * Purely a cast, with no runtime component — the prototype patch above
 * applies to `ControlImpl` itself, so *every* control in the process carries
 * both APIs regardless of which `ControlContext` minted it, and the legacy
 * mutators funnel through a context-free `WriteContextImpl`. This direction
 * needs a cast only because a core `Control<V>` declares none of the legacy
 * members; the opposite direction is structurally assignable and needs
 * nothing (see `types.ts`).
 *
 * **Reads through the returned control are collected ambiently**, like every
 * other legacy read: they register a dependency only inside
 * `useComponentTracking` / `collectChanges` / `withAmbient`. Reading one from
 * an `@rx-controls/react` `useReactive()` body subscribes to *nothing* and
 * the component will not re-render — pass the control to `rc.getValue(…)`
 * there instead, which it is already assignable to.
 */
export function asLegacy<V>(c: CoreControl<V>): Control<V> {
  return c as unknown as Control<V>;
}

/**
 * View a legacy-typed control through the new core surface.
 *
 * Now redundant for ordinary call sites — a compat `Control<V>` is assignable
 * to a core `Control<V>` directly. Kept for generic positions where the
 * relation can't be inferred, and as the explicit spelling of intent.
 */
export function asCore<V>(c: Control<V>): CoreControl<V> {
  return c;
}

export { toImpl };
