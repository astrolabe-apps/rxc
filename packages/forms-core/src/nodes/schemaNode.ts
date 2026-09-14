import {
  asControl,
  type Control,
  type ReadContext,
  controlFromValue,
} from "@rx-controls/core";
import {
  type SchemaField,
  type CompoundField,
  FieldType,
  isCompoundField,
} from "../json";
import type {
  SchemaNode,
  SchemaCursor,
  SchemaTreeResolver,
  SchemaTree,
  FormTreeResolver,
} from "../types";

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
  resolver: SchemaTreeResolver,
): SchemaTree {
  return new StaticSchemaTree(fields, resolver);
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
  resolver: SchemaTreeResolver,
): SchemaTree {
  return new ReactiveSchemaTree(fieldsControl, resolver);
}

/**
 * Non-reactive schema tree. The root cursor wraps a synthetic compound field
 * with `field: ""` and the provided fields as children. Child nodes use
 * field names as path segments.
 */
class StaticSchemaTree implements SchemaTree {
  readonly rootNode: SchemaNode;

  constructor(
    private rootFields: SchemaField[],
    private resolver: SchemaTreeResolver,
  ) {
    const rootNode: SchemaNode = {
      id: "$root",
      parent: undefined,
      cursor(rd: ReadContext): SchemaCursor {
        return {
          rd,
          parent: undefined,
          node: rootNode,
          field: { type: FieldType.Compound, field: "" },
          children: rootFields.map((x) =>
            new StaticSchemaNode(x, rootNode, resolver).cursor(rd),
          ),
        };
      },
    };
    this.rootNode = rootNode;
  }

  createChildCursors(parent: SchemaCursor): SchemaCursor[] {
    return this.rootFields.map((x) =>
      new StaticSchemaNode(x, parent.node, this.resolver).cursor(parent.rd),
    );
  }
}

/** A {@link SchemaNode} wrapping a plain {@link SchemaField}. ID uses the field name. */
class StaticSchemaNode implements SchemaNode {
  id: string;
  constructor(
    private field: SchemaField,
    public parent: SchemaNode,
    private resolver: SchemaTreeResolver,
  ) {
    this.id = this.parent.id + "/" + this.field.field;
  }

  cursor(rd: ReadContext): SchemaCursor {
    return new SchemaCursorImpl(this.field, this, rd, this.resolver);
  }
}

/** A {@link SchemaNode} wrapping a reactive `Control<SchemaField>`. ID uses the control's `uniqueId`. */
class ReactiveSchemaNode implements SchemaNode {
  id: string;
  constructor(
    private field: Control<SchemaField>,
    public parent: SchemaNode,
    private resolver: SchemaTreeResolver,
  ) {
    this.id = this.parent.id + "/" + this.field.uniqueId;
  }

  cursor(rd: ReadContext): SchemaCursor {
    return new SchemaCursorImpl(
      rd.getTrackedValue(this.field),
      this,
      rd,
      this.resolver,
    );
  }
}

/**
 * Creates the appropriate {@link SchemaNode} for a child field. If the field
 * is a reactive value proxy (from `getTrackedValue`), creates a
 * {@link ReactiveSchemaNode}; otherwise creates a {@link StaticSchemaNode}.
 */
function createChildSchemaNode(
  parentNode: SchemaNode,
  fieldOrProxy: SchemaField,
  resolver: SchemaTreeResolver,
): SchemaNode {
  const c = controlFromValue(fieldOrProxy);
  if (c) return new ReactiveSchemaNode(c, parentNode, resolver);
  return new StaticSchemaNode(fieldOrProxy, parentNode, resolver);
}

/**
 * Shared {@link SchemaCursor} implementation for both static and reactive trees.
 *
 * `children` resolves `schemaRef` references on compound fields via the
 * tree's resolver. Without a `schemaRef`, children come from the compound
 * field's own `children` array. Non-compound fields return `[]`.
 */
class SchemaCursorImpl implements SchemaCursor {
  constructor(
    public field: SchemaField,
    public node: SchemaNode,
    public rd: ReadContext,
    private resolver: SchemaTreeResolver,
  ) {}
  get parent(): SchemaCursor | undefined {
    return this.node.parent?.cursor(this.rd);
  }

  get children(): SchemaCursor[] {
    if (isCompoundField(this.field)) {
      if (this.field.schemaRef) {
        return (
          this.resolver
            .getSchemaTree(this.field.schemaRef)
            ?.createChildCursors(this) ?? []
        );
      }
      return this.field.children.map((x) =>
        createChildSchemaNode(this.node, x, this.resolver).cursor(this.rd),
      );
    }
    return [];
  }
}

/**
 * Reactive schema tree backed by `Control<SchemaField[]>`. Each `cursor(rd)`
 * call reads the current elements through the {@link ReadContext}, registering
 * reactive dependencies so consumers update when the schema changes.
 */
class ReactiveSchemaTree implements SchemaTree {
  readonly rootNode: SchemaNode;

  constructor(
    private rootFields: Control<SchemaField[]>,
    private resolver: SchemaTreeResolver,
  ) {
    const rootNode: SchemaNode = {
      cursor(rd: ReadContext): SchemaCursor {
        return {
          rd,
          parent: undefined,
          node: rootNode,
          field: { type: FieldType.Compound, field: "" },
          children: rd
            .getElements(rootFields)
            .map((x) =>
              new ReactiveSchemaNode(x, rootNode, resolver).cursor(rd),
            ),
        };
      },
      id: "$root",
      parent: undefined,
    };
    this.rootNode = rootNode;
  }

  createChildCursors(parent: SchemaCursor): SchemaCursor[] {
    const rd = parent.rd;
    return parent.rd
      .getElements(this.rootFields)
      .map((x) =>
        new ReactiveSchemaNode(x, parent.node, this.resolver).cursor(rd),
      );
  }
}

/**
 * Factory function used by {@link createSchemaTreeResolver} to create a
 * {@link SchemaTree} for a given schema ref. The resolver is passed in so
 * the factory can forward it to the tree for nested `schemaRef` resolution.
 *
 * Return `undefined` if the schema ref is unknown.
 */
export type SchemaTreeFactory = (
  name: string,
  resolver: SchemaTreeResolver,
) => SchemaTree | undefined;

class SchemaTreeResolverImpl implements SchemaTreeResolver {
  private cache = new Map<string, SchemaTree>();
  constructor(private factory: SchemaTreeFactory) {}
  getSchemaTree(schemaRef: string): SchemaTree | undefined {
    const cached = this.cache.get(schemaRef);
    if (cached) return cached;
    const tree = this.factory(schemaRef, this);
    if (tree) this.cache.set(schemaRef, tree);
    return tree;
  }
}

/**
 * Creates a {@link SchemaTreeResolver} that delegates to a factory function
 * and caches the result per schema ref.
 */
export function createSchemaTreeResolver(factory: SchemaTreeFactory) {
  return new SchemaTreeResolverImpl(factory);
}
