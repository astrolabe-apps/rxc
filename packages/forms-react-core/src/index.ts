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
export { Action } from "./Action";

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
export { useDeferredCleanup } from "./useDeferredCleanup";

// Helpers
export { resolveLabelText } from "./labelText";
export { useExpression, ensureExpressionResult } from "./useExpression";
export { getExternalEdit } from "./getExternalEdit";
export type {
  ExternalEditAction,
  ExternalEditController,
  ExternalEditSession,
} from "./getExternalEdit";
export { useFormErrors } from "./useFormErrors";
export type { FormError } from "./useFormErrors";
export {
  useWizardController,
  type WizardController,
  type WizardStepInfo,
} from "./useWizardController";

// Platform-agnostic renderer controllers (React Native readiness)
export {
  valueToString,
  stringToValue,
  mapChildrenByOptionValue,
} from "./optionCoerce";
export {
  useTextInputController,
  useNumberController,
  useDateController,
  type TextInputController,
  type NumberInputController,
  type DateInputController,
} from "./useInputControllers";
export {
  useSelectController,
  useRadioController,
  useChecklistController,
  useCheckboxController,
  useElementSelectedController,
  type SelectController,
  type RadioController,
  type RadioOptionEntry,
  type ChecklistController,
  type ChecklistOptionEntry,
  type CheckboxController,
  type ElementSelectedController,
} from "./useOptionControllers";
export {
  useAutocompleteController,
  type AutocompleteController,
} from "./useAutocompleteController";
export {
  useArrayActions,
  useScrollListController,
  type ArrayActionsController,
  type ArrayRowActions,
  type ScrollListController,
} from "./useCollectionControllers";
export {
  useTabsController,
  useDisclosure,
  useAccordionSection,
  type TabsController,
  type TabInfo,
  type DisclosureController,
  type AccordionSectionController,
} from "./useGroupControllers";
export { clsx, getOverrideClass, rendererClass } from "./className";

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
