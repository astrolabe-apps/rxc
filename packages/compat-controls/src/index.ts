/**
 * @react-typed-forms/core v5 — the legacy v4 (`@react-typed-forms/core` /
 * `@astroapps/controls`) surface reimplemented on `@rxc/controls-core`.
 * Published under the legacy package name, so migrating is a semver-major
 * bump plus the provider line below. Lives in the rxc repo as
 * `packages/compat-controls`; design in `docs/COMPAT-CONTROLS-DESIGN.md`.
 *
 * All three phases are implemented: A (engine bridge), B (React surface),
 * C (`trackedValue` + the effects API + `SubscriptionTracker`).
 */

// The prototype patch is a load-time side effect — importing anything from
// this package gives every control in the process the legacy surface.
//
// One-time migration step for the React layer: mount
// `<ControlContextProvider value={getCompatContext()}>` at the app root —
// the hooks and components below resolve their context through it.
import "./patch.js";

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
  type FieldsUndefined,
  type Subscription,
  type Value,
} from "./types.js";

// ── Bridge 1: ambient reads ──────────────────────────────────────────
export {
  ambientToRc,
  collectChange,
  collectChanges,
  setChangeCollector,
  trackControlChange,
  withAmbient,
} from "./ambient.js";

// ── Bridge 2: ambient transactions ───────────────────────────────────
export {
  addAfterChangesCallback,
  groupedChanges,
  runInWc,
  runPendingChanges,
  runTransaction,
  unsafeFreezeCountEdit,
} from "./transactions.js";

// ── Bridge 3: compat context ─────────────────────────────────────────
export { getCompatContext, setCompatContext } from "./context.js";

// ── Patch + casts ────────────────────────────────────────────────────
export { asCore, asLegacy, ensurePatched, toImpl } from "./patch.js";

// ── Creation ─────────────────────────────────────────────────────────
export { controlGroup, convertSetup, newControl } from "./newControl.js";

// ── Arrays ───────────────────────────────────────────────────────────
export {
  addElement,
  getElementIndex,
  newElement,
  removeElement,
  updateElements,
} from "./arrays.js";

// ── React: component tracking (SWC-plugin contract) ──────────────────
export { useComponentTracking, useTrackedComponent } from "./useComponentTracking.js";

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
} from "./hooks.js";

// ── React: input binding ─────────────────────────────────────────────
export {
  formControlProps,
  useFormControlProps,
  type FormControlProps,
} from "./formControlProps.js";
export {
  FormEditProvider,
  useFormEdit,
  type FormEditState,
} from "./formEdit.js";

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
} from "./components.js";

// ── Effects (Phase C) ────────────────────────────────────────────────
export {
  AsyncEffect,
  Effect,
  SubscriptionTracker,
  createAsyncEffect,
  createEffect,
  createScopedEffect,
  createSyncEffect,
  type TrackedSubscription,
} from "./effects.js";

// ── trackedValue (Phase C) ───────────────────────────────────────────
export {
  trackedValue,
  unsafeRestoreControl,
  unwrapTrackedControl,
} from "./trackedValue.js";

// ── Functions, meta, cleanup, stubs ──────────────────────────────────
export {
  ControlImpl,
  ControlMetricsRegistry,
  addCleanup,
  addDependent,
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
} from "./functions.js";
