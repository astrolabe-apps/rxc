import { describe, expect, it } from "vitest";
import {
  ControlDefinitionType,
  DataRenderType,
  DisplayDataType,
  FieldType,
  GroupRenderType,
  type ControlDefinition,
  type DisplayData,
  type FieldOption,
  type FormState,
  type FormStateNode,
  type GroupedControlsDefinition,
  type SchemaField,
  type TextfieldRenderOptions,
} from "@rxc/forms-core";
import { defaultRegistry } from "../src/builtins";
import {
  pickDataRenderer,
  pickDisplayRenderer,
  pickGroupRenderer,
} from "@rxc/forms-react-core";

interface FakeStateInput {
  definition: ControlDefinition;
  field?: SchemaField;
  fieldOptions?: FieldOption[];
  elementIndex?: number;
}

function fakeNode({
  definition,
  field,
  fieldOptions,
  elementIndex,
}: FakeStateInput): FormStateNode {
  const dataNode = field
    ? ({
        id: "fake",
        cursor: () => ({ elementIndex }),
      } as unknown as NonNullable<FormState["dataNode"]>)
    : undefined;
  const state: Partial<FormState> = {
    definition,
    field,
    fieldOptions,
    dataNode,
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

function dataDef(opts: Partial<ControlDefinition> = {}): ControlDefinition {
  return { type: ControlDefinitionType.Data, field: "x", ...opts };
}

function groupDef(renderType: string): GroupedControlsDefinition {
  return {
    type: ControlDefinitionType.Group,
    children: [],
    groupOptions: { type: renderType },
  } as GroupedControlsDefinition;
}

describe("defaultRegistry — data dispatch", () => {
  const reg = defaultRegistry();

  it("Bool field with no renderType picks CheckboxRenderer with hidesLabel", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Bool, field: "active" },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect(m?.hidesLabel).toBe(true);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "CheckboxRenderer",
    );
  });

  it("Bool field WITH options does not pick CheckboxRenderer", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Bool, field: "active" },
      fieldOptions: [
        { name: "Y", value: true },
        { name: "N", value: false },
      ],
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).not.toBe(
      "CheckboxRenderer",
    );
  });

  it("Standard renderType + options picks SelectRenderer", () => {
    const node = fakeNode({
      definition: dataDef({
        renderOptions: { type: DataRenderType.Standard },
      }),
      field: { type: FieldType.String, field: "color" },
      fieldOptions: [{ name: "Red", value: "red" }],
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "SelectRenderer",
    );
    expect(m?.hidesLabel).toBeFalsy();
  });

  it("options-bearing field with no renderType picks SelectRenderer", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.String, field: "color" },
      fieldOptions: [{ name: "Red", value: "red" }],
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "SelectRenderer",
    );
  });

  it("Radio renderType picks RadioRenderer (Field emits external label, fieldset uses aria-labelledby)", () => {
    const node = fakeNode({
      definition: dataDef({ renderOptions: { type: DataRenderType.Radio } }),
      field: { type: FieldType.String, field: "size" },
      fieldOptions: [{ name: "S", value: "S" }],
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "RadioRenderer",
    );
    expect(m?.hidesLabel).toBeFalsy();
  });

  it("CheckList renderType picks ChecklistRenderer (Field emits external label, fieldset uses aria-labelledby)", () => {
    const node = fakeNode({
      definition: dataDef({ renderOptions: { type: DataRenderType.CheckList } }),
      field: { type: FieldType.String, field: "tags", collection: true },
      fieldOptions: [{ name: "A", value: "a" }],
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "ChecklistRenderer",
    );
    expect(m?.hidesLabel).toBeFalsy();
  });

  it("Checkbox renderType picks CheckboxRenderer with hidesLabel", () => {
    const node = fakeNode({
      definition: dataDef({ renderOptions: { type: DataRenderType.Checkbox } }),
      field: { type: FieldType.Bool, field: "active" },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect(m?.hidesLabel).toBe(true);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "CheckboxRenderer",
    );
  });

  it("Textfield + multiline picks MultilineRenderer", () => {
    const node = fakeNode({
      definition: dataDef({
        renderOptions: {
          type: DataRenderType.Textfield,
          multiline: true,
        } satisfies TextfieldRenderOptions,
      }),
      field: { type: FieldType.String, field: "bio" },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "MultilineRenderer",
    );
  });

  it("FieldType.Int picks NumberRenderer", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Int, field: "age" },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "NumberRenderer",
    );
  });

  it("FieldType.Date / DateTime / Time pick the correct typed renderer", () => {
    const dn = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Date, field: "d" },
    });
    expect(
      (pickDataRenderer(reg.data, dn, rc)?.component as {
        displayName?: string;
      })?.displayName,
    ).toBe("DateRenderer");

    const dtn = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.DateTime, field: "dt" },
    });
    expect(
      (pickDataRenderer(reg.data, dtn, rc)?.component as {
        displayName?: string;
      })?.displayName,
    ).toBe("DateTimeRenderer");

    const tn = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Time, field: "t" },
    });
    expect(
      (pickDataRenderer(reg.data, tn, rc)?.component as {
        displayName?: string;
      })?.displayName,
    ).toBe("TimeRenderer");
  });

  it("Collection field picks ArrayRenderer", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.String, field: "tags", collection: true },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "ArrayRenderer",
    );
  });

  it("Compound field delegates to group dispatch via CompoundDelegate", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Compound, field: "address" },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "CompoundDelegate",
    );
  });

  it("Collection of compound (array of objects) picks ArrayRenderer, not CompoundDelegate", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Compound, field: "addresses", collection: true },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "ArrayRenderer",
    );
  });

  it("An element of a collection-compound picks CompoundDelegate, not ArrayRenderer", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.Compound, field: "addresses", collection: true },
      elementIndex: 0,
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "CompoundDelegate",
    );
  });

  it("An element of a collection-string array picks the textfield catch-all, not ArrayRenderer", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.String, field: "tags", collection: true },
      elementIndex: 0,
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "TextfieldRenderer",
    );
  });

  it("DisplayOnly renderType picks DisplayOnlyRenderer", () => {
    const node = fakeNode({
      definition: dataDef({ renderOptions: { type: DataRenderType.DisplayOnly } }),
      field: { type: FieldType.String, field: "x" },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "DisplayOnlyRenderer",
    );
  });

  it("ArrayElement renderType — array level routes to ArrayElementModalHostRenderer (editExternal sibling)", () => {
    const node = fakeNode({
      definition: dataDef({
        renderOptions: { type: DataRenderType.ArrayElement },
      }),
      field: { type: FieldType.String, field: "items", collection: true },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "ArrayElementModalHostRenderer",
    );
  });

  it("ArrayElement renderType — element level is not special, falls through to the catch-all", () => {
    // `DataRenderType.ArrayElement` only means "editExternal draft host"
    // (legacy parity). On an individual element it has no dedicated
    // renderer, so it degrades to the Textfield catch-all like any
    // unknown element render type.
    const node = fakeNode({
      definition: dataDef({
        renderOptions: { type: DataRenderType.ArrayElement },
      }),
      field: { type: FieldType.String, field: "items", collection: true },
      elementIndex: 0,
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "TextfieldRenderer",
    );
  });

  it("ScrollList renderType on a collection picks ScrollListRenderer", () => {
    const node = fakeNode({
      definition: dataDef({
        renderOptions: { type: DataRenderType.ScrollList },
      }),
      field: { type: FieldType.String, field: "items", collection: true },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "ScrollListRenderer",
    );
  });

  it("Wizard renderType picks WizardRenderer", () => {
    const reg2 = defaultRegistry();
    const def: GroupedControlsDefinition = {
      type: ControlDefinitionType.Group,
      children: [],
      groupOptions: { type: GroupRenderType.Wizard } as never,
    } as GroupedControlsDefinition;
    const node = fakeNode({ definition: def });
    const m = pickGroupRenderer(reg2.group, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "WizardRenderer",
    );
  });

  it("ElementSelected renderType picks ElementSelectedRenderer with hidesLabel", () => {
    const node = fakeNode({
      definition: dataDef({
        renderOptions: {
          type: DataRenderType.ElementSelected,
          elementExpression: { type: "Data", field: "value" },
        } as never,
      }),
      field: { type: FieldType.String, field: "selected", collection: true },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "ElementSelectedRenderer",
    );
    expect(m?.hidesLabel).toBe(true);
  });

  it("Jsonata renderType picks JsonataRenderer", () => {
    const node = fakeNode({
      definition: dataDef({
        renderOptions: { type: DataRenderType.Jsonata, expression: "value" },
      }),
      field: { type: FieldType.String, field: "x" },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "JsonataRenderer",
    );
  });

  it("Autocomplete renderType picks AutocompleteRenderer", () => {
    const node = fakeNode({
      definition: dataDef({ renderOptions: { type: DataRenderType.Autocomplete } }),
      field: { type: FieldType.String, field: "country" },
      fieldOptions: [{ name: "AU", value: "AU" }],
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "AutocompleteRenderer",
    );
  });

  it("Catch-all is TextfieldRenderer for plain String fields", () => {
    const node = fakeNode({
      definition: dataDef(),
      field: { type: FieldType.String, field: "name" },
    });
    const m = pickDataRenderer(reg.data, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "TextfieldRenderer",
    );
    expect(m?.hidesLabel).toBeFalsy();
  });
});

describe("defaultRegistry — group dispatch", () => {
  const reg = defaultRegistry();

  it.each([
    [GroupRenderType.Standard, "StandardGroupRenderer"],
    [GroupRenderType.Inline, "InlineGroupRenderer"],
    [GroupRenderType.Flex, "FlexRenderer"],
    [GroupRenderType.Grid, "GridRenderer"],
    [GroupRenderType.Contents, "ContentsRenderer"],
    [GroupRenderType.SelectChild, "SelectChildRenderer"],
  ] as const)("%s → %s", (renderType, expected) => {
    const node = fakeNode({ definition: groupDef(renderType) });
    const m = pickGroupRenderer(reg.group, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      expected,
    );
  });

  it("unknown group renderType falls back to StandardGroupRenderer", () => {
    const node = fakeNode({ definition: groupDef("Unknown") });
    const m = pickGroupRenderer(reg.group, node, rc);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      "StandardGroupRenderer",
    );
  });
});

describe("defaultRegistry — display dispatch", () => {
  const reg = defaultRegistry();

  it.each([
    [DisplayDataType.Text, "TextDisplayRenderer"],
    [DisplayDataType.Html, "HtmlDisplayRenderer"],
    [DisplayDataType.Icon, "IconDisplayRenderer"],
    [DisplayDataType.Custom, "CustomDisplayRenderer"],
  ] as const)("%s → %s", (type, expectedName) => {
    const data: DisplayData = { type };
    const m = pickDisplayRenderer(reg.display, data);
    expect((m?.component as { displayName?: string })?.displayName).toBe(
      expectedName,
    );
  });

  it("returns null for unknown display data type", () => {
    expect(pickDisplayRenderer(reg.display, { type: "Unknown" })).toBeNull();
  });
});
