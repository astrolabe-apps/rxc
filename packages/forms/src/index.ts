// Public API for @rxc/forms (HTML platform package)
//
// Re-exports the headless surface from @rxc/forms-react-core, then adds
// HTML-specific components (Field/Form/DefaultLabel/DefaultError/Layout/Visibility),
// HTML renderers + adornments, and the HTML defaultRegistry.

// ── Headless surface ─────────────────────────────────────────────────

export * from "@rxc/forms-react-core";

// ── HTML components ──────────────────────────────────────────────────

export { Form } from "./Form";
export { Field } from "./Field";
export {
  DefaultLabel,
  LabelProvider,
  useLabel,
  isGroupLabel,
} from "./Label";
export type { LabelProps, LabelComponent } from "./Label";
export { DefaultError, ErrorProvider, useError } from "./Error";
export type { ErrorProps, ErrorComponent } from "./Error";

// FormStateNode helper hook (HTML wrapper that defaults registry)
export { useFormStateNode } from "./useFormStateNode";

// Layout / Visibility (HTML chrome)
export { DefaultLayout, LayoutProvider, useLayout } from "./Layout";
export {
  DefaultVisibility,
  VisibilityProvider,
  useVisibility,
} from "./Visibility";

// Default built-ins (HTML registry)
export { defaultRegistry, matchBoolField } from "./builtins";

// ── HTML data renderers ──────────────────────────────────────────────

export { TextfieldRenderer } from "./renderers/data/Textfield";
export { NumberRenderer } from "./renderers/data/Number";
export { MultilineRenderer } from "./renderers/data/Multiline";
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
export { JsonataRenderer } from "./renderers/data/Jsonata";
export { ElementSelectedRenderer } from "./renderers/data/ElementSelected";
export { ScrollListRenderer } from "./renderers/data/ScrollList";
export { ArrayElementRenderer } from "./renderers/data/ArrayElement";

// ── HTML group renderers ─────────────────────────────────────────────

export { StandardGroupRenderer } from "./renderers/group/Standard";
export { InlineGroupRenderer } from "./renderers/group/Inline";
export { FlexRenderer } from "./renderers/group/Flex";
export { GridRenderer } from "./renderers/group/Grid";
export { ContentsRenderer } from "./renderers/group/Contents";
export { SelectChildRenderer } from "./renderers/group/SelectChild";
export { TabsRenderer } from "./renderers/group/Tabs";
export { AccordionGroupRenderer } from "./renderers/group/AccordionGroup";
export { DialogRenderer } from "./renderers/group/Dialog";
export { WizardRenderer } from "./renderers/group/Wizard";

// ── HTML action renderers ────────────────────────────────────────────

export { ButtonAction } from "./renderers/action/Button";

// ── HTML display renderers ───────────────────────────────────────────

export { TextDisplayRenderer } from "./renderers/display/Text";
export { HtmlDisplayRenderer } from "./renderers/display/Html";
export { IconDisplayRenderer, resolveIcon } from "./renderers/display/Icon";
export type { ResolvedIcon } from "./renderers/display/Icon";
export { CustomDisplayRenderer } from "./renderers/display/Custom";

// ── HTML adornments ──────────────────────────────────────────────────

export { IconAdornment } from "./adornments/Icon";
export { HelpTextAdornment } from "./adornments/HelpText";
export { OptionalAdornment } from "./adornments/Optional";
export { SetFieldAdornment } from "./adornments/SetField";
export { AccordionAdornment } from "./adornments/Accordion";

// ── HTML-specific types ──────────────────────────────────────────────

export type {
  FieldProps,
  FormProps,
  LayoutComponent,
  LayoutProps,
  UseFormStateNodeOptions,
  VisibilityComponent,
  VisibilityProps,
} from "./types";

// ── Theme + class-merge utilities ────────────────────────────────────

export type {
  HtmlAccordionAdornmentTheme,
  HtmlAccordionGroupTheme,
  HtmlActionTheme,
  HtmlAdornmentTheme,
  HtmlArrayTheme,
  HtmlAutocompleteTheme,
  HtmlCheckboxTheme,
  HtmlDataTheme,
  HtmlDialogTheme,
  HtmlDisplayTheme,
  HtmlErrorTheme,
  HtmlFormOptions,
  HtmlFormTheme,
  HtmlGridTheme,
  HtmlGroupTheme,
  HtmlHelpTextTheme,
  HtmlLabelTheme,
  HtmlLayoutTheme,
  HtmlMultilineTheme,
  HtmlOptionalAdornmentTheme,
  OptionalCustomRenderProps,
  HtmlOptionGroupTheme,
  HtmlSelectTheme,
  HtmlTabsTheme,
} from "./theme";
export { useHtmlTheme } from "./useHtmlTheme";
export { defaultHtmlTheme, deepMergeTheme } from "./defaultTheme";
