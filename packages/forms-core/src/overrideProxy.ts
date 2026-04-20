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
 *    `overridesControl.fieldsNow`). If so, reads its value through `rc`;
 *    when the value is not {@link NoOverride}, it's returned directly.
 * 2. If the key names a non-collection compound with its own overrides
 *    subtree, wraps the base value via the registered nested builder.
 * 3. Otherwise falls through to the underlying target's own property.
 */
export function createOverrideProxy<A extends object, B extends object>(
  target: A,
  overridesControl: Control<B>,
  rc: ReadContext,
  nestedBuilders?: Map<string, NestedProxyBuilder>,
): A {
  const overrideFields = overridesControl.fieldsNow as Record<
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
        if (Object.hasOwn(overrideFields, p)) {
          const nv = rc.getValue(overrideFields[p]);
          if (nv !== NoOverride) return nv;
        }
        const nested = nestedBuilders?.get(p);
        if (nested) {
          const childBase = Reflect.get(t, p, receiver);
          if (childBase != null && typeof childBase === "object") {
            return nested(childBase as object, rc);
          }
          return childBase;
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
