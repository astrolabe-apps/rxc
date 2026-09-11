/**
 * Control creation — legacy `newControl` / `controlGroup` over the compat
 * singleton context (Bridge 3).
 */

import {
  createControlGroup as coreControlGroup,
  type ControlOptions as CoreControlSetup,
  type Control as CoreControl,
} from "@rxc/controls-core";
import { getCompatContext } from "./context.js";
import { runInWc } from "./transactions.js";
import { asLegacy } from "./patch.js";
import type { Control, ControlSetup, ControlValue, DelayedSetup } from "./types.js";

declare const process: { env: { NODE_ENV?: string } } | undefined;
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

let warnedEquals = false;

/**
 * Converted setups are cached by the legacy object they came from, so a
 * self-referential setup converts to a single stable object graph rather than
 * a fresh one per traversal.
 */
const convertedCache = new WeakMap<object, CoreControlSetup<any>>();

/**
 * Convert a legacy `ControlSetup` to the core shape.
 *
 * **Nested setups convert lazily.** `fields` and `elements` are installed as
 * getters that convert on first read, which is what makes legacy's recursive
 * setups work:
 *
 * ```ts
 * const treeSetup: ControlSetup<Node> = {
 *   fields: { children: { elems: () => treeSetup } },
 * };
 * ```
 *
 * `DelayedSetup` thunks are legacy's escape hatch for exactly this, and
 * converting eagerly turned them into infinite recursion — a tree setup blew
 * the stack before the page could render. The engine already reads a child's
 * setup only when that child is created (`createChild`), and `Object.keys`
 * does not fire getters, so deferring here means each level resolves exactly
 * one step further.
 *
 * `equals` (per-control equality) still has no engine support and is dropped
 * with a one-time dev warning.
 */
export function convertSetup<V>(
  setup: ControlSetup<V> | undefined,
): CoreControlSetup<V> | undefined {
  if (!setup) return undefined;
  const cached = convertedCache.get(setup);
  if (cached) return cached as CoreControlSetup<V>;
  const { equals, fields, elems, afterCreate, dontClearError, ...rest } =
    setup;
  if (equals && IS_DEV && !warnedEquals) {
    warnedEquals = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[@react-typed-forms/core] ControlSetup.equals is not supported — the " +
        "engine uses context-level equality (deepEquals). The custom " +
        "comparator was ignored.",
    );
  }
  const out: CoreControlSetup<V> = { ...rest } as CoreControlSetup<V>;
  // Legacy spells this `dontClearError`; the engine now spells it
  // `keepErrors`. Mapped explicitly because `rest` goes through an `as` cast,
  // which suppresses excess-property checking — left in `rest` the old key
  // would be handed to the engine and silently ignored.
  if (dontClearError !== undefined) out.keepErrors = dontClearError;
  if (fields) {
    const converted: Record<string, CoreControlSetup<unknown> | undefined> = {};
    for (const k of Object.keys(fields)) {
      defineLazy(converted, k, () =>
        convertSetup(resolveDelayed((fields as any)[k])),
      );
    }
    out.fields = converted as CoreControlSetup<V>["fields"];
  }
  if (elems !== undefined) {
    // Legacy spells this `elems`; the engine now spells it `elements`.
    defineLazy(out as Record<string, unknown>, "elements", () =>
      convertSetup(resolveDelayed(elems as DelayedSetup<unknown>)),
    );
  }
  if (afterCreate) {
    out.afterCreate = (c) => afterCreate(asLegacy(c) as Control<V>);
  }
  if (typeof setup === "object") convertedCache.set(setup, out);
  return out;
}

/**
 * Install `key` as an enumerable getter that runs `make` once and then
 * replaces itself with the plain value. Enumerable so `Object.keys` still
 * sees the field (the engine iterates them to find eager validators) —
 * `Object.keys` does not invoke getters, so the setup below stays unresolved
 * until something actually reads it.
 */
function defineLazy(
  target: Record<string, unknown>,
  key: string,
  make: () => unknown,
): void {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get() {
      const value = make();
      Object.defineProperty(target, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value,
      });
      return value;
    },
  });
}

function resolveDelayed<V>(
  d: DelayedSetup<V> | undefined,
): ControlSetup<V> | undefined {
  return typeof d === "function" ? d() : d;
}

/**
 * Create a standalone control (legacy signature, including the third
 * `initialValue` argument used by e.g. `cloneFields`).
 */
export function newControl<V>(
  value: V,
  setup?: ControlSetup<V>,
  initialValue?: V,
): Control<V> {
  const c = getCompatContext().newControl(value, convertSetup(setup));
  if (initialValue !== undefined) {
    // Legacy `newControl` constructs with `(value, initialValue)` — the
    // current value stays as passed, so this is initial-only.
    runInWc((wc) => wc.setInitialValue(c, initialValue));
  }
  return asLegacy(c);
}

/**
 * A group control assembled from existing controls — children are attached,
 * not copied, so edits flow both ways.
 */
export function controlGroup<C extends { [k: string]: Control<any> }>(
  fields: C,
): Control<{ [K in keyof C]: ControlValue<C[K]> }> {
  const group = coreControlGroup(
    getCompatContext(),
    fields as unknown as Record<string, CoreControl<unknown>>,
  );
  return asLegacy(group) as Control<{ [K in keyof C]: ControlValue<C[K]> }>;
}
