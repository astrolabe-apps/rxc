# Form State Node Design

FormStateNode is the runtime representation of a single node in the form definition tree. It bridges a `ControlDefinition` (what to render) with a `DataNode` (the data context — a persistent handle pairing a `SchemaNode` with a `Control`). Each node manages reactive state for visibility, disabled, readonly, validation, children, and the resolved definition.

## Design Principles

1. **No exposed Controls** — the reactive control tree is an internal implementation detail. Consumers never interact with `Control<T>` instances for form state (except the data `Control` itself which is the form's value).
2. **ReadContext as the entry point** — all reactivity flows through `FormStateNode.getState(rc)` and `getChildren(rc)`. The returned `FormState` captures the `ReadContext` and registers fine-grained dependencies as individual properties are accessed.
3. **Stable handles, reactive reads** — `FormStateNode` is a stable identity object. The state it represents changes over time; reading that state requires a `ReadContext`.
4. **Proxy is ephemeral** — the `FormState` returned by `getState(rc)` is a lightweight view bound to a specific `ReadContext`. It holds no state of its own — it's a lens that routes property reads through `rc` to the underlying controls.

## FormStateNode — The Reactive Handle

`FormStateNode` is the primary interface consumers work with. It is a stable object representing a node in the form tree, with reactive accessors:

```typescript
interface FormStateNode {
  /** Stable string identity for this node */
  uniqueId: string;

  /** Stable reference to parent (does not change) */
  parentNode: FormStateNode | undefined;

  /**
   * Returns a FormState view bound to the given ReadContext.
   * Property access on the returned object registers dependencies —
   * only the fields actually read are subscribed to.
   */
  getState(rc: ReadContext): FormState;

  /**
   * Returns the current child nodes, registering a dependency on
   * the child list. Changes when array elements are added/removed,
   * resolveChildren produces different specs, etc.
   */
  getChildren(rc: ReadContext): FormStateNode[];

  // Mutators (do not require ReadContext)
  setTouched(b: boolean, notChildren?: boolean): void;
  validate(): boolean;
  cleanup(): void;
  setBusy(busy: boolean): void;
  setForceDisabled(forceDisable: boolean): void;

  // Meta storage
  ensureMeta<A>(key: string, init: (scope: CleanupScope) => A): A;

  // UI attachment
  ui: FormNodeUi;
  attachUi(f: FormNodeUi): void;
}
```

### Usage Pattern

```typescript
// In a controls() render function:
const MyField = controls<{ node: FormStateNode }>(
  (props, { rc }) => {
    const state = props.node.getState(rc);
    if (!state.visible) return null;

    const children = props.node.getChildren(rc);
    // render based on state.definition, state.field, state.data, etc.
    // iterate children — each is a stable FormStateNode handle
  }
);
```

Only the properties actually accessed on `state` register dependencies. If a renderer only reads `visible` and `definition`, it won't re-render when `disabled` or `readonly` change.

## FormState — The Reactive View

`FormState` is the interface returned by `FormStateNode.getState(rc)`. It captures a `ReadContext` internally — all property access routes through it:

```typescript
interface FormState extends FormStateBase, FormNodeOptions {
  childKey: string | number;
  definition: ControlDefinition;   // resolved with script overrides
  valid: boolean;
  touched: boolean;
  clearHidden: boolean;
  variables?: VariablesFunc;
  meta: Record<string, any>;
}

interface FormStateBase {
  data?: Control<unknown>;      // the live data control (undefined for non-data controls)
  field?: SchemaField;          // the schema field definition (undefined for non-data controls)
  readonly: boolean;
  visible: boolean | null;
  disabled: boolean;
  resolved: ResolvedDefinition;
  childIndex: number;
  busy: boolean;
}
```

`FormState` exposes the data and schema field directly — renderers use `state.field` for type info and `state.data` for reading/writing values. For tree traversal (navigating to sibling/child fields), use `state.dataNode` which returns the reactively-resolved persistent `DataNode`; call `dataNode.cursor(rc)` when reactive access to the resolved `SchemaField` or children is required. The `dataNode` lives on `FormState` (not `FormStateNode`) because it's derived from the — possibly scripted — definition field path and must be read through a `ReadContext`.

Accessing `state.visible` internally does `rc.getValue(visibleControl)`, registering a dependency on the visibility control. Accessing `state.data` registers a dependency on the data node control. And so on.

### The `definition` Property

`state.definition` returns a `ControlDefinition` that may be a proxy resolving through up to three layers:

1. **Script override layer** — checks script override controls via `rc`. Script computeds cache their results in these controls (e.g. a `hidden` script writes its result into `overrides.fields.hidden`). Reading through `rc` subscribes the caller to the cached result.

2. **Editor layer** (optional) — if the base definition is backed by a `Control<ControlDefinition>` (e.g. in a form editor's preview mode), property access reads through `rc`, subscribing to editor changes.

3. **Static fallback** — plain property access on the original `ControlDefinition` object. No subscription.

The proxy is stateless — it's created fresh per `getState(rc)` call and holds no state of its own.

## Schema Trees

Schema structure and data binding use the **persistent handle + ephemeral cursor** pattern. A `SchemaNode` / `DataNode` / `FormNode` is a stable `id`-identified handle that can be stored in controls or long-lived structures. Calling `node.cursor(rd)` inside a `ReadContext` produces an ephemeral cursor that registers reactive dependencies on the underlying schema/data/definition tree.

### SchemaNode / SchemaCursor — Schema Structure

`SchemaNode` is a persistent handle to a position in the schema field hierarchy, independent of any data:

```typescript
interface SchemaNode {
  id: string;
  parent?: SchemaNode;
  cursor(rd: ReadContext): SchemaCursor;
}

interface SchemaCursor {
  node: SchemaNode;
  field: SchemaField;
  children: SchemaCursor[];
  parent?: SchemaCursor;
  rd: ReadContext;
}
```

Used for traversing schema structure without data binding — field selection UIs, schema-aware searching, building column definitions, editor tools. In editor mode the backing data may be a `Control<SchemaField[]>`, so the same `SchemaNode` yields different cursor snapshots as the schema is edited. Compound fields with a `schemaRef` resolve their children from the referenced named tree.

### DataNode / DataCursor — Data-Bound Schema

`DataNode` is a persistent handle binding a `SchemaNode` to a `Control` that holds the data value at that path. It replaces the old `SchemaDataNode` concept — splitting persistent identity (`DataNode`) from ephemeral traversal (`DataCursor`) mirrors the `SchemaNode`/`SchemaCursor` pattern.

```typescript
interface DataNode {
  id: string;
  parent?: DataNode;
  cursor(rd: ReadContext): DataCursor;
}

interface DataCursor {
  node: DataNode;
  field: SchemaField;
  control: Control<unknown>;
  elementIndex?: number;
  parent?: DataCursor;
  childField(field: string): DataCursor | undefined;
  childElement(elementIndex: number): DataCursor | undefined;
}
```

- `field` / `control` — the resolved schema field and the control holding its value at this path
- `childField("street")` — navigate to a named child field, returns `undefined` if the field doesn't exist on this schema
- `childElement(index)` — navigate into an array element, lazily creates the child `DataNode`
- `elementIndex` — distinguishes "the array itself" (`undefined`) from "a specific element" (number), critical for collection expansion
- `FormState.dataNode?: DataNode` exposes the reactively-resolved persistent handle; callers who need reactive field/child access call `dataNode.cursor(rc)` themselves

### FormNode / FormCursor — Control Definition Tree

`FormNode` is the analogous persistent handle for `ControlDefinition` trees, with cross-tree `childRefId` resolution via a `FormTreeResolver`. Ephemeral `FormCursor` exposes the resolved definition and children within a `ReadContext`.

## Script Override Lifecycle

Script computeds are the only part of the definition resolution that has lifecycle.

The script layer is internal to the `FormStateNode` implementation — it is not exposed through any public interface. It creates a `Control<Record<string, any>>` for the overrides and a list of cleanup functions for the script computeds. When the base definition changes (editor mode), the entire set is torn down and rebuilt from scratch.

```
Script layer (internal, not exposed)
  └─ overrides: Control<Record<string, any>>  (recreated on definition change)
       ├─ computed: evaluate "hidden" script → write result to overrides.fields.hidden
       ├─ computed: evaluate "disabled" script → write result to overrides.fields.disabled
       └─ computed: evaluate "label" script → write result to overrides.fields.label
```

- Script computeds are created during initialization, with cleanup registered on the FormStateNode
- Each script computed tracks its own dependencies (data controls referenced by the expression) and writes its cached result into the corresponding override control
- When a dependency changes, only that script re-evaluates
- On cleanup, all script computeds are torn down

**Editor mode coarse invalidation:** When the base definition is a `Control<ControlDefinition>` (editor mode), a single tracked computation reads the entire definition. If any property changes, the override control is discarded, a fresh one is created, and all script computeds are rebuilt. This is acceptable — editor preview doesn't need fine-grained reactivity.

## Computed Properties

These are set up internally as `computed()` instances during initialization:

- **dataNode** — looks up the field path from the resolved definition in the parent `DataNode`
- **visible** — combines: parent visibility cascade, force-hidden flag, data node validity, definition's `hidden` property
- **disabled** — combines: parent cascade, force-disabled flag, definition property
- **readonly** — combines: parent cascade, force-readonly flag, definition property

## Sync Effects

Effects that keep the form state and its data control in sync:

- disabled → pushed to the data control
- touched ↔ bidirectional sync with the data control
- errors ← pulled from the data control
- default value logic: clear data when hidden, apply default when visible and undefined

## Children Lifecycle

Children are managed by an internal effect that is created lazily — it does not exist until the first `getChildren(rc)` call. This avoids the cost of resolving children for nodes that are never expanded (e.g. collapsed sections, off-screen nodes).

Once created, the effect maintains the child list reactively:

1. `resolveChildren()` determines the child specs (from form node children, array elements, or field options) — this reads live data (e.g. `control.elements` for arrays), registering dependencies within the effect's own `ReadContext`
2. Children are cached by `childKey` for identity stability across re-evaluations
3. If the parent data context changes, the cache is cleared — entire subtree rebuilds
4. Detached children get `cleanup()` called immediately
5. Each child is a new `FormStateNode` with its own scope, computed properties, and sync effects
6. The resulting `FormStateNode[]` is written to an internal control

`getChildren(rc)` reads that internal control, registering a dependency so the caller is notified when the list changes. The caller never triggers child resolution directly — it only observes the result.

## Cleanup Chain

```
FormStateNode.cleanup()
  ├─ All computed properties stop tracking (visible, disabled, readonly, dataNode)
  ├─ All sync effects unsubscribe (disabled sync, touched sync, error sync, defaults)
  ├─ Children cleaned up recursively
  ├─ Validation effects torn down
  └─ Script layer cleanup
       ├─ All script computeds unsubscribe
       └─ Override control discarded
```

## Cascade Rules

- **Visibility, disabled, readonly** cascade down — if parent is hidden, all descendants are hidden
- **Errors** bubble up through the data control tree (not the form state tree)
- **Data context** can switch when entering array elements or compound fields — each child resolves its data node relative to its parent's data context