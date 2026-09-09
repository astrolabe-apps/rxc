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

import { ControlChange } from "@rxc/controls-core";
import { ControlImpl, toImpl } from "@rxc/controls-core/internal";
import { lookupControl as coreLookupControl } from "@rxc/controls-core";
import type { Control as CoreControl } from "@rxc/controls-core";
import { collectChange } from "./ambient.js";
import { runInWc } from "./transactions.js";
import type { Control, ControlProperties } from "./types.js";

declare const process: { env: { NODE_ENV?: string } } | undefined;
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const CLEANUP_KEY = "$compatCleanup";

/** Report a tracked read of `impl` to the ambient collector, if one is
 * installed. */
function collect(impl: ControlImpl<any>, change: ControlChange): void {
  collectChange?.(impl as unknown as Control<any>, change);
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
      runInWc((wc) => wc.setInitialValueOnly(this as CoreControl<any>, v));
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
  // a baseline move. `wc.setInitialValue` carries the same meaning.
  setInitialValue: {
    value(this: ControlImpl<any>, v: any) {
      runInWc((wc) => wc.setInitialValue(this as CoreControl<any>, v));
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
      if (!list) return;
      delete this.meta[CLEANUP_KEY];
      list.forEach((fn) => fn());
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

/** View a core control through the legacy surface. Purely a cast — the
 * prototype patch means every control already has both APIs. */
export function asLegacy<V>(c: CoreControl<V>): Control<V> {
  return c as unknown as Control<V>;
}

/** View a legacy-typed control through the new core surface. */
export function asCore<V>(c: Control<V>): CoreControl<V> {
  return c as unknown as CoreControl<V>;
}

export { toImpl };
