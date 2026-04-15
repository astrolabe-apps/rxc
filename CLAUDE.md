# CLAUDE.md

## What is this?

RXC is a Rush monorepo for reactive controls and schema-driven forms. It unifies packages previously spread across `@astroapps/*` and `@react-typed-forms/*` under the `@rxc/*` npm scope.

## Packages

| Package | Dir | Purpose |
|---|---|---|
| `@rxc/controls-core` | `packages/controls-core` | Pure TypeScript control tree. No React, no globals. Zero dependencies. |
| `@rxc/controls` | `packages/controls` | React adapter: `controls()` wrapper, `ControlContextProvider`. Re-exports all of controls-core. |
| `@rxc/forms-core` | `packages/forms-core` | Full canonical schema types (SchemaField, ControlDefinition) + persistent SchemaNode/DataNode/FormNode handles with cursor-based reactive traversal. FormStateNode and expression evaluation not yet migrated. |
| `@rxc/forms` | `packages/forms` | Schema-driven rendering. **Not yet implemented — needs design doc first.** |
| `@rxc/compat-controls` | `packages/compat-controls` | Legacy compat for `@react-typed-forms/core` consumers. **Not yet implemented.** |
| `@rxc/compat-forms` | `packages/compat-forms` | Legacy compat for `@react-typed-forms/schemas` consumers. **Not yet implemented.** |
| `rxc-dev-app` | `apps/dev` | Next.js 16 playground with Tailwind CSS. Has simple form demo (`/`) and tree visualizer (`/tree`). |

## Commands

```bash
rush update          # Install/update all dependencies
rush build           # Build all packages
rush build --to X    # Build package X and its deps
rush test            # Run tests across all packages

# Inside a package dir:
rushx test           # Run that package's tests
rushx test:watch     # Watch mode
```

## Architecture

### Core design principles

1. **No globals** — all state is explicit. ControlContext instances are passed, not ambient.
2. **Explicit reactivity** — reading through `ReadContext` registers dependencies. Writing through `WriteContext` batches notifications.
3. **React is an adapter** — the core library (`controls-core`) has zero React dependency. The `controls()` wrapper in `@rxc/controls` injects ReadContext/WriteContext into render functions.
4. **ESM only** — all packages use `"type": "module"`.

### Dependency graph

```
@rxc/controls-core        (pure TS, no deps)
    ↑
@rxc/controls              (+ react peer dep)
    ↑
@rxc/forms-core            (controls-core + jsonata, uuid)
    ↑
@rxc/forms                 (controls + forms-core + react)
```

### Internal subpath export

`@rxc/controls-core/internal` exposes `ControlImpl`, `toImpl`, `WriteContextImpl`, `TrackingReadContext`, `SubscriptionReconciler`, etc. This is for sibling packages (`@rxc/controls`, compat layers) only — not public API.

## Design documents

All in `docs/`:

- **CONTROL-SEMANTICS.md** — The authoritative reference for control tree behavior: value propagation, error handling, dirty/touched/disabled cascading, element lifecycle, null materialization. **These semantics are settled and must be preserved.**
- **FORM-SEMANTICS.md** — The authoritative reference for form state behavior: FormStateNode lifecycle, visibility/disabled/readonly cascading, children resolution, data node syncing, script overrides. **These semantics are settled and must be preserved.**
- **FUTURE-API-DESIGN.md** — The three-package architecture, ReadContext/WriteContext design, controls() wrapper rationale.
- **FORM-FUTURE-API-DESIGN.md** — FormStateNode/FormState design: stable reactive handles with `getState(rc)`/`getChildren(rc)`, no exposed Controls, SchemaNode/DataNode/FormNode persistent handles with cursor-based `ReadContext` traversal.
- **IMPLEMENTATION-PLAN.md** — Original step-by-step migration plan from the controls-api prototype.

## Constraints

### JSON format compatibility

`@rxc/forms-core` must serialize ControlDefinition, SchemaField, and all their subtypes to the **exact same JSON** as the existing `@astroapps/forms-core`. These types use `type`-field discriminated unions. The C# server (`Astrolabe.Schemas`) generates this format — both ends must agree.

Reference for the canonical types: `astrolabe-common/forms/core/src/controlDefinition.ts` and `schemaField.ts`.

### Settled semantics (do not change)

Everything documented in `docs/CONTROL-SEMANTICS.md` is locked:
- Bidirectional value propagation with cycle prevention
- WriteContext transactional batching with NotifyFn pattern
- Bitmask-based change detection (ControlChange enum)
- Lazy child creation (eager for validators)
- Tree-level equality via ControlContext

