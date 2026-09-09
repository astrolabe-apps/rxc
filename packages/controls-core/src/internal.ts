// Internal API — for use by @rxc/controls, @rxc/compat-* packages only.
// Not part of the public API contract.

export {
  ControlImpl,
  toImpl,
  type NotifyFn,
  noopNotify,
  ControlFlags,
  type ParentLink,
  type ControlContextInternal,
} from "./controlImpl.js";

export { WriteContextImpl } from "./writeContextImpl.js";

export {
  TrackingReadContext,
  SubscriptionReconciler,
  setEscapedReadHook,
  type EscapedReadHook,
} from "./readContextImpl.js";

export { Subscriptions } from "./subscriptions.js";

// Re-export public API for convenience
export * from "./index.js";
