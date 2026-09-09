// Re-export all of @rxc/controls-core for single-import convenience
export * from "@rxc/controls-core";

// React-specific API
export {
  useControls,
  useComputed,
  ControlContextProvider,
  useControlContext,
  withControlContext,
} from "./useControls.js";

export { useControl } from "./useControl.js";
export type { UseControlOptions } from "./useControl.js";

export { useControlEffect } from "./useControlEffect.js";

export { useValidator, useAsyncValidator } from "./useValidator.js";

export { useControlGroup } from "./useControlGroup.js";
export { useValueWithPrevious } from "./useValueWithPrevious.js";
export {
  selectableValues,
  useSelectableArray,
  type SelectionGroup,
  type SelectionBuilder,
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
  whenAllDefined,
} from "./components.js";

export type {
  Controls,
  RenderArrayElementsProps,
  RenderCallback,
  RenderControlProps,
  RenderElementsProps,
  RenderOptionalProps,
  Rendered,
  ControlValues,
} from "./types.js";