FormStateNode design (see `docs/FORM-FUTURE-API-DESIGN.md`):
- `FormStateNode` is a persistent handle; `getState(rc)` returns `FormState` with fine-grained reactive property access
- `getChildren(rc)` lazily creates and reactively maintains child list
- `SchemaNode`, `DataNode`, `FormNode` are persistent handles identified by `id`; `cursor(rd)` returns ephemeral cursors for `ReadContext`-based traversal
- Cursors (`SchemaCursor`, `DataCursor`, `FormCursor`) are only valid within the `ReadContext` that created them
- `DataCursor` navigates via `childField(name)` and `childElement(index)`
- `FormState` exposes `data?: Control<unknown>` and `field?: SchemaField` directly (optional — not all definitions bind to data)
- No `Control<T>` exposed for form state internals — all reactive reads go through `ReadContext`

### Open for redesign

- Public API naming and surface
- Rendering architecture (`@rxc/forms`) — the existing `FormRenderer` interface is being replaced
- Component composition patterns (labels, layouts, adornments, visibility)
- How form context flows to renderers (context vs props)
- Editor-mode reactive proxies for `SchemaField`/`ControlDefinition` (how `trackedValue` adapts to explicit `ReadContext`)

## Completed

### Phase 1–2: @rxc/controls-core + @rxc/controls

Fully implemented with 51 tests. Core control tree, reactive ReadContext/WriteContext, computed/effect primitives, React `controls()` wrapper.

### Phase 3a: @rxc/forms-core (types only)

- Full canonical `SchemaField`, `ControlDefinition` types and all subtypes (matching C# server JSON format)
- Type interfaces for `SchemaNode`, `SchemaCursor`, `DataNode`, `DataCursor`, `FormNode`, `FormCursor`, `FormStateNode`, `FormState`
- `cursorUtils.ts` — utility functions for traversing cursors (schema/data/form navigation, path resolution)

### Phase 3b (partial): @rxc/forms-core node implementations

- `SchemaNode`/`SchemaCursor` — reactive schema tree traversal, compound field reference resolution, resolver factory with caching
- `DataNode`/`DataCursor` — data-bound traversal with `childField()`/`childElement()` navigation, lazy child node creation (replaces the old `SchemaDataNode` concept — persistent handle + ephemeral cursor split mirrors `SchemaNode`/`FormNode`)
- `FormNode`/`FormCursor` — control definition tree traversal, local and cross-tree `childRefId` resolution, resolver factory with caching
- 65 passing tests covering all three node types

### Phase 6 (partial): Dev app

- `/` — Simple form demo (validation, dirty/clean, submit/reset) using controls-core directly

## Next steps

### Phase 3b (remaining): FormStateNode

Implement `createFormStateNode` — reactive form state with `getState(rc)`, `getChildren(rc)`.

Key pieces:
- Computed properties (visible, disabled, readonly) with parent cascade
- Sync effects: disabled push to data control, touched bidirectional sync, error mirroring, default value application, required validation
- `onlyForTypes` support for type-discriminated fields
- `dataNode?: DataNode` exposed on the handle, `field`/`data` exposed on `FormState`
- Children lifecycle (lazy creation, reactive maintenance, cleanup on detach)
- Script override layer (expression evaluation — depends on Phase 3c or can be stubbed initially)

Also remaining in 3b:
- Wire up `index.ts` exports for `createSchemaNode`, `createDataNode`, `createFormNode`, `createFormStateNode`
- Fix `throw new ReactiveFormNode` → `return` bug in `formNode.ts:313`
- Replace brute-force `childRefId` scans with reactive indexed lookup (two TODOs in `formNode.ts`)
- `/tree` dev app demo — 3-panel tree visualizer (depends on FormStateNode)

### Phase 3c: Expression evaluation

Migrate `evalExpression.ts` from `astrolabe-common/forms/core/src/`. Add `jsonata` as a direct dependency. This enables dynamic property expressions in ControlDefinition (visibility, disabled, etc. driven by data expressions).

### Phase 4: @rxc/forms (renderer redesign)

Write a design doc first (`docs/RENDERER-DESIGN.md`) before implementing. Key questions to resolve:
- How do renderers register for specific control/render types?
- How does `controls()` integration work for every renderer component?
- How do labels, layouts, adornments, and visibility compose?
- How should different UI libraries (Tailwind, MUI, React Native) plug in?

### Phase 5: Legacy compat packages

- `@rxc/compat-controls` — Monkey-patches `Control.prototype` to restore `.value`, `.touched` getters, `useControl()` hook, `Finput`/`Fselect`/`Fcheckbox` components, global transaction machinery.
- `@rxc/compat-forms` — Wraps `@rxc/forms` with the old `createFormRenderer()` / `FormRenderer` interface.

## Testing

- **Framework**: Vitest + fast-check (property-based testing)
- **Location**: `test/` dir in each package
- **Config**: `vitest.config.ts` per package
- Tests exist for `@rxc/controls-core` (51 tests covering core control behavior, object fields, arrays, errors, reactive proxy). Other packages need tests as they're implemented.
