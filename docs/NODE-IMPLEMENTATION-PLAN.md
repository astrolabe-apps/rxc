# Implement SchemaNode, DataNode, FormNode (Static + Reactive)

## Context

The Node/Cursor interfaces are defined in `packages/forms-core/src/types.ts` (lines 99–286) but have no implementations — previous implementations were reverted. We need both:
- **Static** — wrapping plain `SchemaField[]` / `ControlDefinition[]` (normal form runtime)
- **Reactive** — wrapping `Control<SchemaField[]>` / `Control<ControlDefinition[]>` (editor scenario, where the schema/definition is itself editable)

The interfaces use a **cursor pattern**: nodes are stable handles identified by `id`; calling `node.cursor(rd)` returns an ephemeral cursor with resolved `field`, `children`, and `parent`. Static cursors ignore `rd` and are memoized. Reactive cursors use `rd` to register dependencies and are fresh each call.

## Architecture

```
packages/forms-core/src/nodes/
  schemaNode.ts ──→ SchemaNode / SchemaCursor
     createStaticSchemaTree(fields[], resolver?)
     createReactiveSchemaTree(Control<fields[]>, resolver?)

  dataNode.ts ──→ DataNode / DataCursor
     createDataNode(schemaNode, control, parent?, elemIndex?)

  formNode.ts ──→ FormNode / FormCursor
     createStaticFormTree(definitions[], resolver?)
     createReactiveFormTree(Control<definitions[]>, resolver?)

  index.ts ──→ re-exports all factories + resolver types
```

## Detailed Design

### 1. `nodes/schemaNode.ts`

**Resolver type:**
```typescript
export type SchemaTreeResolver = (schemaRef: string) => SchemaNode | undefined;
```

**Static factory:** `createStaticSchemaTree(fields: SchemaField[], resolver?: SchemaTreeResolver): SchemaNode`

- Synthetic root node with `id: "$root"`, cursor field is a synthetic `CompoundField` with `field: ""`, `type: FieldType.Compound`, `children: fields`.
- `cursor(rd)`: ignores `rd`, returns memoized cursor (built lazily on first call).
- `children` is a **getter** — lazily maps each `SchemaField` to a child `SchemaCursor`. For compound fields with `schemaRef`, resolves via `resolver` and uses that node's cursor children. Non-compound fields return `[]`.
- Child `SchemaNode`s are created fresh each call — no caching needed since consumers identify nodes by `id`, not object reference.
- `parent` on child nodes points back to parent `SchemaNode`.

**Reactive factory:** `createReactiveSchemaTree(fieldsControl: Control<SchemaField[]>, resolver?: SchemaTreeResolver): SchemaNode`

- Root wraps `Control<SchemaField[]>`.
- `cursor(rd)`: reads `rd.getElements(fieldsControl)` (registers Structure dep), returns fresh cursor each call.
- Each child wraps a `Control<SchemaField>`. **`cursor.field` uses `rd.getValueRx(elementControl)`** — fine-grained reactive proxy so reading `cursor.field.displayName` only subscribes to that child control. Safe because `SchemaField` is pure data.
- For compound children resolution: accesses `(elementControl as Control<Record<string, unknown>>).fields["children"]` as `Control<SchemaField[]>`, then `rd.getElements(...)`. Distinct code path from `getValueRx` proxy — we need the actual `Control<SchemaField[]>`.
- Child nodes created fresh each `cursor(rd)` call — no caching needed since consumers identify nodes by `id`, not object reference.
- Node `id`: `String(control.uniqueId)`.
- `schemaRef`: read from `getValueRx` proxy (fine-grained dep), delegates to resolver.

**schemaRef delegation:** When `schemaRef` IS set, children getter delegates entirely to `resolver(schemaRef).cursor(rd).children`. Child cursors' `.node` properties point to nodes in the resolved tree. **No local caching for schemaRef-resolved children** — avoids stale entries when schemaRef changes.

### 2. `nodes/dataNode.ts`

**Factory:** `createDataNode(schemaNode: SchemaNode, control: Control<unknown>, parent?: DataNode, elementIndex?: number): DataNode`

- `id`: `"${schemaNode.id}:${control.uniqueId}"` (+ `[${elementIndex}]` if element).
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
Takes a parsed `formId` (from the `/`-prefixed formats) and returns the root `FormNode` of the external form tree. Returns `FormNode` (not raw definitions) — resolved trees can be static or reactive.

**Local id lookup** (shared utility, used for both local refs and `/formId/localId`):

Finding a definition by `id` within a form tree requires a recursive scan:
1. Walk the tree's definition children
2. For each definition, check if its `id` matches the target
3. If not, recurse into that definition's own children
4. Return the matching `FormNode` (whose `cursor(rd).children` provides the resolved children)

**childRefId resolution** (applies to both static and reactive):
1. Parse `childRefId` — check for leading `/`
2. `"localId"` → scan current tree for definition with matching `id`, use its cursor's children
3. `"/formId"` → `resolver(formId).cursor(rd).children`
4. `"/formId/localId"` → scan `resolver(formId)` tree for `localId`, use its cursor's children
5. No `childRefId` → use `definition.children` directly

**Static factory:** `createStaticFormTree(definitions: ControlDefinition[], resolver?: FormTreeResolver): FormNode`

- Synthetic root, `id: "$root"`.
- `cursor(rd)`: ignores `rd`, returns memoized cursor.
- `children` getter resolves `childRefId` per the parsing above. Local id lookup is a one-time recursive scan of the static definition tree.
- Child FormNodes created fresh each call.

**Reactive factory:** `createReactiveFormTree(definitionsControl: Control<ControlDefinition[]>, resolver?: FormTreeResolver): FormNode`

- `cursor(rd)`: reads `rd.getElements(definitionsControl)`, fresh each call.
- `cursor.definition` uses `rd.getValueRx(defControl)` for fine-grained reactivity.
- `childRefId` read from `getValueRx` proxy. Resolution follows the same three-format parsing as static.
- Without `childRefId`: reads children via `(defControl as Control<Record<string, unknown>>).fields["children"]` + `rd.getElements(...)`.
- Child nodes created fresh each `cursor(rd)` call.
- Node `id`: `String(control.uniqueId)`.

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
2. Static schema + schemaRef: compound references another tree, verify resolution
3. Reactive schema tree: Control<SchemaField[]>, verify ReadContext deps, verify children update on change
4. DataNode: SchemaNode + Control, navigate childField/childElement, verify field/control/elementIndex
5. Static form tree: ControlDefinition[], traverse children, test childRefId resolution
6. Reactive form tree: Control<ControlDefinition[]>, verify reactive behavior
7. cursorUtils compatibility: existing utils work against both static and reactive cursors
8. Reactive schemaRef change: verify children resolve from new tree, DataNode childField gets new schema node
9. Reactive childRefId change: verify children resolve from new form tree

## Verification

```bash
cd packages/forms-core
rushx build           # Type-check passes
rushx test            # All new tests pass
cd ../..
rush build --to @rxc/forms-core   # Full dependency build
```
