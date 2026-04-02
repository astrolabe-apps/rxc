# Reactive SchemaNode, FormNode, and FormStateNode Refactor

## Context

The `SchemaNode` and `FormNode` interfaces already accept `ReadContext` in their method signatures, designed for reactive access. But the current implementations are static:

- `SchemaNodeImpl` stores a plain `SchemaField` and ignores `rc`
- `FormNode` has no implementation at all (interface only)
- `FormStateNodeImpl` takes a static `ControlDefinition` in its constructor

This plan adds fine-grained reactive implementations backed by the Control tree, so that editing schema or form definition JSON reactively propagates through the entire form system — only triggering re-evaluation on nodes whose values actually changed.

## Design Principles

1. **Fine-grained reactivity via Controls**: Each node wraps its own `Control<SchemaField>` or `Control<ControlDefinition>` (a child element of a parent control). `getField(rc)` / `getDefinition(rc)` calls `rc.getValue(control)`, registering a dependency on that specific control only.

2. **Leverage existing propagation**: When `setValue` is called on a root control with new parsed JSON, the control tree propagates downward. Each child control checks equality — if unchanged, no subscribers fire. Array elements reconcile by index.

3. **Lightweight wrappers**: `ReactiveSchemaNodeImpl` and `ReactiveFormNodeImpl` are disposable wrappers created on each `getChildren()` call (same pattern as the static `SchemaNodeImpl`). The `Control` is the stable identity; the wrapper is ephemeral.

4. **Backward compatibility**: A `staticFormNode()` adapter lets existing code pass static `ControlDefinition` without creating Controls.

## Implementation Phases

```
Phase 1: ReactiveSchemaNode             (no deps on other changes)
Phase 2: StaticFormNode + ReactiveFormNode  (no deps on FormStateNode)
Phase 3: FormStateNode refactor          (depends on Phase 2)
Phase 4: Dev app integration             (depends on all above)
Phase 5: Tests
```

---

## Phase 1: Reactive SchemaNode

**File**: `packages/forms-core/src/schemaNode.ts`

### Root node: `RootReactiveSchemaNode`

The factory takes `Control<SchemaField[]>` (the children array). The root is special — it doesn't represent a single field, it wraps the array:

```typescript
class RootReactiveSchemaNode implements SchemaNode {
  parent = undefined;

  constructor(
    private fieldsControl: Control<SchemaField[]>,
    private lookup?: SchemaTreeLookup,
  ) {}

  getField(_rc: ReadContext): SchemaField {
    // Synthetic root — nobody reads .children from this, they call getChildren()
    return { type: FieldType.Compound, field: "", children: [] } as CompoundField;
  }

  getChildren(rc: ReadContext): SchemaNode[] {
    const elements = rc.getElements(this.fieldsControl);
    return elements.map(
      (elem) => new ReactiveSchemaNodeImpl(elem, this, this.lookup),
    );
  }

  getChildNode(rc: ReadContext, fieldName: string): SchemaNode {
    const elements = rc.getElements(this.fieldsControl);
    for (const elem of elements) {
      if (rc.getValue(elem).field === fieldName) {
        return new ReactiveSchemaNodeImpl(elem, this, this.lookup);
      }
    }
    return new SchemaNodeImpl(missingField(fieldName), this, this.lookup);
  }
}
```

**Key decisions**:
- `getField()` returns a static synthetic CompoundField with empty children. Root's `getField` is only used for `isCompoundField` checks by `SchemaDataNode` — callers use `getChildren()` for actual child access.
- `getChildren()` calls `rc.getElements(fieldsControl)` which tracks `ControlChange.Structure` — only re-fires when array length changes.
- Each element control is wrapped in `ReactiveSchemaNodeImpl`.

### Child nodes: `ReactiveSchemaNodeImpl`

