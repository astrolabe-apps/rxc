# CLAUDE.md

## What is this?

RXC is a Rush monorepo for reactive controls and schema-driven forms. It unifies packages previously spread across `@astroapps/*` and `@react-typed-forms/*` under the `@rxc/*` npm scope.

## Packages

| Package | Dir | Purpose |
|---|---|---|
| `@rxc/controls-core` | `packages/controls-core` | Pure TypeScript control tree. No React, no globals. Zero dependencies. |
| `@rxc/controls` | `packages/controls` | React adapter: `controls()` wrapper, `ControlContextProvider`. Re-exports all of controls-core. |
| `@rxc/forms-core` | `packages/forms-core` | Full canonical schema types + persistent SchemaNode/DataNode/FormNode handles, cursor-based reactive traversal, FormStateNode, validators, jsonata, scripted-proxy. |
| `@rxc/forms-react-core` | `packages/forms-react-core` | Headless React forms layer: registry, matchers, dispatch helpers, adornment composition, plugin builders, contexts (Registry/Options/ActionScope/DesignMode), and hooks (useFormStateNode/useLabelText/useExpression/useAsyncAction). No DOM-emitting components — platform packages provide those. |
| `@rxc/forms` | `packages/forms` | HTML platform package on top of forms-react-core. Provides `<Form>`/`<Field>`/`<Label>`/`<Error>`/`<Layout>`/`<Visibility>`, all default data + group + display + adornment renderers, and `defaultRegistry()`. Re-exports the headless surface so consumers import from `@rxc/forms` only. **Phase 4b backlog below.** |
| `@rxc/compat-controls` | `packages/compat-controls` | Legacy compat for `@react-typed-forms/core` consumers. **Not yet implemented.** |
| `@rxc/compat-forms` | `packages/compat-forms` | Legacy compat for `@react-typed-forms/schemas` consumers. **Not yet implemented.** |
| `rxc-dev-app` | `apps/dev` | Next.js 16 playground with Tailwind CSS. Routes: `/` simple controls demo, `/tree` FormStateNode visualizer, `/showcase` kitchen-sink renderer demo, `/interactive` tabs/dialog/accordion/async-action demo, `/designer` plugin + design-mode demo. |

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
@rxc/forms-react-core      (controls + forms-core + react, no DOM)
    ↑
