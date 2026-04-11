import { describe, it, expect } from "vitest";
import {
  createControlContext,
  noopReadContext,
  effect,
  as,
} from "@rxc/controls-core";
import type { Control, ReadContext, ControlContext } from "@rxc/controls-core";
import {
  type SchemaField,
  type CompoundField,
  FieldType,
  type ControlDefinition,
  ControlDefinitionType,
} from "../src/json";
import {
  createStaticSchemaTree as csst,
  createReactiveSchemaTree as crst,
  createDataNode,
  createStaticFormTree as csft,
  createReactiveFormTree as crft,
} from "../src/nodes";
import {
  schemaFieldPath,
  schemaPathString,
  dataJsonPathString,
} from "../src/cursorUtils";
import {
  FormTreeResolver,
  SchemaNode,
  type SchemaTree,
  SchemaTreeResolver,
} from "../src";
import { createSchemaTreeResolver } from "../src/nodes/schemaNode";
import { createFormTreeResolver } from "../src/nodes/formNode";

const rd = noopReadContext;

function makeCtx(): ControlContext {
  return createControlContext();
}

// ── Test data helpers ──────────────────────────────────────────────

function stringField(name: string): SchemaField {
  return { type: FieldType.String, field: name };
}

function compoundField(
  name: string,
  children: SchemaField[],
  schemaRef?: string,
): CompoundField {
  return {
    type: FieldType.Compound,
    field: name,
    children,
    schemaRef,
  };
}

function dataDef(field: string): ControlDefinition {
  return { type: ControlDefinitionType.Data, field } as ControlDefinition;
}

function groupDef(
  children: ControlDefinition[],
  opts?: { id?: string; childRefId?: string; compoundField?: string },
): ControlDefinition {
  return {
    type: ControlDefinitionType.Group,
    children,
    id: opts?.id,
    childRefId: opts?.childRefId,
    compoundField: opts?.compoundField,
  } as ControlDefinition;
}

// ── SchemaNode tests ───────────────────────────────────────────────

describe("Static SchemaNode", () => {
  it("creates root with synthetic compound field", () => {
    const tree = createStaticSchemaTree([stringField("name")]);
    const cursor = tree.cursor(rd);
    expect(cursor.node.id).toBe(tree.id);
    expect(cursor.field.type).toBe(FieldType.Compound);
    expect(cursor.field.field).toBe("");
    expect(cursor.parent).toBeUndefined();
  });

  it("traverses children and verifies fields/parents", () => {
    const tree = createStaticSchemaTree([
      stringField("name"),
      stringField("age"),
    ]);
    const cursor = tree.cursor(rd);
    const children = cursor.children;

    expect(children).toHaveLength(2);
    expect(children[0].field.field).toBe("name");
    expect(children[1].field.field).toBe("age");
    expect(children[0].parent?.node.id).toBe(cursor.node.id);
    expect(children[0].node.parent?.id).toBe(tree.id);
  });

  it("compound field has nested children", () => {
    const tree = createStaticSchemaTree([
      compoundField("address", [stringField("street"), stringField("city")]),
    ]);
    const cursor = tree.cursor(rd);
    const address = cursor.children[0];
    expect(address.children).toHaveLength(2);
    expect(address.children[0].field.field).toBe("street");
    expect(address.children[0].parent?.node.id).toBe(address.node.id);
  });

  it("non-compound fields have no children", () => {
    const tree = createStaticSchemaTree([stringField("name")]);
    const cursor = tree.cursor(rd);
    expect(cursor.children[0].children).toHaveLength(0);
  });

  it("path-based IDs are correct", () => {
    const tree = createStaticSchemaTree([
      compoundField("address", [stringField("street")]),
    ]);
    const cursor = tree.cursor(rd);
    expect(cursor.node.id).toBe("$root");
    expect(cursor.children[0].node.id).toBe("$root/address");
    expect(cursor.children[0].children[0].node.id).toBe("$root/address/street");
  });
});

