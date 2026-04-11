# Class-Based Nodes + SchemaTree/FormTree Refactor

## Context

The `packages/forms-core/src/nodes/` files implement `SchemaNode`, `FormNode`, and `DataNode` using anonymous object literals inside factory functions. The `childRefId` resolution in `formNode.ts` uses O(n) DFS on every lookup. The user wants to:

1. Replace all anonymous objects with classes
2. Introduce `SchemaTree` and `FormTree` abstractions that encapsulate tree-level concerns (resolver access, id lookup)
3. Add `rd: ReadContext` to all cursor interfaces to eliminate parameter drilling
4. Build an O(1) id map for static FormTrees instead of recursive DFS

## Files to Modify

| File | Change |
|------|--------|
| `src/types.ts` | Add `SchemaTree`, `SchemaTreeResolver`, `FormTree`, `FormTreeResolver` interfaces; add `rd` to cursors |
| `src/nodes/schemaNode.ts` | Rewrite with classes; return `SchemaTree` from factories |
| `src/nodes/formNode.ts` | Rewrite with classes; add `idMap`; return `FormTree` from factories |
| `src/nodes/dataNode.ts` | Rewrite with classes; add `rd` to cursor |
| `src/nodes/index.ts` | Remove `SchemaTreeResolver`/`FormTreeResolver` type re-exports (now in `types.ts`) |
| `test/nodes.test.ts` | Update `tree.cursor(rd)` → `tree.rootNode.cursor(rd)`, resolver calls to method syntax |

`src/cursorUtils.ts` needs no changes (only accesses cursor properties additively).

## Phase 1: types.ts

Add new interfaces:

```typescript
interface SchemaTree {
  readonly rootNode: SchemaNode;
  createChildCursors(parent: SchemaCursor): SchemaCursor[];
}

interface SchemaTreeResolver {
  getSchemaTree(schemaRef: string): SchemaTree | undefined;
}

interface FormTree {
  readonly rootNode: FormNode;
  createChildCursors(localId: string | undefined, parent: FormCursor): FormCursor[];
}

interface FormTreeResolver {
  getFormTree(formId: string): FormTree | undefined;
}
```

Add `readonly rd: ReadContext` to `SchemaCursor`, `FormCursor`, `DataCursor`.

## Phase 2: schemaNode.ts — Class Structure

### Tree classes

- **`StaticSchemaTree`** — holds `fields[]`, `resolver?`. Builds root node in constructor. `createChildCursors(parent)` creates new child nodes and cursors parented under `parent` — no wrapper nodes needed since the nodes are created with the correct parent from the start. Has internal `resolveSchemaRef(ref, parent)` method used by cursors.
- **`ReactiveSchemaTree`** — holds `fieldsControl`, `resolver?`. Same pattern but reads elements reactively.

### Node classes

- **`StaticSchemaNode`** — single class for both root and child. Fields: `id`, `parent?`, `field: SchemaField`, `tree: StaticSchemaTree`. Root instance memoizes its cursor.
- **`ReactiveSchemaRootNode`** — reads `rd.getElements(fieldsControl)` in cursor().
- **`ReactiveSchemaChildNode`** — reads `rd.getValueRx(elemControl)` in cursor(). ID uses `control.uniqueId`.

### Cursor classes

- **`StaticSchemaCursor`** — `children` getter: if compound+schemaRef → `tree.resolveSchemaRef(ref, this)`, if compound → recurse `compound.children`, else `[]`.
- **`ReactiveSchemaCursor`** — same logic but reads children from control's `fields["children"]` element list.

### Factory functions (return types change)

```typescript
createStaticSchemaTree(fields, resolver?) → SchemaTree       // was SchemaNode
createReactiveSchemaTree(fieldsControl, resolver?) → SchemaTree
// SchemaTreeResolverImpl: lazy factory — resolver passes itself to the factory on first lookup
// const resolver = new SchemaTreeResolverImpl((name, resolver) => {
//   const fields = allFields[name];
//   return fields ? createStaticSchemaTree(fields, resolver) : undefined;
// });
```

#### SchemaTreeResolverImpl

```typescript
type SchemaTreeFactory = (name: string, resolver: SchemaTreeResolver) => SchemaTree | undefined;

class SchemaTreeResolverImpl implements SchemaTreeResolver {
  private cache = new Map<string, SchemaTree>();
  constructor(private factory: SchemaTreeFactory);
  getSchemaTree(schemaRef: string): SchemaTree | undefined;
  // On first lookup: calls factory(schemaRef, this), caches result
}
```

## Phase 3: formNode.ts — Class Structure

### Tree classes

