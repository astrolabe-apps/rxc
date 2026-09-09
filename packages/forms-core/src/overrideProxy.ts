import type { Control, ReadContext } from "@rxc/controls-core";

/**
 * Sentinel held in override controls before a script has produced a value.
 * {@link createOverrideProxy} falls through to the base target when an
 * override carries this marker, matching the old `astrolabe-common`
 * behaviour (see `overrideProxy.ts` there).
 */
class NoValue {}
export const NoOverride: unknown = new NoValue();

/**
 * Factory that wraps a nested base value at proxy-read time. Produced by
 * the scripted-proxy walker for each non-collection compound field that
 * has scripts somewhere in its subtree.
 */
export type NestedProxyBuilder = (
  childBase: object,
  rc: ReadContext,
) => object;

/**
 * Wrap a target object in a {@link Proxy} that transparently substitutes
 * values pulled from an overrides {@link Control} and, for known compound
 * keys, recursively wraps nested objects via {@link NestedProxyBuilder}s.
 *
 * Property reads route through the given {@link ReadContext}, so consumers
 * running inside a reactive scope will re-evaluate when override values
 * change. On each read the proxy:
 *
 * 1. Checks whether an override control exists for the key (by looking at
 *    `overridesControl.existingFields`). If so, reads its value through `rc`;
 *    when the value is not {@link NoOverride}, it's returned directly.
 * 2. If the key names a non-collection compound with its own overrides
 *    subtree, wraps the base value via the registered nested builder.
 * 3. Otherwise falls through to the underlying target's own property.
 */
// Warn once per call-site about reads through a proxy whose rc has been
// finalized. The pre-mounted Set is keyed by the call-site's frame
// fingerprint so a single offender doesn't spam the console.
const warnedSites = new Set<string>();
declare const process: { env: { NODE_ENV?: string } } | undefined;

/**
 * True only when a development build can be positively confirmed. The literal
 * `process.env.NODE_ENV` is what bundlers statically replace (optional chaining
 * is not matched, and defeating the replacement made webpack shim `process`,
 * leaving this warning live in production bundles); the `typeof` guard keeps an
 * unbundled browser ESM load from throwing. Evaluated once per module.
 */
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function warnEscapedRead(propertyKey: string): void {
  if (!IS_DEV) return;
  // Two frames up from inside the warn helper lands at the proxy get; one
  // more skips that and points at the consumer's actual read site.
  const stack = new Error().stack ?? "";
  const callerLine = stack.split("\n").slice(3, 4).join("") || "(unknown)";
  const key = `${propertyKey}@${callerLine}`;
  if (warnedSites.has(key)) return;
  warnedSites.add(key);
  // eslint-disable-next-line no-console
  console.warn(
    `[@rxc/forms-core] Scripted-override proxy read for ".${propertyKey}" ` +
      `happened after its owning rc was finalized. The read returned the ` +
      `current value but did NOT register a subscription — when the ` +
      `script's override lands, no component will re-render. The proxy ` +
      `was likely passed as a prop and read inside a child component ` +
      `whose own rendered() reconcile had not yet seen the property. ` +
      `Have the consuming component call useReactive() and read through its own ` +
      `rc (e.g. node.getState(rc).definition.X) instead of the passed-in prop.\n` +
      `Site: ${callerLine.trim()}`,
  );
}

export function createOverrideProxy<A extends object, B extends object>(
  target: A,
  overridesControl: Control<B>,
  rc: ReadContext,
  nestedBuilders?: Map<string, NestedProxyBuilder>,
): A {
  const overrideFields = overridesControl.existingFields as Record<
    string,
    Control<unknown>
  >;
  const allOwn = Reflect.ownKeys(target);
  for (const k of Reflect.ownKeys(overrideFields)) {
    if (!allOwn.includes(k)) allOwn.push(k);
  }
  return new Proxy(target, {
    get(t, p, receiver) {
      if (typeof p === "string") {
        // Nested-compound override: the override control for this key is
        // a sub-tree (its `value` is a partial Record holding only the
        // sub-keys with overrides). Defer to the nested builder, which
        // wraps the BASE compound with another proxy that merges overrides
        // and base fields. Falling through to the override-value branch
        // here would replace the entire compound with the partial sub-tree
        // and clobber base fields like `renderOptions.type`.
        const nested = nestedBuilders?.get(p);
        if (nested) {
          const childBase = Reflect.get(t, p, receiver);
          if (childBase != null && typeof childBase === "object") {
            return nested(childBase as object, rc);
          }
          return childBase;
        }
        if (Object.hasOwn(overrideFields, p)) {
          if (!rc.isTracking) warnEscapedRead(p);
          const nv = rc.getValue(overrideFields[p]);
          if (nv !== NoOverride) return nv;
        }
      }
      return Reflect.get(t, p, receiver);
    },
    ownKeys() {
      return allOwn;
    },
    has(t, p) {
      return (
        Reflect.has(t, p) ||
        (typeof p === "string" && Object.hasOwn(overrideFields, p))
      );
    },
    getOwnPropertyDescriptor(t, p) {
      if (typeof p === "string" && Object.hasOwn(overrideFields, p)) {
        return { enumerable: true, configurable: true };
      }
      return Reflect.getOwnPropertyDescriptor(t, p);
    },
  });
}