describe("Static SchemaNode + schemaRef", () => {
  it("resolves schemaRef children via resolver", () => {
    const resolver = createStaticSchemaResolver({
      address: [stringField("street"), stringField("city")],
      main: [compoundField("home", [], "address")],
    });
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const home = cursor.children[0];
    expect(home.children).toHaveLength(2);
    expect(home.children[0].field.field).toBe("street");
    expect(home.children[1].field.field).toBe("city");
  });

  it("re-parents resolved children to referring node", () => {
    const resolver = createStaticSchemaResolver({
      address: [stringField("street")],
      main: [compoundField("home", [], "address")],
    });
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const home = cursor.children[0];
    const street = home.children[0];

    // cursor.parent points back to the referring cursor
    expect(street.parent?.node.id).toBe(home.node.id);
    // node.parent points back to the referring node
    expect(street.node.parent?.id).toBe(home.node.id);
  });

  it("path-based IDs are unique across multiple references to same schema", () => {
    const resolver = createStaticSchemaResolver({
      address: [stringField("street")],
      main: [
        compoundField("billing", [], "address"),
        compoundField("shipping", [], "address"),
      ],
    });
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const billingStreet = cursor.children[0].children[0];
    const shippingStreet = cursor.children[1].children[0];

    expect(billingStreet.node.id).toBe("$root/billing/street");
    expect(shippingStreet.node.id).toBe("$root/shipping/street");
    expect(billingStreet.node.id).not.toBe(shippingStreet.node.id);
  });

  it("nested schemaRef chains work", () => {
    const resolver = createStaticSchemaResolver({
      address: [compoundField("country", [], "country")],
      country: [stringField("code"), stringField("name")],
      home: [compoundField("home", [], "address")],
    });
    const tree = resolver.getSchemaTree("home").rootNode;
    const cursor = tree.cursor(rd);
    const country = cursor.children[0].children[0];
    expect(country.field.field).toBe("country");
    expect(country.children).toHaveLength(2);
    expect(country.children[0].field.field).toBe("code");
    expect(country.children[0].node.id).toBe("$root/home/country/code");
  });

  it("missing schemaRef returns empty children", () => {
    const resolver = createStaticSchemaResolver({
      main: [compoundField("home", [], "nonexistent")],
    });
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    expect(cursor.children[0].children).toHaveLength(0);
  });
});

describe("Static SchemaNode + cursorUtils", () => {
  it("schemaFieldPath works across schemaRef boundary", () => {
    const resolver = createStaticSchemaResolver({
      address: [stringField("street")],
      main: [compoundField("home", [], "address")],
    });
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const street = cursor.children[0].children[0];
    const path = schemaFieldPath(street);
    expect(path.map((c) => c.field.field)).toEqual(["", "home", "street"]);
  });

  it("schemaPathString works across schemaRef boundary", () => {
    const resolver = createStaticSchemaResolver({
      address: [stringField("street")],
      main: [compoundField("home", [], "address")],
    });
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const street = cursor.children[0].children[0];
    expect(schemaPathString(street)).toBe("/home/street");
  });
});

// ── Reactive SchemaNode tests ──────────────────────────────────────

