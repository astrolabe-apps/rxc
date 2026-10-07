/**
 * `trackedValue` — the legacy deep reactive-value proxy, ported verbatim
 * over the compat surface (`current` snapshot view + patched navigation).
 *
 * Property access navigates the control tree (`fields`/`elements`) and
 * reports each step to the given tracker — or, by default, the ambient
 * collector — so consuming a proxied value inside a tracked scope subscribes
 * that scope to exactly the parts it touched.
 */

import { ControlChange } from "@rx-controls/core";
import {
  ambientTracing,
  collectChange,
  reportAmbientMiss,
  strictAmbient,
  traceAmbient,
} from "./ambient.js";

declare const process: { env: { NODE_ENV?: string } } | undefined;
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
import type { ChangeListenerFunc, Control } from "./types.js";

const restoreControlSymbol = Symbol("restoreControl");

export function trackedValue<A>(
  c: Control<A>,
  tracker?: ChangeListenerFunc<any>,
): A;
export function trackedValue<A>(
  c: Control<A> | null | undefined,
  tracker?: ChangeListenerFunc<any>,
): A | null | undefined;
export function trackedValue<A>(
  c: Control<A> | null | undefined,
  tracker?: ChangeListenerFunc<any>,
): A | null | undefined {
  if (c == null) return c as null | undefined;
  const cc = c.current;
  const cv = cc.value;
  const report = (change: ControlChange) => {
    const cb = tracker ?? collectChange;
    if (IS_DEV && ambientTracing) traceAmbient(c, change, cb);
    if (cb !== undefined) cb(c, change);
    else if (IS_DEV && strictAmbient) reportAmbientMiss(c, change);
  };
  if (cv == null) {
    report(ControlChange.Structure);
    return cv;
  }
  if (typeof cv !== "object") {
    report(ControlChange.Value);
    return cv;
  }
  report(ControlChange.Structure);
  const isArray = Array.isArray(cv);
  // Existence and enumeration checks (`in`, `hasOwnProperty`,
  // `Object.keys`) must subscribe exactly as a read does: jsonata ≥ 2.2 asks
  // `hasOwnProperty` before it reads, so a key that is missing now would
  // otherwise never be tracked, and adding it would never re-run the
  // expression. Each trap touches the child the way `get` would, then
  // answers from the live value — the snapshot target only satisfies the
  // Proxy invariants (every key of a plain object or array is configurable,
  // and an array's `length` exists on both).
  const touch = (p: string | symbol): void => {
    if (typeof p === "symbol") return;
    if (isArray) {
      if (p[0] > "9" || p[0] < "0") return;
      const nc = (cc.elements as unknown as Control<unknown>[])[
        p as unknown as number
      ];
      if (nc != null && typeof nc !== "function") trackedValue(nc, tracker);
      return;
    }
    trackedValue((cc.fields as Record<string, Control<unknown>>)[p], tracker);
  };
  const live = (): object => {
    const v = cc.value as unknown;
    // A value that has since changed shape cannot be answered from without
    // breaking the invariants; the snapshot is the best answer left.
    return v != null && typeof v === "object" && Array.isArray(v) === isArray
      ? v
      : (cv as object);
  };
  return new Proxy(cv as object, {
    get(target, p) {
      if (p === restoreControlSymbol) return c;
      if (isArray) {
        const elements = cc.elements as unknown as Control<unknown>[];
        if (p === "length") return elements.length;
        // Non-index properties (methods, symbols) come off the raw array.
        if (typeof p === "symbol" || p[0] > "9" || p[0] < "0") {
          return Reflect.get(cv, p);
        }
        const nc = elements[p as unknown as number];
        if (typeof nc === "function") return nc;
        if (nc == null) return null;
        return trackedValue(nc, tracker);
      }
      return trackedValue(
        (cc.fields as Record<string, Control<unknown>>)[p as string],
        tracker,
      );
    },
    has(target, p) {
      touch(p);
      return p in live();
    },
    getOwnPropertyDescriptor(target, p) {
      touch(p);
      return Reflect.getOwnPropertyDescriptor(live(), p);
    },
    ownKeys() {
      // An array's keys follow its elements (Structure, reported when the
      // proxy was made). An object's do not: adding a key notifies the
      // object's Value and never its Structure, so enumerating one has to
      // subscribe to the whole value — coarse, but `$keys()` stays correct.
      if (!isArray) report(ControlChange.Value);
      return Reflect.ownKeys(live());
    },
  }) as A;
}

/** Recover the control behind a `trackedValue` proxy (undefined for plain
 * values). */
export function unsafeRestoreControl<A>(v: A): Control<A> | undefined {
  return v != null
    ? ((v as Record<symbol, unknown>)[restoreControlSymbol] as
        | Control<A>
        | undefined)
    : undefined;
}

/** The raw (unproxied) value behind a `trackedValue` result — or the input
 * itself when it wasn't a proxy. */
export function unwrapTrackedControl<A>(a: A): A {
  const c = unsafeRestoreControl(a);
  return (c?.current.value ?? a) as A;
}
