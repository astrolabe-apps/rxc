// Public API for @rxc/forms-react-core
//
// Headless registration machinery + hooks. Platform packages
// (@rxc/forms for web, @rxc/forms-native for React Native) supply the
// concrete <Field>, <Form>, <Layout>, <Visibility>, <Label>, <Error>
// and the renderer/adornment registrations.

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
  SchemaExtensionsMap,
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

// Adornment composition primitives
export {
  indexAdornments,
  wrapAdornments,
  type AdornmentKind,
  type AdornmentRegistration,
  type AdornmentRenderProps,
  type AnyAdornmentRegistration,
} from "./Adornment";

// Provider hooks
export {
  RegistryProvider,
  useRegistry,
  OptionsProvider,
  useFormOptions,
} from "./FormProvider";

// Action infrastructure
export {
  ActionScope,
  useActionHandler,
  type ActionHandler,
  type ActionHandlerResult,
} from "./ActionScope";
export { useAsyncAction, runAsyncAction } from "./useAsyncAction";

// Plugin bundle helpers
export {
  actionPlugin,
  collectExtraRenderOptionFields,
  dataPlugin,
  displayPlugin,
  groupPlugin,
  type ActionPluginSpec,
  type DataPluginSpec,
  type DisplayPluginSpec,
  type EditorPluginSlot,
  type GroupPluginSpec,
} from "./plugins";

// Design mode
export {
  DesignModeContext,
  DesignModeProvider,
  useDesignMode,
} from "./DesignMode";

// FormStateNode helper hook
export { useFormStateNode } from "./useFormStateNode";

// Helpers
export { useLabelText } from "./labelText";
export { useExpression } from "./useExpression";

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
  FormOptions,
  GroupMatch,
  GroupRenderer,
  GroupRendererProps,
  UseFormStateNodeOptions,
} from "./types";
