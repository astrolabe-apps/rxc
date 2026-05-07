import { describe, expect, it } from "vitest";
import {
  ControlDefinitionType,
  DataRenderType,
  FieldType,
  GroupRenderType,
  SchemaTags,
  type ControlDefinition,
  type FormState,
  type FormStateNode,
  type SchemaField,
} from "@rxc/forms-core";
import {
  actionPlugin,
  collectExtraRenderOptionFields,
  combineRegistries,
  dataPlugin,
  displayPlugin,
  emptyRegistry,
  groupPlugin,
  matchRenderType,
  pickActionRenderer,
  pickDataRenderer,
  pickDisplayRenderer,
  pickGroupRenderer,
} from "../src";

const Marker = () => null;
Marker.displayName = "PluginMarker";

const rc = {} as never;

function fakeNode(definition: ControlDefinition): FormStateNode {
  const state: Partial<FormState> = {
    definition,
    visible: true,
    disabled: false,
    readonly: false,
    busy: false,
    valid: true,
    touched: false,
    childIndex: 0,
    clearHidden: true,
    meta: {},
  };
  return { getState: () => state as FormState } as unknown as FormStateNode;
}

describe("dataPlugin", () => {
  it("emits a Partial<FormRegistry> with one matcher and the schema entry", () => {
    const schema: SchemaField[] = [
      { field: "maxStars", type: FieldType.Int, tags: [SchemaTags.ScriptNullInit] },
    ];
    const partial = dataPlugin({
      type: "Stars",
      component: Marker,
      schema,
    });
    expect(partial.data).toHaveLength(1);
    expect(partial.schemaExtensions).toEqual({ Stars: schema });
  });

  it("hidesLabel propagates to the matcher's match metadata", () => {
    const partial = dataPlugin({
      type: "MyBox",
      component: Marker,
      hidesLabel: true,
    });
    const matcher = partial.data![0];
    const node = fakeNode({
      type: ControlDefinitionType.Data,
      field: "x",
      renderOptions: { type: "MyBox" },
    } as ControlDefinition);
    const m = matcher(node, rc);
    expect(m?.hidesLabel).toBe(true);
  });

  it("custom plugin matcher prepended via combineRegistries wins over a built-in matcher for the same renderType", () => {
    const Builtin = () => null;
    Builtin.displayName = "BuiltinRadio";
    const builtinReg = {
      data: [matchRenderType(DataRenderType.Radio, Builtin)],
    };
    const custom = dataPlugin({ type: DataRenderType.Radio, component: Marker });
    const reg = combineRegistries(custom, builtinReg);
    const node = fakeNode({
      type: ControlDefinitionType.Data,
      field: "x",
      renderOptions: { type: DataRenderType.Radio },
    } as ControlDefinition);
    const hit = pickDataRenderer(reg.data, node, rc);
    expect((hit?.component as { displayName?: string })?.displayName).toBe(
      "PluginMarker",
    );
  });

  it("childResolvers entry is emitted when resolveChildren is provided", () => {
    const resolveChildren = () => [];
    const partial = dataPlugin({
      type: "VirtualList",
      component: Marker,
      resolveChildren,
    });
    expect(partial.childResolvers).toEqual({ VirtualList: resolveChildren });
  });
});

describe("groupPlugin", () => {
  it("emits a group matcher keyed on groupOptions.type", () => {
    const partial = groupPlugin({ type: "Stepper", component: Marker });
    const node = fakeNode({
      type: ControlDefinitionType.Group,
      children: [],
      groupOptions: { type: "Stepper" },
    } as ControlDefinition);
    const m = partial.group![0](node, rc);
    expect(m?.component).toBe(Marker);
  });

  it("does not match a different groupRenderType", () => {
    const partial = groupPlugin({ type: "Stepper", component: Marker });
    const node = fakeNode({
      type: ControlDefinitionType.Group,
      children: [],
      groupOptions: { type: GroupRenderType.Tabs },
    } as ControlDefinition);
    expect(partial.group![0](node, rc)).toBeNull();
  });
});

describe("actionPlugin", () => {
  it("emits an action matcher keyed on actionId", () => {
    const partial = actionPlugin({ actionId: "submit", component: Marker });
    const node = fakeNode({
      type: ControlDefinitionType.Action,
      actionId: "submit",
    } as ControlDefinition);
    expect(partial.action![0](node, rc)?.component).toBe(Marker);
  });
});

describe("displayPlugin", () => {
  it("emits a display matcher keyed on data.type", () => {
    const partial = displayPlugin({ type: "Card", component: Marker });
    expect(partial.display![0]({ type: "Card" })?.component).toBe(Marker);
    expect(partial.display![0]({ type: "Other" })).toBeNull();
  });
});

describe("collectExtraRenderOptionFields", () => {
  it("flattens schemaExtensions and tags fields with onlyForTypes when missing", () => {
    const reg = emptyRegistry();
    reg.schemaExtensions = {
      Stars: [{ field: "maxStars", type: FieldType.Int }],
      Slider: [
        { field: "min", type: FieldType.Int, onlyForTypes: ["Slider"] },
        { field: "max", type: FieldType.Int },
      ],
    };
    const out = collectExtraRenderOptionFields(reg);
    const byField = Object.fromEntries(out.map((f) => [f.field, f]));
    expect(byField.maxStars.onlyForTypes).toEqual(["Stars"]);
    // Already-tagged fields are passed through unchanged.
    expect(byField.min.onlyForTypes).toEqual(["Slider"]);
    expect(byField.max.onlyForTypes).toEqual(["Slider"]);
  });

  it("returns empty array for a registry with no schemaExtensions", () => {
    const reg = emptyRegistry();
    expect(collectExtraRenderOptionFields(reg)).toEqual([]);
  });
});

describe("combineRegistries — schemaExtensions + childResolvers shadowing", () => {
  it("earlier plugin's schemaExtensions shadows later", () => {
    const first = dataPlugin({
      type: "Custom",
      component: Marker,
      schema: [{ field: "first", type: FieldType.String }],
    });
    const second = dataPlugin({
      type: "Custom",
      component: Marker,
      schema: [{ field: "second", type: FieldType.String }],
    });
    const reg = combineRegistries(first, second);
    expect(reg.schemaExtensions.Custom).toEqual([
      { field: "first", type: FieldType.String },
    ]);
  });
});

// Also verify the unused matchers stay imported (no-op, keeps the import list narrow).
void pickGroupRenderer;
void pickActionRenderer;
void pickDisplayRenderer;
