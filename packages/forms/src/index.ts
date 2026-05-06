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

// Data renderers
export { TextfieldRenderer } from "./renderers/data/Textfield";
export { NumberRenderer } from "./renderers/data/Number";
export { MultilineRenderer } from "./renderers/data/Multiline";
export { BoolRenderer } from "./renderers/data/Bool";
export { CheckboxRenderer } from "./renderers/data/Checkbox";
export {
  DateRenderer,
  DateTimeRenderer,
  TimeRenderer,
} from "./renderers/data/Date";
export { SelectRenderer } from "./renderers/data/Select";
export { RadioRenderer } from "./renderers/data/Radio";
export { ChecklistRenderer } from "./renderers/data/Checklist";
export { AutocompleteRenderer } from "./renderers/data/Autocomplete";
export { DisplayOnlyRenderer } from "./renderers/data/DisplayOnly";
export { ArrayRenderer } from "./renderers/data/Array";
export { CompoundDelegate } from "./renderers/data/Compound";

// Group renderers
export { StandardGroupRenderer } from "./renderers/group/Standard";
export { InlineGroupRenderer } from "./renderers/group/Inline";
export { FlexRenderer } from "./renderers/group/Flex";
export { GridRenderer } from "./renderers/group/Grid";
export { ContentsRenderer } from "./renderers/group/Contents";
export { SelectChildRenderer } from "./renderers/group/SelectChild";
export { TabsRenderer } from "./renderers/group/Tabs";
export { AccordionGroupRenderer } from "./renderers/group/AccordionGroup";
export { DialogRenderer } from "./renderers/group/Dialog";

// Action renderers
export { ButtonAction } from "./renderers/action/Button";

// Display renderers
export { TextDisplayRenderer } from "./renderers/display/Text";
export { HtmlDisplayRenderer } from "./renderers/display/Html";
export { IconDisplayRenderer, iconClassFor } from "./renderers/display/Icon";
export { CustomDisplayRenderer } from "./renderers/display/Custom";

// Adornments
export { IconAdornment } from "./adornments/Icon";
export { HelpTextAdornment } from "./adornments/HelpText";
export { OptionalAdornment } from "./adornments/Optional";
export { SetFieldAdornment } from "./adornments/SetField";
export { AccordionAdornment } from "./adornments/Accordion";

// Adornment composition primitives
export {
  indexAdornments,
  wrapAdornments,
  type AdornmentKind,
  type AdornmentRegistration,
  type AdornmentRenderProps,
} from "./Adornment";

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