describe("Reactive SchemaNode", () => {
  it("reads elements reactively", () => {
    const ctx = makeCtx();
    const fields = ctx.newControl<SchemaField[]>([
      stringField("name"),
      stringField("age"),
    ]);
    const tree = createReactiveSchemaTree(fields);
    const cursor = tree.cursor(rd);
    expect(cursor.children).toHaveLength(2);
    expect(cursor.children[0].field.field).toBe("name");
  });

  it("child IDs use control uniqueId", () => {
    const ctx = makeCtx();
    const fields = ctx.newControl<SchemaField[]>([stringField("name")]);
    const tree = createReactiveSchemaTree(fields);
    const cursor = tree.cursor(rd);
    const child = cursor.children[0];
    // ID should be $root/<uniqueId>
    expect(child.node.id).toMatch(/^\$root\/\d+$/);
  });

  it("registers reactive deps and updates on change", () => {
    const ctx = makeCtx();
    const fields = ctx.newControl<SchemaField[]>([stringField("name")]);
    const tree = createReactiveSchemaTree(fields);

    let childCount = 0;
    effect(ctx, (rc: ReadContext) => {
      childCount = tree.cursor(rc).children.length;
    });
    expect(childCount).toBe(1);

    // Add a field
    ctx.update((wc) => {
      wc.setValue(fields, [stringField("name"), stringField("age")]);
    });
    expect(childCount).toBe(2);
  });

  it("reactive compound children via fields['children']", () => {
    const ctx = makeCtx();
    const fields = ctx.newControl<SchemaField[]>([
      compoundField("address", [stringField("street"), stringField("city")]),
    ]);
    const tree = createReactiveSchemaTree(fields);
    const cursor = tree.cursor(rd);
    const address = cursor.children[0];
    expect(address.children).toHaveLength(2);
    expect(address.children[0].field.field).toBe("street");
    expect(address.children[1].field.field).toBe("city");
  });

  it("reactive compound children update on change", () => {
    const ctx = makeCtx();
    const fields = ctx.newControl<SchemaField[]>([
      compoundField("address", [stringField("street")]),
    ]);
    const tree = createReactiveSchemaTree(fields);

    let childNames: string[] = [];
    effect(ctx, (rc: ReadContext) => {
      const address = tree.cursor(rc).children[0];
      childNames = address.children.map((c) => c.field.field);
    });
    expect(childNames).toEqual(["street"]);

    // Update compound children
    ctx.update((wc) => {
      wc.setValue(fields, [
        compoundField("address", [stringField("street"), stringField("city")]),
      ]);
    });
    expect(childNames).toEqual(["street", "city"]);
  });

  it("reactive schemaRef resolution via resolver", () => {
    const ctx = makeCtx();
    const allSchemas = ctx.newControl<Record<string, SchemaField[]>>({
      address: [stringField("street"), stringField("city")],
      main: [compoundField("home", [], "address")],
    });
    const resolver = createReactiveSchemaResolver(allSchemas);
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const home = cursor.children[0];
    expect(home.children).toHaveLength(2);
    expect(home.children[0].field.field).toBe("street");
  });

  it("reactive schemaRef re-parents with correct IDs", () => {
    const ctx = makeCtx();
    const allSchemas = ctx.newControl<Record<string, SchemaField[]>>({
      address: [stringField("street")],
      main: [
        compoundField("billing", [], "address"),
        compoundField("shipping", [], "address"),
      ],
    });
    const resolver = createReactiveSchemaResolver(allSchemas);
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const billingStreet = cursor.children[0].children[0];
    const shippingStreet = cursor.children[1].children[0];

    // IDs are unique across references
    expect(billingStreet.node.id).not.toBe(shippingStreet.node.id);
    // Parents point back to referring nodes
    expect(billingStreet.node.parent?.id).toBe(cursor.children[0].node.id);
    expect(shippingStreet.node.parent?.id).toBe(cursor.children[1].node.id);
  });

  it("reactive schemaRef to non-existent schema returns empty children", () => {
    const ctx = makeCtx();
    const allSchemas = ctx.newControl<Record<string, SchemaField[]>>({
      address: [stringField("street")],
      main: [compoundField("home", [], "nonexistent")],
    });
    const resolver = createReactiveSchemaResolver(allSchemas);
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const home = cursor.children[0];
    expect(home.children).toHaveLength(0);
  });

  it("reactive resolver lazy loading — empty then populated", () => {
    const ctx = makeCtx();
    const allSchemas = ctx.newControl<Record<string, SchemaField[]>>({});
    const resolver = createReactiveSchemaResolver(allSchemas, ctx);

    // Access before data exists — resolver creates node wrapping null/empty control
    const node = resolver.getSchemaTree("address")?.rootNode;
    expect(node).toBeDefined();
    expect(node!.cursor(rd).children).toHaveLength(0);

    // Populate the control externally (simulating async load completion)
    ctx.update((wc) => {
      const addressControl = allSchemas.fields.address;
      wc.setValue(addressControl, [stringField("street"), stringField("city")]);
    });

    // Now children should resolve
    expect(node!.cursor(rd).children).toHaveLength(2);
    expect(node!.cursor(rd).children[0].field.field).toBe("street");
  });

  it("reactive resolver lazy loading triggers effect re-evaluation", () => {
    const ctx = makeCtx();
    const allSchemas = ctx.newControl<Record<string, SchemaField[]>>({
      main: [compoundField("home", [], "address")],
    });
    const resolver = createReactiveSchemaResolver(allSchemas, ctx);
    const tree = resolver.getSchemaTree("main")!.rootNode;

    let childNames: string[] = [];
    effect(ctx, (rc: ReadContext) => {
      const home = tree.cursor(rc).children[0];
      childNames = home.children.map((c) => c.field.field);
    });
    expect(childNames).toEqual([]);

    // Populate the address schema
    ctx.update((wc) => {
      const addressControl = allSchemas.fields.address;
      wc.setValue(addressControl, [stringField("street")]);
    });
    expect(childNames).toEqual(["street"]);
  });

  it("reactive resolver caches nodes", () => {
    const ctx = makeCtx();
    const allSchemas = ctx.newControl<Record<string, SchemaField[]>>({
      address: [stringField("street")],
    });
    const resolver = createReactiveSchemaResolver(allSchemas);
    expect(resolver.getSchemaTree("address")).toBe(
      resolver.getSchemaTree("address"),
    );
  });
});

// ── DataNode tests ─────────────────────────────────────────────────

