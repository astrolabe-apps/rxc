/**
 * Control creation — legacy `newControl` / `controlGroup` over the compat
 * singleton context (Bridge 3).
 */

import {
  controlGroup as coreControlGroup,
  type ControlSetup as CoreControlSetup,
  type Control as CoreControl,
} from "@rxc/controls-core";
import { getCompatContext } from "./context";
import { runInWc } from "./transactions";
import { asLegacy } from "./patch";
import type { Control, ControlSetup, ControlValue, DelayedSetup } from "./types";

declare const process: { env: { NODE_ENV?: string } } | undefined;
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

let warnedEquals = false;
let warnedDelayed = false;

/**
 * Convert a legacy `ControlSetup` to the core shape.
 *
 * Two legacy features need translation:
 * - `equals` (per-control equality) has no engine support — dropped with a
 *   one-time dev warning.
 * - `DelayedSetup` thunks (legacy's escape hatch for recursive setups) are
 *   resolved eagerly with a one-time dev warning; a genuinely self-referential
 *   setup would recurse forever and is unsupported.
 */
export function convertSetup<V>(
  setup: ControlSetup<V> | undefined,
): CoreControlSetup<V> | undefined {
  if (!setup) return undefined;
  const { equals, fields, elems, afterCreate, ...rest } = setup;
  if (equals && IS_DEV && !warnedEquals) {
    warnedEquals = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[@rxc/compat-controls] ControlSetup.equals is not supported — the " +
        "engine uses context-level equality (deepEquals). The custom " +
        "comparator was ignored.",
    );
  }
  const out: CoreControlSetup<V> = { ...rest } as CoreControlSetup<V>;
  if (fields) {
    const converted: Record<string, CoreControlSetup<unknown> | undefined> = {};
    for (const [k, v] of Object.entries(fields)) {
      converted[k] = convertSetup(resolveDelayed(v as DelayedSetup<unknown>));
    }
    out.fields = converted as CoreControlSetup<V>["fields"];
  }
  if (elems !== undefined) {
    out.elems = convertSetup(
      resolveDelayed(elems as DelayedSetup<unknown>),
    ) as CoreControlSetup<V>["elems"];
  }
  if (afterCreate) {
    out.afterCreate = (c) => afterCreate(asLegacy(c) as Control<V>);
  }
  return out;
}

function resolveDelayed<V>(
  d: DelayedSetup<V> | undefined,
): ControlSetup<V> | undefined {
  if (typeof d !== "function") return d;
  if (IS_DEV && !warnedDelayed) {
    warnedDelayed = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[@rxc/compat-controls] DelayedSetup thunks are resolved eagerly — " +
        "recursive setups are not supported by the engine.",
    );
  }
  return d();
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
