import type { Control, ReadContext } from "@rxc/controls-core";
import {
  type SchemaField,
  type CompoundField,
  FieldType,
  isCompoundField,
} from "../json";
import type { SchemaNode, SchemaCursor } from "../types";

// ── Resolver type ──────────────────────────────────────────────────

/**
 * Resolves a named schema reference (e.g. `"Address"`) to the
 * {@link SchemaNode} root of that schema tree. Used by compound fields with
 * a `schemaRef` to inline another schema's children in place of their own.
 *
 * Returns `undefined` when the reference cannot be resolved.
 */
export type SchemaTreeResolver = (
  schemaRef: string,
) => SchemaNode | undefined;

// ── Wrapper node for re-parenting ──────────────────────────────────

/**
 * Wraps a cursor from a resolved `schemaRef` tree so that it appears as a
 * child of the referencing node. This creates a new {@link SchemaNode} with
 * a path-based id under `parentNode` and re-parents the cursor's `parent`
 * pointer to `parentCursor`.
 */
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

/**
 * Creates a shallow copy of `original` with its `parent` and `node` replaced,
 * recursively wrapping all descendant cursors so the entire sub-tree is
 * re-parented under `wrapperNode`.
 */
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

/** Returns the path segment used to build a child node's id from a static cursor. */
function childSegmentForCursor(cursor: SchemaCursor): string {
  return cursor.field.field;
}

// ── Static schema tree ─────────────────────────────────────────────

/**
 * Builds child {@link SchemaCursor}s for a list of static {@link SchemaField}s.
 * For compound fields with a `schemaRef`, the children are resolved from the
 * referenced tree (via `resolver`) and re-parented. Otherwise, the compound
 * field's own `children` array is recursed into.
 */
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

/**
 * Creates a {@link SchemaNode} root from a plain array of {@link SchemaField}s.
 *
 * The resulting tree is non-reactive — cursors are built once and memoized.
 * Use this when the schema is known at build time and will not change.
 *
 * @param fields   - The top-level schema fields.
 * @param resolver - Optional resolver for `schemaRef` references in compound fields.
 * @returns The root {@link SchemaNode} of the static schema tree.
 */
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

/**
 * Creates a {@link SchemaNode} root backed by a reactive `Control<SchemaField[]>`.
 *
 * Each call to `cursor(rd)` reads the current elements of `fieldsControl`
 * through the {@link ReadContext}, so the tree structure updates automatically
 * when the underlying control changes. Use this in editor scenarios where
 * the schema itself is being edited by the user.
 *
 * @param fieldsControl - A reactive control holding the top-level schema fields.
 * @param resolver      - Optional resolver for `schemaRef` references.
 * @returns The root {@link SchemaNode} of the reactive schema tree.
 */
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

/**
 * Builds a single reactive child {@link SchemaCursor} from a `Control<SchemaField>`.
 *
 * The field value is read reactively via `rd.getValueRx()`, and compound children
 * are resolved by reading the control's `children` sub-control as an element list.
 * Node ids incorporate the control's `uniqueId` for stability across re-renders.
 */
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

/**
 * Extracts a stable path segment from a reactive cursor's node id.
 * The last segment of the id is the control's `uniqueId`, which remains
 * stable across reactive re-evaluations.
 */
function childSegmentForReactiveCursor(cursor: SchemaCursor): string {
  const parts = cursor.node.id.split("/");
  return parts[parts.length - 1];
}

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

/**
 * Creates a {@link SchemaTreeResolver} backed by a reactive
 * `Control<Record<string, SchemaField[]>>`. Each schema reference is resolved
 * to a reactive tree via {@link createReactiveSchemaTree} and cached.
 *
 * @param allSchemas - A reactive control holding all named schema definitions.
 */
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
