/**
 * Verifies the controller-wiring path that `ArrayElementRenderer` relies
 * on when the parent array has `renderOptions.editExternal`. The test
 * builds a real FormStateNode tree (not JSX) and walks the same node
 * hops the renderer does:
 *
 * 1. `node.parentNode` → the array's FormStateNode
 * 2. parent's `renderOptions.editExternal`
 * 3. `node.parent.cursor(rc).elementIndex`
 * 4. `useExternalEdit(parentArray).beginEdit(elementIndex)` → committed
 *    value lands on the targeted element.
 */
import { describe, expect, it } from "vitest";
import {
  createControlContext,
  noopReadContext,
  type ControlContext,
} from "@rxc/controls-core";
import {
  ControlDefinitionType,
  createDataNode,
  createFormStateNode,
  createFormTreeResolver,
  createSchemaTreeResolver,
  createStaticFormTree,
  createStaticSchemaTree,
  type DataControlDefinition,
  DataRenderType,
  defaultResolveChildren,
  FieldType,
  type FormGlobalOptions,
  type FormStateNode,
  isDataControl,
  type ArrayRenderOptions,
  type SchemaField,
} from "@rxc/forms-core";
import { useExternalEdit } from "@rxc/forms-react-core";

const rd = noopReadContext;

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

// Array def with single-child element template. The template is itself a
// data control on `.` (the element) with `renderOptions.type === ArrayElement`
// — what triggers `matchArrayElementChild → ArrayElementRenderer` for
// each element in the production matcher chain.
const arrayDef: DataControlDefinition = {
  type: ControlDefinitionType.Data,
  field: "items",
  renderOptions: {
    type: DataRenderType.Array,
    editExternal: true,
  } as ArrayRenderOptions,
  children: [
    {
      type: ControlDefinitionType.Data,
      field: ".",
      renderOptions: { type: DataRenderType.ArrayElement },
      children: [
        {
          type: ControlDefinitionType.Data,
          field: "name",
        },
        {
          type: ControlDefinitionType.Data,
          field: "qty",
        },
      ],
    } as DataControlDefinition,
  ],
} as DataControlDefinition;

function makeEnv(initial: Array<{ name: string; qty: number }>) {
  const ctx: ControlContext = createControlContext();
  const schemaTree = createStaticSchemaTree(
    itemsSchema,
    createSchemaTreeResolver(() => undefined),
  );
  const formTree = createStaticFormTree(
    [arrayDef],
    createFormTreeResolver(() => undefined),
  );
  const dataControl = ctx.newControl<{
    items: Array<{ name: string; qty: number }>;
  }>({ items: initial });
  const dataNode = createDataNode(schemaTree.rootNode, dataControl);
  const globals: FormGlobalOptions = {
    resolveChildren: defaultResolveChildren,
    runAsync: (fn) => fn(),
    clearHidden: false,
  };
  const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
  const [arrayNode] = root.getChildren(rd);
  const elementNodes = arrayNode.getChildren(rd);
  return { ctx, root, arrayNode, elementNodes, dataControl };
}

function findChildByField(
  node: FormStateNode,
  fieldName: string,
): FormStateNode | undefined {
  for (const c of node.getChildren(rd)) {
    if (c.getState(rd).field?.field === fieldName) return c;
  }
  return undefined;
}