describe("DataNode", () => {
  it("creates root data node", () => {
    const ctx = makeCtx();
    const schema = createStaticSchemaTree([
      stringField("name"),
      stringField("age"),
    ]);
    const data = ctx.newControl({ name: "Alice", age: 30 });
    const node = createDataNode(schema, data);
    const cursor = node.cursor(rd);

    expect(cursor.field.type).toBe(FieldType.Compound);
    expect(cursor.control.uniqueId).toBe(data.uniqueId);
    expect(cursor.parent).toBeUndefined();
  });

  it("navigates childField", () => {
    const ctx = makeCtx();
    const schema = createStaticSchemaTree([
      stringField("name"),
      stringField("age"),
    ]);
    const data = ctx.newControl({ name: "Alice", age: 30 });
    const node = createDataNode(schema, data);
    const cursor = node.cursor(rd);

    const nameCursor = cursor.childField("name");
    expect(nameCursor).toBeDefined();
    expect(nameCursor!.field.field).toBe("name");
    expect(rd.getValue(nameCursor!.control as Control<string>)).toBe("Alice");
    expect(nameCursor!.parent?.node.id).toBe(cursor.node.id);
  });

  it("childField returns undefined for missing field", () => {
    const ctx = makeCtx();
    const schema = createStaticSchemaTree([stringField("name")]);
    const data = ctx.newControl({ name: "Alice" });
    const node = createDataNode(schema, data);
    const cursor = node.cursor(rd);

    expect(cursor.childField("missing")).toBeUndefined();
  });

  it("navigates childElement", () => {
    const ctx = makeCtx();
    const itemSchema = createStaticSchemaTree([stringField("item")]);
    // DataNode for an array — use the same schema for array elements
    const schema = createStaticSchemaTree([
      { ...stringField("item"), collection: true },
    ]);
    const data = ctx.newControl({ item: ["a", "b", "c"] });
    const root = createDataNode(schema, data);
    const cursor = root.cursor(rd);

    const itemCursor = cursor.childField("item");
    expect(itemCursor).toBeDefined();

    const elem = itemCursor!.childElement(1);
    expect(elem).toBeDefined();
    expect(elem!.elementIndex).toBe(1);
    expect(rd.getValue(elem!.control as Control<string>)).toBe("b");
  });

  it("childElement returns undefined for non-collection field", () => {
    const ctx = makeCtx();
    const schema = createStaticSchemaTree([stringField("name")]);
    const data = ctx.newControl({ name: "test" });
    const root = createDataNode(schema, data);
    const cursor = root.cursor(rd);
    const name = cursor.childField("name")!;
    expect(name.childElement(0)).toBeUndefined();
  });

  it("childElement returns undefined for out of bounds", () => {
    const ctx = makeCtx();
    const schema = createStaticSchemaTree([
      { ...stringField("items"), collection: true },
    ]);
    const data = ctx.newControl({ items: ["a"] });
    const root = createDataNode(schema, data);
    const cursor = root.cursor(rd);
    const items = cursor.childField("items")!;
    expect(items.childElement(5)).toBeUndefined();
  });

  it("navigates nested compound fields", () => {
    const ctx = makeCtx();
    const schema = createStaticSchemaTree([
      compoundField("address", [stringField("street"), stringField("city")]),
    ]);
    const data = ctx.newControl({
      address: { street: "123 Main", city: "Springfield" },
    });
    const root = createDataNode(schema, data);
    const cursor = root.cursor(rd);
    const street = cursor.childField("address")?.childField("street");

    expect(street).toBeDefined();
    expect(rd.getValue(street!.control as Control<string>)).toBe("123 Main");
  });

  it("DataNode ID is control uniqueId", () => {
    const ctx = makeCtx();
    const schema = createStaticSchemaTree([stringField("name")]);
    const data = ctx.newControl({ name: "Alice" });
    const node = createDataNode(schema, data);
    expect(node.id).toBe(String(data.uniqueId));
  });

  it("dataJsonPathString works across schema with schemaRef", () => {
    const ctx = makeCtx();
    const resolver = createStaticSchemaResolver({
      address: [stringField("street")],
      main: [compoundField("home", [], "address")],
    });
    const schema = resolver.getSchemaTree("main")!.rootNode;
    const data = ctx.newControl({ home: { street: "Main St" } });
    const root = createDataNode(schema, data);
    const street = root.cursor(rd).childField("home")?.childField("street");
    expect(street).toBeDefined();
    expect(dataJsonPathString(street!)).toBe("home/street");
  });
});

