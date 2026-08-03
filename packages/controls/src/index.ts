// Re-export all of @rxc/controls-core for single-import convenience
export * from "@rxc/controls-core";

// React-specific API
export {
  useControls,
  useComputed,
  ControlContextProvider,
  useControlContext,
} from "./useControls";

export type { Controls, Rendered } from "./types";
