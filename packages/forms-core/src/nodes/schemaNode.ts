import type { Control, ReadContext } from "@rxc/controls-core";
import {
  type SchemaField,
  type CompoundField,
  FieldType,
  isCompoundField,
} from "../json";
import type { SchemaNode, SchemaCursor } from "../types";

// ── Resolver type ──────────────────────────────────────────────────

export type SchemaTreeResolver = (
  schemaRef: string,
) => SchemaNode | undefined;

// ── Wrapper node for re-parenting ──────────────────────────────────

function wrapResolvedCursor(
  originalCursor: SchemaCursor,
  parentCursor: SchemaCursor,
  parentNode: SchemaNode,
  childSegment: string,
): SchemaCursor {
  const wrapperNode: SchemaNode = {
    id: `${parentNode.id}/${childSegment}`,
    parent: parentNode,
    cursor(rd: ReadContext): SchemaCursor {
      const original = originalCursor.node.cursor(rd);
      return wrapCursorWithParent(original, parentCursor, wrapperNode);
    },
  };
  const wrappedCursor: SchemaCursor = wrapCursorWithParent(
    originalCursor,
    parentCursor,
    wrapperNode,
  );
  return wrappedCursor;
}

function wrapCursorWithParent(
  original: SchemaCursor,
  parentCursor: SchemaCursor,
  wrapperNode: SchemaNode,
): SchemaCursor {
  const cursor: SchemaCursor = {
    node: wrapperNode,
    field: original.field,
    parent: parentCursor,
    get children(): SchemaCursor[] {
      return original.children.map((child) =>
        wrapResolvedCursor(
          child,
          cursor,
          wrapperNode,
          childSegmentForCursor(child),
        ),
      );
    },
  };
  return cursor;
}

function childSegmentForCursor(cursor: SchemaCursor): string {
  return cursor.field.field;
}

// ── Static schema tree ─────────────────────────────────────────────

function makeStaticChildCursors(
  fields: SchemaField[],
  parentNode: SchemaNode,
  parentCursor: SchemaCursor,
  resolver: SchemaTreeResolver | undefined,
  rd: ReadContext,
): SchemaCursor[] {
  return fields.map((field) => {
    const childNode: SchemaNode = {
      id: `${parentNode.id}/${field.field}`,
      parent: parentNode,
      cursor(_rd: ReadContext): SchemaCursor {
        return childCursor;
      },
    };
    const childCursor: SchemaCursor = {
      node: childNode,
      field,
      parent: parentCursor,
      get children(): SchemaCursor[] {
        if (isCompoundField(field)) {
          const compound = field as CompoundField;
          if (compound.schemaRef && resolver) {
            const resolved = resolver(compound.schemaRef);
            if (!resolved) return [];
            return resolved.cursor(rd).children.map((c) =>
              wrapResolvedCursor(c, childCursor, childNode, c.field.field),
            );
          }
          return makeStaticChildCursors(
            compound.children,
            childNode,
            childCursor,
            resolver,
            rd,
          );
        }
        return [];
      },
    };
    return childCursor;
  });
}

export function createStaticSchemaTree(
  fields: SchemaField[],
  resolver?: SchemaTreeResolver,
): SchemaNode {
  const rootField: CompoundField = {
    type: FieldType.Compound,
    field: "",
    children: fields,
  };

  let memoizedCursor: SchemaCursor | undefined;

  const rootNode: SchemaNode = {
    id: "$root",
    cursor(rd: ReadContext): SchemaCursor {
      if (!memoizedCursor) {
        const cursor: SchemaCursor = {
          node: rootNode,
          field: rootField,
          get children(): SchemaCursor[] {
            return makeStaticChildCursors(
              fields,
              rootNode,
              cursor,
              resolver,
              rd,
            );
          },
        };
        memoizedCursor = cursor;
      }
      return memoizedCursor;
    },
  };
  return rootNode;
}

