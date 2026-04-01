import type { Control, ReadContext } from "@rxc/controls-core";
import type { SchemaDataNode, SchemaField } from "./types";
import { FieldType, isCompoundField } from "./types";

export function createSchemaDataNode(
  schema: SchemaField,
  control: Control<any>,
  parent?: SchemaDataNode,
  elementIndex?: number,
): SchemaDataNode {
  const node: SchemaDataNode = {
    schema,
    control,
    parent,
    elementIndex,
    getChild(field: string): SchemaDataNode {
      const childField = isCompoundField(schema)
        ? schema.children.find((f) => f.field === field)
        : undefined;
      const resolvedField: SchemaField = childField ?? {
        type: FieldType.Any,
        field,
      };
      const childControl = (control as Control<Record<string, unknown>>).fields[
        field
      ] as Control<any>;
      return createSchemaDataNode(resolvedField, childControl, node);
    },
    getChildElement(index: number): SchemaDataNode {
      const elemControl = (control as Control<unknown[]>).elements[
        index
      ] as Control<any>;
      return createSchemaDataNode(schema, elemControl, node, index);
    },
  };
  return node;
}

export function resolveFieldPath(
  path: string,
  dataNode: SchemaDataNode,
): SchemaDataNode | undefined {
  const segments = path.split("/");
  let current: SchemaDataNode | undefined = dataNode;
  for (const seg of segments) {
    if (!current) return undefined;
    if (seg === "..") {
      current = current.parent;
    } else if (seg === ".") {
      // stay
    } else {
      current = current.getChild(seg);
    }
  }
  return current;
}

export function isValidDataNode(
  dataNode: SchemaDataNode,
  rc?: ReadContext,
): boolean {
  const parent = dataNode.parent;
  if (!parent) return true;
  const types = dataNode.schema.onlyForTypes;
  if (!types || types.length === 0) return true;

  if (!isCompoundField(parent.schema)) return true;
  const typeField = parent.schema.children.find((f) => f.isTypeField);
  if (!typeField) return true;

  const typeControl = (
    parent.control as Control<Record<string, unknown>>
  ).fields[typeField.field] as Control<string | undefined>;
  const typeValue = rc ? rc.getValue(typeControl) : typeControl.valueNow;
  return typeValue != null && types.includes(typeValue);
}
