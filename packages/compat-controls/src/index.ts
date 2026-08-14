/**
 * @rxc/compat-controls — drop-in replacement for the legacy
 * `@react-typed-forms/core` / `@astroapps/controls` surface, running on
 * `@rxc/controls-core`. See `docs/COMPAT-CONTROLS-DESIGN.md`.
 *
 * Phases A (engine bridge) + B (React surface) are implemented;
 * `trackedValue` and the effects API land with Phase C.
 */

// The prototype patch is a load-time side effect — importing anything from
// this package gives every control in the process the legacy surface.
//
// One-time migration step for the React layer: mount
// `<ControlContextProvider value={getCompatContext()}>` at the app root —
// the hooks and components below resolve their context through it.
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

// ── React: component tracking (SWC-plugin contract) ──────────────────
export { useComponentTracking, useTrackedComponent } from "./useComponentTracking";

// The one-line root wrap for legacy apps:
// <ControlContextProvider value={getCompatContext()}>
export { ControlContextProvider } from "@rxc/controls";

// ── React: hooks ─────────────────────────────────────────────────────
export {
  controlValues,
  ensureSelectableValues,
  useAsyncValidator,
  useCalculatedControl,
  useComputed,
  useControl,
  useControlEffect,
  useControlGroup,
  useDebounced,
  usePreviousValue,
  useRefState,
  useSelectableArray,
  useValidator,
  useValueChangeEffect,
  type SelectionGroup,
  type SelectionGroupSync,
} from "./hooks";

// ── React: input binding ─────────────────────────────────────────────
export {
  formControlProps,
  useFormControlProps,
  type FormControlProps,
} from "./formControlProps";
export {
  FormEditProvider,
  useFormEdit,
  type FormEditState,
} from "@rxc/controls";

// ── React: components ────────────────────────────────────────────────
export {
  Fcheckbox,
  Finput,
  Fselect,
  NotDefinedContext,
  RenderArrayElements,
  RenderControl,
  RenderElements,
  RenderOptional,
  renderOptionally,
  type FcheckboxProps,
  type FinputProps,
  type FselectProps,
  type RenderArrayElementsProps,
  type RenderControlProps,
  type RenderElementsProps,
} from "./components";

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
