import { describe, expect, it } from "vitest";
import {
  ControlDefinitionType,
  DataRenderType,
  FieldType,
  GroupRenderType,
  type ControlDefinition,
  type DataControlDefinition,
  type FieldOption,
  type FormState,
  type FormStateNode,
  type GroupedControlsDefinition,
  type SchemaField,
} from "@rxc/forms-core";
import {
  matchAll,
  matchAny,
  matchCollection,
  matchCompoundField,
  matchDataAlways,
  matchGroupRenderType,
  matchHasOptions,
  matchRenderType,
  matchRenderTypeOneOf,
  matchSchemaType,
} from "../src/matchers";

const Renderer = () => null;
Renderer.displayName = "Renderer";

const Other = () => null;
Other.displayName = "Other";

interface FakeStateInput {
  definition: ControlDefinition;
  field?: SchemaField;
  fieldOptions?: FieldOption[];
}

function fakeNode({
  definition,
  field,
  fieldOptions,
}: FakeStateInput): FormStateNode {
  const state: Partial<FormState> = {
    definition,
    field,
    fieldOptions,
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

const rc = {} as never;

function dataDef(renderType?: string): DataControlDefinition {
  return {
    type: ControlDefinitionType.Data,
    field: "x",
    renderOptions: renderType ? { type: renderType } : undefined,
  };
}

function groupDef(renderType: string): GroupedControlsDefinition {
  return {
    type: ControlDefinitionType.Group,
    children: [],
    groupOptions: { type: renderType },
  } as GroupedControlsDefinition;
}

describe("data matchers", () => {
  it("matchRenderType hits on matching renderOptions.type", () => {
    const m = matchRenderType(DataRenderType.Radio, Renderer);
    const node = fakeNode({ definition: dataDef(DataRenderType.Radio) });
    expect(m(node, rc)?.component).toBe(Renderer);
  });

  it("matchRenderType misses on non-matching type", () => {
    const m = matchRenderType(DataRenderType.Radio, Renderer);
    const node = fakeNode({ definition: dataDef(DataRenderType.Dropdown) });
    expect(m(node, rc)).toBeNull();
  });

  it("matchRenderType propagates hidesLabel metadata", () => {
    const m = matchRenderType(DataRenderType.Radio, Renderer, {
      hidesLabel: true,
    });
    const node = fakeNode({ definition: dataDef(DataRenderType.Radio) });
    expect(m(node, rc)?.hidesLabel).toBe(true);
  });

  it("matchSchemaType hits on field.type", () => {
    const m = matchSchemaType(FieldType.Int, Renderer);
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Int, field: "age" },
    });
    expect(m(node, rc)?.component).toBe(Renderer);
  });

  it("matchSchemaType misses without a field", () => {
    const m = matchSchemaType(FieldType.Int, Renderer);
    const node = fakeNode({ definition: dataDef() });
    expect(m(node, rc)).toBeNull();
  });

  it("matchHasOptions hits when fieldOptions is non-empty", () => {
    const m = matchHasOptions(Renderer);
    const node = fakeNode({
      definition: dataDef(),
      fieldOptions: [{ name: "A", value: "a" }],
    });
    expect(m(node, rc)?.component).toBe(Renderer);
  });

  it("matchHasOptions misses on empty options", () => {
    const m = matchHasOptions(Renderer);
    const node = fakeNode({ definition: dataDef(), fieldOptions: [] });
    expect(m(node, rc)).toBeNull();
  });

  it("matchCollection hits when field.collection is true", () => {
    const m = matchCollection(Renderer);
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.String, field: "tags", collection: true },
    });
    expect(m(node, rc)?.component).toBe(Renderer);
  });

  it("matchCompoundField hits on Compound field type", () => {
    const m = matchCompoundField(Renderer);
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Compound, field: "address" },
    });
    expect(m(node, rc)?.component).toBe(Renderer);
  });

  it("matchRenderTypeOneOf hits any of the listed types", () => {
    const m = matchRenderTypeOneOf(
      [DataRenderType.Standard, DataRenderType.Array],
      Renderer,
    );
    expect(
      m(fakeNode({ definition: dataDef(DataRenderType.Standard) }), rc),
    ).not.toBeNull();
    expect(
      m(fakeNode({ definition: dataDef(DataRenderType.Array) }), rc),
    ).not.toBeNull();
    expect(
      m(fakeNode({ definition: dataDef(DataRenderType.Radio) }), rc),
    ).toBeNull();
  });

  it("matchDataAlways always hits and carries metadata", () => {
    const m = matchDataAlways(Renderer, { hidesLabel: true });
    expect(m(fakeNode({ definition: dataDef() }), rc)?.hidesLabel).toBe(true);
  });

  it("matchAll requires all predicates to hit; uses last component", () => {
    const m = matchAll(
      matchSchemaType(FieldType.String, Other),
      matchHasOptions(Renderer),
    );
    const hit = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.String, field: "x" },
      fieldOptions: [{ name: "A", value: "a" }],
    });
    expect(m(hit, rc)?.component).toBe(Renderer);

    const miss = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.String, field: "x" },
      fieldOptions: [],
    });
    expect(m(miss, rc)).toBeNull();
  });

  it("matchAny hits on first non-null match", () => {
    const m = matchAny(
      matchRenderType("Never", Other),
      matchSchemaType(FieldType.Int, Renderer),
    );
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Int, field: "n" },
    });
    expect(m(node, rc)?.component).toBe(Renderer);
  });
});

describe("group matchers", () => {
  it("matchGroupRenderType hits on groupOptions.type", () => {
    const m = matchGroupRenderType(GroupRenderType.Tabs, Renderer);
    const node = fakeNode({ definition: groupDef(GroupRenderType.Tabs) });
    expect(m(node, rc)?.component).toBe(Renderer);
  });

  it("matchGroupRenderType misses on non-matching type", () => {
    const m = matchGroupRenderType(GroupRenderType.Tabs, Renderer);
    const node = fakeNode({ definition: groupDef(GroupRenderType.Standard) });
    expect(m(node, rc)).toBeNull();
  });
});
