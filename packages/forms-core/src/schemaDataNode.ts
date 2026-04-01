import type { Control, ControlContext, ReadContext } from "@rxc/controls-core";
import { ensureMetaValue } from "@rxc/controls-core";
import { resolveSchemaNode, SchemaNode } from "./schemaNode";
import type { SchemaField } from "./json/schemaField";


export abstract class SchemaDataTree {
  abstract rootNode: SchemaDataNode;

  abstract getChild(rc: ReadContext, parent: SchemaDataNode, child: SchemaNode): SchemaDataNode;

  abstract getChildElement(
    parent: SchemaDataNode,
    elementIndex: number,
  ): SchemaDataNode;
}

export class SchemaDataNode {
  constructor(
    public id: string,
    public schema: SchemaNode,
    public elementIndex: number | undefined,
    public control: Control<any>,
    public tree: SchemaDataTree,
    public parent?: SchemaDataNode,
  ) {}

  getChild(rc: ReadContext, childNode: SchemaNode): SchemaDataNode {
    return this.tree.getChild(rc, this, childNode);
  }

  getChildElement(elementIndex: number): SchemaDataNode {
    return this.tree.getChildElement(this, elementIndex);
  }
}

export function getMetaFields<
  T extends Record<string, any> = Record<string, unknown>,
>(control: Control<any>): Control<T> {
  return ensureMetaValue(
    control,
    "metaFields",
    (newControl) => newControl({}) as Control<T>,
  );
}
export class SchemaDataTreeImpl extends SchemaDataTree {
  rootNode: SchemaDataNode;

  constructor(rootSchema: SchemaNode, rootControl: Control<any>) {
    super();
    this.rootNode = new SchemaDataNode(
      "",
      rootSchema,
      undefined,
      rootControl,
      this,
    );
  }

  getChild(rc: ReadContext, parent: SchemaDataNode, childNode: SchemaNode): SchemaDataNode {
    let objControl = parent.control as Control<Record<string, unknown>>;
    const field = childNode.getField(rc);
    if (field.meta) {
      objControl = getMetaFields(objControl);
    }
    const child = objControl.fields[field.field];
    return new SchemaDataNode(
      child.uniqueId.toString(),
      childNode,
      undefined,
      child,
      this,
      parent,
    );
  }

  getChildElement(
    parent: SchemaDataNode,
    elementIndex: number,
  ): SchemaDataNode {
    const elemControl = parent.control as Control<unknown[]>;
    const elemChild = elemControl.elements[elementIndex];
    return new SchemaDataNode(
      elemChild.uniqueId.toString() + "_" + elementIndex,
      parent.schema,
      elementIndex,
      elemChild,
      this,
      parent,
    );
  }
}

export class IsolatedSchemaDataTree extends SchemaDataTree {
  rootNode: SchemaDataNode;

  constructor(rootSchema: SchemaNode, private ctx: ControlContext) {
    super();
    this.rootNode = new SchemaDataNode(
      "",
      rootSchema,
      undefined,
      ctx.newControl({}),
      this,
    );
  }

  getChild(rc: ReadContext, parent: SchemaDataNode, childNode: SchemaNode): SchemaDataNode {
    return new SchemaDataNode(
      parent.id + "/" + childNode.getField(rc).field,
      childNode,
      undefined,
      this.ctx.newControl(undefined),
      this,
      parent,
    );
  }

  getChildElement(
    parent: SchemaDataNode,
    elementIndex: number,
  ): SchemaDataNode {
    return new SchemaDataNode(
      parent.id + "_" + elementIndex,
      parent.schema,
      elementIndex,
      this.ctx.newControl(undefined),
      this,
      parent,
    );
  }
}

/**
 * @deprecated Use createSchemaDataNode instead.
 */
export const makeSchemaDataNode = createSchemaDataNode;

export function createSchemaDataNode(
  schema: SchemaNode,
  control: Control<unknown>,
): SchemaDataNode {
  return new SchemaDataTreeImpl(schema, control).rootNode;
}

export function schemaDataForFieldRef(
  rc: ReadContext,
  fieldRef: string | undefined,
  schema: SchemaDataNode,
): SchemaDataNode | undefined {
  return schemaDataForFieldPath(rc, fieldRef?.split("/") ?? [], schema);
}

export function schemaDataForFieldPath(
  rc: ReadContext,
  fieldPath: string[],
  dataNode: SchemaDataNode,
): SchemaDataNode | undefined {
  let i = 0;
  let current: SchemaDataNode | undefined = dataNode;
  while (i < fieldPath.length) {
    if (!current) return undefined;
    const nextField = fieldPath[i];
    if (nextField === "..") {
      current = current.parent;
    } else if (nextField === ".") {
      // stay
    } else {
      const childNode = resolveSchemaNode(rc, current.schema, nextField);
      current = childNode ? current.getChild(rc, childNode) : undefined;
    }
    i++;
  }
  return current;
}

export function traverseParents<A, B extends { parent?: B | undefined }>(
  current: B | undefined,
  get: (b: B) => A,
  until?: (b: B) => boolean,
): A[] {
  let outArray: A[] = [];
  while (current && !until?.(current)) {
    outArray.push(get(current));
    current = current.parent;
  }
  return outArray.reverse();
}

export function getRootDataNode(dataNode: SchemaDataNode) {
  while (dataNode.parent) {
    dataNode = dataNode.parent;
  }
  return dataNode;
}

export function getJsonPath(rc: ReadContext, dataNode: SchemaDataNode) {
  return traverseParents(
    dataNode,
    (d) => (d.elementIndex == null ? d.schema.getField(rc).field : d.elementIndex),
    (x) => !x.parent,
  );
}

export function getSchemaPath(rc: ReadContext, schemaNode: SchemaNode): SchemaField[] {
  return traverseParents(
    schemaNode,
    (d) => d.getField(rc),
    (x) => !x.parent,
  );
}

export function getSchemaFieldList(rc: ReadContext, schema: SchemaNode): SchemaField[] {
  return schema.getChildNodes(rc).map((x) => x.getField(rc));
}
