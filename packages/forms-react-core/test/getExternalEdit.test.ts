import { describe, expect, it } from "vitest";
import {
  createControlContext,
  untrackedRead,
  type ControlContext,
} from "@rx-controls/core";
import {
  ControlDefinitionType,
  createDataNode,
  createFormStateNode,
  createStaticFormTree,
  createStaticSchemaTree,
  type DataControlDefinition,
  type ControlDefinition,
  defaultResolveChildren,
  FieldType,
  type FormGlobalOptions,
  type FormStateNode,
  type SchemaField,
} from "@rx-controls/forms-core";
import { createFormTreeResolver } from "@rx-controls/forms-core";
import { createSchemaTreeResolver } from "@rx-controls/forms-core";
import { getExternalEdit } from "../src/getExternalEdit";

const rd = untrackedRead;

function stringField(name: string): SchemaField {
  return { type: FieldType.String, field: name };
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
  return { type: ControlDefinitionType.Group, children } as ControlDefinition;
}

/**
 * Build a form with a single compound-collection array field at the root
 * (`items: { name (required), color }[]`). The array's element template is
 * a Group wrapping the two data controls — matches the legacy single-child
 * template shape used by `resolveArrayChildren`.
 */
function makeArrayEnv(initialItems: Array<{ name: string; color: string }>) {
  const fields: SchemaField[] = [
    {
      type: FieldType.Compound,
      field: "items",
      collection: true,
      children: [stringField("name"), stringField("color")],
    },
  ];
  const defs: ControlDefinition[] = [
    {
      type: ControlDefinitionType.Data,
      field: "items",
      children: [
        groupDef([
          dataDef("name", { required: true }),
          dataDef("color"),
        ]),
      ],
    } as DataControlDefinition,
  ];

  const ctx: ControlContext = createControlContext();
  const schemaTree = createStaticSchemaTree(
    fields,
    createSchemaTreeResolver(() => undefined),
  );
  const formTree = createStaticFormTree(
    defs,
    createFormTreeResolver(() => undefined),
  );
  const dataControl = ctx.newControl<{
    items: Array<{ name: string; color: string }>;
  }>({ items: initialItems });
  const dataNode = createDataNode(schemaTree.rootNode, dataControl);
  const globals: FormGlobalOptions = {
    resolveChildren: defaultResolveChildren,
    runAsync: (fn) => fn(),
    clearHidden: false,
  };
  const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);

  // The root's first child is the `items` array FormStateNode.
  const [itemsNode] = root.getChildren(rd);
  return { ctx, root, itemsNode, dataControl };
}

function draftField(
  draftForm: FormStateNode,
  fieldName: string,
): { node: FormStateNode | undefined; value: unknown } {
  // The draft form's root is the single-child Group; its children are the
  // group's child data controls. Find the one bound to `fieldName`.
  const groupChildren = draftForm.getChildren(rd);
  for (const c of groupChildren) {
    if (c.getState(rd).field?.field === fieldName) {
      return { node: c, value: c.getState(rd).data?.valueNow };
    }
  }
  return { node: undefined, value: undefined };
}

function setDraftField(
  ctx: ControlContext,
  draftForm: FormStateNode,
  fieldName: string,
  value: unknown,
) {
  const { node } = draftField(draftForm, fieldName);
  const dataCtl = node?.getState(rd).data;
  if (!dataCtl) throw new Error(`no draft control for ${fieldName}`);
  ctx.update((wc) => wc.setValue(dataCtl, value));
}