@rxc/forms                 (HTML platform: components + renderers + adornments)
```

A future `@rxc/forms-native` would sit alongside `@rxc/forms`, depending on the same `forms-react-core` for dispatch + hooks but emitting React Native views/text instead of DOM.

### Internal subpath export

`@rxc/controls-core/internal` exposes `ControlImpl`, `toImpl`, `WriteContextImpl`, `TrackingReadContext`, `SubscriptionReconciler`, etc. This is for sibling packages (`@rxc/controls`, compat layers) only — not public API.

## Design documents

All in `docs/`:

- **CONTROL-SEMANTICS.md** — The authoritative reference for control tree behavior: value propagation, error handling, dirty/touched/disabled cascading, element lifecycle, null materialization. **These semantics are settled and must be preserved.**
- **FORM-SEMANTICS.md** — The authoritative reference for form state behavior: FormStateNode lifecycle, visibility/disabled/readonly cascading, children resolution, data node syncing, script overrides. **These semantics are settled and must be preserved.**
- **RENDERER-DESIGN.md** — The authoritative reference for the renderer engine across `@rxc/forms-react-core` (headless: registry, matchers, plugin helpers, contexts, hooks, adornment composition, action infra, design-mode) and `@rxc/forms` (HTML platform: Field/Form/Label/Error/Layout/Visibility, default renderers, default registry). **Phase 4a is settled; Phase 4b items are listed below.**
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

### Phase 3b: @rxc/forms-core node implementations ✅

- `SchemaNode`/`SchemaCursor` — reactive schema tree traversal, compound field reference resolution, resolver factory with caching
- `DataNode`/`DataCursor` — data-bound traversal with `childField()`/`childElement()` navigation, lazy child node creation; `DataCursor.schema: SchemaCursor` exposed so validators can navigate siblings
- `FormNode`/`FormCursor` — control definition tree traversal, local and cross-tree `childRefId` resolution, resolver factory with caching

### Phase 3b: `createFormStateNode` — Layer 1 ✅

- Persistent `FormStateNode` handle; `getState(rc)` returns a stateless `FormState` view bound to the given `ReadContext`; `getChildren(rc)` gives the live child list
- Child `base` Controls stored as elements of parent's `children` Control so valid/disabled/touched bubble up through the control tree natively (`$FormState` meta is the back-pointer — don't remove)
- Computeds: `dataNode` resolution (supports `.`/`..`/named), `visible` cascade, `disabled` cascade, `readonly` cascade
- Sync effects: `disabled → data`, `touched` bidirectional, errors mirrored from data → base, `clearHidden` + `defaultValue` cycle
- Lazy children via `effect`, diffed by `childKey`
- Array-element expansion via `DataCursor.childElement(i)`

### Phase 3b: Layer 2 — SchemaInterface + options + visibility gates ✅

- `src/schemaInterface.ts` — `SchemaInterface` + `DefaultSchemaInterface` (options, emptiness, compare, length, validation messages, date parsing)
- `src/cursorUtils.ts::validDataCursor` — `onlyForTypes` discriminator gate
- Visibility cascade steps 3 (`validDataCursor`) and 4 (`hideDisplayOnly`) wired
- `fieldOptions` on `FormState` computed with `allowedOptions` filter
- `CheckList` / `Radio` expansion in `defaultResolveChildren` — one child per option with `formData.option` + `formData.optionSelected` in `variables`

### Phase 3b: Layer 3 — Validators ✅

- `src/validators.ts` — `setupValidation`, `ValidationEvalContext`, `ValidatorEval`
- Built-in evaluators: `Length` (with array auto-pad preserving old semantics), `Date`, `Jsonata`
- `required` + `requiredErrorText` support; `validationEnabled = !!visible` gate suppresses errors on hidden nodes
- `Jsonata` validator evaluates against the parent data cursor and publishes the stringified result under the `"jsonata"` error key; publishing is gated by `validationEnabled` via a publisher effect

### Phase 3c: Layer 4a — Scripted proxy ✅

- `src/overrideProxy.ts` — rc-bound proxy with `NoOverride` sentinel, optional `nestedBuilders` for recursive compound wrapping
- `src/evalExpression.ts` — `Data`, `DataMatch`, `NotEmpty`, `UUID`, `Not` evaluators + `createEvalExpr` (handles `Not` unwrapping with coerce inversion)
- `src/scriptedProxy.ts` — `createEvaluatedDefinition` + `ScriptProvider`
- `src/legacyScripts.ts` — `buildLegacyScripts` converts legacy `dynamic[]` → `$scripts` bucket
- Each FormStateNode builds an `EvaluatedDefinition`; visible/disabled/readonly/fieldOptions/default-value computeds read through the rc-bound proxy
- Visibility cascade reverted to settled `hidden == null ? null : !hidden` — the scripted proxy pre-populates `_ScriptNullInit` fields to their coerced defaults, so `null` only flows through during genuinely pending async scripts

### Phase 3c: Layer 4b — Nested compound proxies + schema-driven walker ✅

- `src/json/schemaSchemas.ts` — ported verbatim from `astrolabe-common` (1705 lines). Provides `ControlDefinitionSchema` and `ControlDefinitionSchemaMap` as the self-describing metadata for scripting.
- `src/json/controlDefinitionSchemas.ts` — `Coerce` type + `coerceForFieldType` (shared helper)
- `src/json/schemaField.ts` — added `hasSchemaTag` helper
- `src/scriptedProxy.ts` — `createEvaluatedDefinition` now walks `ControlDefinitionSchema` recursively: discovers scriptable fields at every level (scalar + non-collection compound), uses `_ScriptNullInit` tags dynamically, allocates nested override controls via `overridesControl.fields.X` (lazy subcontrol nesting), and `subtreeHasScripts` gates recursion so compounds without scripts don't pollute `fieldsNow`. The old hardcoded `SCRIPTABLE_FIELDS` table is gone — user-extended `ControlDefinitionSchemaMap` entries work with no additional wiring.
- `src/overrideProxy.ts::createOverrideProxy` — accepts `nestedBuilders: Map<string, NestedProxyBuilder>`; the `get` trap wraps nested compound values via the builder when the override rollup would otherwise shadow them.
- `src/legacyScripts.ts` — `Display` and `GridColumns` now route to nested paths (`displayData.text`/`html`, `renderOptions.overrideText`, `groupOptions.columns`, `renderOptions.groupOptions.columns`), matching legacy `formStateNode.ts`.
- **Note:** collection-compound element scripting (legacy `wireProxies` mapping array elements through per-element proxies) is not ported — no scriptable fields currently live inside arrays on `ControlDefinition`. Extension point only.

### Phase 3c: Layer 4c — Jsonata ✅

- `src/evalExpression.ts::jsonataEval` — async evaluator. Builds the data path prefix via `getSchemaPath` (field/index segments, `#$i[N]` index syntax), wraps the root data proxy with `ensurePathNavigable` so jsonata can traverse null compound fields (jsonata issue #773), and runs `jsonata.evaluate()` against the rc-tracked data proxy.
- Async tracking: uses a dedicated `TrackingReadContext` + `SubscriptionReconciler` (via `@rxc/controls-core/internal`) because jsonata's async `.evaluate()` populates reads lazily through the data proxy — `effect`'s synchronous reconciliation cycle doesn't capture those. Changes detected by the reconciler abort any in-flight eval and queue a fresh run.
- `src/validators.ts::evalJsonataValidator` — wires `jsonataEval` against the parent data context; publishes error via a separate publisher effect so the `validationEnabled` gate and the async result are composed reactively.
- `src/nodes/formStateNode.ts` — `variables` now plumbed from the node's `FormNodeOptions` through `createEvaluatedDefinition`.
- **Variables reactivity:** `VariablesFunc` is `(rc: ReadContext) => Record<string, any>` — invoked with the same `TrackingReadContext` that drives jsonata's data reads, so reactive reads inside the producer (e.g. `optionSelected` derived from a data control via `rc.getValue`) trigger jsonata re-evaluation when their inputs change. `combineVariables` and `isOptionSelected` use the rc directly.

