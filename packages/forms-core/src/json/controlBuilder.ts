import {
  ControlAdornmentType,
  ControlDefinitionType,
  DataRenderType,
  DisplayDataType,
  DynamicPropertyType,
  GroupRenderType,
  IconLibrary,
} from "./controlDefinition";
import type {
  AccordionAdornment,
  AccordionRenderer,
  ActionControlDefinition,
  ArrayElementRenderOptions,
  ArrayRenderOptions,
  AutocompleteRenderOptions,
  CheckListRenderOptions,
  ControlAdornment,
  ControlDefinition,
  CustomDisplay,
  DataControlDefinition,
  DateTimeRenderOptions,
  DialogRenderOptions,
  DisplayControlDefinition,
  DisplayOnlyRenderOptions,
  DynamicProperty,
  ElementSelectedRenderOptions,
  FlexRenderer,
  GridRendererOptions,
  GroupRenderOptions,
  GroupedControlsDefinition,
  HelpTextAdornment,
  HtmlDisplay,
  IconAdornment,
  IconDisplay,
  IconReference,
  JsonataRenderOptions,
  OptionalAdornment,
  RadioButtonRenderOptions,
  RenderOptions,
  ScrollListRenderOptions,
  SelectChildRenderer,
  SetFieldAdornment,
  StandardGroupRenderer,
  TabsRenderOptions,
  TextDisplay,
  TextfieldRenderOptions,
  TooltipAdornment,
  WizardRenderOptions,
} from "./controlDefinition";
import { AdornmentPlacement } from "./controlDefinition";
import { ValidatorType } from "./schemaValidator";
import type {
  DateValidator,
  JsonataValidator,
  LengthValidator,
} from "./schemaValidator";
import { ExpressionType } from "./entityExpression";
import type {
  DataExpression,
  DataMatchExpression,
  EntityExpression,
  JsonataExpression,
  NotEmptyExpression,
  NotExpression,
} from "./entityExpression";

export function dataControl(
  field: string,
  title?: string | null,
  options?: Partial<DataControlDefinition>,
): DataControlDefinition {
  return { type: ControlDefinitionType.Data, field, title, ...options };
}

export function validatorOptions<A extends { type: string }>(
  type: ValidatorType,
): (options: Omit<A, "type">) => A {
  return (o) => ({ type, ...o }) as A;
}

export function adornmentOptions<A extends { type: string }>(
  type: ControlAdornmentType,
): (options: Omit<A, "type">) => A {
  return (o) => ({ type, ...o }) as A;
}

export function renderOptionsFor<A extends RenderOptions>(
  type: DataRenderType,
): (options: Omit<A, "type">) => { renderOptions: A } {
  return (o) => ({ renderOptions: { type, ...o } as A });
}

export const autocompleteOptions = renderOptionsFor<AutocompleteRenderOptions>(
  DataRenderType.Autocomplete,
);

export const checkListOptions = renderOptionsFor<CheckListRenderOptions>(
  DataRenderType.CheckList,
);

export const radioButtonOptions = renderOptionsFor<RadioButtonRenderOptions>(
  DataRenderType.Radio,
);

export const lengthValidatorOptions = validatorOptions<LengthValidator>(
  ValidatorType.Length,
);

export const jsonataValidatorOptions = validatorOptions<JsonataValidator>(
  ValidatorType.Jsonata,
);

export const dateValidatorOptions = validatorOptions<DateValidator>(
  ValidatorType.Date,
);

export const accordionOptions = adornmentOptions<AccordionAdornment>(
  ControlAdornmentType.Accordion,
);

export const textfieldOptions = renderOptionsFor<TextfieldRenderOptions>(
  DataRenderType.Textfield,
);

export const displayOnlyOptions = renderOptionsFor<DisplayOnlyRenderOptions>(
  DataRenderType.DisplayOnly,
);

export const jsonataOptions = renderOptionsFor<JsonataRenderOptions>(
  DataRenderType.Jsonata,
);

export function textDisplayControl(
  text: string,
  options?: Partial<DisplayControlDefinition>,
): DisplayControlDefinition {
  return {
    type: ControlDefinitionType.Display,
    displayData: { type: DisplayDataType.Text, text } as TextDisplay,
    ...options,
  };
}

