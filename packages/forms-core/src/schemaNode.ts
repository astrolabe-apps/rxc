import {
  FieldType,
  isCompoundField,
  missingField,
} from "./json/schemaField";
import type { CompoundField, SchemaField } from "./json/schemaField";
import { noopReadContext } from "@rxc/controls-core";
import type { ReadContext } from "@rxc/controls-core";

export interface SchemaTreeLookup {
  getSchema(schemaId: string): SchemaNode | undefined;

  getSchemaTree(
    schemaId: string,
    additional?: SchemaField[],
  ): SchemaTree | undefined;
}

export abstract class SchemaTree {
  abstract rootNode: SchemaNode;

  abstract getSchemaTree(schemaId: string): SchemaTree | undefined;

  createChildNode(parent: SchemaNode, field: SchemaField): SchemaNode {
    return new SchemaNode(parent.id + "/" + field.field, () => field, this, parent);
  }

  getSchema(schemaId: string): SchemaNode | undefined {
    return this.getSchemaTree(schemaId)?.rootNode;
  }
}

class SchemaTreeImpl extends SchemaTree {
  rootNode: SchemaNode;

  getSchemaTree(schemaId: string): SchemaTree | undefined {
    return this.lookup?.getSchemaTree(schemaId);
  }

  constructor(
    rootFields: SchemaField[],
    private lookup?: SchemaTreeLookup,
  ) {
    super();
    const rootField: CompoundField = {
      type: FieldType.Compound,
      field: "",
      children: rootFields,
    };
    this.rootNode = new SchemaNode(
      "",
      () => rootField,
      this,
    );
  }
}

export function createSchemaTree(
  rootFields: SchemaField[],
  lookup?: SchemaTreeLookup,
): SchemaTree {
  return new SchemaTreeImpl(rootFields, lookup);
}

export class SchemaNode {
  public constructor(
    public id: string,
    public getField: (rc: ReadContext) => SchemaField,
    public tree: SchemaTree,
    public parent?: SchemaNode,
    private _getChildFields?: (rc: ReadContext) => SchemaField[],
  ) {}

  get fieldNow(): SchemaField {
    return this.getField(noopReadContext);
  }

  getSchema(schemaId: string): SchemaNode | undefined {
    return this.tree.getSchema(schemaId);
  }

  getUnresolvedFields(rc: ReadContext): SchemaField[] {
    if (this._getChildFields) return this._getChildFields(rc);
    const f = this.getField(rc);
    return isCompoundField(f) ? f.children : [];
  }

  getResolvedParent(rc: ReadContext, noRecurse?: boolean): SchemaNode | undefined {
    const f = this.getField(rc);
    if (!isCompoundField(f)) return undefined;
    const parentNode = f.schemaRef
      ? this.tree.getSchema(f.schemaRef)
      : !noRecurse && f.treeChildren
        ? this.parent?.getResolvedParent(rc)
        : undefined;
    return parentNode ?? this;
  }

  getResolvedFields(rc: ReadContext): SchemaField[] {
    const resolvedParent = this.getResolvedParent(rc);
    return resolvedParent?.getUnresolvedFields(rc) ?? [];
  }

  getChildNodes(rc: ReadContext): SchemaNode[] {
    const node = this;
    return node.getResolvedFields(rc).map((x) => node.createChildNode(x));
  }

  getChildField(rc: ReadContext, field: string): SchemaField {
    return (
      this.getResolvedFields(rc).find((x) => x.field === field) ??
      missingField(field)
    );
  }

  createChildNode(field: SchemaField): SchemaNode {
    return this.tree.createChildNode(this, field);
  }

  getChildNode(rc: ReadContext, field: string): SchemaNode {
    return this.createChildNode(this.getChildField(rc, field));
  }
}

export function resolveSchemaNode(
  rc: ReadContext,
  node: SchemaNode,
  fieldSegment: string,
): SchemaNode | undefined {
  if (fieldSegment == ".") return node;
  if (fieldSegment == "..") return node.parent;
  return node.getChildNode(rc, fieldSegment);
}

export function createSchemaNode(
  field: SchemaField,
  lookup: SchemaTree,
  parent: SchemaNode | undefined,
): SchemaNode {
  return new SchemaNode(
    parent ? parent.id + "/" + field.field : field.field,
    () => field,
    lookup,
    parent,
  );
}

export function createSchemaLookup<A extends Record<string, SchemaField[]>>(
  schemaMap: A,
): {
  getSchema(schemaId: keyof A): SchemaNode;
  getSchemaTree(schemaId: keyof A, additional?: SchemaField[]): SchemaTree;
} {
  const lookup = {
    getSchemaTree,
    getSchema,
  };
  return lookup;

  function getSchema(schemaId: keyof A): SchemaNode {
    return getSchemaTree(schemaId)!.rootNode;
  }

  function getSchemaTree(
    schemaId: keyof A,
    additional?: SchemaField[],
  ): SchemaTree {
    const fields = schemaMap[schemaId];
    if (fields) {
      return new SchemaTreeImpl(
        additional ? [...fields, ...additional] : fields,
        lookup,
      );
    }
    return undefined!;
  }
}