### Phase 4 — @rxc/forms (renderer) ✅

Implementation plan in `~/.claude/plans/what-are-your-throughts-dynamic-origami.md`. Design in `docs/RENDERER-DESIGN.md`.

#### Phase 4a-1: Skeleton + minimal renderers ✅
- `Form`, `Field` components; `useFormStateNode` helper; `FormRegistry`, `combineRegistries`, `defaultRegistry`; matcher types + sugar (`matchRenderType`, `matchSchemaType`, `matchAll`, `matchAny`, `matchHasOptions`, `matchCollection`, `matchCompoundField`, `matchAlways`)
- `DefaultLayout`, `DefaultVisibility`, `<Label>`, `<Error>`, `useLabelText`
- Phase-1 renderers: `TextfieldRenderer` (catch-all), `NumberRenderer` (Int/Double, parse-on-blur), `CompoundDelegate`, `StandardGroupRenderer`
- `id` prop on `DataRendererProps` (generated once per Field via `useId()`); `<Label htmlFor>` and `<Error id>` threaded from Field
- `ControlContext.uniqueId` counter moved off the module global onto `ControlContextImpl` — fresh contexts always start from 1, so SSR/hydration produce identical `Control.uniqueId`/`FormStateNode.uniqueId` sequences
- `/tree` page migrated to `<Form>`

