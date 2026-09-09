// Re-export all of @rxc/controls-core for single-import convenience
export * from "@rxc/controls-core";

// React-specific API
export {
  useReactive,
  useComputed,
  ControlContextProvider,
  useControlContext,
  withControlContext,
} from "./useReactive.js";

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
  type FormControlBinding,
} from "./useFormControlProps.js";
export { ControlInput, type ControlInputProps } from "./ControlInput.js";
export { ControlSelect, type ControlSelectProps } from "./ControlSelect.js";
export { ControlCheckbox, type ControlCheckboxProps } from "./ControlCheckbox.js";

// Render helpers — nested subscription scopes
export {
  NotDefinedContext,
  NotDefinedProvider,
  RenderArrayElements,
  Reactive,
  RenderElements,
  RenderOptional,
  whenAllDefined,
} from "./components.js";

export type {
  ReactiveScope,
  RenderArrayElementsProps,
  RenderCallback,
  ReactiveProps,
  RenderElementsProps,
  RenderOptionalProps,
  Rendered,
  ControlValues,
} from "./types.js";
