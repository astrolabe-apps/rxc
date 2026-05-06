// Public API for @rxc/forms

// Components
export { Form } from "./Form";
export { Field } from "./Field";
export { Label } from "./Label";
export { Error } from "./Error";

// FormStateNode helper hook
export { useFormStateNode } from "./useFormStateNode";

// Layout / Visibility
export {
  DefaultLayout,
  LayoutProvider,
  useLayout,
} from "./Layout";
export {
  DefaultVisibility,
  VisibilityProvider,
  useVisibility,
} from "./Visibility";

// Provider hooks
export {
  RegistryProvider,
  useRegistry,
  OptionsProvider,
  useFormOptions,
} from "./FormProvider";

// Registry + dispatch
export {
  combineRegistries,
  emptyRegistry,
  pickActionRenderer,
  pickDataRenderer,
  pickDisplayRenderer,
  pickGroupRenderer,
} from "./registry";
export type {
  ActionMatcher,
  DataMatcher,
  DisplayMatcher,
  FormRegistry,
  GroupMatcher,
} from "./registry";

// Matcher sugar helpers
export {
  matchActionAlways,
  matchActionId,
  matchAll,
  matchAny,
  matchCollection,
  matchCompoundField,
  matchDataAlways,
  matchDisplayAlways,
  matchDisplayDataType,
  matchGroupAlways,
  matchGroupRenderType,
  matchHasOptions,
  matchRenderType,
  matchRenderTypeOneOf,
  matchSchemaType,
} from "./matchers";

// Default built-ins
export { defaultRegistry } from "./builtins";

// Phase 1 renderers
export { TextfieldRenderer } from "./renderers/data/Textfield";
export { NumberRenderer } from "./renderers/data/Number";
export { CompoundDelegate } from "./renderers/data/Compound";
export { StandardGroupRenderer } from "./renderers/group/Standard";

// Helpers
export { useLabelText } from "./labelText";

// Types
export type {
  ActionMatch,
  ActionRenderer,
  ActionRendererProps,
  DataMatch,
  DataRenderer,
  DataRendererProps,
  DisplayMatch,
  DisplayRenderer,
  DisplayRendererProps,
  FieldProps,
  FormOptions,
  FormProps,
  GroupMatch,
  GroupRenderer,
  GroupRendererProps,
  LayoutComponent,
  LayoutProps,
  VisibilityComponent,
  VisibilityProps,
} from "./types";
