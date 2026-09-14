import type { Control, ReadContext } from "@rx-controls/core";
import { isCompoundField } from "../json";
import type { SchemaNode, DataNode, DataCursor } from "../types";

/**
 * Creates a {@link DataNode} that binds a {@link SchemaNode} to a
 * {@link Control} holding the actual data value.
 *
 * The returned node's `cursor(rd)` produces a {@link DataCursor} that
 * exposes the schema field metadata alongside navigation into child fields
 * (`childField`) and array elements (`childElement`).
 *
 * @param schemaNode   - The schema node describing the structure at this data path.
 * @param control      - The control holding the data value for this path.
 * @param parent       - The parent data node, if not the root.
 * @param elementIndex - For array elements, the index within the parent collection.
 * @returns A persistent {@link DataNode} handle.
 */
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

/**
 * Builds an ephemeral {@link DataCursor} for a data node within a
 * {@link ReadContext}. The cursor resolves the schema cursor from the
 * associated schema node and provides `childField` / `childElement`
 * navigation that lazily creates child {@link DataNode}s on access.
 */
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
    schema: schemaCursor,
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
