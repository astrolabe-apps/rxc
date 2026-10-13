import type {
  Control,
  ReadContext as CoreReadContext,
} from "@rx-controls/core";

/**
 * What a derived {@link FormProp} is a function of: `@rx-controls/core`'s
 * `ReadContext`, the same type under the same name, so a derivation written
 * once and used in several props (`(rc) => …`) can be typed without a direct
 * dependency on core.
 *
 * @group Authoring
 */
export type ReadContext = CoreReadContext;

/**
 * A prop that may be reactive. One of three shapes:
 *
 * - a plain value, fixed for as long as the prop is;
 * - a function of a `ReadContext`, re-evaluated whenever a control it reads
 *   changes — a derived value;
 * - a `Control<T>`, read for its current value — a value bound to form state.
 *
 * A `FormProp` is always resolved **by the component that consumes it**, in
 * that component's own tracking window (see {@link getProp}), never by the
 * component that passed it down. That is what makes a change reach exactly
 * the components that read it and re-render nothing else.
 *
 * @group Authoring
 */
export type FormProp<T> = T | ((rc: ReadContext) => T) | Control<T>;

/**
 * The classes one part of a look gives an element, for an implementation whose
 * looks are class strings (html): a string
 * is added to the implementation's own classes for that element; `{ replace }`
 * stands in for them — and for any part of an earlier look — entirely. The
 * legacy JSON format spells replacement with a leading `"@ "`.
 *
 * Only an implementation knows its own class for an element, so layering
 * happens there — see {@link combineClass}.
 *
 * @group Implementations
 */
export type ClassValue =
  | string
  | {
      /** Use this class instead of the implementation's own. */
      replace: string;
    };

/**
 * Resolve a {@link FormProp} in the caller's tracking window: a control is
 * read through `rc`, a function is called with `rc`, a plain value is
 * returned as it is. `undefined` in, `undefined` out.
 *
 * Call it from the component that uses the value. Resolving a prop in a parent
 * and passing the result down subscribes the parent instead, which re-renders
 * the wrong component and misses nothing only by accident.
 *
 * @group Implementations
 */
export function getProp<T>(
  rc: ReadContext,
  prop: FormProp<T> | undefined,
): T | undefined {
  if (prop === undefined) return undefined;
  if (isControl(prop)) return rc.getValue(prop) as T;
  if (typeof prop === "function") return (prop as (rc: ReadContext) => T)(rc);
  return prop;
}

/** A `Control` by shape: core's controls carry `subscribe` and a numeric `uniqueId`. */
function isControl(x: unknown): x is Control<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { subscribe?: unknown }).subscribe === "function" &&
    typeof (x as { uniqueId?: unknown }).uniqueId === "number"
  );
}

/**
 * Two parts of a look that land on one element — a label drawn as a single
 * element takes both the `label` and `labelText` parts — or one look laid over
 * another. A `{ replace }` on the right wins outright; one on the left stays a
 * replacement with the right appended.
 *
 * @group Implementations
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