// ── Reactive schema tree ───────────────────────────────────────────

export function createReactiveSchemaTree(
  fieldsControl: Control<SchemaField[]>,
  resolver?: SchemaTreeResolver,
): SchemaNode {
  const rootField: CompoundField = {
    type: FieldType.Compound,
    field: "",
    children: [],
  };

  const rootNode: SchemaNode = {
    id: "$root",
    cursor(rd: ReadContext): SchemaCursor {
      const elements = rd.getElements(fieldsControl);
      const cursor: SchemaCursor = {
        node: rootNode,
        field: rootField,
        get children(): SchemaCursor[] {
          return elements.map((elemControl) =>
            makeReactiveChildCursor(
              elemControl,
              rootNode,
              cursor,
              rd,
              resolver,
            ),
          );
        },
      };
      return cursor;
    },
  };
  return rootNode;
}

function makeReactiveChildCursor(
  elemControl: Control<SchemaField>,
  parentNode: SchemaNode,
  parentCursor: SchemaCursor,
  rd: ReadContext,
  resolver: SchemaTreeResolver | undefined,
): SchemaCursor {
  const childNode: SchemaNode = {
    id: `${parentNode.id}/${elemControl.uniqueId}`,
    parent: parentNode,
    cursor(rd2: ReadContext): SchemaCursor {
      return makeReactiveChildCursor(
        elemControl,
        parentNode,
        parentCursor,
        rd2,
        resolver,
      );
    },
  };

  const field = rd.getValueRx(elemControl);

  const childCursor: SchemaCursor = {
    node: childNode,
    field,
    parent: parentCursor,
    get children(): SchemaCursor[] {
      if (isCompoundField(field)) {
        const compound = field as CompoundField;
        if (compound.schemaRef && resolver) {
          const resolved = resolver(compound.schemaRef);
          if (!resolved) return [];
          return resolved.cursor(rd).children.map((c) =>
            wrapResolvedCursor(
              c,
              childCursor,
              childNode,
              childSegmentForReactiveCursor(c),
            ),
          );
        }
        // Access children control from the compound field's control
        const childrenControl = (
          elemControl as unknown as Control<Record<string, unknown>>
        ).fields["children"] as unknown as Control<SchemaField[]>;
        const childElements = rd.getElements(childrenControl);
        return childElements.map((ce) =>
          makeReactiveChildCursor(ce, childNode, childCursor, rd, resolver),
        );
      }
      return [];
    },
  };
  return childCursor;
}

function childSegmentForReactiveCursor(cursor: SchemaCursor): string {
  // For reactive wrapped cursors, we need a stable segment.
  // The original node id contains the control uniqueId as its last segment.
  const parts = cursor.node.id.split("/");
  return parts[parts.length - 1];
}

// ── Resolver factories ─────────────────────────────────────────────

export function createStaticSchemaResolver(
  allFields: Record<string, SchemaField[]>,
): SchemaTreeResolver {
  const cache = new Map<string, SchemaNode>();
  const resolver: SchemaTreeResolver = (schemaRef: string) => {
    let node = cache.get(schemaRef);
    if (!node) {
      const fields = allFields[schemaRef];
      if (!fields) return undefined;
      node = createStaticSchemaTree(fields, resolver);
      cache.set(schemaRef, node);
    }
    return node;
  };
  return resolver;
}

export function createReactiveSchemaResolver(
  allSchemas: Control<Record<string, SchemaField[]>>,
): SchemaTreeResolver {
  const cache = new Map<string, SchemaNode>();
  const resolver: SchemaTreeResolver = (schemaRef: string) => {
    let node = cache.get(schemaRef);
    if (!node) {
      const control = (allSchemas as Control<Record<string, unknown>>).fields[
        schemaRef
      ] as unknown as Control<SchemaField[]>;
      node = createReactiveSchemaTree(control, resolver);
      cache.set(schemaRef, node);
    }
    return node;
  };
  return resolver;
}
