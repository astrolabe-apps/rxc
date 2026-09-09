/**
 * @astroapps/controls — type spec
 *
 * This file defines the public API for the core controls package.
 * See also: react-types.ts for the @astroapps/controls-react spec.
 */

// ── Value types ──────────────────────────────────────────────────────

export type ControlValidator<V> = ((v: V) => string | undefined | null) | null;

export interface ControlOptions<V> {
  validator?: ControlValidator<V>;
  fields?: {
    [K in keyof NonNullable<V>]?: ControlOptions<NonNullable<V>[K]>;
  };
  elements?: V extends Array<infer X> ? ControlOptions<X> : unknown;
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

export type ChangeListener<V> = (
  control: Control<V>,
  change: ControlChange,
  wc: WriteContext,
) => void;

export type Subscription = {
  mask: ControlChange;
  listener: ChangeListener<any>;
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
  readonly existingFields: Record<string, Control<unknown> | undefined>;

  // Subscriptions
  subscribe(listener: ChangeListener<V>, mask: ControlChange): Subscription;
  unsubscribe(subscription: Subscription): void;

  // Metadata
  meta: Record<string, unknown>;
}

export type ControlValue<C> = C extends Control<infer V> ? V : never;

// ── ReadContext ───────────────────────────────────────────────────────

/**
 * ReadContext — explicit reactive read scope.
 *
 * Reading through it registers a dependency on the (control, property)
 * pair. This is the library's single reactive read mechanism, not a
 * render-time facility: a React render pass is one of the things that
 * opens a scope, alongside `computeInto`, `effect`, `useValidator` and the
 * async expression evaluators. All of them share one lifecycle —
 * `beginTracking()`, then tracked reads, then `reconcile(tracked)`, which diffs
 * the tracked set against the live subscriptions.
 *
 * `untrackedRead` is the non-tracking implementation, for one-shot
 * reads that should subscribe to nothing.
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
   * the built-in `ControlOptions.validator` wiring behaves, subscribing to
   * `Value | Validate`.
   */
  trackValidate(control: Control<unknown>): void;

  /**
   * Returns a deep reactive proxy over the control's value.
   *
   * - For null/undefined: tracks Structure, returns the value
   * - For primitives: tracks Value, returns the value
   * - For objects: tracks Structure, returns a Proxy where property access
   *   recurses through `control.fields[prop]` → `getTrackedValue(child)`
   * - For arrays: tracks Structure, returns a Proxy where index access
   *   recurses through `control.elementsNow[i]` → `getTrackedValue(elem)`
   *
   * This gives fine-grained reactivity: reading `proxy.name` only subscribes
   * to the `name` child control, not the entire parent.
   *
   * **Important:** Only use on controls whose value is a pure data tree
   * (plain objects/arrays/primitives). If the control's value contains
   * domain objects (e.g. class instances, opaque references), the proxy
   * will incorrectly route their property access through lazy child controls.
   */
  getTrackedValue<V>(control: Control<V>): V;

  /**
   * `true` while this scope is still accepting tracked reads, so a read
   * made now registers a dependency and can trigger a re-run. When
   * `false`, reads still return current values but register nothing.
   *
   * Most scopes are tracking for their whole life: `computeInto`,
   * `effect`, validators and async evaluators own every read they make
   * and never stop. Only a host that exposes its `rc` to code running
   * after `reconcile()` closes one — the React adapter does so in
   * `rendered(…)`, so a component's `rc` stops tracking for the whole
   * window between renders.
   *
   * Code holding an `rc` whose origin it does not control should check
   * this before relying on a read to be reactive, and either route
   * through its own scope or accept the read as a one-shot snapshot.
   */
  readonly isTracking: boolean;
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
   * `@react-typed-forms/core`'s `control.setInitialValue(v)`, which is why
   * that name is *not* used for it here: it reads as "set the initial value"
   * while doing strictly more than that. {@link WriteContext.setInitialValue}
   * is the one that does only what it says.
   */
  reset<V>(control: Control<V>, value: V): void;
  /**
   * Set the initial value alone, leaving the current value as-is — so the
   * control becomes dirty if the two now differ. Equivalent to legacy's
   * `control.initialValue = v` property setter.
   */
  setInitialValue<V>(control: Control<V>, value: V): void;
  markClean(control: Control<unknown>): void;

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

  /**
   * Include or exclude `element` in an array control **treated as a set**.
   *
   * Membership is the only thing that matters, so order is not preserved as
   * meaningful state. When the resulting members match the control's
   * `initialValue` — in any order — the initial value itself is written
   * instead of the newly built array. Toggling an element off and back on
   * therefore leaves the control *clean*, rather than dirty on a reordering,
   * and because the written value is genuinely equal to the baseline the
   * clean state is visible to ancestor controls too.
   *
   * Nullable arrays round-trip: an empty result against a `null`/`undefined`
   * baseline writes that baseline back rather than materialising `[]`, and
   * excluding from a null value is a no-op.
   *
   * **Elements must be primitives** — identity is `Set`/`===` based, since
   * set members here are option values. Objects would each be their own
   * member regardless of shape, and a value carrying duplicates is not
   * accounted for. Including an element already present (or excluding one
   * that is absent) is a no-op.
   */
  setElementIncluded<V>(
    control: Control<V[] | null | undefined>,
    element: V,
    included: boolean,
  ): void;

  afterFlush(cb: () => void): void;
}

// ── ControlContext ────────────────────────────────────────────────────

/**
 * ControlContext — factory and runtime for controls.
 *
 * Allocates controls and their unique ids, runs write batches, holds
 * the equality function every control it creates compares with, and
 * garbage-collects subscription trackers.
 *
 * It holds no controls itself, and is not per control tree: one context
 * typically serves a whole app (or one SSR request, which is what makes
 * `uniqueId` sequences reproducible across render and hydration), and
 * every `newControl` call mints an independent root within it.
 */
export interface ControlContext {
  /** Create a new control with the given initial value */
  newControl<V>(value: V, setup?: ControlOptions<V>): Control<V>;

  /** Execute a batch of writes; subscribers run after the callback completes */
  update(cb: (wc: WriteContext) => void): void;

  // Note: tracking ReadContext instances are not created here — hosts
  // construct `TrackingReadContext` from `@rxc/controls-core/internal`
  // and pair it with a `SubscriptionReconciler` themselves.

  /** Mark a tracker as dead (alive=false); cleanup is deferred via lazy sweep */
  releaseTracker(tracker: { alive: boolean; cleanup(): void }): void;

  /** Revive a tracker (alive=true); cancels pending cleanup (React strict mode safe) */
  retainTracker(tracker: { alive: boolean; cleanup(): void }): void;

  /** The equality function used by every control this context creates */
  readonly equals: (a: unknown, b: unknown) => boolean;
}

/*
 * Implementations of the two ReadContext shapes both ship:
 *
 * - `TrackingReadContext` records (control, ControlChange) pairs as they are
 *   read, and a `SubscriptionReconciler` turns that set into live
 *   subscriptions. Both are exported from `@rxc/controls-core/internal`, for
 *   sibling packages that host a reactive scope of their own.
 *
 * - `untrackedRead` returns snapshot values (the `*Now` properties) without
 *   subscribing — for tests, one-shot reads, and event handlers.
 */
