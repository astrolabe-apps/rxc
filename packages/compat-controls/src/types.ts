/**
 * @react-typed-forms/core v5 — the legacy v4 type surface, re-declared
 * over the new engine.
 *
 * The runtime objects are `@rxc/controls-core` `ControlImpl`s with the legacy
 * members added by the prototype patch (see `patch.ts`); these types are the
 * static face of that patch. `Control<V>` here deliberately includes the new
 * core's snapshot surface (`valueNow`, …) as well, so a compat-typed control
 * is assignable wherever a core `Control<V>` is expected — same objects,
 * both APIs.
 *
 * Reference: `@react-typed-forms/core@4.6.0` type declarations (the last v4).
 */

import { ControlChange } from "@rxc/controls-core";
import type { Subscription } from "@rxc/controls-core";

export { ControlChange };
export type { Subscription };

// ── Setup ────────────────────────────────────────────────────────────

export type ControlValidator<V> = ((v: V) => string | undefined | null) | null;

/** Legacy allowed a thunk to break recursive setups. The new engine resolves
 * setups eagerly — thunks are called once at conversion (dev-warned). */
export type DelayedSetup<V, M = object> =
  | ControlSetup<V, M>
  | (() => ControlSetup<V, M>);

export interface ControlSetup<V, M = object> {
  validator?: ControlValidator<V>;
  /**
   * Legacy per-control equality. **Not supported** — the new engine has
   * context-level equality only. Accepted for source compatibility and
   * ignored with a dev-mode warning.
   */
  equals?: (v1: unknown, v2: unknown) => boolean;
  fields?: {
    [K in keyof NonNullable<V>]?: DelayedSetup<NonNullable<V>[K], M>;
  };
  elems?: V extends Array<infer X> ? DelayedSetup<X, M> : unknown;
  afterCreate?: (control: Control<V>) => void;
  meta?: Partial<M>;
  dontClearError?: boolean;
}

// ── Change tracking ──────────────────────────────────────────────────

/** Legacy two-arg listener. The engine invokes listeners with a third `wc`
 * argument; two-arg legacy listeners simply ignore it. */
export type ChangeListenerFunc<V> = (
  control: Control<V>,
  change: ControlChange,
) => void;

// ── Field/Element type helpers (legacy-identical) ────────────────────

type FieldsUndefined<V> = { [K in keyof V]-?: V[K] | undefined };

type FieldsMapNull<T> = undefined extends T
  ? FieldsUndefined<T>
  : null extends T
    ? FieldsUndefined<T>
    : T;

type OnlyObjects<V> = V extends string | number | boolean | Array<any>
  ? never
  : { [K in keyof V]-?: Control<V[K]> };

export type ControlFields<V> = NonNullable<OnlyObjects<FieldsMapNull<V>>>;

export type ControlElements<V> = V extends (infer A)[]
  ? Control<A>[]
  : V extends string | number | { [k: string]: any }
    ? never[]
    : NonNullable<V>;

// ── Control ──────────────────────────────────────────────────────────

export interface ControlProperties<V> {
  value: V;
  initialValue: V;
  error: string | null | undefined;
  readonly errors: { [k: string]: string };
  readonly valid: boolean;
  readonly dirty: boolean;
  disabled: boolean;
  touched: boolean;
  readonly fields: ControlFields<V>;
  readonly elements: ControlElements<V>;
  readonly isNull: boolean;
}

export interface CleanupScope {
  addCleanup(cleanup: () => void): void;
}

export interface CleanupScopeImpl extends CleanupScope {
  cleanup(): void;
}

export interface Control<V> extends ControlProperties<V>, CleanupScopeImpl {
  uniqueId: number;
  subscribe(listener: ChangeListenerFunc<V>, mask: ControlChange): Subscription;
  unsubscribe(subscription: Subscription): void;
  isEqual: (v1: unknown, v2: unknown) => boolean;
  /** Untracked snapshot view — reads collect nothing. */
  current: ControlProperties<V>;
  setError(key: string, error?: string | null): void;
  setErrors(errors?: { [k: string]: string | null | undefined } | null): void;
  setValue(cb: (v: V) => V): void;
  setValueAndInitial(v: V, iv: V): void;
  setInitialValue(v: V): void;
  setTouched(touched: boolean, notChildren?: boolean): void;
  setDisabled(disabled: boolean, notChildren?: boolean): void;
  markAsClean(): void;
  clearErrors(): void;
  validate(): boolean;
  /** The DOM element bound to this control (alias of `meta.element`). */
  element: any;
  meta: Record<string, any>;
  lookupControl(path: (string | number)[]): Control<any> | undefined;

  // ── New-core snapshot surface, so compat controls flow into new-API
  //    positions unchanged ─────────────────────────────────────────────
  readonly valueNow: V;
  readonly initialValueNow: V;
  readonly validNow: boolean;
  readonly dirtyNow: boolean;
  readonly touchedNow: boolean;
  readonly disabledNow: boolean;
  readonly errorNow: string | null | undefined;
  readonly errorsNow: Record<string, string>;
  readonly isNullNow: boolean;
  readonly elementsNow: ControlElements<V>;
  readonly fieldsNow: Record<string, Control<unknown> | undefined>;
}

export type ControlValue<C> = C extends Control<infer V> ? V : never;

/** Return type of `delayedValue` — a lazily computed value holder. */
export interface Value<V> {
  readonly value: V;
}