```typescript
class ReactiveSchemaNodeImpl implements SchemaNode {
  constructor(
    private fieldControl: Control<SchemaField>,
    public parent: SchemaNode | undefined,
    private lookup?: SchemaTreeLookup,
  ) {}

  getField(rc: ReadContext): SchemaField {
    return rc.getValue(this.fieldControl);
    // Tracks ControlChange.Value on this specific control only
  }

  getChildren(rc: ReadContext): SchemaNode[] {
    const field = rc.getValue(this.fieldControl);
    if (!isCompoundField(field)) return [];
    return this.resolveChildren(rc);
  }

  getChildNode(rc: ReadContext, fieldName: string): SchemaNode {
    const field = rc.getValue(this.fieldControl);
    if (!isCompoundField(field)) {
      return new SchemaNodeImpl(missingField(fieldName), this, this.lookup);
    }
    const resolved = this.getResolvedNode(field);
    return resolved.findChild(rc, fieldName);
  }

  private resolveChildren(rc: ReadContext): SchemaNode[] {
    const field = rc.getValue(this.fieldControl) as CompoundField;
    const resolved = this.getResolvedNode(field);
    const childrenControl = resolved.fieldControl.fields.children as Control<SchemaField[]>;
    const elements = rc.getElements(childrenControl);
    return elements.map(
      (elem) => new ReactiveSchemaNodeImpl(elem, this, this.lookup),
    );
  }

  private findChild(rc: ReadContext, fieldName: string): SchemaNode {
    const childrenControl = this.fieldControl.fields.children as Control<SchemaField[]>;
    const elements = rc.getElements(childrenControl);
    for (const elem of elements) {
      if (rc.getValue(elem).field === fieldName) {
        return new ReactiveSchemaNodeImpl(elem, this, this.lookup);
      }
    }
    return new SchemaNodeImpl(missingField(fieldName), this, this.lookup);
  }

  private getResolvedNode(field: CompoundField): ReactiveSchemaNodeImpl {
    // Handle schemaRef
    if (field.schemaRef && this.lookup) {
      const ref = this.lookup.getSchema(field.schemaRef);
      if (ref && ref instanceof ReactiveSchemaNodeImpl) return ref;
      // If ref is static SchemaNode, fall through to self
    }
    // Handle treeChildren — walk up to parent
    if (field.treeChildren && this.parent instanceof ReactiveSchemaNodeImpl) {
      return this.parent.getResolvedNode(
        this.parent.fieldControl.valueNow as CompoundField,
      );
    }
    return this;
  }
}
```

**Reactivity details for `getChildren(rc)`**:
1. `rc.getValue(this.fieldControl)` — tracks Value on this field control. If this field changes from Compound to String, re-evaluates.
2. `rc.getElements(childrenControl)` — tracks Structure on the children array. If children are added/removed, re-evaluates.
3. Each child's own `getField(rc)` only tracks that child's control — siblings are independent.

### Factory function

```typescript
export function createReactiveSchemaNode(
  fields: Control<SchemaField[]>,
  lookup?: SchemaTreeLookup,
): SchemaNode {
  return new RootReactiveSchemaNode(fields, lookup);
}
```

### Interaction with SchemaDataNode

`SchemaDataNodeImpl` already uses `SchemaNode` through the interface — `this.schema.getChildren(rc)` and `childSchema.getField(rc)`. No changes needed to `SchemaDataNode`. The reactive `SchemaNode` just makes those calls track real dependencies instead of being no-ops.

---

## Phase 2: FormNode Implementations

**New file**: `packages/forms-core/src/formNode.ts`

### StaticFormNodeImpl

Adapter for existing code that has static `ControlDefinition` objects:

```typescript
class StaticFormNodeImpl implements FormNode {
  constructor(
    private definition: ControlDefinition,
    public parent?: FormNode,
  ) {}

  getDefinition(_rc: ReadContext): ControlDefinition {
    return this.definition;
  }

  getChildren(_rc: ReadContext): FormNode[] {
    const children = this.definition.children;
    if (!children) return [];
    return children.map((child) => new StaticFormNodeImpl(child, this));
  }
}

export function staticFormNode(definition: ControlDefinition): FormNode {
  return new StaticFormNodeImpl(definition);
}
```

### ReactiveFormNodeImpl

Fine-grained reactive implementation backed by Controls:

```typescript
class ReactiveFormNodeImpl implements FormNode {
  constructor(
    private defControl: Control<ControlDefinition>,
    public parent?: FormNode,
  ) {}

  getDefinition(rc: ReadContext): ControlDefinition {
    return rc.getValue(this.defControl);
    // Tracks ControlChange.Value on this specific control
  }

  getChildren(rc: ReadContext): FormNode[] {
    const childrenControl = this.defControl.fields.children as
      Control<ControlDefinition[] | null | undefined>;
    if (rc.isNull(childrenControl)) return [];
    const elements = rc.getElements(
      childrenControl as Control<ControlDefinition[]>,
    );
    return elements.map(
      (elem) => new ReactiveFormNodeImpl(elem, this),
    );
  }
}

export function createReactiveFormNode(
  definition: Control<ControlDefinition>,
): FormNode {
  return new ReactiveFormNodeImpl(definition);
}
```