#### Phase 4a-2: Full default renderer set ✅
- Data: `MultilineRenderer`, `BoolRenderer` (hidesLabel), `CheckboxRenderer` (alias), `DateRenderer`/`DateTimeRenderer`/`TimeRenderer`, `SelectRenderer` (with optgroup), `RadioRenderer` (hidesLabel, fieldset/legend), `ChecklistRenderer` (hidesLabel, array membership), `AutocompleteRenderer` (single-mode, no Downshift), `DisplayOnlyRenderer`, `ArrayRenderer` (renderer-internal `wc.addElement`/`wc.removeElement`)
- Group: `InlineGroupRenderer`, `FlexRenderer`, `GridRenderer`, `ContentsRenderer`, `SelectChildRenderer`
- Display: `TextDisplayRenderer`, `HtmlDisplayRenderer`, `IconDisplayRenderer` (FontAwesome/Material/CssClass), `CustomDisplayRenderer` (FormOptions.customDisplays)
- `useExpression(rc, node, expr)` — synchronous Data expressions only; Jsonata deferred
- Matcher ordering rules locked in by tests: `matchCompoundField` excludes the array node of a collection-compound (uses `DataCursor.elementIndex`); `matchCollection` excludes individual elements; explicit renderType matchers run before defaults so CheckList collection routes to ChecklistRenderer not ArrayRenderer; bare `matchHasOptions(SelectRenderer)` after explicit matchers handles options-bearing fields with no renderType
- `/showcase` page

#### Phase 4a-3: Adornments + complex groups + actions ✅
- Adornment system (`src/Adornment.tsx`): `AdornmentKind` (`label`/`control`/`field`), `AdornmentRegistration<A>`, `wrapAdornments` (priority asc + reduce so highest priority is outermost), `indexAdornments`
- Default adornments (`src/adornments/`): Icon, HelpText (placement-driven inline/block), Optional (allowNull checkbox), SetField (useExpression effect → sibling), Accordion (priority 1000, native `<details>`)
- Field's render now wraps: Visibility → field-kind adornments → Layout → control-kind adornments → renderer; label-kind adornments wrap the label inside Layout
- `<ActionScope>` context + `useActionHandler` ancestor walker + `runAsyncAction` / `useAsyncAction` (`.catch` + `.finally` so rejection releases busy)
- `ButtonAction` (icon placement variants, ActionStyle classes)
- Group: `TabsRenderer`, `AccordionGroupRenderer` (per-child native `<details>`), `DialogRenderer` (native `<dialog>` + ActionScope intercepts `openDialog`/`closeDialog`)
- `/interactive` page

#### Phase 4a-4: Plugins + design mode ✅
- `dataPlugin` / `groupPlugin` / `actionPlugin` / `displayPlugin` (`src/plugins.ts`) — emit `Partial<FormRegistry>`; `EditorPluginSlot` opaque carry-through
- `collectExtraRenderOptionFields(registry)` flattens schemaExtensions; `useFormStateNode` passes via `FormGlobalOptions.extraRenderOptionFields`
- forms-core change: `createEvaluatedDefinition` accepts `extraRenderOptionFields: SchemaField[]` — appended when buildLevel descends into the `renderOptions` compound, so plugin scriptable options register correctly
- forms-core fix: `createOverrideProxy` checks the nested-builder branch *before* the override-value branch so a partial nested override (e.g. `{ maxStars }`) doesn't shadow base compound fields (e.g. `renderOptions.type`)
- `DesignModeContext` + `useDesignMode()`; `Field` and `Form` accept `designMode?: boolean` prop that installs the provider
- `/designer` page: custom Stars data plugin with scripted `maxStars` option, design-mode toggle (DesignVisibility, ActionScope-stubbed actions, high-priority field-kind SelectionAdornment)

#### Tailwind v4 in dev app
`apps/dev/src/app/globals.css` registers `@source "../../../../packages/forms/src/**/*.{ts,tsx}"` so renderer utility classes from `@rxc/forms` are emitted into the generated stylesheet.

## Testing

