import { ControlImpl, toImpl } from "./controlImpl.js";
import { ControlChange } from "./types.js";
import type { Control, ReadContext, Subscription } from "./types.js";

const restoreControlSymbol = Symbol("restoreControl");

// ── getTrackedValue implementation ───────────────────────────────────────

/**
 * Recursively creates a reactive proxy over a control's value.
 * Object/array property access is routed through child controls,
 * giving fine-grained dependency tracking.
 *
 * This works well for **pure data trees** where the control structure
 * mirrors the data shape (e.g. `{name: "Alice", address: {city: "NYC"}}`).
 * It does NOT work for controls whose values contain domain objects
 * (e.g. `DataNode`) — those objects' properties would be incorrectly
 * routed through lazy child controls that don't represent real data fields.
 */
function createValueRxProxy<V>(control: Control<V>, rc: ReadContext): V {
  const value = control.valueNow;
  if (value == null) {
    rc.isNull(control); // track Structure
    return value;
  }
  if (typeof value !== "object") {
    rc.getValue(control); // track Value for primitives
    return value;
  }
  // Object or array — track Structure (for null transitions / array length),
  // return a proxy that recurses into child controls
  if (Array.isArray(value)) {
    const elements = rc.getElements(control as unknown as Control<unknown[]>);
    return new Proxy(value, {
      get(target, p, receiver) {
        if (p === restoreControlSymbol) return control;
        if (p === "length") return elements.length;
        if (typeof p === "symbol" || typeof p !== "string")
          return Reflect.get(target, p, receiver);
        const idx = Number(p);
        if (Number.isInteger(idx) && idx >= 0 && idx < elements.length) {
          return createValueRxProxy(elements[idx], rc);
        }
        return Reflect.get(target, p, receiver);
      },
    }) as V;
  }
  // Plain object — proxy field access through control.fields
  rc.isNull(control); // track Structure for null transitions
  return new Proxy(value as object, {
    get(target, p, receiver) {
      if (p === restoreControlSymbol) return control;
      if (typeof p === "symbol") return Reflect.get(target, p, receiver);
      const child = (control.fields as Record<string, Control<any>>)[p];
      if (child) return createValueRxProxy(child, rc);
      return Reflect.get(target, p, receiver);
    },
  }) as V;
}

export function controlFromValue<A>(v: A): Control<A> | undefined {
  return v != null ? (v as any)[restoreControlSymbol] : undefined;
}
// ── NoopReadContext ─────────────────────────────────────────────────

export const untrackedRead: ReadContext = {
  getValue<V>(control: Control<V>): V {
    return control.valueNow;
  },
  getInitialValue<V>(control: Control<V>): V {
    return control.initialValueNow;
  },
  isValid(control: Control<unknown>): boolean {
    return control.validNow;
  },
  isDirty(control: Control<unknown>): boolean {
    return control.dirtyNow;
  },
  isTouched(control: Control<unknown>): boolean {
    return control.touchedNow;
  },
  isDisabled(control: Control<unknown>): boolean {
    return control.disabledNow;
  },
  isNull(control: Control<unknown>): boolean {
    return control.isNullNow;
  },
  getError(control: Control<unknown>): string | null | undefined {
    return control.errorNow;
  },
  getErrors(control: Control<unknown>): Record<string, string> {
    return control.errorsNow;
  },
  getElements<V>(control: Control<V[]>): Control<V>[] {
    return control.elementsNow;
  },
  getTrackedValue<V>(control: Control<V>): V {
    return createValueRxProxy(control, this);
  },
  trackValidate(): void {},
  // The noop rc never tracks, so every read through it is a snapshot.
  // Note the value: this is `false`, not `true` — the flag says "is
  // tracking", not "is finished".
  isTracking: false,
};

// ── TrackingReadContext ──────────────────────────────────────────────

/**
 * Notified when a {@link TrackingReadContext} is read after it has stopped
 * tracking. Such a read returns a current value but registers no dependency,
 * so nothing will re-render when that control later changes.
 *
 * Most such reads are perfectly legitimate — event handlers, refs and
 * effects all run after `finalize()` and read current values on purpose — so
 * core deliberately does not decide whether any given one is a mistake. It
 * only reports them. The React adapter installs a hook that knows the one
 * damning circumstance: a non-tracking rc read *while another rc's render
 * window is open*, which means a callback captured an enclosing component's `rc`
 * instead of using the one it was handed.
 *
 * Dev-only by convention: the adapter installs this behind its `IS_DEV` check,
 * so the branch below stays `null` in production builds. It sits on the
 * already-taken early-return path, so tracked reads pay nothing for it.
 */
export type EscapedReadHook = (rc: TrackingReadContext) => void;

let escapedReadHook: EscapedReadHook | null = null;

/** Install (or clear, with `null`) the {@link EscapedReadHook}. */
export function setEscapedReadHook(hook: EscapedReadHook | null): void {
  escapedReadHook = hook;
}

export class TrackingReadContext implements ReadContext {
  tracked = new Map<ControlImpl, ControlChange>();

