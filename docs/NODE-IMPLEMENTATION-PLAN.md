# Implement SchemaNode, DataNode, FormNode (Static + Reactive)

## Context

The Node/Cursor interfaces are defined in `packages/forms-core/src/types.ts` (lines 99–286) but have no implementations — previous implementations were reverted. We need both:
- **Static** — wrapping plain `SchemaField[]` / `ControlDefinition[]` (normal form runtime)
- **Reactive** — wrapping `Control<SchemaField[]>` / `Control<ControlDefinition[]>` (editor scenario, where the schema/definition is itself editable)

The interfaces use a **cursor pattern**: nodes are stable handles identified by `id`; calling `node.cursor(rd)` returns an ephemeral cursor with resolved `field`, `children`, and `parent`. Static cursors ignore `rd` and are memoized. Reactive cursors use `rd` to register dependencies and are fresh each call.

### Node ID scheme

Node IDs are **path-based**: `"${parent.id}/${segment}"`. This ensures global uniqueness even when the same underlying data appears as children of multiple parents via `schemaRef`/`childRefId` resolution.

| Node type | Root ID | Child segment |
|-----------|---------|---------------|
| Static SchemaNode | `"$root"` | `field.field` (field name string) |
| Reactive SchemaNode | `"$root"` | `String(control.uniqueId)` |
| Static FormNode | `"$root"` | `String(index)` (position in parent's children array) |
| Reactive FormNode | `"$root"` | `String(control.uniqueId)` |
| DataNode | — | `String(control.uniqueId)` (no parent prefix needed — data controls are unique per path) |

**Why path-based:** When "billingAddress" and "shippingAddress" both have `schemaRef: "address"`, the resolved children wrap the same underlying controls. Using `control.uniqueId` alone would produce duplicate IDs. Path-based IDs disambiguate: `"$root/billingAddress/street"` vs `"$root/shippingAddress/street"` (static) or `"$root/42/78"` vs `"$root/57/78"` (reactive, where 42/57 are parent control uniqueIds and 78 is the shared child control uniqueId).

**DataNode exception:** DataNodes don't need parent-prefixed IDs because each data path has its own `Control` with a distinct `uniqueId`. Even if two DataNodes share the same schema source, their data controls differ.

## Architecture

```
packages/forms-core/src/nodes/
  schemaNode.ts ──→ SchemaNode / SchemaCursor
     createStaticSchemaTree(fields[], resolver?)
     createReactiveSchemaTree(Control<fields[]>, resolver?)
     createStaticSchemaResolver(Record<string, fields[]>)
     createReactiveSchemaResolver(Control<Record<string, fields[]>>, loadSchema?)

  dataNode.ts ──→ DataNode / DataCursor
     createDataNode(schemaNode, control, parent?, elemIndex?)

  formNode.ts ──→ FormNode / FormCursor
     createStaticFormTree(definitions[], resolver?)
     createReactiveFormTree(Control<definitions[]>, resolver?)
     createStaticFormResolver(Record<string, definitions[]>)
     createReactiveFormResolver(Control<Record<string, definitions[]>>, loadForm?)

  index.ts ──→ re-exports all factories + resolver types
```

## Detailed Design

### 1. `nodes/schemaNode.ts`

**Resolver type:**
```typescript
export type SchemaTreeResolver = (schemaRef: string) => SchemaNode | undefined;
```

The resolver is a simple lookup — it returns the root `SchemaNode` for a named schema, or `undefined` if the schema doesn't exist. The resolver does **not** take `ReadContext`; reactive deps are registered when `cursor(rd)` is called on the returned node.

**Resolver implementations** (helper factories):

*Static:* `createStaticSchemaResolver(allFields: Record<string, SchemaField[]>): SchemaTreeResolver`
- Caches `SchemaNode` per key. On first access, creates `createStaticSchemaTree(fields, resolver)`.
- Self-referential: the resolver passes itself to each tree so nested `schemaRef` chains work.
- Returns `undefined` for unknown keys.

*Reactive/lazy:* `createReactiveSchemaResolver(allSchemas: Control<Record<string, SchemaField[]>>, loadSchema?: (id: string) => Promise<SchemaField[]>): SchemaTreeResolver`
- Caches `SchemaNode` per key. On first access:
  1. Gets child control via `allSchemas.fields[schemaRef]` (lazy child creation).
  2. If `control.isNull` and `loadSchema` provided: sets `control.value = []`, calls `loadSchema(id)` which sets `control.value = loadedFields` on completion.
  3. Creates `createReactiveSchemaTree(control, resolver)`, caches it.
- Always returns a `SchemaNode` (never `undefined`) — the node wraps a possibly-empty control. Reactive deps handle the "not loaded yet" case: `cursor(rd)` calls `rd.getElements(control)`, registering a dep. When async load completes and the control updates, the dep fires and consumers re-evaluate.
- Self-referential: same pattern as static.

**Static factory:** `createStaticSchemaTree(fields: SchemaField[], resolver?: SchemaTreeResolver): SchemaNode`

- Synthetic root node with `id: "$root"`, cursor field is a synthetic `CompoundField` with `field: ""`, `type: FieldType.Compound`, `children: fields`.
- `cursor(rd)`: ignores `rd`, returns memoized cursor (built lazily on first call).
- `children` is a **getter** — lazily maps each `SchemaField` to a child `SchemaCursor`. Non-compound fields return `[]`.
- Child `SchemaNode`s are created fresh each call — no caching needed since consumers identify nodes by `id`, not object reference.
- Child node `id`: `"${parent.id}/${field.field}"` (path-based, see Node ID scheme above).
- `parent` on child nodes points back to parent `SchemaNode`.

**Reactive factory:** `createReactiveSchemaTree(fieldsControl: Control<SchemaField[]>, resolver?: SchemaTreeResolver): SchemaNode`

- Root wraps `Control<SchemaField[]>`.
- `cursor(rd)`: reads `rd.getElements(fieldsControl)` (registers Structure dep), returns fresh cursor each call.
- Each child wraps a `Control<SchemaField>`. **`cursor.field` uses `rd.getValueRx(elementControl)`** — fine-grained reactive proxy so reading `cursor.field.displayName` only subscribes to that child control. Safe because `SchemaField` is pure data.
- For compound children resolution: accesses `(elementControl as Control<Record<string, unknown>>).fields["children"]` as `Control<SchemaField[]>`, then `rd.getElements(...)`. Distinct code path from `getValueRx` proxy — we need the actual `Control<SchemaField[]>`.
- Child nodes created fresh each `cursor(rd)` call — no caching needed since consumers identify nodes by `id`, not object reference.
- Child node `id`: `"${parent.id}/${control.uniqueId}"` (path-based, see Node ID scheme above).
- `schemaRef`: read from `getValueRx` proxy (fine-grained dep), delegates to resolver.

**schemaRef delegation and re-parenting:** When `schemaRef` IS set, children getter:
1. Calls `resolver(schemaRef)` — returns `SchemaNode | undefined`.
2. If `undefined`, returns `[]` (schema doesn't exist or not loaded yet — for the reactive/lazy case the resolver always returns a node, so `undefined` only occurs with static resolvers for genuinely missing schemas).
3. Calls `resolvedNode.cursor(rd).children` — this registers reactive deps on the resolved tree's data, enabling lazy loading to work.
4. **Creates wrapper nodes** for each resolved child. Each wrapper has:
   - `id`: `"${referringNode.id}/${childSegment}"` — path-based, using the referring node as prefix (not the resolved tree's root). For static: `childSegment = field.field`. For reactive: `childSegment = String(control.uniqueId)`.
   - `parent`: the referring node (the compound field with `schemaRef`).
   - `cursor(rd)`: delegates to the original resolved child's `cursor(rd)` for `field` and children computation, but overrides `parent` (to the referring cursor) and `node` (to the wrapper). Children are a **lazy getter** — each child is itself wrapped with the correct parent, so re-parenting propagates down the tree only along traversed paths (O(depth), not O(tree size)).

**Lazy loading dep chain:**
1. Tree A cursor encounters `schemaRef: "address"`, calls `resolver("address")`
2. Resolver returns cached `SchemaNode` wrapping a possibly-empty `Control<SchemaField[]>`
3. `resolvedNode.cursor(rd).children` → `rd.getElements(control)` registers dep on the control
4. If control is empty (`[]`): returns no children. When async load completes and sets `control.value = loadedFields`, dep fires, consumer re-evaluates, children now resolve.

### 2. `nodes/dataNode.ts`

**Factory:** `createDataNode(schemaNode: SchemaNode, control: Control<unknown>, parent?: DataNode, elementIndex?: number): DataNode`

- `id`: `String(control.uniqueId)` (data controls are unique per path — no parent prefix needed, see Node ID scheme).
- `cursor(rd)`:
  - Gets `schemaCursor = schemaNode.cursor(rd)` (registers schema deps if reactive).
  - Returns DataCursor with `rd` **closed over** (implicit ReadContext).
  - `cursor.parent` links back to the parent DataCursor that produced this child (avoids re-calling `parent.cursor(rd)`).

**`childField(name)`:**
1. Find schema child: `schemaCursor.children.find(c => c.field.field === name)`
2. Get child control: `(control as Control<Record<string, unknown>>).fields[name]`
3. Create child DataNode (fresh each call — identity is by `id`, not object reference)
4. Return child DataCursor with `rd` still closed over.

**`childElement(index)`:**
1. `rd.getElements(control as Control<unknown[]>)[index]`
2. Create child DataNode: same schema node (array elements share parent's schema), fresh each call.

### 3. `nodes/formNode.ts`

**childRefId format** (from FORM-SEMANTICS.md):

The `childRefId` string on a `ControlDefinition` uses one of three formats:
- `"localId"` (no leading `/`) — find a definition by `id` within the **current** tree, use its children
- `"/formId"` — use the root children of an **external** form tree
- `"/formId/localId"` — find a definition by `id` within an **external** form tree, use its children

**Resolver type:**
```typescript
export type FormTreeResolver = (formId: string) => FormNode | undefined;
```
Takes a parsed `formId` (from the `/`-prefixed formats) and returns the root `FormNode` of the external form tree. Returns `FormNode` (not raw definitions) — resolved trees can be static or reactive. Same design as `SchemaTreeResolver`: no `ReadContext` parameter, reactive deps registered via `cursor(rd)` on the returned node.

**Resolver implementations** (helper factories):

*Static:* `createStaticFormResolver(allDefs: Record<string, ControlDefinition[]>): FormTreeResolver`
- Caches `FormNode` per key. On first access, creates `createStaticFormTree(defs, resolver)`.
- Self-referential: passes itself to each tree for nested `childRefId` chains.
- Returns `undefined` for unknown keys.

*Reactive/lazy:* `createReactiveFormResolver(allDefs: Control<Record<string, ControlDefinition[]>>, loadForm?: (id: string) => Promise<ControlDefinition[]>): FormTreeResolver`
- Same pattern as the schema resolver: caches nodes, initializes empty control + triggers async load on first access, always returns a `FormNode`.
- Lazy loading works identically — `cursor(rd)` on the returned node registers deps via `rd.getElements(control)`, async load completion triggers re-evaluation.

**Local id lookup** (shared utility, used for both local refs and `/formId/localId`):

Finding a definition by `id` within a form tree requires a recursive scan:
1. Walk the tree's definition children
2. For each definition, check if its `id` matches the target
3. If not, recurse into that definition's own children
4. Return the matching `FormNode` (whose `cursor(rd).children` provides the resolved children)

**childRefId resolution and re-parenting** (applies to both static and reactive):
1. Parse `childRefId` — check for leading `/`
2. `"localId"` → scan current tree for definition with matching `id`, use its cursor's children
3. `"/formId"` → `resolver(formId).cursor(rd).children`
4. `"/formId/localId"` → scan `resolver(formId)` tree for `localId`, use its cursor's children
5. No `childRefId` → use `definition.children` directly
6. **Create wrapper nodes** for resolved children (same approach as SchemaNode): each wrapper has path-based `id` (`"${referringNode.id}/${childSegment}"`), `parent` pointing to the referring node, and `cursor(rd)` delegating to the original with overridden parent cursor. Children getter wraps lazily (O(depth)).

**Lazy loading for external refs:** When `childRefId` references an external form (`"/formId"` or `"/formId/localId"`):
1. `resolver(formId)` returns a `FormNode` wrapping a possibly-empty control
2. `resolvedNode.cursor(rd).children` registers deps via `rd.getElements(control)`
3. If not loaded yet: returns `[]`. When load completes, dep fires, children resolve.

**Static factory:** `createStaticFormTree(definitions: ControlDefinition[], resolver?: FormTreeResolver): FormNode`

- Synthetic root, `id: "$root"`.
- `cursor(rd)`: ignores `rd`, returns memoized cursor.
- `children` getter resolves `childRefId` per the parsing above. Local id lookup is a one-time recursive scan of the static definition tree.
- Child FormNodes created fresh each call. Child node `id`: `"${parent.id}/${index}"` (path-based, see Node ID scheme above).

**Reactive factory:** `createReactiveFormTree(definitionsControl: Control<ControlDefinition[]>, resolver?: FormTreeResolver): FormNode`

- `cursor(rd)`: reads `rd.getElements(definitionsControl)`, fresh each call.
- `cursor.definition` uses `rd.getValueRx(defControl)` for fine-grained reactivity.
- `childRefId` read from `getValueRx` proxy. Resolution follows the same three-format parsing as static.
- Without `childRefId`: reads children via `(defControl as Control<Record<string, unknown>>).fields["children"]` + `rd.getElements(...)`.
- Child nodes created fresh each `cursor(rd)` call.
- Child node `id`: `"${parent.id}/${control.uniqueId}"` (path-based, see Node ID scheme above).

**Reactive local id resolution — dependency implications:**

Local `childRefId` resolution in a reactive tree requires scanning definition controls within `cursor(rd)`, which registers broad reactive dependencies:
1. `rd.getElements(rootControl)` — subscribes to root structure
2. For each element: `rd.getValueRx(elementControl).id` — subscribes to every definition's `id`
3. Recurse into children: `rd.getElements(childrenControl)` at each level — subscribes to every level's structure

Any change to tree structure or any definition's `id` invalidates cursors that performed local ref lookups. This is **correct** — if ids or structure change, reference resolution may yield different results.

Note that every cursor performing a local ref lookup independently subscribes to the entire tree. If this proves costly in practice, a tree-level reactive id map (centralised computation mapping `id → FormNode`) could let multiple cursors share a single set of subscriptions. Not required for initial implementation.

### 4. `nodes/index.ts` + update `src/index.ts`

Re-export all factories and resolver types. Add `export * from "./nodes"` to `src/index.ts`.

## Existing code to reuse

| What | Where | Used for |
|------|-------|----------|
| `isCompoundField(sf)` | `json/schemaField.ts:130` | Check if field has children |
| `CompoundField` type | `json/schemaField.ts:97` | Cast to access `.children`, `.schemaRef` |
| `FieldType.Compound` | `json/schemaField.ts:60` | Synthetic root field type |
| `Control.fields` | Proxy in controlImpl.ts | Runtime access to child controls |
| `Control.uniqueId` | `number` | Stable identity for caching |
| `ReadContext.getElements()` | controls-core types.ts:127 | Read array elements reactively |
| `ReadContext.getValueRx()` | controls-core types.ts:147 | Fine-grained reactive proxy for `cursor.field` |

## Implementation Order

1. `nodes/schemaNode.ts` — no deps beyond types + json utilities
2. `nodes/dataNode.ts` — depends on SchemaNode/SchemaCursor
3. `nodes/formNode.ts` — parallel to schemaNode, independent of it
4. `nodes/index.ts` + update `src/index.ts`
5. Tests

Steps 1 and 3 can be done in parallel.

## Test plan

Create `packages/forms-core/vitest.config.ts` (copy from controls-core) and `test/nodes.test.ts`:

1. Static schema tree: create from SchemaField[], traverse, verify children/fields/parents
2. Static schema + schemaRef: compound references another tree via resolver, verify resolution and re-parenting (cursor.parent points back to referring cursor, not resolved tree)
3. Reactive schema tree: Control<SchemaField[]>, verify ReadContext deps, verify children update on change
4. DataNode: SchemaNode + Control, navigate childField/childElement, verify field/control/elementIndex
5. Static form tree: ControlDefinition[], traverse children, test childRefId resolution (all three formats)
6. Reactive form tree: Control<ControlDefinition[]>, verify reactive behavior
7. cursorUtils compatibility: existing utils work against both static and reactive cursors
8. Reactive schemaRef change: verify children resolve from new tree, DataNode childField gets new schema node
9. Reactive childRefId change: verify children resolve from new form tree
10. Static resolver: `createStaticSchemaResolver` with multiple named schemas, verify cross-tree resolution and self-referential chains (schema A refs schema B which refs schema C)
11. Reactive resolver with lazy loading: `createReactiveSchemaResolver` with `loadSchema` callback, verify:
    - Initial access returns node with empty children
    - After async load completes and control is updated, cursor re-evaluation yields actual children
    - Resolver caches nodes (same SchemaNode returned for same key across calls)
12. Form resolver: same lazy loading tests for `createReactiveFormResolver`
13. Re-parenting across refs: verify field path resolution (walking cursor.parent chain) produces correct path through the referring tree, not the resolved tree
14. Path-based ID uniqueness: two compound fields with the same `schemaRef` produce children with distinct node IDs (parent prefix differs), wrapper node parent/id are correct at every level of the resolved subtree

## Verification

```bash
cd packages/forms-core
rushx build           # Type-check passes
rushx test            # All new tests pass
cd ../..
rush build --to @rxc/forms-core   # Full dependency build
```
