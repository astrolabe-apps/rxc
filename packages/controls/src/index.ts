// Re-export all of @rxc/controls-core for single-import convenience
export * from "@rxc/controls-core";

// React-specific API
export {
  controls,
  ControlContextProvider,
  useControlContext,
} from "./controls";

export type {
  ControlsRender,
  ControlsContext,
  UpdateFn,
  UseComputed,
} from "./types";
