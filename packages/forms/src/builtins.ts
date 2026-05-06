import {
  DataRenderType,
  DisplayDataType,
  FieldType,
  GroupRenderType,
  isDataControl,
  type FormStateNode,
  type TextfieldRenderOptions,
} from "@rxc/forms-core";
import type { ReadContext } from "@rxc/controls-core";
import {
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
} from "./matchers";
import { combineRegistries, type DataMatcher, type FormRegistry } from "./registry";

// Data renderers
import { TextfieldRenderer } from "./renderers/data/Textfield";
import { NumberRenderer } from "./renderers/data/Number";
import { CompoundDelegate } from "./renderers/data/Compound";
import { MultilineRenderer } from "./renderers/data/Multiline";
import { BoolRenderer } from "./renderers/data/Bool";
import { CheckboxRenderer } from "./renderers/data/Checkbox";
import { DateRenderer, DateTimeRenderer, TimeRenderer } from "./renderers/data/Date";
import { SelectRenderer } from "./renderers/data/Select";
import { RadioRenderer } from "./renderers/data/Radio";
import { ChecklistRenderer } from "./renderers/data/Checklist";
import { AutocompleteRenderer } from "./renderers/data/Autocomplete";
import { DisplayOnlyRenderer } from "./renderers/data/DisplayOnly";
import { ArrayRenderer } from "./renderers/data/Array";

// Group renderers
import { StandardGroupRenderer } from "./renderers/group/Standard";
import { InlineGroupRenderer } from "./renderers/group/Inline";
import { FlexRenderer } from "./renderers/group/Flex";
import { GridRenderer } from "./renderers/group/Grid";
import { ContentsRenderer } from "./renderers/group/Contents";
import { SelectChildRenderer } from "./renderers/group/SelectChild";

// Display renderers
import { TextDisplayRenderer } from "./renderers/display/Text";
import { HtmlDisplayRenderer } from "./renderers/display/Html";
import { IconDisplayRenderer } from "./renderers/display/Icon";
import { CustomDisplayRenderer } from "./renderers/display/Custom";

/** Match a Bool field with no explicit renderType and no options → checkbox. */
function matchBoolDefault(component: typeof BoolRenderer): DataMatcher {
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

/** Match `displayOnly: true` on the data control definition. */
function matchDisplayOnly(component: typeof DisplayOnlyRenderer): DataMatcher {
  return (node, rc) => {
    const def = node.getState(rc).definition;
    if (!isDataControl(def)) return null;
    if (!(def as { displayOnly?: boolean | null }).displayOnly) return null;
    return { component };
  };
}

/**
 * Default registry for `@rxc/forms`. Phase 2 covers the full default
 * data + group + display set documented in RENDERER-DESIGN.md (Phase 4a
 * minus adornments, complex groups, and actions — those land in Phase 3).
 */
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
      matchCompoundField(CompoundDelegate),
      matchDisplayOnly(DisplayOnlyRenderer),
      matchBoolDefault(BoolRenderer),
      // Explicit renderTypes win over the defaults below so that e.g. a
      // CheckList collection routes to ChecklistRenderer, not ArrayRenderer.
      matchRenderType(DataRenderType.Radio, RadioRenderer, { hidesLabel: true }),
      matchRenderType(DataRenderType.Checkbox, CheckboxRenderer, {
        hidesLabel: true,
      }),
      matchRenderType(DataRenderType.CheckList, ChecklistRenderer, {
        hidesLabel: true,
      }),
      matchRenderType(DataRenderType.Dropdown, SelectRenderer),
      matchRenderType(DataRenderType.Autocomplete, AutocompleteRenderer),
      matchRenderType(DataRenderType.DisplayOnly, DisplayOnlyRenderer),
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
      matchGroupRenderType(GroupRenderType.Grid, GridRenderer),
      matchGroupRenderType(GroupRenderType.Flex, FlexRenderer),
      matchGroupRenderType(GroupRenderType.Inline, InlineGroupRenderer),
      matchGroupRenderType(GroupRenderType.Contents, ContentsRenderer),
      matchGroupRenderType(GroupRenderType.SelectChild, SelectChildRenderer),
      matchGroupRenderType(GroupRenderType.Standard, StandardGroupRenderer),
      matchGroupAlways(StandardGroupRenderer),
    ],
    action: [],
    display: [
      matchDisplayDataType(DisplayDataType.Text, TextDisplayRenderer),
      matchDisplayDataType(DisplayDataType.Html, HtmlDisplayRenderer),
      matchDisplayDataType(DisplayDataType.Icon, IconDisplayRenderer),
      matchDisplayDataType(DisplayDataType.Custom, CustomDisplayRenderer),
    ],
  });
}