describe("DataNode reactive", () => {
  it("data traversal reacts to schema changes", () => {
    const ctx = makeCtx();
    const fields = ctx.newControl<SchemaField[]>([stringField("name")]);
    const schema = createReactiveSchemaTree(fields);
    const data = ctx.newControl<Record<string, unknown>>({
      name: "Alice",
      age: 30,
    });
    const node = createDataNode(schema, data);

    let fieldNames: string[] = [];
    effect(ctx, (rc: ReadContext) => {
      const cursor = node.cursor(rc);
      // Traverse all schema children via childField
      const schemaCursor = schema.cursor(rc);
      fieldNames = schemaCursor.children
        .map((sc) => sc.field.field)
        .filter((f) => cursor.childField(f) !== undefined);
    });
    expect(fieldNames).toEqual(["name"]);

    // Add age field to schema
    ctx.update((wc) => {
      wc.setValue(fields, [stringField("name"), stringField("age")]);
    });
    expect(fieldNames).toEqual(["name", "age"]);
  });

  it("childElement reacts to array changes", () => {
    const ctx = makeCtx();
    const schema = createStaticSchemaTree([
      { ...stringField("items"), collection: true },
    ]);
    const data = ctx.newControl({ items: ["a", "b"] });
    const node = createDataNode(schema, data);

    let elemCount = 0;
    effect(ctx, (rc: ReadContext) => {
      const items = node.cursor(rc).childField("items");
      if (!items) return;
      // Count elements by trying indices
      const elems = rc.getElements(as<unknown[]>(items.control));
      elemCount = elems.length;
    });
    expect(elemCount).toBe(2);

    ctx.update((wc) => {
      const itemsControl = data.fields.items;
      wc.setValue(itemsControl, ["a", "b", "c"]);
    });
    expect(elemCount).toBe(3);
  });

  it("data traversal with reactive schemaRef", () => {
    const ctx = makeCtx();
    const allSchemas = ctx.newControl<Record<string, SchemaField[]>>({
      address: [stringField("street")],
      main: [compoundField("home", [], "address")],
    });
    const resolver = createReactiveSchemaResolver(allSchemas);
    const schema = resolver.getSchemaTree("main")!.rootNode;
    const data = ctx.newControl({ home: { street: "Main St", city: "NYC" } });
    const node = createDataNode(schema, data);

    const cursor = node.cursor(rd);
    const street = cursor.childField("home")?.childField("street");
    expect(street).toBeDefined();
    expect(rd.getValue(street!.control as Control<string>)).toBe("Main St");

    // City not available yet because address schema only has street
    const city = cursor.childField("home")?.childField("city");
    expect(city).toBeUndefined();

    // Add city to address schema
    ctx.update((wc) => {
      const addressControl = allSchemas.fields.address;
      wc.setValue(addressControl, [stringField("street"), stringField("city")]);
    });

    // Now city should be accessible
    const cursor2 = node.cursor(rd);
    const city2 = cursor2.childField("home")?.childField("city");
    expect(city2).toBeDefined();
    expect(rd.getValue(city2!.control as Control<string>)).toBe("NYC");
  });
});

// ── FormNode tests ─────────────────────────────────────────────────

describe("Static FormNode", () => {
  it("creates root with children", () => {
    const tree = createStaticFormTree([dataDef("name"), dataDef("age")]);
    const cursor = tree.cursor(rd);
    expect(cursor.children).toHaveLength(2);
    expect((cursor.children[0].field as any).field).toBe("name");
    expect(cursor.children[0].parent?.node.id).toBe(cursor.node.id);
  });

  it("nested children", () => {
    const tree = createStaticFormTree([
      groupDef([dataDef("name"), dataDef("age")]),
    ]);
    const cursor = tree.cursor(rd);
    const group = cursor.children[0];
    expect(group.children).toHaveLength(2);
    expect(group.children[0].node.parent?.id).toBe(group.node.id);
  });

  it("path-based IDs", () => {
    const tree = createStaticFormTree([groupDef([dataDef("name")])]);
    const cursor = tree.cursor(rd);
    expect(cursor.node.id).toBe("$root");
    expect(cursor.children[0].node.id).toBe("$root/0");
    expect(cursor.children[0].children[0].node.id).toBe("$root/0/0");
  });
});

