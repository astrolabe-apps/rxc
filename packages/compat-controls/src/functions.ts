/**
 * The legacy free-function surface: trivial ports, re-typed re-exports, and
 * the documented no-op stubs. Everything here is non-React (Phase A);
 * `trackedValue`, the effects API, and `SubscriptionTracker` land with
 * Phase C.
 */

import {
  computed,
  deepEquals,
  getControlPath as coreGetControlPath,
  setFields as coreSetFields,
  type ComputedRef,
  type Control as CoreControl,
} from "@rxc/controls-core";
import { ControlImpl, toImpl } from "@rxc/controls-core/internal";
import { withAmbient } from "./ambient";
import { getCompatContext } from "./context";
import { newControl } from "./newControl";
import { asLegacy, asCore } from "./patch";
import { runInWc } from "./transactions";
import type { CleanupScopeImpl, Control, Value } from "./types";

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

/** The materialized fields of an object control, keyed by name. */
export function getCurrentFields<V extends Record<string, any>>(
  control: Control<V>,
): { [K in keyof V]?: Control<V[K]> } {
  return control.fieldsNow as { [K in keyof V]?: Control<V[K]> };
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
    | { ref: ComputedRef; compute: () => V }
    | undefined;
  if (existing?.compute === compute) return;
  const wrapped = (rc: Parameters<Parameters<typeof computed>[2]>[0]) =>
    withAmbient(rc, compute);
  if (existing) {
    existing.ref.replaceCompute(wrapped);
    existing.compute = compute;
    return;
  }
  const ref = computed(getCompatContext(), asCore(control), wrapped);
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
