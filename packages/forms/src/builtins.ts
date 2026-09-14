import {
  DataRenderType,
  DisplayDataType,
  FieldType,
  GroupRenderType,
  isDataControl,
  type FormStateNode,
  type TextfieldRenderOptions,
} from "@rx-controls/forms-core";
import type { ReadContext } from "@rx-controls/core";
import {
  combineRegistries,
  matchAll,
  matchCollection,
  matchCompoundField,
  matchDataAlways,
  matchDisplayDataType,
  matchGroupAlways,
  matchGroupRenderType,
  matchHasOptions,
  matchRenderType,
  matchSchemaType,
  type DataMatcher,
  type DataRenderer,
  type FormRegistry,
} from "@rx-controls/forms-react-core";

// Data renderers
import { TextfieldRenderer } from "./renderers/data/Textfield";
import { NumberRenderer } from "./renderers/data/Number";
import { CompoundDelegate } from "./renderers/data/Compound";
import { MultilineRenderer } from "./renderers/data/Multiline";
import { CheckboxRenderer } from "./renderers/data/Checkbox";
import { DateRenderer, DateTimeRenderer, TimeRenderer } from "./renderers/data/Date";
import { SelectRenderer } from "./renderers/data/Select";
import { RadioRenderer } from "./renderers/data/Radio";
import { ChecklistRenderer } from "./renderers/data/Checklist";
import { AutocompleteRenderer } from "./renderers/data/Autocomplete";
import { DisplayOnlyRenderer } from "./renderers/data/DisplayOnly";
import { ArrayRenderer } from "./renderers/data/Array";
import { JsonataRenderer } from "./renderers/data/Jsonata";
import { ElementSelectedRenderer } from "./renderers/data/ElementSelected";
import { ScrollListRenderer } from "./renderers/data/ScrollList";
import { ArrayElementModalHostRenderer } from "./renderers/data/ArrayElementModalHost";

// Group renderers
import { StandardGroupRenderer } from "./renderers/group/Standard";
import { InlineGroupRenderer } from "./renderers/group/Inline";
import { FlexRenderer } from "./renderers/group/Flex";
import { GridRenderer } from "./renderers/group/Grid";
import { ContentsRenderer } from "./renderers/group/Contents";
import { SelectChildRenderer } from "./renderers/group/SelectChild";
import { TabsRenderer } from "./renderers/group/Tabs";
import { AccordionGroupRenderer } from "./renderers/group/AccordionGroup";
import { DialogRenderer } from "./renderers/group/Dialog";
import { WizardRenderer } from "./renderers/group/Wizard";

// Action renderers
import { ButtonAction } from "./renderers/action/Button";

// Display renderers
import { TextDisplayRenderer } from "./renderers/display/Text";
import { HtmlDisplayRenderer } from "./renderers/display/Html";
import { IconDisplayRenderer } from "./renderers/display/Icon";
import { CustomDisplayRenderer } from "./renderers/display/Custom";

// Adornments
import { IconAdornment } from "./adornments/Icon";
import { HelpTextAdornment } from "./adornments/HelpText";
import { OptionalAdornment } from "./adornments/Optional";
import { SetFieldAdornment } from "./adornments/SetField";
import { AccordionAdornment } from "./adornments/Accordion";

/**
 * Match a Bool field with no explicit `renderOptions.type` and no
 * options array — the "default for a boolean" slot. Exported so hosts
 * can swap `CheckboxRenderer` for their own component without having
 * to recreate the predicate:
 *
 * ```ts
 * combineRegistries(
 *   { data: [matchBoolField(MyToggleRenderer)] },
 *   defaultRegistry(),
 * );
 * ```
 *
 * Always registers with `hidesLabel: true` — replacement renderers are
 * expected to render their own inline label (typically via `<Label>`
 * for adornment composition).
 */
export function matchBoolField(component: DataRenderer): DataMatcher {
  return (node: FormStateNode, rc: ReadContext) => {
    const state = node.getState(rc);
    if (state.field?.type !== FieldType.Bool) return null;
    if (state.fieldOptions && state.fieldOptions.length > 0) return null;
    const def = state.definition;
    if (!isDataControl(def)) return null;
    if (def.renderOptions?.type) return null;
    return { component, hidesLabel: true };
  };
}

/** Match a Textfield renderType with multiline=true. */
function matchMultiline(component: typeof MultilineRenderer): DataMatcher {
  return (node, rc) => {
    const def = node.getState(rc).definition;
    if (!isDataControl(def)) return null;
    const ro = def.renderOptions as TextfieldRenderOptions | undefined;
    if (ro?.type !== DataRenderType.Textfield) return null;
    if (!ro.multiline) return null;
    return { component };
  };
}

/**
 * Match a `renderType: ArrayElement` data control bound to a collection
 * field (`field.collection === true`, `cursor.elementIndex === undefined`)
 * — the `editExternal` modal/inline draft host. This is the ONLY meaning
 * `DataRenderType.ArrayElement` carries (legacy parity — see CLAUDE.md
 * "Legacy semantics only"). It's a sibling data control bound to the
 * same array field as a `renderType: Array, editExternal: true` (or
 * DataGrid) control; both resolve to the same array `Control`, so the
 * host sees the staged-edit session the Array's Add/Edit buttons stage.
 *
 * An element-level `renderType: ArrayElement` (`elementIndex !== undefined`)
 * is NOT special — it falls through to the catch-all like any unknown
 * element render type.
 */
