/**
 * `trackedValue` — the legacy deep reactive-value proxy, ported verbatim
 * over the compat surface (`current` snapshot view + patched navigation).
 *
 * Property access navigates the control tree (`fields`/`elements`) and
 * reports each step to the given tracker — or, by default, the ambient
 * collector — so consuming a proxied value inside a tracked scope subscribes
 * that scope to exactly the parts it touched.
 */

import { ControlChange } from "@rxc/controls-core";
import { collectChange } from "./ambient.js";
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
  const report = (change: ControlChange) =>
    (tracker ?? collectChange)?.(c, change);
  if (cv == null) {
    report(ControlChange.Structure);
    return cv;
  }
  if (typeof cv !== "object") {
    report(ControlChange.Value);
    return cv;
  }
  report(ControlChange.Structure);
  return new Proxy(cv as object, {
    get(target, p) {
      if (p === restoreControlSymbol) return c;
      if (Array.isArray(cv)) {
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