**Reactivity details for `getChildren(rc)`**:
1. `rc.isNull(childrenControl)` — tracks Structure on the children control. Fires when children transitions null ↔ array.
2. `rc.getElements(childrenControl)` — tracks Structure on the array. Fires on length change.
3. Each child `getDefinition(rc)` only tracks that child's control.

**Null handling**: `this.defControl.fields.children` lazily creates a child control. If `children` is null/undefined in the definition, the control's value is null. `rc.isNull()` checks this and tracks `ControlChange.Structure`, so when children appear, the effect re-runs.

**childRefId**: Not currently used in `FormStateNodeImpl`. Deferred — can be added later by passing an optional `FormTreeLookup` to the factory.

### Export changes

**File**: `packages/forms-core/src/index.ts`

```typescript
export { staticFormNode, createReactiveFormNode } from "./formNode";
export { createReactiveSchemaNode } from "./schemaNode";
```

---

## Phase 3: FormStateNode Refactor

**File**: `packages/forms-core/src/formStateNode.ts`

### Constructor change

```diff
 class FormStateNodeImpl implements FormStateNode {
   constructor(
-    readonly definition: ControlDefinition,
+    readonly formNode: FormNode,
     readonly parentNode: FormStateNode | undefined,
     private parentData: SchemaDataNode,
     readonly globals: FormStateGlobals,
     readonly nodeOptions: FormNodeOptions,
     readonly childKey: string | number,
     childIndex: number,
   ) {
```

### Init method changes

Each method that previously read `this.definition` now reads `this.formNode.getDefinition(rc)` inside its reactive callback.

#### `initDataNode(ctx)`

Previously had a conditional `if (fieldPath)` outside the computed. Now everything moves inside:

```typescript
private initDataNode(ctx: ControlContext) {
  this.effects.push(
    computed(ctx, this.stateControl.fields.dataNode, (rc) => {
      const def = this.formNode.getDefinition(rc);
      const fieldPath = isDataControl(def)
        ? def.field
        : isGroupControl(def)
          ? def.compoundField
          : undefined;
      return fieldPath
        ? schemaDataForFieldRef(rc, fieldPath, this.parentData)
        : undefined;
    }),
  );
}
```

Changed from conditional computed to always-computed. Returns `undefined` when there's no field path.

#### `initVisible(ctx)`

```typescript
private initVisible(ctx: ControlContext) {
  this.effects.push(
    computed(ctx, this.stateControl.fields.visible, (rc) => {
      if (this.nodeOptions.forceHidden) return false;
      if (this.parentNode) {
        const parentState = this.parentNode.getState(rc);
        if (parentState.visible === false) return false;
      }
      const dn = rc.getValue(this.stateControl.fields.dataNode);
      const def = this.formNode.getDefinition(rc);
      if (
        dn &&
        (!isValidDataNode(dn, rc) ||
          hideDisplayOnly(dn, rc, def, this.globals))
      )
        return false;
      return def.hidden == null ? null : !def.hidden;
    }),
  );
}
```

Only change: `this.definition` → `this.formNode.getDefinition(rc)` (called once, used for both `hideDisplayOnly` and `hidden` check).

#### `initReadonly(ctx)`

```typescript
private initReadonly(ctx: ControlContext) {
  this.effects.push(
    computed(ctx, this.stateControl.fields.readonly, (rc) => {
      if (this.parentNode) {
        const parentState = this.parentNode.getState(rc);
        if (parentState.readonly) return true;
      }
      const def = this.formNode.getDefinition(rc);
      return this.nodeOptions.forceReadonly || !!def.readonly;
    }),
  );
}
```

#### `initDisabled(ctx)`

```typescript
private initDisabled(ctx: ControlContext) {
  this.effects.push(
    computed(ctx, this.stateControl.fields.disabled, (rc) => {
      if (this.parentNode) {
        const parentState = this.parentNode.getState(rc);
        if (parentState.disabled) return true;
      }
      const def = this.formNode.getDefinition(rc);
      return this.nodeOptions.forceDisabled || !!def.disabled;
    }),
  );
}
```

#### `initValidation(ctx)`

Previously had early return outside effect. Now the check moves inside:

