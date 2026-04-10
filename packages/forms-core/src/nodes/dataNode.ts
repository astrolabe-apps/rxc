import type { Control, ReadContext } from "@rxc/controls-core";
import { isCompoundField } from "../json";
import type { SchemaNode, DataNode, DataCursor } from "../types";

export function createDataNode(
  schemaNode: SchemaNode,
  control: Control<unknown>,
  parent?: DataNode,
  elementIndex?: number,
): DataNode {
  const node: DataNode = {
    id: String(control.uniqueId),
    parent,
    cursor(rd: ReadContext): DataCursor {
      return makeDataCursor(node, schemaNode, control, rd, parent, elementIndex);
    },
  };
  return node;
}

function makeDataCursor(
  node: DataNode,
  schemaNode: SchemaNode,
  control: Control<unknown>,
  rd: ReadContext,
  parentDataNode: DataNode | undefined,
  elementIndex: number | undefined,
): DataCursor {
  const schemaCursor = schemaNode.cursor(rd);

  // Capture parent cursor lazily — only compute if parent exists
  let parentCursorCached: DataCursor | undefined | null = null;
  function getParentCursor(): DataCursor | undefined {
    if (parentCursorCached === null) {
      parentCursorCached = parentDataNode?.cursor(rd);
    }
    return parentCursorCached;
  }

  const cursor: DataCursor = {
    node,
    field: schemaCursor.field,
    control,
    elementIndex,
    get parent(): DataCursor | undefined {
      return getParentCursor();
    },

    childField(fieldName: string): DataCursor | undefined {
      const schemaChild = schemaCursor.children.find(
        (c) => c.field.field === fieldName,
      );
      if (!schemaChild) return undefined;

      const childControl = (
        control as Control<Record<string, unknown>>
      ).fields[fieldName] as Control<unknown>;

      const childDataNode = createDataNode(schemaChild.node, childControl, node);
      return childDataNode.cursor(rd);
    },

    childElement(index: number): DataCursor | undefined {
      if (!isCompoundField(schemaCursor.field) && !schemaCursor.field.collection)
        return undefined;

      const elements = rd.getElements(control as Control<unknown[]>);
      if (index < 0 || index >= elements.length) return undefined;

      const elemControl = elements[index];
      const childDataNode = createDataNode(schemaNode, elemControl, node, index);
      return childDataNode.cursor(rd);
    },
  };
  return cursor;
}
