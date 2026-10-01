const objConst = {}.constructor;

export function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null) return a === b;
  if (b == null) return false;
  if (typeof a === "object" && typeof b === "object") {
    if (a.constructor !== b.constructor) return false;
    if (Array.isArray(a)) {
      const ba = b as unknown[];
      if (a.length !== ba.length) return false;
      return a.every((x, i) => deepEquals(x, ba[i]));
    }
    // Maps compare values deeply under identical keys; Sets compare membership
    // by key identity, as Set.has does.
    if (a instanceof Map) {
      const bm = b as Map<unknown, unknown>;
      if (a.size !== bm.size) return false;
      for (const [k, v] of a) {
        if (!bm.has(k) || !deepEquals(v, bm.get(k))) return false;
      }
      return true;
    }
    if (a instanceof Set) {
      const bs = b as Set<unknown>;
      if (a.size !== bs.size) return false;
      for (const v of a) {
        if (!bs.has(v)) return false;
      }
      return true;
    }
    if (a.constructor !== objConst) return false;
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = Object.keys(aObj);
    if (keys.length !== Object.keys(bObj).length) return false;
    return keys.every(
      (k) => Object.prototype.hasOwnProperty.call(bObj, k) && deepEquals(aObj[k], bObj[k]),
    );
  }
  // NaN equality
  return a !== a && b !== b;
}
