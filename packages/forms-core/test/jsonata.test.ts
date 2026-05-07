import { describe, it, expect } from "vitest";
import {
  createControlContext,
  noopReadContext,
  type Control,
  type ControlContext,
} from "@rxc/controls-core";
import {
  type SchemaField,
  FieldType,
  type ControlDefinition,
  ControlDefinitionType,
  DynamicPropertyType,
  ExpressionType,
  type JsonataExpression,
  type DataControlDefinition,
  ValidatorType,
  type JsonataValidator,
} from "../src/json";
import {
  createStaticSchemaTree as csst,
  createDataNode,
  createStaticFormTree as csft,
  createFormStateNode,
  defaultResolveChildren,
} from "../src/nodes";
import { createSchemaTreeResolver } from "../src/nodes/schemaNode";
import { createFormTreeResolver } from "../src/nodes/formNode";
import type { FormGlobalOptions } from "../src/types";

const rd = noopReadContext;

const stringField = (name: string): SchemaField => ({
  type: FieldType.String,
  field: name,
});
const intField = (name: string): SchemaField => ({
  type: FieldType.Int,
  field: name,
  collection: false,
});
const dataDef = (
  field: string,
  extra: Partial<DataControlDefinition> = {},
): DataControlDefinition =>
  ({ type: ControlDefinitionType.Data, field, ...extra }) as DataControlDefinition;

const jsonataExpr = (expression: string): JsonataExpression => ({
  type: ExpressionType.Jsonata,
  expression,
});

function makeEnv(
  fields: SchemaField[],
  defs: ControlDefinition[],
  initial: unknown,
) {
  const ctx: ControlContext = createControlContext();
  const schemaTree = csst(fields, createSchemaTreeResolver(() => undefined));
  const formTree = csft(defs, createFormTreeResolver(() => undefined));
  const dataControl = ctx.newControl(initial);
  const dataNode = createDataNode(schemaTree.rootNode, dataControl);
  const globals: FormGlobalOptions = {
    resolveChildren: defaultResolveChildren,
    runAsync: (fn) => fn(),
    clearHidden: false,
  };
  return { ctx, formTree, dataNode, dataControl, globals };
}

/** Yield enough microtasks for the jsonata promise chain + reconcile to settle. */
async function flush(n = 30): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

