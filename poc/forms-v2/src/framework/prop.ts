import type { Control, ReadContext } from "@rx-controls/core";
import type { ClassValue, FormProp } from "./types.js";

function isControl(x: unknown): x is Control<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { subscribe?: unknown }).subscribe === "function" &&
    typeof (x as { uniqueId?: unknown }).uniqueId === "number"
  );
}

/** Resolve in the *consuming* component's tracking window, never the dispatcher's. */
export function getProp<T>(
  rc: ReadContext,
  p: FormProp<T> | undefined,
): T | undefined {
  if (p === undefined) return undefined;
  if (isControl(p)) return rc.getValue(p) as T;
  if (typeof p === "function") return (p as (rc: ReadContext) => T)(rc);
  return p;
}

/** Only the implementation knows its own class for a slot, so it does the merge. */
export function mergeClass(
  own: string | undefined,
  given: ClassValue | undefined,
): string | undefined {
  if (given === undefined) return own;
  if (typeof given === "object") return given.replace;
  return [own, given].filter(Boolean).join(" ") || undefined;
}

/**
 * Two slots landing on one element — a single-element label taking both
 * `labelClassName` and `labelTextClassName`. A `replace` on the right wins;
 * one on the left keeps replacing and appends the right.
 */
export function combineClass(
  a: ClassValue | undefined,
  b: ClassValue | undefined,
): ClassValue | undefined {
  if (b === undefined) return a;
  if (a === undefined) return b;
  if (typeof b === "object") return b;
  if (typeof a === "object") return { replace: `${a.replace} ${b}` };
  return `${a} ${b}`;
}

const order: Record<string, number> = { hidden: 0, silent: 1, rendered: 2 };

/** Narrow, never widen: a child cannot be more visible than its parent. */
export function narrowPresence<P extends string>(parent: P, child: P): P {
  return order[parent] <= order[child] ? parent : child;
}