describe("ArrayElementRenderer — editExternal wiring shape", () => {
  it("element's parentNode is the array, and its parent DataCursor exposes elementIndex", () => {
    const { arrayNode, elementNodes } = makeEnv([
      { name: "alice", qty: 1 },
      { name: "bob", qty: 2 },
    ]);
    expect(elementNodes).toHaveLength(2);

    const [el0, el1] = elementNodes;
    expect(el0.parentNode).toBe(arrayNode);
    expect(el1.parentNode).toBe(arrayNode);
    expect(el0.parent.cursor(rd).elementIndex).toBe(0);
    expect(el1.parent.cursor(rd).elementIndex).toBe(1);
  });

  it("editExternal lives on the parent array's renderOptions and is reachable from the element", () => {
    const { elementNodes } = makeEnv([{ name: "alice", qty: 1 }]);
    const [el0] = elementNodes;
    const parentDef = el0.parentNode?.getState(rd).definition;
    expect(parentDef && isDataControl(parentDef)).toBe(true);
    const renderOpts = (parentDef as DataControlDefinition).renderOptions as
      | ArrayRenderOptions
      | undefined;
    expect(renderOpts?.editExternal).toBe(true);
  });

  it("beginEdit from the element side stages the live element value", () => {
    const { ctx, arrayNode, elementNodes, dataControl } = makeEnv([
      { name: "alice", qty: 1 },
      { name: "bob", qty: 2 },
    ]);
    const [, el1] = elementNodes;
    const elementIndex = el1.parent.cursor(rd).elementIndex!;

    const edit = useExternalEdit(arrayNode);
    edit.beginEdit(elementIndex);
    const session = edit.session(rd)!;

    expect(session.mode).toBe("edit");
    expect(session.index).toBe(1);
    expect(session.draft.valueNow).toEqual({ name: "bob", qty: 2 });

    // Mutate the draft via its children (the path the dialog body uses).
    const nameCell = findChildByField(session.draftForm, "name")!;
    ctx.update((wc) => wc.setValue(nameCell.getState(rd).data!, "BOB-EDITED"));

    // Live element untouched pre-Apply.
    expect(dataControl.valueNow.items[1]).toEqual({ name: "bob", qty: 2 });
    expect(edit.apply()).toBe(true);
    expect(dataControl.valueNow.items[1]).toEqual({ name: "BOB-EDITED", qty: 2 });
  });

  it("element-side cancel discards draft without touching the live element", () => {
    const { ctx, arrayNode, elementNodes, dataControl } = makeEnv([
      { name: "alice", qty: 1 },
    ]);
    const [el0] = elementNodes;
    const idx = el0.parent.cursor(rd).elementIndex!;

    const edit = useExternalEdit(arrayNode);
    edit.beginEdit(idx);
    const nameCell = findChildByField(edit.session(rd)!.draftForm, "name")!;
    ctx.update((wc) => wc.setValue(nameCell.getState(rd).data!, "GHOST"));
    edit.cancel();

    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items[0]).toEqual({ name: "alice", qty: 1 });
  });
});

describe("ArrayRenderer — editExternal add path", () => {
  it("beginAdd builds a draft whose children mirror the element template", () => {
    const { arrayNode } = makeEnv([]);
    const edit = useExternalEdit(arrayNode);

    edit.beginAdd();
    const session = edit.session(rd)!;
    expect(session.mode).toBe("add");

    // The draft form's children should be the element-template's own
    // children (the `name` + `qty` data controls), since the array's
    // singleChild is the ArrayElement template and `useExternalEdit`'s
    // auto-detect picks that as the draft root.
    const fields = session.draftForm
      .getChildren(rd)
      .map((c) => c.getState(rd).field?.field);
    expect(fields).toEqual(["name", "qty"]);
  });

  it("apply commits the staged draft to the live array", () => {
    const { ctx, arrayNode, dataControl } = makeEnv([
      { name: "alice", qty: 1 },
    ]);
    const edit = useExternalEdit(arrayNode);

    edit.beginAdd();
    const session = edit.session(rd)!;
    const nameCtl = findChildByField(session.draftForm, "name")!.getState(rd)
      .data!;
    const qtyCtl = findChildByField(session.draftForm, "qty")!.getState(rd)
      .data!;
    ctx.update((wc) => {
      wc.setValue(nameCtl, "carol");
      wc.setValue(qtyCtl, 9);
    });

    expect(edit.apply()).toBe(true);
    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items).toEqual([
      { name: "alice", qty: 1 },
      { name: "carol", qty: 9 },
    ]);
  });

  it("add-side cancel leaves the array untouched", () => {
    const { ctx, arrayNode, dataControl } = makeEnv([
      { name: "alice", qty: 1 },
    ]);
    const edit = useExternalEdit(arrayNode);

    edit.beginAdd();
    const nameCtl = findChildByField(edit.session(rd)!.draftForm, "name")!
      .getState(rd)
      .data!;
    ctx.update((wc) => wc.setValue(nameCtl, "ghost"));
    edit.cancel();

    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items).toEqual([
      { name: "alice", qty: 1 },
    ]);
  });

  it("Add and per-element Edit share the same controller", () => {
    const { arrayNode, elementNodes } = makeEnv([
      { name: "alice", qty: 1 },
    ]);
    const editFromArray = useExternalEdit(arrayNode);
    const editFromElement = useExternalEdit(elementNodes[0].parentNode!);
    expect(editFromElement).toBe(editFromArray);
  });
});
