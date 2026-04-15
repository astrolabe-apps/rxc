import { describe, it, expect } from "vitest";
import {
  createControlContext,
  noopReadContext,
  type ControlContext,
} from "@rxc/controls-core";
import {
  type SchemaField,
  type CompoundField,
  FieldType,
  type ControlDefinition,
  ControlDefinitionType,
  DataRenderType,
  DisplayDataType,
  type FieldOption,
  ValidatorType,
  type LengthValidator,
  DynamicPropertyType,
  ExpressionType,
  type DataMatchExpression,
  type DataExpression,
  type NotEmptyExpression,
  type NotExpression,
  DataControlDefinition,
} from "../src/json";
import {
  createStaticSchemaTree as csst,
  createDataNode,
  createStaticFormTree as csft,
  createFormStateNode,
  defaultResolveChildren,
} from "../src/nodes";
import {
  createSchemaTreeResolver,
} from "../src/nodes/schemaNode";
import {
  createFormTreeResolver,
} from "../src/nodes/formNode";
import type { FormGlobalOptions } from "../src/types";

const rd = noopReadContext;

function stringField(name: string): SchemaField {
  return { type: FieldType.String, field: name };
}
function compoundField(name: string, children: SchemaField[]): CompoundField {
  return { type: FieldType.Compound, field: name, children };
}
function dataDef(
  field: string,
  extra: Partial<DataControlDefinition> = {},
): DataControlDefinition {
  return {
    type: ControlDefinitionType.Data,
    field,
    ...extra,
  } as DataControlDefinition;
}
function groupDef(children: ControlDefinition[]): ControlDefinition {
  return {
    type: ControlDefinitionType.Group,
    children,
  } as ControlDefinition;
}

function schemaResolver() {
  return createSchemaTreeResolver(() => undefined);
}
function formResolver() {
  return createFormTreeResolver(() => undefined);
}

function makeEnv(
  fields: SchemaField[],
  defs: ControlDefinition[],
  initial: unknown,
) {
  const ctx: ControlContext = createControlContext();
  const schemaTree = csst(fields, schemaResolver());
  const formTree = csft(defs, formResolver());
  const dataControl = ctx.newControl(initial);
  const dataNode = createDataNode(schemaTree.rootNode, dataControl);
  const globals: FormGlobalOptions = {
    resolveChildren: defaultResolveChildren,
    runAsync: (fn) => fn(),
    clearHidden: false,
  };
  return { ctx, formTree, dataNode, dataControl, globals };
}

describe("createFormStateNode — Layer 1", () => {
  it("exposes a stable handle with a resolved dataNode for a simple data control", () => {
    const fields = [stringField("name")];
    const defs = [dataDef("name")];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      name: "alice",
    });

    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );

    // Root definition wraps the children — the single `name` data control
    // is the root's child.
    const children = root.getChildren(rd);
    expect(children.length).toBe(1);
    const nameNode = children[0];
    const state = nameNode.getState(rd);
    expect(state.dataNode).toBeDefined();
    expect(state.field?.field).toBe("name");
    expect(state.data?.valueNow).toBe("alice");
  });

  it("cascades disabled from parent → child → data control", () => {
    const fields = [compoundField("addr", [stringField("street")])];
    const defs = [
      {
        type: ControlDefinitionType.Group,
        compoundField: "addr",
        children: [dataDef("street")],
        disabled: true,
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      addr: { street: "1 Main St" },
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [addrNode] = root.getChildren(rd);
    expect(addrNode.getState(rd).disabled).toBe(true);
    const [streetNode] = addrNode.getChildren(rd);
    expect(streetNode.getState(rd).disabled).toBe(true);
    // And it was pushed to the data control itself.
    expect(streetNode.getState(rd).data?.disabledNow).toBe(true);
  });

  it("resolves visibility via definition.hidden (defaulting to true)", () => {
    const fields = [stringField("a"), stringField("b")];
    const defs = [dataDef("a", { hidden: true }), dataDef("b")];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      a: "x",
      b: "y",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [a, b] = root.getChildren(rd);
    expect(a.getState(rd).visible).toBe(false);
    // hidden is unset → coerces to `false` (schema default) → visible=true.
    // `null` would only occur while a Visible script is pending (Layer 4).
    expect(b.getState(rd).visible).toBe(true);
  });

  it("expands array children when bound to a collection field", () => {
    const fields: SchemaField[] = [
      { type: FieldType.String, field: "tags", collection: true },
    ];
    const defs = [dataDef("tags")];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      tags: ["red", "green", "blue"],
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [tagsNode] = root.getChildren(rd);
    const elements = tagsNode.getChildren(rd);
    expect(elements.length).toBe(3);
    expect(elements[0].getState(rd).data?.valueNow).toBe("red");
    expect(elements[2].getState(rd).data?.valueNow).toBe("blue");
  });

  it("clears hidden data when clearHidden is set and visibility flips to false", () => {
    const fields = [stringField("x")];
    const defs = [dataDef("x", { hidden: true })];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      x: "keep-me?",
    });
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, {
      ...globals,
      clearHidden: true,
    });
    const [xNode] = root.getChildren(rd);
    // hidden=true + clearHidden → data was wiped
    expect(xNode.getState(rd).data?.valueNow).toBeUndefined();
  });

  it("applies defaultValue when visible and the data is undefined", () => {
    const fields = [stringField("x")];
    const defs = [dataDef("x", { defaultValue: "the-default" })];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      x: undefined,
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [xNode] = root.getChildren(rd);
    expect(xNode.getState(rd).data?.valueNow).toBe("the-default");
  });
});