export function schemaForFieldRef(
  rc: ReadContext,
  fieldRef: string | undefined,
  schema: SchemaNode,
): SchemaNode {
  return schemaForFieldPath(rc, fieldRef?.split("/") ?? [], schema);
}

export function traverseSchemaPath<A>(
  rc: ReadContext,
  fieldPath: string[],
  schema: SchemaNode,
  acc: A,
  next: (acc: A, node: SchemaNode) => A,
): A {
  let i = 0;
  while (i < fieldPath.length) {
    const nextField = fieldPath[i];
    let childNode = resolveSchemaNode(rc, schema, nextField);
    if (!childNode) {
      childNode = createSchemaNode(
        missingField(nextField),
        schema.tree,
        schema,
      );
    }
    acc = next(acc, childNode);
    schema = childNode;
    i++;
  }
  return acc;
}

export function traverseData(
  rc: ReadContext,
  fieldPath: string[],
  root: SchemaNode,
  data: { [k: string]: any },
): unknown {
  return traverseSchemaPath(
    rc,
    fieldPath,
    root,
    data,
    (acc, n) => acc?.[n.getField(rc).field] as any,
  );
}

export function schemaForFieldPath(
  rc: ReadContext,
  fieldPath: string[],
  schema: SchemaNode,
): SchemaNode {
  let i = 0;
  while (i < fieldPath.length) {
    const nextField = fieldPath[i];
    let childNode = resolveSchemaNode(rc, schema, nextField);
    if (!childNode) {
      childNode = createSchemaNode(
        missingField(nextField),
        schema.tree,
        schema,
      );
    }
    schema = childNode;
    i++;
  }
  return schema;
}

export function schemaForDataPath(
  rc: ReadContext,
  fieldPath: string[],
  schema: SchemaNode,
): DataPathNode {
  let i = 0;
  let element = schema.getField(rc).collection;
  while (i < fieldPath.length) {
    const nextField = fieldPath[i];
    let childNode: SchemaNode | undefined;
    if (nextField == ".") {
      i++;
      continue;
    } else if (nextField == "..") {
      if (element) {
        element = false;
        i++;
        continue;
      }
      childNode = schema.parent;
    } else {
      childNode = schema.getChildNode(rc, nextField);
    }
    if (!childNode) {
      childNode = createSchemaNode(
        missingField(nextField),
        schema.tree,
        schema,
      );
    } else {
      element = childNode.getField(rc).collection;
    }
    schema = childNode;
    i++;
  }
  return { node: schema, element: !!element };
}

export function getParentDataPath(
  rc: ReadContext,
  { node, element }: DataPathNode,
): DataPathNode | undefined {
  if (element) return { node, element: false };
  const parent = node.parent;
  return parent
    ? { node: parent, element: !!parent.getField(rc).collection }
    : undefined;
}

export function getSchemaNodePath(rc: ReadContext, node: SchemaNode) {
  const paths: string[] = [];
  let curNode: SchemaNode | undefined = node;
  while (curNode) {
    paths.push(curNode.getField(rc).field);
    curNode = curNode.parent;
  }
  return paths.reverse();
}

export function getSchemaNodePathString(rc: ReadContext, node: SchemaNode) {
  return getSchemaNodePath(rc, node).join("/");
}

export function isCompoundNode(rc: ReadContext, node: SchemaNode) {
  return isCompoundField(node.getField(rc));
}

/**
 * Returns the relative path from a parent node to a child node.
 * @param parent
 * @param child
 */
export function relativePath(rc: ReadContext, parent: SchemaNode, child: SchemaNode): string {
  // return the path from child to parent
  if (parent.id === child.id) return ".";

  const parentPath = getSchemaNodePath(rc, parent);
  const childPath = getSchemaNodePath(rc, child);
  return relativeSegmentPath(parentPath, childPath);
}

/**
 * Returns the relative path from a parent node to a child node.
 * @param parentPath
 * @param childPath
 */
export function relativeSegmentPath(
  parentPath: string[],
  childPath: string[],
): string {
  let i = 0;
  while (
    i < parentPath.length &&
    i < childPath.length &&
    parentPath[i] === childPath[i]
  ) {
    i++;
  }

  const upLevels = parentPath.length - i;
  const downPath = childPath.slice(i).join("/");

  return "../".repeat(upLevels) + downPath;
}

export interface DataPathNode {
  node: SchemaNode;
  element: boolean;
}