```typescript
private initValidation(ctx: ControlContext) {
  this.effects.push(
    effect(ctx, (rc) => {
      const def = this.formNode.getDefinition(rc);
      if (!isDataControl(def) || !def.required) return;

      const isEmptyValue =
        this.globals.isEmptyValue ??
        ((_: SchemaField, v: unknown) => v == null || v === "");

      const visible = rc.getValue(this.stateControl.fields.visible);
      const dn = rc.getValue(this.stateControl.fields.dataNode);
      if (!visible || !dn) return;
      const value = rc.getValue(dn.data);
      const field = dn.getField(rc);
      const error = isEmptyValue(field, value)
        ? (def.requiredErrorText ?? "This field is required")
        : undefined;
      ctx.update((wc) => wc.setError(dn.data, "default", error));
    }),
  );
}
```

The effect always registers but exits early if not a required data control. This is correct — if the definition reactively changes from non-required to required, the effect re-runs and starts validating.

#### `initDefaultValue(ctx)`

Same pattern — check moves inside:

```typescript
private initDefaultValue(ctx: ControlContext) {
  this.effects.push(
    effect(ctx, (rc) => {
      const def = this.formNode.getDefinition(rc);
      if (!isDataControl(def)) return;

      const dn = rc.getValue(this.stateControl.fields.dataNode);
      if (!dn) return;

      const visible = rc.getValue(this.stateControl.fields.visible);
      const value = rc.getValue(dn.data);

      if (visible === false) {
        if (this.globals.clearHidden && !def.dontClearHidden) {
          ctx.update((wc) => wc.setValue(dn.data, undefined));
        }
      } else if (
        visible &&
        value === undefined &&
        def.defaultValue != null
      ) {
        ctx.update((wc) => wc.setValue(dn.data, def.defaultValue));
      }
    }),
  );
}
```

#### `initChildren(ctx)`

The biggest change. Previously read `this.definition.children` and had an early return. Now uses `this.formNode.getChildren(rc)`:

```typescript
private initChildren(ctx: ControlContext) {
  // Always register — children may appear/disappear reactively
  this.effects.push(
    effect(ctx, (rc) => {
      const childFormNodes = this.formNode.getChildren(rc);
      if (childFormNodes.length === 0 && this.childEntries.length === 0) return;

      const dn = rc.getValue(this.stateControl.fields.dataNode);
      const dataContext = dn ?? this.parentData;

      const newKeys = childFormNodes.map((fn, i) =>
        this.childKeyFor(fn.getDefinition(rc), i),
      );

      const oldMap = new Map(this.childEntries.map((e) => [e.key, e]));
      const newEntries: ChildEntry[] = [];

      for (let i = 0; i < childFormNodes.length; i++) {
        const key = newKeys[i];
        const existing = oldMap.get(key);
        if (existing) {
          ctx.update((wc) =>
            wc.setValue(existing.node.stateControl.fields.childIndex, i),
          );
          newEntries.push(existing);
          oldMap.delete(key);
        } else {
          const childNode = new FormStateNodeImpl(
            childFormNodes[i],  // Pass child FormNode
            this,
            dataContext,
            this.globals,
            { forceReadonly: false, forceDisabled: false, forceHidden: false },
            key,
            i,
          );
          newEntries.push({ key, node: childNode });
        }
      }

      for (const removed of oldMap.values()) {
        removed.node.cleanup();
      }

      this.childEntries = newEntries;
      ctx.update((wc) =>
        wc.setValue(
          this.childrenControl,
          newEntries.map((e) => e.node),
        ),
      );
    }),
  );
}
```

**Key change**: No early return at top level. The effect always runs. `childFormNodes` comes from `this.formNode.getChildren(rc)` — for reactive FormNode, this tracks the children array's Structure changes. Each child `FormStateNodeImpl` receives the child `FormNode`, so its own `getDefinition(rc)` tracks that child's control independently.

**Reconciliation**: Still by `childKeyFor` (field name or index). When a child FormNode's definition changes (e.g., field name changes), the key changes, old node is cleaned up, new one created. When just properties change (e.g., `required` toggled), the key stays the same, the existing `FormStateNodeImpl` is reused, and its internal effects re-run because they track `formNode.getDefinition(rc)`.

Wait — there's a subtlety here. When an existing child `FormStateNodeImpl` is reused by key, its `formNode` field still points to the *old* `FormNode` wrapper. But the old wrapper points to the *same* underlying `Control<ControlDefinition>` element (elements are reused by index in the control tree). So `getDefinition(rc)` still reads from the same control. This works correctly as long as the child order doesn't change.

