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

/** Resolve a whole bag of renderer-specific props. */
export function getProps<P extends object>(
  rc: ReadContext,
  props: P,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(props)) {
    out[k] = getProp(
      rc,
      (props as Record<string, unknown>)[k] as FormProp<unknown>,
    );
  }
  return out;
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

const order: Record<string, number> = { hidden: 0, silent: 1, rendered: 2 };

/** Narrow, never widen: a child cannot be more visible than its parent. */
export function narrowPresence<P extends string>(parent: P, child: P): P {
  return order[parent] <= order[child] ? parent : child;
}
