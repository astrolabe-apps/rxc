/**
 * @astroapps/controls — type spec
 *
 * This file defines the public API for the core controls package.
 * See also: react-types.ts for the @astroapps/controls-react spec.
 */

// ── Value types ──────────────────────────────────────────────────────

export type ControlValidator<V> = ((v: V) => string | undefined | null) | null;

export interface ControlSetup<V> {
  validator?: ControlValidator<V>;
  fields?: {
    [K in keyof NonNullable<V>]?: ControlSetup<NonNullable<V>[K]>;
  };
  elems?: V extends Array<infer X> ? ControlSetup<X> : unknown;
  afterCreate?: (control: Control<V>) => void;
  meta?: Record<string, unknown>;
  dontClearError?: boolean;
}

// ── Change tracking ──────────────────────────────────────────────────

export enum ControlChange {
  None = 0,
  Valid = 1,
  Touched = 2,
  Dirty = 4,
  Disabled = 8,
  Value = 16,
  InitialValue = 32,
  Error = 64,
  All = Value | Valid | Touched | Disabled | Error | Dirty | InitialValue,
  Structure = 128,
  Validate = 256,
}

export type ChangeListenerFunc<V> = (
  control: Control<V>,
  change: ControlChange,
  wc: WriteContext,
) => void;

export type Subscription = {
  mask: ControlChange;
  listener: ChangeListenerFunc<any>;
};

// ── Field/Element type helpers ───────────────────────────────────────

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

export interface Control<V> {
  readonly uniqueId: number;

  // Snapshot reads (no subscription, no side effects)
  readonly valueNow: V;
  readonly initialValueNow: V;
  readonly validNow: boolean;
  readonly dirtyNow: boolean;
  readonly touchedNow: boolean;
  readonly disabledNow: boolean;
  readonly errorNow: string | null | undefined;
  readonly errorsNow: Record<string, string>;
  readonly isNullNow: boolean;

  // Structural navigation. `fields` lazily materializes child controls on
  // access; `elementsNow` lazily materializes the element controls for the
  // current value. Both are untracked ("Now") — subscribe to structure via
  // `rc.getElements` in reactive scopes.
  readonly fields: ControlFields<V>;
  readonly elementsNow: ControlElements<V>;

  // Snapshot structural read (no lazy creation): only the fields that have
  // been materialized — a field nobody has navigated to yet is absent, hence
  // `| undefined` on every lookup.
  readonly fieldsNow: Record<string, Control<unknown> | undefined>;

  // Subscriptions
  subscribe(listener: ChangeListenerFunc<V>, mask: ControlChange): Subscription;
  unsubscribe(subscription: Subscription): void;

  // Metadata
  meta: Record<string, unknown>;
}

export type ControlValue<C> = C extends Control<infer V> ? V : never;

// ── ReadContext ───────────────────────────────────────────────────────

/**
 * ReadContext — explicit reactive read context.
 * Reading through it registers a dependency on the control+property pair.
 */
export interface ReadContext {
  getValue<V>(control: Control<V>): V;
  getInitialValue<V>(control: Control<V>): V;
  isValid(control: Control<unknown>): boolean;
  isDirty(control: Control<unknown>): boolean;
  isTouched(control: Control<unknown>): boolean;
  isDisabled(control: Control<unknown>): boolean;
  isNull(control: Control<unknown>): boolean;
  getError(control: Control<unknown>): string | null | undefined;
  getErrors(control: Control<unknown>): Record<string, string>;
  getElements<V>(control: Control<V[]>): Control<V>[];

  /**
   * Register a dependency on `validate()` broadcasts for this control.
   *
   * Unlike the other methods this reads nothing — it adds
   * `ControlChange.Validate` to the tracked mask, so the surrounding
   * computation re-runs when `WriteContext.validate()` is called on the
   * control (or an ancestor). That signal fires even though no value
   * changed (after a `clearErrors`, on submit, …), so a computation that
   * publishes errors calls this to re-publish them on demand — exactly how
   * the built-in `ControlSetup.validator` wiring behaves, subscribing to
   * `Value | Validate`.
   */
  trackValidate(control: Control<unknown>): void;