export function htmlDisplayControl(
  html: string,
  options?: Partial<DisplayControlDefinition>,
): DisplayControlDefinition {
  return {
    type: ControlDefinitionType.Display,
    displayData: { type: DisplayDataType.Html, html } as HtmlDisplay,
    ...options,
  };
}

/** @deprecated Use withScripts(def, { defaultValue: expr }) instead */
export function dynamicDefaultValue(expr: EntityExpression): DynamicProperty {
  return { type: DynamicPropertyType.DefaultValue, expr };
}

/** @deprecated Use withScripts(def, { readonly: expr }) instead */
export function dynamicReadonly(expr: EntityExpression): DynamicProperty {
  return { type: DynamicPropertyType.Readonly, expr };
}

/** @deprecated Use withScripts(def, { hidden: notExpr(expr) }) instead */
export function dynamicVisibility(expr: EntityExpression): DynamicProperty {
  return { type: DynamicPropertyType.Visible, expr };
}

/** @deprecated Use withScripts(def, { disabled: expr }) instead */
export function dynamicDisabled(expr: EntityExpression): DynamicProperty {
  return { type: DynamicPropertyType.Disabled, expr };
}

export function dataExpr(field: string): DataExpression {
  return { type: ExpressionType.Data, field };
}

/**
 * @deprecated Use dataExpr
 */
export const fieldExpr = dataExpr;

/**
 * @deprecated Use dataMatchExpr
 */
export const fieldEqExpr = dataMatchExpr;

export const uuidExpr = { type: ExpressionType.UUID };
export function dataMatchExpr(field: string, value: any): DataMatchExpression {
  return { type: ExpressionType.DataMatch, field, value };
}

export function notEmptyExpr(
  field: string,
  empty?: boolean,
): NotEmptyExpression {
  return { type: ExpressionType.NotEmpty, field, empty };
}
export function jsonataExpr(expression: string): JsonataExpression {
  return { type: ExpressionType.Jsonata, expression };
}

export function groupedControl(
  children: ControlDefinition[],
  title?: string,
  options?: Partial<GroupedControlsDefinition>,
): GroupedControlsDefinition {
  return {
    type: ControlDefinitionType.Group,
    children,
    title,
    groupOptions: { type: "Standard", hideTitle: !title },
    ...options,
  };
}
export function compoundControl(
  field: string,
  title: string | undefined | null,
  children: ControlDefinition[],
  options?: Partial<DataControlDefinition>,
): DataControlDefinition {
  return {
    type: ControlDefinitionType.Data,
    field,
    children,
    title,
    renderOptions: { type: "Standard" },
    ...options,
  };
}

export function actionControl(
  actionText: string,
  actionId: string,
  options?: Partial<ActionControlDefinition>,
): ActionControlDefinition {
  return {
    type: ControlDefinitionType.Action,
    title: actionText,
    actionId,
    ...options,
  };
}
export const emptyGroupDefinition: GroupedControlsDefinition = {
  type: ControlDefinitionType.Group,
  children: [],
  groupOptions: { type: GroupRenderType.Standard, hideTitle: true },
};

export function notExpr(innerExpression: EntityExpression): NotExpression {
  return { type: ExpressionType.Not, innerExpression };
}

export function withScripts<T extends ControlDefinition>(
  def: T,
  scripts: Record<string, EntityExpression>,
): T {
  return { ...def, ["$scripts"]: scripts } as T;
}

export function withAdornments<T extends ControlDefinition>(
  def: T,
  adornments: ControlAdornment[],
): T {
  return { ...def, adornments } as T;
}

// ── Render options helpers ────────────────────────────────────────────

export const arrayOptions = renderOptionsFor<ArrayRenderOptions>(
  DataRenderType.Array,
);

export const arrayElementOptions = renderOptionsFor<ArrayElementRenderOptions>(
  DataRenderType.ArrayElement,
);

export const elementSelectedOptions =
  renderOptionsFor<ElementSelectedRenderOptions>(
    DataRenderType.ElementSelected,
  );

export const scrollListOptions = renderOptionsFor<ScrollListRenderOptions>(
  DataRenderType.ScrollList,
);

