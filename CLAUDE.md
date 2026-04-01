# CLAUDE.md

## What is this?

RXC is a Rush monorepo for reactive controls and schema-driven forms. It unifies packages previously spread across `@astroapps/*` and `@react-typed-forms/*` under the `@rxc/*` npm scope.

## Packages

| Package | Dir | Purpose |
|---|---|---|
| `@rxc/controls-core` | `packages/controls-core` | Pure TypeScript control tree. No React, no globals. Zero dependencies. |
| `@rxc/controls` | `packages/controls` | React adapter: `controls()` wrapper, `ControlContextProvider`. Re-exports all of controls-core. |
| `@rxc/forms-core` | `packages/forms-core` | Minimal schema types (SchemaField, ControlDefinition) + FormStateNode + SchemaDataNode. Expression evaluation not yet migrated. |
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
- **FORM-FUTURE-API-DESIGN.md** — FormStateNode design with single stateControl, computed properties, script overrides.
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
- FormStateNode with single stateControl and computed properties

### Open for redesign

- Public API naming and surface
- Rendering architecture (`@rxc/forms`) — the existing `FormRenderer` interface is being replaced
- Component composition patterns (labels, layouts, adornments, visibility)
- How form context flows to renderers (context vs props)

## Completed

### Phase 1–2: @rxc/controls-core + @rxc/controls

Fully implemented with 51 tests. Core control tree, reactive ReadContext/WriteContext, computed/effect primitives, React `controls()` wrapper.

### Phase 3a–3b: @rxc/forms-core (minimal schema types + FormStateNode)

Migrated from the `astrolabe-common/controls-api/src/lib/form/` POC:
- Minimal `SchemaField`, `ControlDefinition` types (subset — just enough for FormStateNode, not the full canonical types yet)
- `SchemaDataNode` with field path resolution and type discriminator support
- `FormStateNode` with computed visibility/disabled/readonly cascading, data sync effects, required validation, default values, child lifecycle

### Phase 6 (partial): Dev app

Both POC examples ported to `apps/dev/`:
- `/` — Simple form demo (validation, dirty/clean, submit/reset)
- `/tree` — 3-panel tree visualizer (FormStateNode-driven form, state tree inspector, raw control tree)

## Next steps

### Phase 3a (full): Canonical schema types

Migrate the full `ControlDefinition`, `SchemaField`, and all subtypes from `astrolabe-common/forms/core/src/controlDefinition.ts` and `schemaField.ts`. The current types in forms-core are a minimal subset — the full types define the JSON wire format and must match the C# server exactly.

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
