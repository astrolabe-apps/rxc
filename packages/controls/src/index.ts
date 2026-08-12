// Re-export all of @rxc/controls-core for single-import convenience
export * from "@rxc/controls-core";

// React-specific API
export {
  useControls,
  useComputed,
  ControlContextProvider,
  useControlContext,
} from "./useControls";

export { useControl } from "./useControl";
export type { UseControlSetup } from "./useControl";

export { useControlEffect } from "./useControlEffect";

export { useValidator, useAsyncValidator } from "./useValidator";

export { useControlGroup } from "./useControlGroup";
export { usePreviousValue } from "./usePreviousValue";
export {
  ensureSelectableValues,
  useSelectableArray,
  type SelectionGroup,
  type SelectionGroupSync,
} from "./useSelectableArray";

// Binding layer — controls ↔ native form elements
export {
  FormEditProvider,
  useFormEdit,
  type FormEditState,
} from "./FormEditState";
export {
  useFormControlProps,
  type FormControlProps,
} from "./useFormControlProps";
export { Finput, type FinputProps } from "./Finput";
export { Fselect, type FselectProps } from "./Fselect";
export { Fcheckbox, type FcheckboxProps } from "./Fcheckbox";

// Render helpers — nested subscription scopes
export {
  NotDefinedContext,
  RenderArrayElements,
  RenderControl,
  RenderElements,
  RenderOptional,
  renderOptionally,
} from "./components";

export type {
  Controls,
  RenderArrayElementsProps,
  RenderCallback,
  RenderControlProps,
  RenderElementsProps,
  RenderOptionalProps,
  Rendered,
  ValuesOfControls,
} from "./types";
