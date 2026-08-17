/**
 * Bridge 1 — ambient reads.
 *
 * Restores the legacy module-global change collector: the prototype patch's
 * getters report each `(control, changeBit)` read here, and whoever installed
 * the collector (a component tracker, `collectChanges`, `withAmbient`)
 * accumulates them. The global lives in this package only — the core engine
 * remains global-free.
 */

import { ControlChange } from "@rxc/controls-core";
import type { Control as CoreControl, ReadContext } from "@rxc/controls-core";
import type { ChangeListenerFunc } from "./types.js";

/**
 * The currently installed ambient collector, or `undefined` outside any
 * tracking window. Exported as a live binding, matching legacy.
 */
export let collectChange: ChangeListenerFunc<any> | undefined;

/** Install (or clear) the ambient collector. Prefer {@link collectChanges}
 * — it save/restores, so nested windows compose. */
export function setChangeCollector(
  c: ChangeListenerFunc<any> | undefined,
): void {
  collectChange = c;
}

/**
 * Run `run` with `listener` installed as the ambient collector, restoring
 * the previous collector afterwards. Every tracked getter read inside `run`
 * reports to `listener`.
 */
export function collectChanges<A>(
  listener: ChangeListenerFunc<any>,
  run: () => A,
): A {
  const prev = collectChange;
  collectChange = listener;
  try {
    return run();
  } finally {
    collectChange = prev;
  }
}

/** Manually report a dependency on `(c, change)` to the ambient collector. */
export function trackControlChange(c: Control<any>, change: ControlChange): void {
  collectChange?.(c, change);
}

// `Control` here is the compat type; at runtime these are core ControlImpls.
import type { Control } from "./types.js";

/**
 * A collector that converts ambient reads into explicit `rc` reads.
 *
 * Each reported change bit is re-read through the given {@link ReadContext},
 * which registers exactly that facet as a dependency. This is what lets a
 * legacy no-arg closure (`() => c.value + d.value`) drive any rc-based
 * primitive: the getter returns the snapshot, and this collector makes the
 * rc subscribe to it.
 */
export function ambientToRc(rc: ReadContext): ChangeListenerFunc<any> {
  return (control, change) => {
    const c = control as unknown as CoreControl<unknown>;
    if (change & ControlChange.Value) rc.getValue(c);
    if (change & ControlChange.InitialValue) rc.getInitialValue(c);
    if (change & ControlChange.Valid) rc.isValid(c);
    if (change & ControlChange.Touched) rc.isTouched(c);
    if (change & ControlChange.Disabled) rc.isDisabled(c);
    if (change & ControlChange.Dirty) rc.isDirty(c);
    if (change & ControlChange.Error) rc.getError(c);
    if (change & ControlChange.Structure)
      rc.getElements(c as CoreControl<unknown[]>);
  };
}

/**
 * Run a legacy ambient-reading closure under an explicit {@link ReadContext}.
 *
 * The workhorse adapter for every closure-taking legacy API: reads made via
 * the patched getters inside `fn` are mirrored into `rc` (see
 * {@link ambientToRc}), so `rc`'s owner re-runs when they change.
 */
export function withAmbient<A>(rc: ReadContext, fn: () => A): A {
  return collectChanges(ambientToRc(rc), fn);
}