describe("Static FormNode + childRefId", () => {
  it("local childRefId resolves to sibling definition by id", () => {
    const tree = createStaticFormTree([
      groupDef([dataDef("street"), dataDef("city")], { id: "addressFields" }),
      groupDef([], { childRefId: "addressFields" }),
    ]);
    const cursor = tree.cursor(rd);
    const refGroup = cursor.children[1];
    expect(refGroup.children).toHaveLength(2);
    expect((refGroup.children[0].field as any).field).toBe("street");
  });

  it("local childRefId re-parents children", () => {
    const tree = createStaticFormTree([
      groupDef([dataDef("street")], { id: "addressFields" }),
      groupDef([], { childRefId: "addressFields" }),
    ]);
    const cursor = tree.cursor(rd);
    const refGroup = cursor.children[1];
    const street = refGroup.children[0];
    expect(street.parent?.node.id).toBe(refGroup.node.id);
    expect(street.node.parent?.id).toBe(refGroup.node.id);
  });

  it("external childRefId /formId resolves via resolver", () => {
    const resolver = createStaticFormResolver({
      addressForm: [dataDef("street"), dataDef("city")],
      main: [groupDef([], { childRefId: "/addressForm" })],
    });
    const tree = resolver.getFormTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const group = cursor.children[0];
    expect(group.children).toHaveLength(2);
    expect((group.children[0].field as any).field).toBe("street");
  });

  it("external childRefId /formId/localId resolves via resolver + id scan", () => {
    const resolver = createStaticFormResolver({
      addressForm: [
        groupDef([dataDef("street"), dataDef("city")], { id: "inner" }),
      ],
      main: [groupDef([], { childRefId: "/addressForm/inner" })],
    });
    const tree = resolver.getFormTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const group = cursor.children[0];
    expect(group.children).toHaveLength(2);
    expect((group.children[0].field as any).field).toBe("street");
  });

  it("missing external ref returns empty children", () => {
    const resolver = createStaticFormResolver({
      main: [groupDef([], { childRefId: "/nonexistent" })],
    });
    const tree = resolver.getFormTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    expect(cursor.children[0].children).toHaveLength(0);
  });

  it("local childRefId with non-existent id returns empty children", () => {
    const tree = createStaticFormTree([
      groupDef([], { childRefId: "doesNotExist" }),
    ]);
    const cursor = tree.cursor(rd);
    expect(cursor.children[0].children).toHaveLength(0);
  });

  it("leaf definition with no children and no childRefId returns empty", () => {
    const tree = createStaticFormTree([dataDef("name")]);
    const cursor = tree.cursor(rd);
    expect(cursor.children[0].children).toHaveLength(0);
  });

  it("path-based IDs unique across same childRefId used twice", () => {
    const resolver = createStaticFormResolver({
      shared: [dataDef("field1")],
      main: [
        groupDef([], { childRefId: "/shared" }),
        groupDef([], { childRefId: "/shared" }),
      ],
    });
    const tree = resolver.getFormTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const first = cursor.children[0].children[0];
    const second = cursor.children[1].children[0];
    expect(first.node.id).not.toBe(second.node.id);
  });
});

// ── Reactive FormNode tests ────────────────────────────────────────

describe("Reactive FormNode", () => {
  it("reads elements reactively", () => {
    const ctx = makeCtx();
    const defs = ctx.newControl<ControlDefinition[]>([
      dataDef("name"),
      dataDef("age"),
    ]);
    const tree = createReactiveFormTree(defs);
    const cursor = tree.cursor(rd);
    expect(cursor.children).toHaveLength(2);
  });

  it("registers reactive deps and updates on change", () => {
    const ctx = makeCtx();
    const defs = ctx.newControl<ControlDefinition[]>([dataDef("name")]);
    const tree = createReactiveFormTree(defs);

    let childCount = 0;
    effect(ctx, (rc: ReadContext) => {
      childCount = tree.cursor(rc).children.length;
    });
    expect(childCount).toBe(1);

    ctx.update((wc) => {
      wc.setValue(defs, [dataDef("name"), dataDef("age")]);
    });
    expect(childCount).toBe(2);
  });
});