describe("FormStateNode — Layer 2: schemaInterface + options", () => {
  it("exposes resolved.fieldOptions for a data field with options", () => {
    const options: FieldOption[] = [
      { name: "Red", value: "r" },
      { name: "Green", value: "g" },
      { name: "Blue", value: "b" },
    ];
    const fields: SchemaField[] = [
      { type: FieldType.String, field: "color", options },
    ];
    const defs = [dataDef("color")];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      color: "g",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [colorNode] = root.getChildren(rd);
    const resolved = colorNode.getState(rd).resolved;
    expect(resolved.fieldOptions).toEqual(options);
  });

  it("filters fieldOptions by definition.allowedOptions (value list)", () => {
    const options: FieldOption[] = [
      { name: "Red", value: "r" },
      { name: "Green", value: "g" },
      { name: "Blue", value: "b" },
    ];
    const fields: SchemaField[] = [
      { type: FieldType.String, field: "color", options },
    ];
    const defs = [dataDef("color", { allowedOptions: ["r", "b"] })];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      color: "r",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [colorNode] = root.getChildren(rd);
    const resolved = colorNode.getState(rd).resolved;
    expect(resolved.fieldOptions?.map((o) => o.value)).toEqual(["r", "b"]);
  });

  it("expands CheckList into one child per option", () => {
    const options: FieldOption[] = [
      { name: "Red", value: "r" },
      { name: "Green", value: "g" },
    ];
    const fields: SchemaField[] = [
      { type: FieldType.String, field: "tags", collection: true, options },
    ];
    const defs = [
      {
        type: ControlDefinitionType.Data,
        field: "tags",
        renderOptions: { type: DataRenderType.CheckList },
        children: [
          {
            type: ControlDefinitionType.Display,
            displayData: { type: DisplayDataType.Text, text: "opt" },
          } as ControlDefinition,
        ],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      tags: ["g"],
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [tagsNode] = root.getChildren(rd);
    const optionChildren = tagsNode.getChildren(rd);
    expect(optionChildren.length).toBe(2);
    expect(optionChildren.map((c) => c.childKey)).toEqual(["r", "g"]);
  });

  it("hides a field whose onlyForTypes excludes the parent's discriminator", () => {
    const fields: SchemaField[] = [
      compoundField("thing", [
        {
          type: FieldType.String,
          field: "kind",
          isTypeField: true,
        },
        {
          type: FieldType.String,
          field: "carColor",
          onlyForTypes: ["car"],
        },
      ]),
    ];
    const defs = [
      {
        type: ControlDefinitionType.Group,
        compoundField: "thing",
        children: [dataDef("kind"), dataDef("carColor")],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      thing: { kind: "bike", carColor: "red" },
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [thingNode] = root.getChildren(rd);
    const [, carColor] = thingNode.getChildren(rd);
    // kind is "bike", carColor is only valid for "car" → hidden
    expect(carColor.getState(rd).visible).toBe(false);
  });

  it("hides a display-only field with an empty value and no emptyText", () => {
    const fields = [stringField("note")];
    const defs = [
      {
        type: ControlDefinitionType.Data,
        field: "note",
        renderOptions: { type: DataRenderType.DisplayOnly },
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      note: "",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [noteNode] = root.getChildren(rd);
    expect(noteNode.getState(rd).visible).toBe(false);
  });
});

describe("FormStateNode — Layer 3: validators", () => {
  it("reports a required error when the value is empty", () => {
    const fields = [stringField("name")];
    const defs = [dataDef("name", { required: true })];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      name: "",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [nameNode] = root.getChildren(rd);
    const errors = nameNode.getState(rd).data?.errorsNow ?? {};
    expect(Object.values(errors)).toContain("Please enter a value");
    expect(nameNode.getState(rd).valid).toBe(false);
  });

  it("clears the required error when the value becomes non-empty", () => {
    const fields = [stringField("name")];
    const defs = [dataDef("name", { required: true })];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { name: "" },
    );
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [nameNode] = root.getChildren(rd);
    expect(nameNode.getState(rd).valid).toBe(false);
    ctx.update((wc) =>
      wc.setValue(
        (dataControl as unknown as { fields: { name: import("@rxc/controls-core").Control<string> } }).fields.name,
        "Jo",
      ),
    );
    expect(nameNode.getState(rd).valid).toBe(true);
  });

  it("uses definition.requiredErrorText when provided", () => {
    const fields = [stringField("name")];
    const defs = [
      dataDef("name", {
        required: true,
        requiredErrorText: "Name is compulsory",
      }),
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      name: "",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [nameNode] = root.getChildren(rd);
    const errors = nameNode.getState(rd).data?.errorsNow ?? {};
    expect(Object.values(errors)).toContain("Name is compulsory");
  });

  it("reports a Length.max error when the value is too long", () => {
    const fields = [stringField("code")];
    const lengthMax: LengthValidator = { type: ValidatorType.Length, max: 3 };
    const defs = [dataDef("code", { validators: [lengthMax] })];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      code: "abcdef",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [codeNode] = root.getChildren(rd);
    const errors = codeNode.getState(rd).data?.errorsNow ?? {};
    expect(Object.values(errors)[0]).toMatch(/Length must be less than 3/);
  });

  it("suppresses validation errors when the node is hidden", () => {
    const fields = [stringField("name")];
    const defs = [dataDef("name", { hidden: true, required: true })];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      name: "",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [nameNode] = root.getChildren(rd);
    expect(nameNode.getState(rd).visible).toBe(false);
    expect(nameNode.getState(rd).data?.errorsNow ?? {}).toEqual({});
    expect(nameNode.getState(rd).valid).toBe(true);
  });

  it("auto-pads a collection to reach Length.min (per settled semantics)", () => {
    const fields: SchemaField[] = [
      { type: FieldType.String, field: "tags", collection: true },
    ];
    const lengthMin: LengthValidator = { type: ValidatorType.Length, min: 3 };
    const defs = [dataDef("tags", { validators: [lengthMin] })];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { tags: ["a"] },
    );
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    // Force the validation effect to run by touching children.
    void root.getChildren(rd);
    const tagsControl = (
      dataControl as unknown as {
        fields: { tags: import("@rxc/controls-core").Control<unknown[]> };
      }
    ).fields.tags;
    expect(tagsControl.elementsNow.length).toBe(3);
  });
});

describe("FormStateNode — Layer 4a: scripted proxy", () => {
  it("evaluates $scripts.hidden via a DataMatch expression", () => {
    const fields: SchemaField[] = [
      stringField("kind"),
      stringField("detail"),
    ];
    const dataMatch: DataMatchExpression = {
      type: ExpressionType.DataMatch,
      field: "../kind",
      value: "hide-it",
    };
    const defs = [
      dataDef("kind"),
      {
        ...dataDef("detail"),
        $scripts: { hidden: dataMatch },
      } as ControlDefinition & {
        $scripts: Record<string, DataMatchExpression>;
      },
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { kind: "show-it", detail: "x" },
    );
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [, detailNode] = root.getChildren(rd);
    expect(detailNode.getState(rd).visible).toBe(true);

    ctx.update((wc) =>
      wc.setValue(
        (
          dataControl as unknown as {
            fields: {
              kind: import("@rxc/controls-core").Control<string>;
            };
          }
        ).fields.kind,
        "hide-it",
      ),
    );
    expect(detailNode.getState(rd).visible).toBe(false);
  });

  it("inverts via Not — a Visible dynamic[] entry drives hidden correctly", () => {
    const fields: SchemaField[] = [stringField("kind"), stringField("detail")];
    // `Visible` dynamic property → script is wrapped in Not so it writes to `hidden`.
    const visibleWhenKind: DataMatchExpression = {
      type: ExpressionType.DataMatch,
      field: "../kind",
      value: "show",
    };
    const defs = [
      dataDef("kind"),
      {
        ...dataDef("detail"),
        dynamic: [
          { type: DynamicPropertyType.Visible, expr: visibleWhenKind },
        ],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { kind: "hide", detail: "x" },
    );
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [, detailNode] = root.getChildren(rd);
    expect(detailNode.getState(rd).visible).toBe(false);
    ctx.update((wc) =>
      wc.setValue(
        (
          dataControl as unknown as {
            fields: {
              kind: import("@rxc/controls-core").Control<string>;
            };
          }
        ).fields.kind,
        "show",
      ),
    );
    expect(detailNode.getState(rd).visible).toBe(true);
  });

  it("drives `disabled` from a legacy dynamic[] Disabled entry", () => {
    const fields: SchemaField[] = [
      { type: FieldType.Bool, field: "locked" },
      stringField("code"),
    ];
    const lockedTrue: DataMatchExpression = {
      type: ExpressionType.DataMatch,
      field: "../locked",
      value: true,
    };
    const defs = [
      dataDef("locked"),
      {
        ...dataDef("code"),
        dynamic: [
          { type: DynamicPropertyType.Disabled, expr: lockedTrue },
        ],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { locked: true, code: "x" },
    );
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [, codeNode] = root.getChildren(rd);
    expect(codeNode.getState(rd).disabled).toBe(true);
    ctx.update((wc) =>
      wc.setValue(
        (
          dataControl as unknown as {
            fields: {
              locked: import("@rxc/controls-core").Control<boolean>;
            };
          }
        ).fields.locked,
        false,
      ),
    );
    expect(codeNode.getState(rd).disabled).toBe(false);
  });

  it("drives `title` from a Data expression", () => {
    const fields: SchemaField[] = [stringField("greeting"), stringField("msg")];
    const dataExpr: DataExpression = {
      type: ExpressionType.Data,
      field: "../greeting",
    };
    const defs = [
      dataDef("greeting"),
      {
        ...dataDef("msg"),
        $scripts: { title: dataExpr },
      } as ControlDefinition & {
        $scripts: Record<string, DataExpression>;
      },
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      greeting: "Hello",
      msg: "",
    });
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [, msgNode] = root.getChildren(rd);
    // state.definition.title now reflects the scripted value.
    expect(msgNode.getState(rd).definition.title).toBe("Hello");
  });

  it("hides a field via a NotEmpty expression", () => {
    const fields: SchemaField[] = [stringField("a"), stringField("b")];
    // hide b when a is empty
    const notEmpty: NotEmptyExpression = {
      type: ExpressionType.NotEmpty,
      field: "../a",
    };
    const hidden: NotExpression = {
      type: ExpressionType.Not,
      innerExpression: notEmpty,
    };
    const defs = [
      dataDef("a"),
      {
        ...dataDef("b"),
        $scripts: { hidden },
      } as ControlDefinition & { $scripts: Record<string, NotExpression> },
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { a: "", b: "something" },
    );
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
    );
    const [, bNode] = root.getChildren(rd);
    // a is empty → NotEmpty is false → Not(false) = true → hidden=true → visible=false
    expect(bNode.getState(rd).visible).toBe(false);

    ctx.update((wc) =>
      wc.setValue(
        (
          dataControl as unknown as {
            fields: { a: import("@rxc/controls-core").Control<string> };
          }
        ).fields.a,
        "anything",
      ),
    );
    expect(bNode.getState(rd).visible).toBe(true);
  });
});