If child order *does* change (e.g., field at index 0 and index 1 swap), then:
- The control elements at index 0 and 1 get new values (via `syncElementsOnValueChange`)
- The old `ReactiveFormNodeImpl` wrappers created in the previous effect run are now garbage — the new `getChildren(rc)` call creates fresh wrappers around the same element controls (now with swapped values)
- The `childKeyFor` reconciliation matches by field name, so the `FormStateNodeImpl` with key "firstName" now gets the wrapper pointing to whatever element control holds "firstName"

But wait — the reused `FormStateNodeImpl` still holds its *old* `formNode` (a `ReactiveFormNodeImpl` wrapping the element control at the old index). If the element at the old index now has a different definition value (because of the swap), the `FormStateNodeImpl`'s effects will re-run and see the new definition. But this is the **wrong** definition — it's the swapped one.

**This is a real issue with index-based reconciliation.** The `FormStateNodeImpl` is reused by key (field name), but its `formNode` wraps a control at a specific array index. After a swap, the control at that index has different data.

**Mitigation**: In `initChildren`, when reusing an existing `FormStateNodeImpl`, we should update its `formNode` to the new child `FormNode` wrapper. This requires making `formNode` mutable:

```diff
-  readonly formNode: FormNode,
+  formNode: FormNode,
```

And in the reconciliation:
```typescript
if (existing) {
  existing.node.formNode = childFormNodes[i];  // Update to new FormNode wrapper
  // ...
}
```

This ensures the reused `FormStateNodeImpl` always reads from the correct element control.

### `createFormStateView` changes

```typescript
function createFormStateView(
  impl: FormStateNodeImpl,
  rc: ReadContext,
): FormState {
  return {
    get definition() {
      return impl.formNode.getDefinition(rc);
    },
    get resolved() {
      return { definition: impl.formNode.getDefinition(rc) };
    },
    // ... all other getters unchanged
  };
}
```

### `createFormStateNode` signature

```typescript
export function createFormStateNode(
  formNode: FormNode,
  parentData: SchemaDataNode,
  globals: FormStateGlobals,
  options?: FormNodeOptions,
): FormStateNode {
  return new FormStateNodeImpl(
    formNode,
    undefined,
    parentData,
    globals,
    options ?? { forceReadonly: false, forceDisabled: false, forceHidden: false },
    "root",
    0,
  );
}
```

---

## Phase 4: Dev App Integration

**File**: `apps/dev/src/app/tree/page.tsx`

### Layout change

Expand from 3-panel to include JSON editors. Options:
- **Option A**: Add a 4th column (cramped on smaller screens)
- **Option B**: Add JSON editors above/below the 3 panels
- **Option C**: Tabbed panel switching

Recommend **Option B**: Add a collapsible row above the 3 panels with two side-by-side JSON editors (schema and form definition).

### Wiring

```typescript
// In useRef init block:
const schemaFieldsControl = controlContext.newControl<SchemaField[]>(
  personSchema().children,
);
const formDefControl = controlContext.newControl<ControlDefinition>(
  personFormDef(),
);

const schemaNode = createReactiveSchemaNode(schemaFieldsControl);
const dataNode = createSchemaDataNode(schemaNode, rootControl);
const formNode = createReactiveFormNode(formDefControl);
const globals: FormStateGlobals = { ctx: controlContext, clearHidden: true };
const formStateNode = createFormStateNode(formNode, dataNode, globals);

stateRef.current = {
  rootControl,
  formStateNode,
  schemaFieldsControl,
  formDefControl,
};
```

### JSON editors

Two textareas (or controlled inputs) that:
1. Display `JSON.stringify(control.valueNow, null, 2)`
2. On change, parse and `setValue`:
   ```typescript
   onChange={(e) => {
     try {
       const parsed = JSON.parse(e.target.value);
       controlContext.update((wc) => wc.setValue(schemaFieldsControl, parsed));
     } catch {
       // Show parse error indicator, don't update control
     }
   }}
   ```

The textareas need to be reactive components (wrapped in `controls()`) so they reflect changes from both directions — user typing and external control updates.

Need to handle the "controlled textarea" problem: while the user is editing, we don't want the control value to snap the textarea back. Solution: use local state for the text, sync to control on blur or debounced, sync from control when not focused.