function matchArrayElementModalHost(
  component: typeof ArrayElementModalHostRenderer,
): DataMatcher {
  return (node, rc) => {
    const state = node.getState(rc);
    if (!isDataControl(state.definition)) return null;
    if (state.definition.renderOptions?.type !== DataRenderType.ArrayElement) {
      return null;
    }
    const field = state.field;
    if (!field?.collection) return null;
    const dn = state.dataNode;
    if (!dn) return null;
    const cursor = dn.cursor(rc);
    if (cursor.elementIndex !== undefined) return null;
    return { component, hidesLabel: true };
  };
}

/** Match `displayOnly: true` on the data control definition. */
function matchDisplayOnly(component: typeof DisplayOnlyRenderer): DataMatcher {
  return (node, rc) => {
    const def = node.getState(rc).definition;
    if (!isDataControl(def)) return null;
    if (!(def as { displayOnly?: boolean | null }).displayOnly) return null;
    return { component };
  };
}

/** Default registry for `@rx-controls/forms`. */
export function defaultRegistry(): FormRegistry {
  return combineRegistries({
    data: [
      // Most-specific first.
      matchAll(
        matchCollection(ArrayRenderer),
        matchRenderType(DataRenderType.Standard, ArrayRenderer),
      ),
      matchAll(
        matchCollection(ArrayRenderer),
        matchRenderType(DataRenderType.Array, ArrayRenderer),
      ),
      matchAll(
        matchCollection(ScrollListRenderer),
        matchRenderType(DataRenderType.ScrollList, ScrollListRenderer),
      ),
      // `renderType: ArrayElement` on the array itself = sibling modal
      // host for the editExternal flow (legacy parity — this is the only
      // meaning the render type carries).
      matchArrayElementModalHost(ArrayElementModalHostRenderer),
      matchCompoundField(CompoundDelegate),
      matchDisplayOnly(DisplayOnlyRenderer),
      matchBoolField(CheckboxRenderer),
      // Explicit renderTypes win over the defaults below so that e.g. a
      // CheckList collection routes to ChecklistRenderer, not ArrayRenderer.
      matchRenderType(DataRenderType.Radio, RadioRenderer),
      matchRenderType(DataRenderType.Checkbox, CheckboxRenderer, {
        hidesLabel: true,
      }),
      matchRenderType(DataRenderType.CheckList, ChecklistRenderer),
      matchRenderType(DataRenderType.Dropdown, SelectRenderer),
      matchRenderType(DataRenderType.Autocomplete, AutocompleteRenderer),
      matchRenderType(DataRenderType.DisplayOnly, DisplayOnlyRenderer),
      matchRenderType(DataRenderType.Jsonata, JsonataRenderer),
      matchRenderType(
        DataRenderType.ElementSelected,
        ElementSelectedRenderer,
        { hidesLabel: true },
      ),
      // Defaults: options-bearing → Select, collection → Array.
      // Absent renderType is treated as "default" — legacy semantics.
      matchHasOptions(SelectRenderer),
      matchCollection(ArrayRenderer),
      matchMultiline(MultilineRenderer),
      matchSchemaType(FieldType.Int, NumberRenderer),
      matchSchemaType(FieldType.Double, NumberRenderer),
      matchSchemaType(FieldType.Date, DateRenderer),
      matchSchemaType(FieldType.DateTime, DateTimeRenderer),
      matchSchemaType(FieldType.Time, TimeRenderer),
      matchDataAlways(TextfieldRenderer),
    ],
    group: [
      matchGroupRenderType(GroupRenderType.Tabs, TabsRenderer),
      matchGroupRenderType(GroupRenderType.Wizard, WizardRenderer),
      matchGroupRenderType(GroupRenderType.Accordion, AccordionGroupRenderer),
      matchGroupRenderType(GroupRenderType.Dialog, DialogRenderer),
      matchGroupRenderType(GroupRenderType.Grid, GridRenderer),
      matchGroupRenderType(GroupRenderType.Flex, FlexRenderer),
      matchGroupRenderType(GroupRenderType.Inline, InlineGroupRenderer),
      matchGroupRenderType(GroupRenderType.Contents, ContentsRenderer),
      matchGroupRenderType(GroupRenderType.SelectChild, SelectChildRenderer),
      matchGroupRenderType(GroupRenderType.Standard, StandardGroupRenderer),
      matchGroupAlways(StandardGroupRenderer),
    ],
    action: [
      // Single default — every action node renders as a button. Hosts
      // can register matchActionId(...) before this to override per id.
      (): { component: typeof ButtonAction } => ({ component: ButtonAction }),
    ],
    display: [
      matchDisplayDataType(DisplayDataType.Text, TextDisplayRenderer),
      matchDisplayDataType(DisplayDataType.Html, HtmlDisplayRenderer),
      matchDisplayDataType(DisplayDataType.Icon, IconDisplayRenderer),
      matchDisplayDataType(DisplayDataType.Custom, CustomDisplayRenderer),
    ],
    // Cast each registration to the unspecified-ControlAdornment form so
    // the array can hold heterogeneous subtypes — variance escape.
    adornments: [
      IconAdornment,
      HelpTextAdornment,
      OptionalAdornment,
      SetFieldAdornment,
      AccordionAdornment,
    ] as unknown as FormRegistry["adornments"],
  });
}