export const dateTimeOptions = renderOptionsFor<DateTimeRenderOptions>(
  DataRenderType.DateTime,
);

// ── Group options helpers ─────────────────────────────────────────────

export function groupOptionsFor<A extends GroupRenderOptions>(
  type: GroupRenderType,
): (options?: Omit<A, "type">) => { groupOptions: A } {
  return (o) => ({ groupOptions: { type, ...(o ?? {}) } as A });
}

export const standardGroupOptions =
  groupOptionsFor<StandardGroupRenderer>(GroupRenderType.Standard);

export const flexOptions = groupOptionsFor<FlexRenderer>(GroupRenderType.Flex);

export const gridOptions = groupOptionsFor<GridRendererOptions>(
  GroupRenderType.Grid,
);

export const tabsOptions = groupOptionsFor<TabsRenderOptions>(
  GroupRenderType.Tabs,
);

export const accordionGroupOptions = groupOptionsFor<AccordionRenderer>(
  GroupRenderType.Accordion,
);

export const inlineOptions = groupOptionsFor<StandardGroupRenderer>(
  GroupRenderType.Inline,
);

export const contentsOptions = groupOptionsFor<StandardGroupRenderer>(
  GroupRenderType.Contents,
);

export const selectChildOptions = groupOptionsFor<SelectChildRenderer>(
  GroupRenderType.SelectChild,
);

export const dialogOptions = groupOptionsFor<DialogRenderOptions>(
  GroupRenderType.Dialog,
);

export const wizardOptions = groupOptionsFor<WizardRenderOptions>(
  GroupRenderType.Wizard,
);

// ── Display control helpers ───────────────────────────────────────────

export function iconDisplayControl(
  icon: IconReference,
  options?: Partial<DisplayControlDefinition> & { iconClass?: string },
): DisplayControlDefinition {
  const { iconClass = "", ...rest } = options ?? {};
  return {
    type: ControlDefinitionType.Display,
    displayData: { type: DisplayDataType.Icon, iconClass, icon } as IconDisplay,
    ...rest,
  };
}

export function customDisplayControl(
  customId: string,
  options?: Partial<DisplayControlDefinition>,
): DisplayControlDefinition {
  return {
    type: ControlDefinitionType.Display,
    displayData: { type: DisplayDataType.Custom, customId } as CustomDisplay,
    ...options,
  };
}

// ── Icon helpers ──────────────────────────────────────────────────────
// `fontAwesomeIcon` already lives in controlDefinition.ts.

export function materialIcon(name: string): IconReference {
  return { library: IconLibrary.Material, name };
}

export function cssClassIcon(name: string): IconReference {
  return { library: IconLibrary.CssClass, name };
}

// ── Adornment builders ────────────────────────────────────────────────

export function iconAdornment(
  icon: IconReference,
  options?: { iconClass?: string; placement?: AdornmentPlacement | null },
): IconAdornment {
  const { iconClass = "", placement } = options ?? {};
  return {
    type: ControlAdornmentType.Icon,
    iconClass,
    icon,
    ...(placement !== undefined ? { placement } : {}),
  };
}

export function helpTextAdornment(
  helpText: string,
  placement?: AdornmentPlacement | null,
): HelpTextAdornment {
  return {
    type: ControlAdornmentType.HelpText,
    helpText,
    ...(placement !== undefined ? { placement } : {}),
  };
}

export function tooltipAdornment(tooltip: string): TooltipAdornment {
  return { type: ControlAdornmentType.Tooltip, tooltip };
}

export function setFieldAdornment(
  field: string,
  expression: EntityExpression,
  options?: Omit<SetFieldAdornment, "type" | "field" | "expression">,
): SetFieldAdornment {
  return {
    type: ControlAdornmentType.SetField,
    field,
    expression,
    ...options,
  };
}

export function optionalAdornment(
  options?: Omit<OptionalAdornment, "type">,
): OptionalAdornment {
  return { type: ControlAdornmentType.Optional, ...options };
}

export function accordionAdornment(
  title: string,
  options?: Omit<AccordionAdornment, "type" | "title">,
): AccordionAdornment {
  return { type: ControlAdornmentType.Accordion, title, ...options };
}
