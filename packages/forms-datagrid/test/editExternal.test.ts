import { describe, expect, it } from "vitest";
import {
  createControlContext,
  untrackedRead,
  type ControlContext,
} from "@rx-controls/core";
import {
  type ChildResolverFunc,
  ControlDefinitionType,
  createDataNode,
  createFormStateNode,
  createFormTreeResolver,
  createSchemaTreeResolver,
  createStaticFormTree,
  createStaticSchemaTree,
  type DataControlDefinition,
  defaultResolveChildren,
  FieldType,
  type FormGlobalOptions,
  type FormStateNode,
  type GroupedControlsDefinition,
  GroupRenderType,
  type SchemaField,
} from "@rx-controls/forms-core";
import { getExternalEdit } from "@rx-controls/forms-react-core";
import { dataGridResolveChildren, DataGridRenderType } from "../src/DataGrid";

const rd = untrackedRead;

// Match the dispatcher the registry installs: DataGrid → grid resolver,
// everything else → default. Mirrors `makeResolveChildren` in the
// real registry path so the test exercises the production wiring.
const resolveChildren: ChildResolverFunc = (node, rc) => {
  const def = node.getState(rc).definition as {
    renderOptions?: { type?: string };
    groupOptions?: { type?: string };
  };
  const renderType = def.renderOptions?.type ?? def.groupOptions?.type;
  if (renderType === DataGridRenderType) return dataGridResolveChildren(node, rc);
  return defaultResolveChildren(node, rc);
};

const itemsSchema: SchemaField[] = [
  {
    type: FieldType.Compound,
    field: "items",
    collection: true,
    children: [
      { type: FieldType.String, field: "name" } as SchemaField,
      { type: FieldType.Int, field: "qty" } as SchemaField,
    ],
  } as SchemaField,
];

const col = (field: string, title: string): DataControlDefinition =>
  ({
    type: ControlDefinitionType.Data,
    field,
    title,
    renderOptions: { type: "Standard" },
  }) as DataControlDefinition;

const gridDef: DataControlDefinition = {
  type: ControlDefinitionType.Data,
  field: "items",
  renderOptions: { type: DataGridRenderType },
  children: [col("name", "Name"), col("qty", "Qty")],
} as DataControlDefinition;

function makeGridEnv(initial: Array<{ name: string; qty: number }>) {
  const ctx: ControlContext = createControlContext();
  const schemaTree = createStaticSchemaTree(
    itemsSchema,
    createSchemaTreeResolver(() => undefined),
  );
  const formTree = createStaticFormTree(
    [gridDef],
    createFormTreeResolver(() => undefined),
  );
  const dataControl = ctx.newControl<{
    items: Array<{ name: string; qty: number }>;
  }>({ items: initial });
  const dataNode = createDataNode(schemaTree.rootNode, dataControl);
  const globals: FormGlobalOptions = {
    resolveChildren,
    runAsync: (fn) => fn(),
    clearHidden: false,
  };
  const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
  const [arrayNode] = root.getChildren(rd);
  return { ctx, root, arrayNode, dataControl };
}

// The overrides the DataGrid renderer passes to getExternalEdit — keep
// this in sync with the call in `DataGrid.tsx`.
function gridEditOverrides(arrayNode: FormStateNode) {
  return {
    elementForm: arrayNode.form ?? undefined,
    elementDefinition: {
      type: ControlDefinitionType.Group,
      groupOptions: { type: GroupRenderType.Contents },
    } as GroupedControlsDefinition,
  };
}

function findDraftCellByField(
  draftForm: FormStateNode,
  fieldName: string,
): FormStateNode | undefined {
  for (const c of draftForm.getChildren(rd)) {
    if (c.getState(rd).field?.field === fieldName) return c;
  }
  return undefined;
}

