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
 * Wrap a target object in a {@link Proxy} that transparently substitutes
 * values pulled from an overrides {@link Control}.
 *
 * Property reads route through the given {@link ReadContext}, so consumers
 * running inside a reactive scope will re-evaluate when override values
 * change. On each read the proxy:
 *
 * 1. Checks whether an override control exists for the key (by looking at
 *    `overridesControl.fieldsNow`). If so, reads its value through `rc`;
 *    when the value is not {@link NoOverride}, it's returned directly.
 * 2. Otherwise falls through to the underlying target's own property.
 */
export function createOverrideProxy<A extends object, B extends object>(
  target: A,
  overridesControl: Control<B>,
  rc: ReadContext,
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
      if (typeof p === "string" && Object.hasOwn(overrideFields, p)) {
        const nv = rc.getValue(overrideFields[p]);
        if (nv !== NoOverride) return nv;
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
