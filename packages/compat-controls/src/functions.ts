/**
 * The legacy free-function surface: trivial ports, re-typed re-exports, and
 * the documented no-op stubs. Everything here is non-React (Phase A);
 * `trackedValue`, the effects API, and `SubscriptionTracker` land with
 * Phase C.
 */

import {
  computeInto,
  deepEquals,
  getControlPath as coreGetControlPath,
  attachFields as coreSetFields,
  type ComputedHandle,
  type Control as CoreControl,
} from "@rx-controls/core";
import { ControlImpl, toImpl } from "@rx-controls/core/internal";
import {
  collectChange,
  describeCollector,
  enterCompute,
  exitCompute,
  withAmbient,
} from "./ambient.js";
import { getCompatContext } from "./context.js";
import { newControl } from "./newControl.js";
import { asLegacy, asCore } from "./patch.js";
import { runInWc } from "./transactions.js";
import type { CleanupScope, CleanupScopeImpl, Control, Value } from "./types.js";

export { deepEquals };

// ── Validation ───────────────────────────────────────────────────────

export function notEmpty<V>(msg: string): (v: V) => string | undefined {
  return (v) => (!v ? msg : undefined);
}

// ── Navigation / null helpers ────────────────────────────────────────

/** Narrow a nullable control: `undefined` when absent or holding null.
 * Reads `isNull` through the patched getter, so the ambient collector (if
 * any) tracks the null-ness. */
export function controlNotNull<V>(
  c: Control<V | null | undefined> | undefined | null,
): Control<V> | undefined {
  return !c || c.isNull ? undefined : (c as Control<V>);
}

export function getControlPath(
  c: Control<any>,
  untilParent?: Control<any>,
): (string | number)[] {
  return coreGetControlPath(
    asCore(c),
    untilParent ? asCore(untilParent) : undefined,
  );
}

/** A lazily computed value holder. */
export function delayedValue<V>(v: () => V): Value<V> {
  return {
    get value() {
      return v();
    },
  };
}

/** Apply `f` to each *existing* child control (materialized fields and
 * elements) — no lazy creation, matching legacy. */
export function withChildren(
  parent: Control<any>,
  f: (c: Control<any>) => void,
): void {
  const impl = toImpl(asCore(parent));
  if (impl._fields) {
    for (const child of Object.values(impl._fields)) {
      f(asLegacy(child as unknown as CoreControl<unknown>));
    }
  }
  impl._elems?.forEach((child) =>
    f(asLegacy(child as unknown as CoreControl<unknown>)),
  );
}

// ── Object controls ──────────────────────────────────────────────────

/**
 * The materialized fields of an object control, keyed by name.
 *
 * Returns the control's **live** `_fields` record, not a snapshot: fields
 * created after this call show up in the object the caller already holds.
 * That aliasing is load-bearing. Legacy went through
 * `_logic.ensureObject()._fields`, whose `ensureObject()` forced the record
 * into existence, and callers rely on it — `createOverrideProxy` in
 * `@astroapps/forms-core` captures the record once at construction and then
 * expects later-created override fields to appear through it.
 *
 * Hence the explicit materialization: `existingFields` yields a throwaway
 * `{}` while `_fields` is still undefined, so a caller capturing that early
 * would be left holding an object the engine never writes to (every nested
 * scripted override silently stopped applying).
 */
export function getCurrentFields<V extends Record<string, any>>(
  control: Control<V>,
): { [K in keyof V]?: Control<V[K]> } {
  const impl = toImpl(asCore(control));
  // Same shape the engine's own lazy creation uses (ControlImpl.getField).
  impl._fields ??= Object.create(null);
  return impl._fields as unknown as { [K in keyof V]?: Control<V[K]> };
}

/**
 * A new control with `control`'s current value/initialValue whose fields are
 * `control`'s *actual* field controls (attached, not copied) — edits through
 * either parent flow to the shared children.
 */
