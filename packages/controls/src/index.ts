// Re-export all of @rxc/controls-core for single-import convenience
export * from "@rxc/controls-core";

// React-specific API
export {
  useControls,
  useComputed,
  ControlContextProvider,
  useControlContext,
  wrapWithControlsContext,
} from "./useControls.js";

export { useControl } from "./useControl.js";
export type { UseControlSetup } from "./useControl.js";

export { useControlEffect } from "./useControlEffect.js";

export { useValidator, useAsyncValidator } from "./useValidator.js";

export { useControlGroup } from "./useControlGroup.js";
export { usePreviousValue } from "./usePreviousValue.js";
export {
  ensureSelectableValues,
  useSelectableArray,
  type SelectionGroup,
  type SelectionGroupSync,
} from "./useSelectableArray.js";

// Binding layer — controls ↔ native form elements
export {
  FormEditProvider,
  useFormEdit,
  type FormEditState,
} from "./FormEditState.js";
export {
  useFormControlProps,
  type FormControlProps,
} from "./useFormControlProps.js";
export { Finput, type FinputProps } from "./Finput.js";
export { Fselect, type FselectProps } from "./Fselect.js";
export { Fcheckbox, type FcheckboxProps } from "./Fcheckbox.js";

// Render helpers — nested subscription scopes
export {
  NotDefinedContext,
  RenderArrayElements,
  RenderControl,
  RenderElements,
  RenderOptional,
  renderOptionally,
} from "./components.js";

export type {
  Controls,
  RenderArrayElementsProps,
  RenderCallback,
  RenderControlProps,
  RenderElementsProps,
  RenderOptionalProps,
  Rendered,
  ValuesOfControls,
} from "./types.js";