### Schema-data sync issue

When the schema changes (fields added/removed/renamed), the existing data control may have stale structure. For the dev app, this is acceptable — the data keeps its existing shape and new fields get `undefined` values via lazy control creation.

---

## Phase 5: Testing

**File**: `packages/forms-core/test/reactiveSchemaNode.test.ts` (new)

1. **Basic reactive SchemaNode**: Create control, wrap in `createReactiveSchemaNode`, verify `getField`/`getChildren`/`getChildNode` work
2. **Fine-grained propagation**: Change one field in the array, verify only that node's `getField(rc)` returns new value
3. **Structural changes**: Add/remove fields from array, verify `getChildren` updates
4. **Compound nesting**: Test nested CompoundFields with reactive children

**File**: `packages/forms-core/test/reactiveFormNode.test.ts` (new)

1. **Basic reactive FormNode**: Create control, wrap in `createReactiveFormNode`, verify `getDefinition`/`getChildren`
2. **Null children**: Test definition with `children: null`
3. **Children added/removed**: Modify children array reactively

**File**: `packages/forms-core/test/formStateNodeReactive.test.ts` (new)

1. **FormStateNode with static FormNode**: Verify backward compatibility via `staticFormNode`
2. **FormStateNode with reactive FormNode**: Toggle `required`, `hidden`, `disabled` reactively — verify FormState updates
3. **Reactive children**: Add/remove children from definition, verify FormStateNode children update
4. **Full pipeline**: Reactive schema + reactive form def + FormStateNode — edit JSON, verify form state

---

## Edge Cases and Mitigations

### Index-based element reconciliation

The control tree reconciles array elements by index. If fields are reordered in JSON, element controls at each index get new values. `FormStateNodeImpl` reconciles by key (field name), so reused nodes must update their `formNode` reference (see Phase 3 `initChildren` discussion above).

### Equality and re-renders

The default `ControlContext.equals` uses `deepEquals`. When parsing JSON, all objects are new references, but deep equality prevents spurious updates for unchanged subtrees. This is critical for fine-grained reactivity — without deep equality, every node would re-fire on any JSON edit.

### Type guards on control values

`isCompoundField(field)` and `isDataControl(def)` work correctly because `rc.getValue(control)` returns the plain value. No proxy or wrapper issues.

### `Control<T>.fields.children` typing

`fields` returns a `ControlFields<V>` proxy. For `Control<SchemaField>`, accessing `.fields.children` returns `Control<SchemaField[] | undefined>` (since not all SchemaFields have children). We assert `as Control<SchemaField[]>` after verifying `isCompoundField`. Safe because the type guard confirms the property exists.

### initChildren always registering

Previously `initChildren` had an early return `if (!childDefs?.length) return` that skipped effect registration entirely. Now the effect always registers since children may appear reactively. The effect body exits early when both `childFormNodes.length === 0` and `this.childEntries.length === 0`, so the cost for childless nodes is one lightweight effect that reads `formNode.getChildren(rc)` (one Structure dependency) and returns immediately.

### FormStateNode `formNode` mutability

`formNode` must become mutable (not `readonly`) so `initChildren` can update it on child reuse after reordering. This is a minor API change but only affects the internal implementation.

---

## Files Modified

| File | Change |
|------|--------|
| `packages/forms-core/src/schemaNode.ts` | Add `ReactiveSchemaNodeImpl`, `RootReactiveSchemaNode`, `createReactiveSchemaNode` |
| `packages/forms-core/src/formNode.ts` | **New file** — `StaticFormNodeImpl`, `ReactiveFormNodeImpl`, `staticFormNode`, `createReactiveFormNode` |
| `packages/forms-core/src/formStateNode.ts` | Refactor to take `FormNode`, update all init methods |
| `packages/forms-core/src/index.ts` | Add exports for new APIs |
| `apps/dev/src/app/tree/page.tsx` | Add JSON editors, wire reactive nodes |
| `packages/forms-core/test/` | New test files |

## Verification

1. `rush build` — all packages compile
2. `rushx test` in `packages/forms-core` — new tests pass
3. Dev app (`apps/dev`) — navigate to `/tree`:
   - Form renders and works as before
   - Edit schema JSON → form structure updates reactively
   - Edit form definition JSON → form UI updates reactively
   - FormStateNode tree inspector shows live state changes
   - Raw control tree shows fine-grained updates (only changed nodes flash)