describe("Reactive FormNode children", () => {
  it("reactive nested children via fields['children']", () => {
    const ctx = makeCtx();
    const defs = ctx.newControl<ControlDefinition[]>([
      groupDef([dataDef("name"), dataDef("age")]),
    ]);
    const tree = createReactiveFormTree(defs);
    const cursor = tree.cursor(rd);
    const group = cursor.children[0];
    expect(group.children).toHaveLength(2);
    expect((group.children[0].field as any).field).toBe("name");
  });

  it("reactive nested children update on change", () => {
    const ctx = makeCtx();
    const defs = ctx.newControl<ControlDefinition[]>([
      groupDef([dataDef("name")]),
    ]);
    const tree = createReactiveFormTree(defs);

    let innerNames: string[] = [];
    effect(ctx, (rc: ReadContext) => {
      const group = tree.cursor(rc).children[0];
      innerNames = group.children.map(
        (c) => (c.field as any).field ?? c.field.type,
      );
    });
    expect(innerNames).toEqual(["name"]);

    ctx.update((wc) => {
      wc.setValue(defs, [groupDef([dataDef("name"), dataDef("age")])]);
    });
    expect(innerNames).toEqual(["name", "age"]);
  });

  it("reactive childRefId resolution", () => {
    const ctx = makeCtx();
    const allDefs = ctx.newControl<Record<string, ControlDefinition[]>>({
      shared: [dataDef("street"), dataDef("city")],
      main: [groupDef([], { childRefId: "/shared" })],
    });
    const resolver = createReactiveFormResolver(allDefs);
    const tree = resolver.getFormTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const group = cursor.children[0];
    expect(group.children).toHaveLength(2);
    expect((group.children[0].field as any).field).toBe("street");
  });

  it("reactive childRefId re-parents with correct IDs", () => {
    const ctx = makeCtx();
    const allDefs = ctx.newControl<Record<string, ControlDefinition[]>>({
      shared: [dataDef("field1")],
      main: [
        groupDef([], { childRefId: "/shared" }),
        groupDef([], { childRefId: "/shared" }),
      ],
    });
    const resolver = createReactiveFormResolver(allDefs);
    const tree = resolver.getFormTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const first = cursor.children[0].children[0];
    const second = cursor.children[1].children[0];
    expect(first.node.id).not.toBe(second.node.id);
    expect(first.node.parent?.id).toBe(cursor.children[0].node.id);
    expect(second.node.parent?.id).toBe(cursor.children[1].node.id);
  });

  it("reactive form resolver lazy loading", () => {
    const ctx = makeCtx();
    const allDefs = ctx.newControl<Record<string, ControlDefinition[]>>({});
    const resolver = createReactiveFormResolver(allDefs, ctx);

    const node = resolver.getFormTree("shared")?.rootNode;
    expect(node).toBeDefined();
    expect(node!.cursor(rd).children).toHaveLength(0);

    // Populate externally
    ctx.update((wc) => {
      const sharedControl = allDefs.fields.shared;

      wc.setValue(sharedControl, [dataDef("street")]);
    });

    expect(node!.cursor(rd).children).toHaveLength(1);
    expect((node!.cursor(rd).children[0].field as any).field).toBe("street");
  });

  it("reactive form resolver lazy loading triggers effect", () => {
    const ctx = makeCtx();
    const allDefs = ctx.newControl<Record<string, ControlDefinition[]>>({
      main: [groupDef([], { childRefId: "/shared" })],
    });
    const resolver = createReactiveFormResolver(allDefs, ctx);
    const tree = resolver.getFormTree("main")!.rootNode;

    let childFields: string[] = [];
    effect(ctx, (rc: ReadContext) => {
      const group = tree.cursor(rc).children[0];
      childFields = group.children.map((c) => (c.field as any).field ?? "");
    });
    expect(childFields).toEqual([]);

    // Populate
    ctx.update((wc) => {
      const sharedControl = allDefs.fields.shared;
      wc.setValue(sharedControl, [dataDef("street")]);
    });
    expect(childFields).toEqual(["street"]);
  });

  it("reactive form resolver caches nodes", () => {
    const ctx = makeCtx();
    const allDefs = ctx.newControl<Record<string, ControlDefinition[]>>({
      form1: [dataDef("name")],
    });
    const resolver = createReactiveFormResolver(allDefs);
    expect(resolver.getFormTree("form1")).toBe(resolver.getFormTree("form1"));
  });

  it("definition with no children and no childRefId returns empty", () => {
    const ctx = makeCtx();
    const defs = ctx.newControl<ControlDefinition[]>([dataDef("name")]);
    const tree = createReactiveFormTree(defs);
    const cursor = tree.cursor(rd);
    expect(cursor.children[0].children).toHaveLength(0);
  });

  it("reactive form child node cursor(rd) re-invocation", () => {
    const ctx = makeCtx();
    const defs = ctx.newControl<ControlDefinition[]>([
      groupDef([dataDef("street")]),
    ]);
    const tree = createReactiveFormTree(defs);
    const cursor = tree.cursor(rd);
    const group = cursor.children[0];

    // Re-invoke cursor on the child node
    const groupCursor2 = group.node.cursor(rd);
    expect(groupCursor2.field.type).toBe(ControlDefinitionType.Group);
    expect(groupCursor2.children).toHaveLength(1);
    expect((groupCursor2.children[0].field as any).field).toBe("street");
  });
});

describe("Wrapper node cursor re-invocation", () => {
  it("schema wrapper node cursor(rd) produces correct field and parent", () => {
    const resolver = createStaticSchemaResolver({
      address: [stringField("street"), stringField("city")],
      main: [compoundField("home", [], "address")],
    });
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const street = cursor.children[0].children[0];

    // Call cursor(rd) on the wrapper node independently
    const streetCursor2 = street.node.cursor(rd);
    expect(streetCursor2.field.field).toBe("street");
    expect(streetCursor2.parent?.field.field).toBe("home");
    expect(streetCursor2.node.id).toBe("$root/home/street");
  });

  it("form wrapper node cursor(rd) produces correct definition and parent", () => {
    const resolver = createStaticFormResolver({
      shared: [dataDef("street"), dataDef("city")],
      main: [groupDef([], { childRefId: "/shared" })],
    });
    const tree = resolver.getFormTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const street = cursor.children[0].children[0];

    // Call cursor(rd) on the wrapper node independently
    const streetCursor2 = street.node.cursor(rd);
    expect((streetCursor2.field as any).field).toBe("street");
    expect(streetCursor2.parent?.field.type).toBe("Group");
    expect(streetCursor2.node.id).toBe(street.node.id);
  });

  it("form wrapper node with children re-invocation traverses deeper", () => {
    const resolver = createStaticFormResolver({
      shared: [groupDef([dataDef("street")], { id: "inner" })],
      main: [groupDef([], { childRefId: "/shared" })],
    });
    const tree = resolver.getFormTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const innerGroup = cursor.children[0].children[0];

    // Re-invoke cursor on the wrapper node (a group with children)
    const innerCursor2 = innerGroup.node.cursor(rd);
    expect(innerCursor2.children).toHaveLength(1);
    expect((innerCursor2.children[0].field as any).field).toBe("street");
  });

  it("deep wrapper re-invocation preserves full parent chain", () => {
    const resolver = createStaticSchemaResolver({
      address: [compoundField("country", [stringField("code")])],
      main: [compoundField("home", [], "address")],
    });
    const tree = resolver.getSchemaTree("main")!.rootNode;
    const cursor = tree.cursor(rd);
    const code = cursor.children[0].children[0].children[0];

    // Walk the parent chain
    const path = schemaFieldPath(code);
    expect(path.map((c) => c.field.field)).toEqual([
      "",
      "home",
      "country",
      "code",
    ]);

    // Re-invoke cursor on the country wrapper node
    const countryCursor = cursor.children[0].children[0].node.cursor(rd);
    expect(countryCursor.children).toHaveLength(1);
    expect(countryCursor.children[0].field.field).toBe("code");
  });
});