- **Framework**: Vitest + fast-check (property-based testing)
- **Location**: `test/` dir in each package
- **Config**: `vitest.config.ts` per package
- Current counts:
  - `controls-core`: **54** (added uniqueId determinism tests)
  - `forms-core`: **107** (added 4 override-proxy regression tests)
  - `forms-react-core`: **46** (registry, matchers, adornments, useAsyncAction, plugins)
  - `forms`: **30** (builtins matcher ordering)

## Next steps

### Phase 4b — additive renderer features (deferred, none blocks the design)

- `WizardRenderer` (group) + `useWizardController` hook
- `ScrollListRenderer` (data, collection — IntersectionObserver + meta-driven loading state)
- `JsonataRenderer` (data) — needs full async expression evaluation through `useExpression`
- `ElementSelectedRenderer` (data, Bool)
- `ArrayElementRenderer` (data, dialog-based external edit)
- `OptionalAdornment.editSelectable` flag
- `LabelStart` / `LabelEnd` placements via `kind: "label"` adornment registration (HelpText + Icon currently defer these)
- Optional `@rxc/forms-motion` add-on package shipping `FadeVisibility`, `SlideVisibility`, animated `<Accordion>` (Framer Motion-based)
- Reorder support in arrays (separate `SortableArrayRenderer` consuming `dnd-kit`)
- Multi-error rendering primitive (Error currently shows the first error only)
- `acquireDisabler` + FormNodeUi disabler stack in forms-core — enables `disableType: "Form"` / `"Global"` for `useAsyncAction` (Phase 3 supports `Self` only)
- `useExpression`: handle Jsonata + DataMatch + NotEmpty + UUID + Not via the full forms-core evaluator (today only `Data` is wired)

### `@rxc/forms-editor` (visual designer, separate project)

The renderer engine already provides every hook the editor needs (no further `@rxc/forms` work required to start the port):
- Ambient `designMode` via `DesignModeContext`
- Selection chrome as a high-priority field-kind adornment (`/designer` page demonstrates the pattern)
- `<Form visibility={DesignVisibility}>` to render hidden fields anyway
- `<ActionScope onAction={() => true}>` to stub actions
- `EditorPluginSlot` on plugin specs — opaque carry-through for the editor package's typings
- Reactive definition input falls out of the rc-driven render pipeline; the only piece is exposing `ControlDefinition`/`SchemaField` as Controls (the `trackedValue` adaptation noted under "Open for redesign" — `@rxc/forms-core` work, not renderer work). `createReactiveFormTree` already does this for definitions.

Reference port target: `astrolabe-common/astrolabe-schemas-editor/src/`.

### Phase 5 — Legacy compat packages

- `@rxc/compat-controls` — Monkey-patches `Control.prototype` to restore `.value`, `.touched` getters, `useControl()` hook, `Finput`/`Fselect`/`Fcheckbox` components, global transaction machinery.
- `@rxc/compat-forms` — Wraps `@rxc/forms` with the old `createFormRenderer()` / `FormRenderer` interface. Mapping legacy `RendererRegistration[]` to new matcher functions; renderers that returned plain `ReactNode` port mechanically; renderers that mutated `ControlLayoutProps` need manual translation (documented limitation).

### Smaller follow-ups

- Replace brute-force `childRefId` scans with reactive indexed lookup (two TODOs in `forms-core/src/nodes/formNode.ts`)
- Consider re-adding `validDataCursor` result caching via `ensureMetaValue` on the data control (old code had per-control `validForSchema` cache; current port re-walks the parent chain per call)
- AccordionAdornment / AccordionGroupRenderer expanded state survives unmount/remount via `data.meta` (Phase 3 keeps it as React-local `useState`)
- ArrayRenderer reorder + per-row chrome customization
- ButtonAction supports `disableType: "Form"` / `"Global"` once forms-core gets `acquireDisabler`
- Action stubbing in `/designer` could be a dedicated `<DesignActionScope>` rather than ad-hoc `<ActionScope onAction={() => true}>`