  /**
   * True while this scope is accepting tracked reads — between `beginTracking()`
   * and `finalize()`. Reads made in that window register dependencies in
   * `tracked`, which a subsequent `reconcile()` turns into live
   * subscriptions.
   *
   * Outside the window reads still return current values but register
   * nothing, so they cannot reach a reconciler and cannot trigger a
   * re-run. That is the point: it prevents late additions that would
   * silently corrupt the next run's subscription set.
   *
   * Only hosts that hand this scope's `rc` to code running after
   * `reconcile()` close the window — the React adapter does, in
   * `rendered(…)`. `computeInto`, `effect`, validators and async evaluators
   * own every read they make and simply `beginTracking()` before each run, so
   * their window stays open for the scope's whole life.
   */
  private tracking = true;

  /** Whether this scope is still accepting tracked reads. */
  get isTracking(): boolean {
    return this.tracking;
  }

  private track(control: Control<any>, change: ControlChange): ControlImpl {
    const c = toImpl(control);
    if (!this.tracking) {
      escapedReadHook?.(this);
      return c;
    }
    const existing = this.tracked.get(c);
    if (existing !== undefined) {
      this.tracked.set(c, existing | change);
    } else {
      this.tracked.set(c, change);
    }
    return c;
  }

  beginTracking(): void {
    this.tracked.clear();
    this.tracking = true;
  }

  /**
   * Stop accepting tracked reads.
   *
   * For hosts that hand this scope's `rc` to code which runs after
   * `reconcile()`. The React adapter calls it in `rendered(…)`, because
   * JSX descendants, event handlers and refs all keep reading through
   * the same `rc` once the render pass has closed, and those reads must
   * not pollute `tracked`. Hosts that own every read (`computeInto`,
   * `effect`) never need to call it.
   *
   * Reads still return current values afterwards.
   */
  finalize(): void {
    this.tracking = false;
  }

  getValue<V>(control: Control<V>): V {
    return this.track(control, ControlChange.Value)._value as V;
  }

  getInitialValue<V>(control: Control<V>): V {
    return this.track(control, ControlChange.InitialValue)._initialValue as V;
  }

  isValid(control: Control<unknown>): boolean {
    const c = this.track(control, ControlChange.Valid);
    return c.isValid();
  }

  isDirty(control: Control<unknown>): boolean {
    const c = this.track(control, ControlChange.Dirty);
    return c.dirtyNow;
  }

  isTouched(control: Control<unknown>): boolean {
    const c = this.track(control, ControlChange.Touched);
    return c.touchedNow;
  }

  isDisabled(control: Control<unknown>): boolean {
    const c = this.track(control, ControlChange.Disabled);
    return c.disabledNow;
  }

  isNull(control: Control<unknown>): boolean {
    const c = this.track(control, ControlChange.Structure);
    return c.isNullNow;
  }

  getError(control: Control<unknown>): string | null | undefined {
    const c = this.track(control, ControlChange.Error);
    return c.errorNow;
  }

  getErrors(control: Control<unknown>): Record<string, string> {
    const c = this.track(control, ControlChange.Error);
    return c.errorsNow;
  }

  getElements<V>(control: Control<V[]>): Control<V>[] {
    const c = this.track(control, ControlChange.Structure);
    return c.getOrCreateElements() as unknown as Control<V>[];
  }

  trackValidate(control: Control<unknown>): void {
    this.track(control, ControlChange.Validate);
  }

  getTrackedValue<V>(control: Control<V>): V {
    return createValueRxProxy(control, this);
  }
}

// ── SubscriptionReconciler ──────────────────────────────────────────

interface TrackedSub {
  control: ControlImpl;
  subscription: Subscription;
  mask: ControlChange;
}

export class SubscriptionReconciler {
  alive = true;
  private subs: TrackedSub[] = [];
  private listener:
    | ((control: Control<any>, change: ControlChange) => void)
    | undefined;

  setListener(
    listener: (control: Control<any>, change: ControlChange) => void,
  ): void {
    this.listener = listener;
  }

  reconcile(tracked: Map<ControlImpl, ControlChange>): void {
    const newSubs: TrackedSub[] = [];

    // For each tracked control, find or create subscription
    for (const [control, mask] of tracked) {
      const existing = this.subs.find((s) => s.control === control);
      if (existing) {
        if (existing.mask !== mask) {
          // Mask changed — unsubscribe and resubscribe
          control.unsubscribe(existing.subscription);
          const sub = control.subscribe(this.wrappedListener, mask);
          newSubs.push({ control, subscription: sub, mask });
        } else {
          newSubs.push(existing);
        }
      } else {
        // New subscription
        const sub = control.subscribe(this.wrappedListener, mask);
        newSubs.push({ control, subscription: sub, mask });
      }
    }

    // Unsubscribe any that are no longer tracked
    for (const s of this.subs) {
      if (!tracked.has(s.control)) {
        s.control.unsubscribe(s.subscription);
      }
    }

    this.subs = newSubs;
  }

  private wrappedListener = (control: Control<any>, change: ControlChange) => {
    if (this.alive && this.listener) {
      this.listener(control, change);
    }
  };

  cleanup(): void {
    for (const s of this.subs) {
      s.control.unsubscribe(s.subscription);
    }
    this.subs = [];
  }
}