  /**
   * Returns a deep reactive proxy over the control's value.
   *
   * - For null/undefined: tracks Structure, returns the value
   * - For primitives: tracks Value, returns the value
   * - For objects: tracks Structure, returns a Proxy where property access
   *   recurses through `control.fields[prop]` → `getValueRx(child)`
   * - For arrays: tracks Structure, returns a Proxy where index access
   *   recurses through `control.elementsNow[i]` → `getValueRx(elem)`
   *
   * This gives fine-grained reactivity: reading `proxy.name` only subscribes
   * to the `name` child control, not the entire parent.
   *
   * **Important:** Only use on controls whose value is a pure data tree
   * (plain objects/arrays/primitives). If the control's value contains
   * domain objects (e.g. class instances, opaque references), the proxy
   * will incorrectly route their property access through lazy child controls.
   */
  getValueRx<V>(control: Control<V>): V;

  /**
   * `true` if this rc is past its render window (the wrapping
   * component's `rendered(…)` has reconciled). Reads still return current
   * values but no longer register tracked dependencies — late reads
   * cannot establish live subscriptions and silently fail to trigger
   * re-renders. Code paths that legitimately use a captured rc outside
   * its owning render should check this and either route through their
   * own rc or accept the read as a one-shot snapshot.
   */
  readonly isFinalized: boolean;
}

// ── WriteContext ──────────────────────────────────────────────────────

/**
 * WriteContext — explicit write context for batched mutations.
 * Only exists for the duration of a ControlContext.update() callback.
 */
export interface WriteContext {
  setValue<V>(control: Control<V>, value: V): void;
  updateValue<V>(control: Control<V>, cb: (current: V) => V): void;
  setValueAndInitial<V>(control: Control<V>, value: V, initial: V): void;
  /**
   * Reset the control to `value` — sets **both** the value and the initial
   * value, leaving the control clean. Same meaning as legacy
   * `@react-typed-forms/core`'s `control.setInitialValue(v)`.
   *
   * To move the clean baseline without touching the current value (legacy's
   * `control.initialValue = v` property setter), use
   * {@link WriteContext.setInitialValueOnly}.
   */
  setInitialValue<V>(control: Control<V>, value: V): void;
  /**
   * Set the initial value alone, leaving the current value as-is — so the
   * control becomes dirty if the two now differ. Equivalent to legacy's
   * `control.initialValue = v` property setter.
   */
  setInitialValueOnly<V>(control: Control<V>, value: V): void;
  markAsClean(control: Control<unknown>): void;

  setTouched(
    control: Control<unknown>,
    touched: boolean,
    notChildren?: boolean,
  ): void;
  setDisabled(
    control: Control<unknown>,
    disabled: boolean,
    notChildren?: boolean,
  ): void;
  setError(control: Control<unknown>, key: string, error?: string | null): void;
  setErrors(
    control: Control<unknown>,
    errors?: Record<string, string | null | undefined> | null,
  ): void;
  clearErrors(control: Control<unknown>): void;
  validate(control: Control<unknown>): boolean;

  addElement<V>(
    control: Control<V[]>,
    child: V,
    index?: number | Control<V>,
    insertAfter?: boolean,
  ): Control<V>;
  removeElement<V>(control: Control<V[]>, child: number | Control<V>): void;
  updateElements<V>(
    control: Control<V[]>,
    cb: (elems: Control<V>[]) => Control<V>[],
  ): Control<V>[];

  afterChanges(cb: () => void): void;
}

// ── ControlContext ────────────────────────────────────────────────────

/**
 * ControlContext — tree-level configuration and factory.
 * The central object in the core: provides control creation, write batching,
 * read context creation, and tree-level configuration (equality).
 */
export interface ControlContext {
  /** Create a new control with the given initial value */
  newControl<V>(value: V, setup?: ControlSetup<V>): Control<V>;

  /** Execute a batch of writes; subscribers run after the callback completes */
  update(cb: (wc: WriteContext) => void): void;

  // Design note: a method for creating tracking ReadContext instances
  // (for reactive dependency tracking during renders/effects) is planned
  // but the exact API is TBD.

  /** Mark a tracker as dead (alive=false); cleanup is deferred via lazy sweep */
  markTrackerDead(tracker: { alive: boolean; cleanup(): void }): void;

  /** Revive a tracker (alive=true); cancels pending cleanup (React strict mode safe) */
  reviveTracker(tracker: { alive: boolean; cleanup(): void }): void;

  /** The equality function used for value comparison across this tree */
  readonly equals: (a: unknown, b: unknown) => boolean;
}

/*
 * Design notes:
 *
 * - A "tracking" ReadContext implementation would record (control, ControlChange)
 *   pairs during execution, then reconcile subscriptions after the render/effect
 *   completes. The exact shape (class vs function, SubscriptionTracker abstraction)
 *   is TBD.
 *
 * - A "noop" ReadContext would return snapshot values (*Now properties) without
 *   subscribing. Useful for tests, one-shot reads, or event handlers.
 */
