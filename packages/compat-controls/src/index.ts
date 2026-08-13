/**
 * @rxc/compat-controls — drop-in replacement for the legacy
 * `@react-typed-forms/core` / `@astroapps/controls` surface, running on
 * `@rxc/controls-core`. See `docs/COMPAT-CONTROLS-DESIGN.md`.
 *
 * Phase A: the engine bridge (non-React surface). The React hooks and
 * components (`useControl`, `Finput`, …) land with Phase B; `trackedValue`
 * and the effects API with Phase C.
 */

// The prototype patch is a load-time side effect — importing anything from
// this package gives every control in the process the legacy surface.
import "./patch";

// ── Types ────────────────────────────────────────────────────────────
export {
  ControlChange,
  type ChangeListenerFunc,
  type CleanupScope,
  type CleanupScopeImpl,
  type Control,
  type ControlElements,
  type ControlFields,
  type ControlProperties,
  type ControlSetup,
  type ControlValidator,
  type ControlValue,
  type DelayedSetup,
  type Subscription,
  type Value,
} from "./types";

// ── Bridge 1: ambient reads ──────────────────────────────────────────
export {
  ambientToRc,
  collectChange,
  collectChanges,
  setChangeCollector,
  trackControlChange,
  withAmbient,
} from "./ambient";

// ── Bridge 2: ambient transactions ───────────────────────────────────
export {
  addAfterChangesCallback,
  groupedChanges,
  runInWc,
  runPendingChanges,
  runTransaction,
  unsafeFreezeCountEdit,
} from "./transactions";

// ── Bridge 3: compat context ─────────────────────────────────────────
export { getCompatContext, setCompatContext } from "./context";

// ── Patch + casts ────────────────────────────────────────────────────
export { asCore, asLegacy, ensurePatched, toImpl } from "./patch";

// ── Creation ─────────────────────────────────────────────────────────
export { controlGroup, convertSetup, newControl } from "./newControl";

// ── Arrays ───────────────────────────────────────────────────────────
export {
  addElement,
  getElementIndex,
  newElement,
  removeElement,
  updateElements,
} from "./arrays";

// ── Functions, meta, cleanup, stubs ──────────────────────────────────
export {
  ControlImpl,
  ControlMetricsRegistry,
  addCleanup,
  cleanupControl,
  clearMetaValue,
  cloneFields,
  controlNotNull,
  createCleanupScope,
  deepEquals,
  delayedValue,
  ensureMetaValue,
  getControlById,
  getControlMetrics,
  getControlPath,
  getCurrentFields,
  getHeavyControls,
  getMetaValue,
  notEmpty,
  printControlMetrics,
  printHeavyControls,
  setFields,
  updateComputedValue,
  withChildren,
  type ControlInfo,
  type ControlMetrics,
} from "./functions";