export function cloneFields<V extends Record<string, any>>(
  control: Control<V>,
): Control<V> {
  const nc = newControl(control.current.value, undefined, control.current.initialValue);
  const impl = toImpl(asCore(control));
  const fields = impl._fields;
  if (fields && Object.keys(fields).length > 0) {
    runInWc((wc) =>
      coreSetFields(
        wc,
        asCore(nc),
        fields as unknown as Record<string, CoreControl<unknown>>,
      ),
    );
  }
  return nc;
}

/** Attach `fields` controls onto `control` (legacy two-arg signature). */
export function setFields<V, OTHER extends { [p: string]: any }>(
  control: Control<V>,
  fields: { [K in keyof OTHER]-?: Control<OTHER[K]> },
): Control<V & OTHER> {
  return asLegacy(
    runInWc((wc) =>
      coreSetFields(
        wc,
        asCore(control),
        fields as unknown as Record<string, CoreControl<unknown>>,
      ),
    ),
  ) as Control<V & OTHER>;
}

// ── Meta helpers (legacy signatures — init takes no arguments) ───────

export function ensureMetaValue<V>(
  control: Control<any>,
  key: string,
  init: () => V,
): V {
  const meta = control.meta;
  if (!(key in meta)) meta[key] = init();
  return meta[key] as V;
}

export function getMetaValue<V>(control: Control<any>, key: string): V | undefined {
  return control.meta[key] as V | undefined;
}

export function clearMetaValue(control: Control<any>, key: string): void {
  delete control.meta[key];
}

// ── Computed value ───────────────────────────────────────────────────

const COMPUTED_KEY = "$compatComputed";

/**
 * Keep `control`'s value computed from other controls: recomputes (and
 * writes) whenever anything `compute` read through the patched getters
 * changes. Re-calling with the same function is a no-op; a new function
 * replaces the computation. Torn down by `control.cleanup()`.
 */
export function updateComputedValue<V>(
  control: Control<V>,
  compute: () => V,
): void {
  const meta = control.meta;
  const existing = meta[COMPUTED_KEY] as
    | { ref: ComputedHandle; compute: () => V }
    | undefined;
  if (existing?.compute === compute) return;
  const wrapped = (rc: Parameters<Parameters<typeof computeInto>[2]>[0]) => {
    // Record what the ambient collector was on entry, then confirm whether
    // `withAmbient` actually becomes the collector for the compute's reads.
    // Both helpers are no-ops outside a dev build.
    enterCompute(describeCollector(collectChange));
    try {
      return withAmbient(rc, compute);
    } finally {
      exitCompute();
    }
  };
  if (existing) {
    existing.ref.replaceCompute(wrapped);
    existing.compute = compute;
    return;
  }
  const ref = computeInto(getCompatContext(), asCore(control), wrapped);
  meta[COMPUTED_KEY] = { ref, compute };
  control.addCleanup(() => {
    ref.cleanup();
    delete meta[COMPUTED_KEY];
  });
}

// ── Cleanup scopes ───────────────────────────────────────────────────

export function addCleanup(scope: { addCleanup(cb: () => void): void }, cleanup: () => void): void {
  scope.addCleanup(cleanup);
}

export function cleanupControl(c: Control<any>): void {
  c.cleanup();
}

/** Tear down `child` when `parent`'s scope cleans up. */
export function addDependent(parent: CleanupScope, child: Control<any>): void {
  parent.addCleanup(() => child.cleanup());
}

export function createCleanupScope(): CleanupScopeImpl {
  let cleanups: (() => void)[] = [];
  return {
    addCleanup(cb) {
      cleanups.push(cb);
    },
    cleanup() {
      const list = cleanups;
      cleanups = [];
      list.forEach((fn) => fn());
    },
  };
}

// ── Diagnostics stubs (no engine analogue — documented no-ops) ───────

export function getControlMetrics(): Record<string, never> {
  return {};
}
export function getHeavyControls(): unknown[] {
  return [];
}
export function getControlById(_id: number): Control<any> | undefined {
  return undefined;
}
export function printControlMetrics(): void {}
export function printHeavyControls(): void {}
export class ControlMetricsRegistry {}
export type ControlMetrics = Record<string, never>;
export type ControlInfo = Record<string, never>;

// Re-export the impl escape hatch some legacy diagnostics code used.
export { ControlImpl };