describe("jsonataEval via dynamic[] script", () => {
  it("evaluates a constant expression and writes the stringified result to title", async () => {
    const fields: SchemaField[] = [stringField("name")];
    const defs = [
      {
        ...dataDef("name"),
        dynamic: [
          {
            type: DynamicPropertyType.Label,
            expr: jsonataExpr("$sum([1,2,3,4,5])"),
          },
        ],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      name: "alice",
    });
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    const [nameNode] = root.getChildren(rd);

    await flush();
    expect(nameNode.getState(rd).definition.title).toBe("15");
  });

  it("evaluates a data-bound expression — derives title from a scalar field", async () => {
    const fields: SchemaField[] = [intField("n")];
    const defs = [
      {
        ...dataDef("n"),
        dynamic: [
          {
            type: DynamicPropertyType.Label,
            // `n.($*2)` — navigate into `n`, double its value in context.
            expr: jsonataExpr("$ * 2"),
          },
        ],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { n: 5 },
    );
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    const [nNode] = root.getChildren(rd);

    await flush();
    expect(nNode.getState(rd).definition.title).toBe("10");

    // Mutate the field and verify re-evaluation.
    ctx.update((wc) =>
      wc.setValue(
        (dataControl as unknown as { fields: { n: Control<number> } })
          .fields.n,
        21,
      ),
    );
    await flush();
    expect(nNode.getState(rd).definition.title).toBe("42");
  });

  it("re-evaluates when a reactive variable's underlying control changes", async () => {
    const fields: SchemaField[] = [stringField("name")];
    const defs = [
      {
        ...dataDef("name"),
        dynamic: [
          {
            type: DynamicPropertyType.Label,
            expr: jsonataExpr("$counter * 2"),
          },
        ],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      name: "alice",
    });
    const counter = ctx.newControl<number>(0);
    const root = createFormStateNode(
      ctx,
      formTree.rootNode,
      dataNode,
      globals,
      { variables: (rc) => ({ counter: rc.getValue(counter) }) },
    );
    const [nameNode] = root.getChildren(rd);

    await flush();
    expect(nameNode.getState(rd).definition.title).toBe("0");

    // Bump the variable's underlying control — jsonata should re-run.
    ctx.update((wc) => wc.setValue(counter, 7));
    await flush();
    expect(nameNode.getState(rd).definition.title).toBe("14");
  });

  it("tolerates a parse error by publishing `undefined`", async () => {
    const fields: SchemaField[] = [stringField("name")];
    const defs = [
      {
        ...dataDef("name"),
        dynamic: [
          {
            type: DynamicPropertyType.Label,
            // Deliberately bogus jsonata syntax.
            expr: jsonataExpr("this is ((( not jsonata"),
          },
        ],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      name: "alice",
    });
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    const [nameNode] = root.getChildren(rd);

    await flush();
    // Parse failure → evaluator falls back to `null` jsonata → undefined/null
    // result → coerced to empty string for `title` (a String field type).
    const title = nameNode.getState(rd).definition.title;
    expect(title == null || title === "").toBe(true);
  });
});

describe("jsonataValidator", () => {
  it("publishes an error from a jsonata expression", async () => {
    const fields: SchemaField[] = [intField("n")];
    const jsonataV: JsonataValidator = {
      type: ValidatorType.Jsonata,
      expression: "n > 10 ? 'too big' : null",
    };
    const defs = [
      { ...dataDef("n"), validators: [jsonataV] } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { n: 5 },
    );
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    const [nNode] = root.getChildren(rd);

    await flush();
    // Value under threshold — no error.
    expect(nNode.getState(rd).valid).toBe(true);

    // Push value above threshold.
    ctx.update((wc) =>
      wc.setValue(
        (dataControl as unknown as { fields: { n: Control<number> } }).fields
          .n,
        42,
      ),
    );
    await flush();

    // Child FormStateNode mirrors the data control's errors, so `valid`
    // becomes false when the jsonata error appears.
    expect(nNode.getState(rd).valid).toBe(false);

    // Drop back under threshold — error clears.
    ctx.update((wc) =>
      wc.setValue(
        (dataControl as unknown as { fields: { n: Control<number> } }).fields
          .n,
        1,
      ),
    );
    await flush();
    expect(nNode.getState(rd).valid).toBe(true);
  });

  it("publishes a literal error from required + jsonata together", async () => {
    const fields: SchemaField[] = [stringField("tag")];
    const jsonataV: JsonataValidator = {
      type: ValidatorType.Jsonata,
      expression: '"Tag must contain a hyphen"',
    };
    const defs = [
      {
        ...dataDef("tag"),
        required: true,
        validators: [jsonataV],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { tag: "" },
    );
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    const [tagNode] = root.getChildren(rd);

    await flush();
    const tagControl = (
      dataControl as unknown as { fields: { tag: Control<string> } }
    ).fields.tag;

    expect(tagNode.getState(rd).valid).toBe(false);
    // The bound data control should carry BOTH error keys: the default
    // (required) under `<uniqueId>default` and the jsonata one under
    // the literal "jsonata" key.
    const errors = tagControl.errorsNow ?? {};
    expect(errors["jsonata"]).toBe("Tag must contain a hyphen");
    expect(Object.keys(errors).filter((k) => k.endsWith("default"))).toHaveLength(
      1,
    );
  });

  it("re-publishes a literal jsonata error after a value change", async () => {
    // Constant-message expression: no data reads inside the expression,
    // so the evaluator's own data tracking can't re-fire it. The
    // validator's `isEnabled` gate subscribes to the data control's
    // value, ensuring a re-evaluation (and therefore a re-publish)
    // after `setValueImpl`'s auto-clear of the errors map.
    const fields: SchemaField[] = [stringField("tag")];
    const jsonataV: JsonataValidator = {
      type: ValidatorType.Jsonata,
      expression: '"Tag must contain a hyphen"',
    };
    const defs = [
      {
        ...dataDef("tag"),
        required: true,
        validators: [jsonataV],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { tag: "" },
    );
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    root.getChildren(rd);
    await flush();

    const tagControl = (
      dataControl as unknown as { fields: { tag: Control<string> } }
    ).fields.tag;
    expect(tagControl.errorsNow?.["jsonata"]).toBe("Tag must contain a hyphen");

    ctx.update((wc) => wc.setValue(tagControl, "a"));
    await flush();
    expect(tagControl.errorsNow?.["jsonata"]).toBe("Tag must contain a hyphen");
  });

  it("re-publishes the jsonata error after a value change clears errors", async () => {
    // Realistic case: data-bound expression that produces the same
    // message for multiple values. `setValueImpl` clears every error
    // on the control on each value write (controlImpl.ts), so the
    // jsonata key gets nuked when the user types — the validator must
    // re-publish from the next jsonata evaluation.
    const fields: SchemaField[] = [stringField("tag")];
    const jsonataV: JsonataValidator = {
      type: ValidatorType.Jsonata,
      expression: '$contains(tag, "-") ? null : "Tag must contain a hyphen"',
    };
    const defs = [
      {
        ...dataDef("tag"),
        required: true,
        validators: [jsonataV],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, dataControl, globals } = makeEnv(
      fields,
      defs,
      { tag: "" },
    );
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    root.getChildren(rd);
    await flush();

    const tagControl = (
      dataControl as unknown as { fields: { tag: Control<string> } }
    ).fields.tag;

    // Type a single character — required clears (non-empty), jsonata
    // re-evaluates to the same message and must republish.
    ctx.update((wc) => wc.setValue(tagControl, "a"));
    await flush();
    expect(tagControl.errorsNow?.["jsonata"]).toBe("Tag must contain a hyphen");

    // Type a hyphen — jsonata flips to null, key clears.
    ctx.update((wc) => wc.setValue(tagControl, "ab-cd"));
    await flush();
    expect(tagControl.errorsNow?.["jsonata"]).toBeUndefined();
  });

  it("suppresses the error while the node is hidden (validationEnabled=false)", async () => {
    const fields: SchemaField[] = [intField("n")];
    const jsonataV: JsonataValidator = {
      type: ValidatorType.Jsonata,
      expression: "n > 10 ? 'too big' : null",
    };
    const defs = [
      {
        ...dataDef("n"),
        hidden: true,
        validators: [jsonataV],
      } as ControlDefinition,
    ];
    const { ctx, formTree, dataNode, globals } = makeEnv(fields, defs, {
      n: 100,
    });
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    const [nNode] = root.getChildren(rd);

    await flush();
    expect(nNode.getState(rd).visible).toBe(false);
    // Validation gated by visibility — the above-threshold value still
    // produces no error.
    expect(nNode.getState(rd).valid).toBe(true);
  });
});