// ── Resolver caching tests ─────────────────────────────────────────

describe("Resolver caching", () => {
  it("static schema resolver caches nodes", () => {
    const resolver = createStaticSchemaResolver({
      address: [stringField("street")],
    });
    const node1 = resolver.getSchemaTree("address");
    const node2 = resolver.getSchemaTree("address");
    expect(node1).toBe(node2);
  });

  it("static form resolver caches nodes", () => {
    const resolver = createStaticFormResolver({
      form1: [dataDef("name")],
    });
    const node1 = resolver.getFormTree("form1");
    const node2 = resolver.getFormTree("form1");
    expect(node1).toBe(node2);
  });
});

// ── Resolver factories ─────────────────────────────────────────────

/**
 * Creates a {@link SchemaTreeResolver} from a plain record of named schema
 * field arrays. Resolved trees are cached so each `schemaRef` is built once.
 *
 * @param allFields - A map from schema reference name to its field definitions.
 */
export function createStaticSchemaResolver(
  allFields: Record<string, SchemaField[]>,
): SchemaTreeResolver {
  return createSchemaTreeResolver((schemaId, resolver) => {
    const rootFields = allFields[schemaId];
    return rootFields ? csst(rootFields, resolver) : undefined;
  });
}

export function createReactiveSchemaResolver(
  allSchemas: Control<Record<string, SchemaField[]>>,
  ctx?: ControlContext,
): SchemaTreeResolver {
  return createSchemaTreeResolver((schemaId, resolver) => {
    const rootFields = allSchemas.fields[schemaId];
    if (ctx && rootFields.isNullNow)
      ctx.update((wc) => wc.setValue(rootFields, []));
    return !rootFields.isNullNow ? crst(rootFields, resolver) : undefined;
  });
}

// ── Resolver factories ─────────────────────────────────────────────

/**
 * Creates a {@link FormTreeResolver} from a plain record of named control
 * definition arrays. Resolved trees are cached so each form id is built once.
 *
 * @param allDefs - A map from form id to its control definitions.
 */
export function createStaticFormResolver(
  allDefs: Record<string, ControlDefinition[]>,
): FormTreeResolver {
  return createFormTreeResolver((formId, resolver) => {
    const rootControls = allDefs[formId];
    return rootControls ? csft(rootControls, resolver) : undefined;
  });
}

export function createReactiveFormResolver(
  allDefs: Control<Record<string, ControlDefinition[]>>,
  ctx?: ControlContext,
): FormTreeResolver {
  return createFormTreeResolver((formId, resolver) => {
    const rootControls = allDefs.fields[formId];
    if (ctx && rootControls.isNullNow)
      ctx.update((wc) => wc.setValue(rootControls, []));
    return !rootControls.isNullNow ? crft(rootControls, resolver) : undefined;
  });
}

export function createStaticSchemaTree(fields: SchemaField[]): SchemaNode {
  return csst(fields, { getSchemaTree: () => undefined }).rootNode;
}

export function createReactiveSchemaTree(
  fieldsControl: Control<SchemaField[]>,
): SchemaNode {
  return crst(fieldsControl, { getSchemaTree: () => undefined }).rootNode;
}

export function createStaticFormTree(controls: ControlDefinition[]) {
  return csft(controls, { getFormTree: () => undefined }).rootNode;
}

export function createReactiveFormTree(controls: Control<ControlDefinition[]>) {
  return crft(controls, { getFormTree: () => undefined }).rootNode;
}