- **`StaticFormTree`** — key improvement: builds `idMap: Map<string, ControlDefinition>` at construction by walking all definitions. Only indexes defs with truthy `id`, skips `childRefId` subtrees to avoid circular references.
  - `createChildCursors(localId?, parent)`: undefined → creates nodes/cursors for root children parented under `parent`; string → O(1) idMap lookup → creates nodes/cursors for that definition's children parented under `parent`.
  - `resolveChildRefId(childRefId, parent)`: parses format, routes to `this.createChildCursors()` for local refs, `resolver.getFormTree(formId)?.createChildCursors()` for external refs.
- **`ReactiveFormTree`** — same interface, uses DFS for local id resolution (reactive idMap deferred to follow-up). Has `resolveChildRefId` with same routing logic.

### Node classes

- **`StaticFormNode`** — created lazily during cursor traversal. Fields: `id`, `parent?`, `definition`, `tree`. Root memoizes cursor.
- **`ReactiveFormRootNode`** — reads elements from `Control<ControlDefinition[]>`.
- **`ReactiveFormChildNode`** — reads `rd.getValueRx(elemControl)`. ID uses `control.uniqueId`.

### Cursor classes

- **`StaticFormCursor`** — `children` getter: if `childRefId` → `tree.resolveChildRefId(childRefId, this)`, if `childNodes` → map to cursors with `this` as parent, else `[]`.
- **`ReactiveFormCursor`** — same but reads children from control element list.

### Factory functions

```typescript
createStaticFormTree(defs, resolver?) → FormTree              // was FormNode
createReactiveFormTree(defsControl, resolver?) → FormTree
// FormTreeResolverImpl: same lazy factory pattern as SchemaTreeResolverImpl
```

#### FormTreeResolverImpl

```typescript
type FormTreeFactory = (name: string, resolver: FormTreeResolver) => FormTree | undefined;

class FormTreeResolverImpl implements FormTreeResolver {
  private cache = new Map<string, FormTree>();
  constructor(private factory: FormTreeFactory);
  getFormTree(formId: string): FormTree | undefined;
  // On first lookup: calls factory(formId, this), caches result
}
```

## Phase 4: dataNode.ts

- **`DataNodeImpl`** — class implementing DataNode. Constructor takes `schemaNode, control, parent?, elementIndex?`.
- **`DataCursorImpl`** — class implementing DataCursor. Has `rd` property. Lazy parent cursor. `childField`/`childElement` create child DataNodeImpl instances.
- `createDataNode()` returns `new DataNodeImpl(...)`.

## Phase 5: Tests

Mechanical updates:
- `tree.cursor(rd)` → `tree.rootNode.cursor(rd)`
- `resolver("address")` → `resolver.getSchemaTree("address")`
- `resolver("form1")` → `resolver.getFormTree("form1")`
- Resolver tests: `resolver.getSchemaTree("x")` / `resolver.getFormTree("x")` lookups

## Key Design Decisions

1. **Static root nodes memoize their cursor** (data never changes)
2. **`node.cursor(rd)` returns cursor without parent** — parent is only set during tree traversal via children getter
3. **No wrapper nodes** — `createChildCursors(parent)` creates new nodes and cursors parented directly under the consuming tree's node. Cross-tree resolution (schemaRef, childRefId) produces nodes whose `parent` is the referencing node, not the source tree's node. This is correct because the node's parent reflects where it was placed, not where it was defined.
4. **Reactive FormTree uses DFS for local id lookup** (deferred: reactive idMap via effects + ControlContext)
5. **All nodes are created lazily** — nodes are created during cursor traversal, not at tree construction. Eager creation is not possible because `createChildCursors` needs a parent that's only known at traversal time, and circular `childRefId` references would cause infinite recursion. The static `idMap` indexes definitions, not nodes.
6. **`childRefId` parsing stays as a utility function**, routing logic lives in `FormTree.resolveChildRefId`
7. **Resolvers use lazy factories** — `SchemaTreeResolverImpl` / `FormTreeResolverImpl` take a `(name, resolver) => Tree | undefined` factory function. On first lookup, the resolver calls the factory with the requested name and itself, then caches the result. This breaks the circular dependency (the factory receives the resolver it needs to pass to tree constructors) and enables lazy loading. No separate static/reactive resolver variants needed since the factory can create whichever tree type it wants. When a tree is constructed without a resolver, factory functions default to a no-op (`{ getSchemaTree: () => undefined }` / `{ getFormTree: () => undefined }`) so tree internals never check for `undefined` resolver

## Verification

```bash
cd packages/forms-core
rushx build    # TypeScript compiles
rushx test     # All existing tests pass (with mechanical updates)
```