describe("getExternalEdit", () => {
  it("addCommit: apply pushes the draft value onto the array", () => {
    const { ctx, itemsNode, dataControl } = makeArrayEnv([
      { name: "alice", color: "red" },
    ]);
    const edit = getExternalEdit(itemsNode);

    edit.beginAdd();
    const session = edit.session(rd);
    expect(session).not.toBeNull();
    expect(session!.mode).toBe("add");

    setDraftField(ctx, session!.draftForm, "name", "bob");
    setDraftField(ctx, session!.draftForm, "color", "blue");

    expect(edit.apply()).toBe(true);
    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items).toEqual([
      { name: "alice", color: "red" },
      { name: "bob", color: "blue" },
    ]);
  });

  it("addCancel: cancel discards the draft, array unchanged", () => {
    const { ctx, itemsNode, dataControl } = makeArrayEnv([
      { name: "alice", color: "red" },
    ]);
    const edit = getExternalEdit(itemsNode);

    edit.beginAdd();
    setDraftField(ctx, edit.session(rd)!.draftForm, "name", "ghost");
    edit.cancel();

    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items).toEqual([
      { name: "alice", color: "red" },
    ]);
  });

  it("editCommit: apply writes draft over the targeted element", () => {
    const { ctx, itemsNode, dataControl } = makeArrayEnv([
      { name: "alice", color: "red" },
      { name: "bob", color: "blue" },
      { name: "carol", color: "green" },
    ]);
    const edit = getExternalEdit(itemsNode);

    edit.beginEdit(1);
    const session = edit.session(rd)!;
    expect(session.mode).toBe("edit");
    expect(session.index).toBe(1);
    // Snapshot reflects the live value at begin time.
    expect(session.draft.valueNow).toEqual({ name: "bob", color: "blue" });

    setDraftField(ctx, session.draftForm, "name", "BOB-EDITED");

    expect(edit.apply()).toBe(true);
    expect(dataControl.valueNow.items).toEqual([
      { name: "alice", color: "red" },
      { name: "BOB-EDITED", color: "blue" },
      { name: "carol", color: "green" },
    ]);
  });

  it("editCancel: cancel leaves the live element untouched", () => {
    const { ctx, itemsNode, dataControl } = makeArrayEnv([
      { name: "alice", color: "red" },
      { name: "bob", color: "blue" },
    ]);
    const edit = getExternalEdit(itemsNode);

    edit.beginEdit(0);
    setDraftField(ctx, edit.session(rd)!.draftForm, "name", "ZZZ");
    edit.cancel();

    expect(dataControl.valueNow.items[0]).toEqual({ name: "alice", color: "red" });
  });

  it("editCommit does NOT alias compound draft writes back to the live element", () => {
    // Regression guard for the structuredClone snapshot in beginEdit. If the
    // snapshot ever degrades to a reference copy, writes to the draft's
    // child fields would surface on the live element before Apply.
    const { ctx, itemsNode, dataControl } = makeArrayEnv([
      { name: "alice", color: "red" },
    ]);
    const edit = getExternalEdit(itemsNode);

    edit.beginEdit(0);
    setDraftField(ctx, edit.session(rd)!.draftForm, "name", "BEFORE-APPLY");
    // The live array element should still be untouched.
    expect(dataControl.valueNow.items[0].name).toBe("alice");

    edit.cancel();
    expect(dataControl.valueNow.items[0].name).toBe("alice");
  });

  it("validationBlocks: apply rejects when the draft has a required-error", () => {
    const { itemsNode, dataControl } = makeArrayEnv([]);
    const edit = getExternalEdit(itemsNode);

    edit.beginAdd();
    // Leave `name` empty — should fail the required validator.
    expect(edit.apply()).toBe(false);

    // Session is still open; array unchanged.
    expect(edit.session(rd)).not.toBeNull();
    expect(dataControl.valueNow.items).toEqual([]);
  });

  it("dontValidateBypasses: apply commits even when invalid if dontValidate is set", () => {
    const { itemsNode, dataControl } = makeArrayEnv([]);
    const edit = getExternalEdit(itemsNode);

    edit.beginAdd();
    expect(edit.apply({ dontValidate: true })).toBe(true);
    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items.length).toBe(1);
  });

  it("add session stages [cancel, add] actions on the session", () => {
    // The actions live on the session (legacy `extData.fields.actions`),
    // not in the renderer. Cancel first (dontValidate), then the confirm
    // action — for `add` it uses the array's add id/text (default add/Add).
    const { itemsNode } = makeArrayEnv([]);
    const edit = getExternalEdit(itemsNode);

    edit.beginAdd();
    const { actions } = edit.session(rd)!;
    expect(actions.map((a) => a.action.actionId)).toEqual(["cancel", "add"]);
    expect(actions.map((a) => a.action.actionText)).toEqual(["Cancel", "Add"]);
    expect(actions.map((a) => a.dontValidate ?? false)).toEqual([true, false]);
  });

  it("edit session stages [cancel, apply] actions on the session", () => {
    const { itemsNode } = makeArrayEnv([{ name: "alice", color: "red" }]);
    const edit = getExternalEdit(itemsNode);

    edit.beginEdit(0);
    const { actions } = edit.session(rd)!;
    expect(actions.map((a) => a.action.actionId)).toEqual(["cancel", "apply"]);
    expect(actions.map((a) => a.action.actionText)).toEqual(["Cancel", "Apply"]);
  });

  it("confirm action's onClick commits the draft (raw — host applies validation)", () => {
    const { ctx, itemsNode, dataControl } = makeArrayEnv([]);
    const edit = getExternalEdit(itemsNode);

    edit.beginAdd();
    const session = edit.session(rd)!;
    setDraftField(ctx, session.draftForm, "name", "bob");
    setDraftField(ctx, session.draftForm, "color", "blue");

    // The staged confirm action commits directly (the modal host is the
    // one that wraps this with validation).
    session.actions[1].action.onClick();

    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items).toEqual([{ name: "bob", color: "blue" }]);
  });

  it("cancel action's onClick discards the session", () => {
    const { ctx, itemsNode, dataControl } = makeArrayEnv([
      { name: "alice", color: "red" },
    ]);
    const edit = getExternalEdit(itemsNode);

    edit.beginAdd();
    setDraftField(ctx, edit.session(rd)!.draftForm, "name", "ghost");
    edit.session(rd)!.actions[0].action.onClick();

    expect(edit.session(rd)).toBeNull();
    expect(dataControl.valueNow.items).toEqual([{ name: "alice", color: "red" }]);
  });

  it("concurrentBeginReplaces: second begin disposes the first session", () => {
    const { itemsNode } = makeArrayEnv([
      { name: "alice", color: "red" },
      { name: "bob", color: "blue" },
      { name: "carol", color: "green" },
    ]);
    const edit = getExternalEdit(itemsNode);

    edit.beginEdit(0);
    const first = edit.session(rd)!;
    edit.beginEdit(2);
    const second = edit.session(rd)!;

    expect(second).not.toBe(first);
    expect(second.index).toBe(2);
    expect(second.draft.valueNow).toEqual({ name: "carol", color: "green" });
  });

  it("returns the same controller instance for repeat calls on the same node", () => {
    const { itemsNode } = makeArrayEnv([]);
    const a = getExternalEdit(itemsNode);
    const b = getExternalEdit(itemsNode);
    expect(a).toBe(b);
  });

  it("siblings bound to the same array field share one controller (legacy editExternal pattern)", () => {
    // Two sibling `dataControl`s bound to `items` — mirrors the legacy
    // `renderType: Array` + sibling `renderType: ArrayElement` modal-host
    // shape. Both FormStateNodes resolve to the same array `Control`, so
    // `getExternalEdit` returns the same controller for either node.
    const fields = [
      {
        type: FieldType.Compound,
        field: "items",
        collection: true,
        children: [stringField("name")],
      },
    ] as Array<import("@rx-controls/forms-core").SchemaField>;
    const defs: ControlDefinition[] = [
      {
        type: ControlDefinitionType.Data,
        field: "items",
        children: [groupDef([dataDef("name")])],
      } as DataControlDefinition,
      {
        type: ControlDefinitionType.Data,
        field: "items",
        children: [groupDef([dataDef("name")])],
      } as DataControlDefinition,
    ];
    const ctx: ControlContext = createControlContext();
    const schemaTree = createStaticSchemaTree(
      fields,
      createSchemaTreeResolver(() => undefined),
    );
    const formTree = createStaticFormTree(
      defs,
      createFormTreeResolver(() => undefined),
    );
    const dataControl = ctx.newControl({ items: [] as Array<{ name: string }> });
    const dataNode = createDataNode(schemaTree.rootNode, dataControl);
    const globals: FormGlobalOptions = {
      resolveChildren: defaultResolveChildren,
      runAsync: (fn) => fn(),
      clearHidden: false,
    };
    const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
    const [first, second] = root.getChildren(rd);

    const aEdit = getExternalEdit(first);
    const bEdit = getExternalEdit(second);
    expect(aEdit).toBe(bEdit);

    // Starting a session from one sibling is visible to the other.
    aEdit.beginAdd();
    expect(bEdit.session(rd)).not.toBeNull();
    expect(bEdit.session(rd)?.mode).toBe("add");
  });
});
