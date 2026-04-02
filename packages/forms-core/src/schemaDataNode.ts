import type { Control, ReadContext } from "@rxc/controls-core";
import { ensureMetaValue } from "@rxc/controls-core";
import type { SchemaField } from "./json/schemaField";
import { isCompoundField, missingField } from "./json/schemaField";
import type { SchemaDataNode, SchemaNode } from "./types";
import { createChildSchemaNode } from "./schemaNode";

class SchemaDataNodeImpl implements SchemaDataNode {
  constructor(
    public data: Control<unknown>,
    public parent: SchemaDataNode | undefined,
    public elementIndex: number | undefined,
    public schema: SchemaNode,
  ) {}

  getField(rc: ReadContext): SchemaField {
    return this.schema.getField(rc);
  }

  getChildren(rc: ReadContext): SchemaDataNode[] {
    return this.schema.getChildren(rc).map((childSchema) => {
      const field = childSchema.getField(rc);
      let objControl = this.data as Control<Record<string, unknown>>;
      if (field.meta) {
        objControl = getMetaFields(objControl);
      }
      const child = objControl.fields[field.field];
      return new SchemaDataNodeImpl(child, this, undefined, childSchema);
    });
  }

  getChild(rc: ReadContext, field: string): SchemaDataNode {
    const childSchema = this.schema.getChildNode(rc, field);
    const childField = childSchema.getField(rc);
    let objControl = this.data as Control<Record<string, unknown>>;
    if (childField.meta) {
      objControl = getMetaFields(objControl);
    }
    const child = objControl.fields[childField.field];
    return new SchemaDataNodeImpl(child, this, undefined, childSchema);
  }

  getChildElement(elementIndex: number): SchemaDataNode {
    const elemControl = this.data as Control<unknown[]>;
    const elemChild = elemControl.elements[elementIndex];
    return new SchemaDataNodeImpl(elemChild, this, elementIndex, this.schema);
  }
}

function getMetaFields<
  T extends Record<string, any> = Record<string, unknown>,
>(control: Control<any>): Control<T> {
  return ensureMetaValue(
    control,
    "metaFields",
    (newControl) => newControl({}) as Control<T>,
  );
}

/**
 * Create a root SchemaDataNode binding a SchemaNode to a Control.
 */
export function createSchemaDataNode(
  schema: SchemaNode,
  control: Control<unknown>,
): SchemaDataNode {
  return new SchemaDataNodeImpl(control, undefined, undefined, schema);
}

/**
 * Navigate a SchemaDataNode by a field path (e.g. "address/street").
 */
export function schemaDataForFieldPath(
  rc: ReadContext,
  fieldPath: string[],
  dataNode: SchemaDataNode,
): SchemaDataNode | undefined {
  let current: SchemaDataNode | undefined = dataNode;
  for (const segment of fieldPath) {
    if (!current) return undefined;
    if (segment === "..") {
      current = current.parent;
    } else if (segment === ".") {
      // stay
    } else {
      current = current.getChild(rc, segment);
    }
  }
  return current;
}

/**
 * Navigate a SchemaDataNode by a field ref string (e.g. "address/street").
 */
export function schemaDataForFieldRef(
  rc: ReadContext,
  fieldRef: string | undefined,
  dataNode: SchemaDataNode,
): SchemaDataNode | undefined {
  if (!fieldRef) return undefined;
  return schemaDataForFieldPath(rc, fieldRef.split("/"), dataNode);
}