describe("DataGrid editExternal — controller wiring", () => {
  it("draft form exposes one child per column, bound to the draft data", () => {
    const { arrayNode } = makeGridEnv([]);
    const edit = getExternalEdit(arrayNode, gridEditOverrides(arrayNode));

    edit.beginAdd();
    const session = edit.session(rd)!;
    expect(session).not.toBeNull();
    const cells = session.draftForm.getChildren(rd);
    expect(cells.map((c) => c.getState(rd).field?.field)).toEqual([
      "name",
      "qty",
    ]);

    // Each cell's data control wires through to the draft compound.
    const nameCell = findDraftCellByField(session.draftForm, "name");
    expect(nameCell?.getState(rd).data).toBeDefined();
  });

  it("no-options getExternalEdit yields the same per-column draft", () => {
    // The DataGrid renderer now calls `getExternalEdit(node)` with NO options
    // (so it shares the `$externalEdit` controller with the sibling
    // ArrayElement modal host). The multi-child auto-detect must root the
    // draft in a Contents group → one child per column, not a nested grid.
    const { arrayNode } = makeGridEnv([]);
    const edit = getExternalEdit(arrayNode);

    edit.beginAdd();
    const session = edit.session(rd)!;
    expect(session).not.toBeNull();
    expect(
      session.draftForm.getChildren(rd).map((c) => c.getState(rd).field?.field),
    ).toEqual(["name", "qty"]);
  });

  it("the same controller is shared across nodes bound to the array (no-options)", () => {
    // Two FormStateNodes bound to the same array field resolve to one
    // controller — the linchpin of the sibling-host pattern (grid stages,
    // sibling renders the modal against the same session).
    const { arrayNode } = makeGridEnv([{ name: "alpha", qty: 1 }]);
    const a = getExternalEdit(arrayNode);
    const b = getExternalEdit(arrayNode);
    expect(a).toBe(b);
    a.beginEdit(0);
    expect(b.session(rd)).not.toBeNull();
  });

  it("apply pushes the staged draft onto the live array", () => {
    const { ctx, arrayNode, dataControl } = makeGridEnv([
      { name: "alpha", qty: 1 },
    ]);
    const edit = getExternalEdit(arrayNode, gridEditOverrides(arrayNode));

    edit.beginAdd();
    const session = edit.session(rd)!;
    const nameCtl = findDraftCellByField(session.draftForm, "name")!.getState(rd)
      .data!;
    const qtyCtl = findDraftCellByField(session.draftForm, "qty")!.getState(rd)
      .data!;
    ctx.update((wc) => {
      wc.setValue(nameCtl, "beta");
      wc.setValue(qtyCtl, 7);
    });

    expect(edit.apply()).toBe(true);
    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items).toEqual([
      { name: "alpha", qty: 1 },
      { name: "beta", qty: 7 },
    ]);
  });

  it("editing a row stages a snapshot, apply writes it back over the live element", () => {
    const { ctx, arrayNode, dataControl } = makeGridEnv([
      { name: "alpha", qty: 1 },
      { name: "beta", qty: 2 },
    ]);
    const edit = getExternalEdit(arrayNode, gridEditOverrides(arrayNode));

    edit.beginEdit(1);
    const session = edit.session(rd)!;
    expect(session.mode).toBe("edit");
    expect(session.draft.valueNow).toEqual({ name: "beta", qty: 2 });

    const qtyCtl = findDraftCellByField(session.draftForm, "qty")!.getState(rd)
      .data!;
    ctx.update((wc) => wc.setValue(qtyCtl, 99));
    // Pre-apply: live element untouched.
    expect(dataControl.valueNow.items[1]).toEqual({ name: "beta", qty: 2 });

    expect(edit.apply()).toBe(true);
    expect(dataControl.valueNow.items).toEqual([
      { name: "alpha", qty: 1 },
      { name: "beta", qty: 99 },
    ]);
  });

  it("cancel discards the staged draft", () => {
    const { ctx, arrayNode, dataControl } = makeGridEnv([
      { name: "alpha", qty: 1 },
    ]);
    const edit = getExternalEdit(arrayNode, gridEditOverrides(arrayNode));

    edit.beginEdit(0);
    const nameCtl = findDraftCellByField(edit.session(rd)!.draftForm, "name")!
      .getState(rd)
      .data!;
    ctx.update((wc) => wc.setValue(nameCtl, "GHOST"));
    edit.cancel();

    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items[0]).toEqual({ name: "alpha", qty: 1 });
  });
});
