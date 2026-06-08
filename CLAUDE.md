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
| `@rxc/forms` | `packages/forms` | HTML platform package on top of forms-react-core. Provides `<Form>`/`<Field>`/`<Label>`/`<Error>`/`<Layout>`/`<Visibility>`, all default data + group + display + adornment renderers, and `defaultRegistry()`. Re-exports the headless surface so consumers import from `@rxc/forms` only. |
| `@rxc/forms-motion` | `packages/forms-motion` | Optional Framer Motion add-on. Ships `FadeVisibility`, `SlideVisibility`, and `MotionAccordionAdornment` to upgrade the no-op default Visibility / native `<details>` accordion. |
| `@rxc/forms-dnd` | `packages/forms-dnd` | Optional dnd-kit add-on. Ships `SortableArrayRenderer` for reorderable arrays. |
| `@rxc/forms-datagrid` | `packages/forms-datagrid` | Optional DataGrid add-on. Ships `dataGridRegistry()` — a `renderOptions.type === "DataGrid"` data renderer + `ColumnOptions` adornment, layered on the framework-agnostic published `@astroapps/datagrid` base grid. **Display-only scope** (columns + rows from the bound array); add/remove/edit actions and search/filter/sort wiring are not yet ported. |
| `@rxc/compat-controls` | `packages/compat-controls` | Legacy compat for `@react-typed-forms/core` consumers. **Not yet implemented.** |
| `@rxc/compat-forms` | `packages/compat-forms` | Legacy compat for `@react-typed-forms/schemas` consumers. **Not yet implemented.** |
| `rxc-dev-app` | `apps/dev` | Next.js 16 playground with Tailwind CSS. Routes: `/` simple controls demo, `/tree` FormStateNode visualizer, `/showcase` kitchen-sink renderer demo, `/interactive` tabs/dialog/accordion/async-action demo, `/designer` plugin + design-mode demo. |
| `rxc-legacy-buttons-demo` | `apps/legacy-buttons` | Visual baseline for `ButtonAction` parity — renders legacy button variants via the published `@react-typed-forms/schemas-html` so the rxc `ButtonAction` renderer can be checked side-by-side. |
| `rxc-legacy-compare-demo` | `apps/legacy-compare` | Renders the canonical "Fire" form using the published legacy `@react-typed-forms/schemas` (port 3002). Loads the same `Fire.json`, the same `bootstrap.min.css` + `theme.css` baseline as the legacy ServiceTas portal — the reference rendering that `rxc-compare-demo` is compared against. |
| `rxc-compare-demo` | `apps/rxc-compare` | Mirrors `legacy-compare` via `@rxc/forms` (port 3003). Same `Fire.json`, same schemas, same CSS baseline. Drives upstream `@rxc/*` API improvements whenever the port hits a gap (see "Comparison-app workstream" below). |

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
- **MIGRATION-FROM-LEGACY.md** — Rosetta stone for porting hosts and custom renderer sets from `@react-typed-forms/schemas` + `@react-typed-forms/schemas-html` onto `@rxc/forms` + `@rxc/forms-react-core`. Maps every legacy registration shape, hook, and slot to its new equivalent, calls out mechanical ports vs translations, and lists known gaps. The renderer engine itself has no design doc — the implementation in `packages/forms-react-core/src` and `packages/forms/src` is the source of truth.
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

### No deprecations — `@rxc/*` is pre-release

The `@rxc/*` packages haven't been published. Don't add `@deprecated` aliases, "legacy" re-exports, backwards-compat shims, or rename-with-pointer transitions when refactoring the public surface. Just change the name / shape and update every call site. The dedicated `@rxc/compat-controls` and `@rxc/compat-forms` packages exist for legacy `@react-typed-forms/*` consumers — that's the only place compat shims belong.

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

Implementation plan in `~/.claude/plans/what-are-your-throughts-dynamic-origami.md`. The implementation in `packages/forms-react-core/src` and `packages/forms/src` is the source of truth; legacy → new mapping for porting hosts is in `docs/MIGRATION-FROM-LEGACY.md`.

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
  - `controls-core`: **54** (uniqueId determinism)
  - `forms-core`: **110** (+3 acquireDisabler / disabler stack)
  - `forms-react-core`: **47** (+1 multi-kind adornment registration)
  - `forms`: **36** (+6 new renderers — Jsonata / ElementSelected / ScrollList / Wizard / ArrayElement levels)
  - `forms-datagrid`: **3** (display-only resolver: rows×columns, empty, reactive add)

## Comparison-app workstream

The `apps/legacy-compare` + `apps/rxc-compare` pairing exists to validate that the rxc renderer set can reproduce the legacy `@react-typed-forms/schemas`-html rendering of real-world forms (currently just the "Fire" registration form from ServiceTas) **and to drive upstream API improvements in `@rxc/*` whenever the port hits a gap.**

### Goals

1. **Visual parity on the Fire form.** Both apps share the same `Fire.json` definition, the same generated `schemas.ts` (import path swapped to `@rxc/forms-core` in the new app), and the same `bootstrap.min.css` + `theme.css` baseline. Run side-by-side: legacy on port 3002, rxc on port 3003.
2. **Use the comparison to find missing capabilities in `@rxc/forms`.** Each parity gap is evaluated for whether it's host-specific (handle in the compare app's customizations) or a missing core capability (extend `@rxc/forms`, update `docs/MIGRATION-FROM-LEGACY.md`, then use the new API in the compare app).

### Upstream changes already driven by this work

- **`@rxc/forms`: swappable `Label` / `Error`.** Added `LabelProvider` + `useLabel()` and `<Form label={MyLabel}>` so hosts can swap the label component without rebuilding Field. Same pattern for `Error`: `DefaultError` + `ErrorProvider` + `useError()` + `<Form error={MyError}>`. `FieldProps` and `FormProps` gained matching `label?` / `error?` slots for per-Field overrides. (No back-compat `Label`/`Error` aliases — per the Constraints "No deprecations" rule, the old names were just deleted.)
- **`@rxc/forms`: `theme.label.groupClassName` + `isGroupLabel()` predicate.** `DefaultLabel` now layers `theme.label.groupClassName` on top of `theme.label.className` whenever the rendered control is group-shaped (`type: "Group"` definitions OR compound Data controls with `renderOptions.type === "Group"`). Mirrors the legacy `DefaultRendererOptions.label.groupLabelClass` slot. The `isGroupLabel(def)` predicate is exported so custom `<Label>` components can reuse it.
- **`@rxc/forms-react-core`: `useFormErrors(rc, node)`.** Recursive walker returning `FormError[]` (`{ node, uniqueId, error }`) — one entry per touched descendant with a published validation error. Skips hidden subtrees (`visible === false`) so messages don't surface for fields the user can't see. Replaces hand-rolled walkers in error-summary panels.
- **`@rxc/forms-core`: resolver factories exported.** `createSchemaTreeResolver` and `createFormTreeResolver` (plus their `SchemaTreeFactory` / `FormTreeFactory` types) are now re-exported from `nodes/index.ts`. Hosts that previously inlined a cached `Record<string, SchemaField[]> → SchemaTree` resolver can drop the boilerplate.
- **`@rxc/forms`: Radio / Checklist render `entryWrapperClass` + `selectedClass` / `notSelectedClass` + per-option children.** `RadioRenderer` and `ChecklistRenderer` now read `entryWrapperClass` / `selectedClass` / `notSelectedClass` from the form definition's `renderOptions` (typed via `RadioButtonRenderOptions` / `CheckListRenderOptions`), layered with matching theme slots on `HtmlOptionGroupTheme`. Each option's wrapper `<div>` carries those classes, and the per-option children that `defaultResolveChildren` already spawns (keyed by `meta.fieldOptionValue`) are rendered inside the wrapper via `<Field>` — matching the legacy `fieldOptionAdornment(p)` + `HtmlCheckButtons` shape. Outer `<fieldset>`/`<legend>` retained for a11y.
- **`@rxc/forms-react-core` (`useFormStateNode`): deferred `runAsync` queue.** Mirrors the legacy `useAsyncRunner` from `astrolabe-common/schemas/src/RenderForm.tsx`: `runAsync` callbacks fired during render are queued on a stable component-scoped ref, then drained inside a `useEffect` after React commits. This is what keeps SSR snapshots and the first client hydration in agreement when Jsonata scripts would otherwise resolve via `queueMicrotask` between SSR HTML ship and CSR commit — a hydration-mismatch trap that surfaced the first time a `Display`-typed Jsonata script ran during initial render. Custom runners can still be supplied via `options.runAsync` for tests.
- **`@rxc/forms`: display renderers wrapped in `controls()` and read through `node.getState(rc).definition`.** `HtmlDisplayRenderer`, `TextDisplayRenderer`, `IconDisplayRenderer`, and `CustomDisplayRenderer` are now `controls()`-wrapped and ignore the `data` prop's properties for reactive reads — they re-resolve through their own `rc` from `node.getState(rc).definition.displayData`. The `data` prop is bound to the dispatching Field's rc, whose `reconcile()` has already happened by the time the renderer body runs; reads through it never establish subscriptions. Reading via the renderer's own rc is the working contract. All three also layer `definition.styleClass` over the theme class via `rendererClass`, matching legacy `rendererClass(className, options.htmlClassName)`.
- **`@rxc/controls-core`: `ReadContext.isFinalized` + render-window enforcement.** `TrackingReadContext` flips a `rendering` flag back to false in `finalize()` (called by the React `controls()` wrapper immediately after `reconciler.reconcile()`). While finalized, `track()` returns the impl without mutating `tracked`, so escaped-proxy reads can no longer corrupt the next render's subscription set. Reads still return current values (event handlers, refs, etc. work). `noopReadContext.isFinalized` is permanently `true`.
- **`@rxc/forms-core` (`createOverrideProxy`): dev-mode escape warning.** The scripted-override proxy now checks `rc.isFinalized` on each scriptable property read; if true, a one-per-call-site `console.warn` fires explaining the read landed past the owning rc's reconcile window and the consumer won't re-render on script updates. Includes a call-site stack frame and a one-line fix recipe (wrap the consumer in `controls()` and read via `node.getState(rc)`).

### Known gaps still to address

Each of these is a candidate for upstream support; the compare app currently works around them locally.

- **`HtmlDisplayRenderer` does not parse anchor `href` for action dispatch.** Legacy's HtmlDisplay parses `<a href="https://action/...">` to intercept clicks and dispatch via the renderer set. Fire doesn't use this, so the compare app skips it; would be a small extension via `<ActionScope>` + `useActionHandler` if/when a form needs it.
- **HelpText popover variant.** The default `HelpTextAdornment` in `@rxc/forms` emits inline `<p>` text. The legacy ServiceTas theme uses a Radix Popover with an info-circle trigger. The compare app ships its own `PopoverHelpTextAdornment` (Radix + FontAwesome) and registers it before `defaultRegistry()` so it shadows the default. Either pattern is valid; the popover variant could ship as an opt-in alternative in `@rxc/forms` or a future `@rxc/forms-radix` companion.
- **No "labelContainer" hook in `DefaultLayout`.** Legacy `DefaultRendererOptions.label.labelContainer` wrapped label + label-adornments in a flex row. The compare app's `HtmlLayout` re-implements this by wrapping the `label` prop in a `<div class="flex gap-4 items-baseline flex-wrap">`. A theme slot (`theme.label.containerClass` or a `labelContainer` render function) would avoid the host-side Layout rewrite.

### Workflow when porting reveals a gap

1. Try to satisfy the gap with existing `@rxc/forms` extension points (theme, providers, plugin registrations, custom renderer).
2. If that ends up duplicating substantial work from `@rxc/forms` source, treat it as a signal that the core is missing a slot. Add the slot upstream — keep the change small, document it in `docs/MIGRATION-FROM-LEGACY.md` if it shifts the legacy→new mapping, and add a test.
3. Strict-mode safety: `apps/rxc-compare` runs with `reactStrictMode: true`. The legacy lib isn't strict-safe (`apps/legacy-compare/next.config.mjs` flips it off) but the rxc lib should remain so — preserve this baseline. SSR + first render is green; full validation requires browser-side interaction (mount/unmount transitions) once parity work resumes.

## Next steps

### Phase 4b — additive renderer features ✅

All shipped. Notes on the moving pieces:

- **Multi-error rendering** — `<Error all>` per-call or `HtmlFormOptions.showAllErrors` form-wide. Renders a `<ul>` of `rc.getErrors(data)`.
- **Full `useExpression` evaluator** — wraps `defaultEvaluators` from forms-core. Allocates a result Control per call site, registers the evaluator on mount + when `expr` identity changes, returns `rc.getValue(container)`. Async (Jsonata) updates land via `returnResult` and re-render through the rc subscription. Variables are read once at registration via `noopReadContext` — the function reference is stable across the form's lifetime.
- **`JsonataRenderer`** — `DataRenderType.Jsonata` → renders the result as HTML (`dangerouslySetInnerHTML`). Memoizes the expression object by string content so `useExpression` doesn't re-register every render.
- **`ElementSelectedRenderer`** — `DataRenderType.ElementSelected`, `hidesLabel`. Resolves `elementExpression` via `useExpression`, toggles array membership.
- **`OptionalAdornment.editSelectable`** — adds an "Edit" toggle alongside the null toggle. Toggle state lives on a per-node Control via `node.ensureMeta("$optional/editing", …)`. While not editing, an effect calls `node.setForceDisabled(true)` so the inner cascade picks it up.
- **`LabelStart`/`LabelEnd` placements** — `AdornmentRegistration.kind` accepts an array. `wrapAdornments` filters by `kind` membership and threads the active `kind` into `AdornmentRenderProps` so the render fn can branch. HelpText + Icon now register for both `["label", "control"]`.
- **`acquireDisabler` + disabler stack** — counter field `disablerCount` on FormStateBaseImpl. Cascade treats `disablerCount > 0` as forced disabled (alongside `forceDisabled`). `Self` increments on the node, `Global` walks to the root of the form state tree (matching legacy `getDisabler(Global)` semantics). `useAsyncAction` accepts a `disableType` param; `ButtonAction` passes the action's.
- **`WizardRenderer` + `useWizardController`** — `GroupRenderType.Wizard`. Hook exposes `currentPage` / `pageChildren` / `steps` / `next` / `prev` / `goToPage` / `validatePage`. Page index Control comes from `pageIndexField` resolution against the parent data cursor, falling back to a per-hook internal Control. Children with `placement: "leftNav" | "middleNav" | "rightNav"` are exposed separately for chrome around the page.
- **`ScrollListRenderer`** — `DataRenderType.ScrollList` on a collection. Reads `data.meta.$scrollList.{loading, hasMore}` (host-driven) and dispatches `bottomActionId` via `useActionHandler` when an `IntersectionObserver` sentinel becomes visible.
- **`ArrayElementRenderer`** — `DataRenderType.ArrayElement`. Two-level dispatch: array level routes to `ArrayRenderer`; per-element level (matched via `DataCursor.elementIndex`) routes to `ArrayElementRenderer`, which renders a one-line summary + Edit button popping a native `<dialog>`. `showInline: true` skips the dialog and renders children inline.
- **`@rxc/forms-motion`** — separate package. `FadeVisibility` / `SlideVisibility` (cross-fade / slide-down via `<AnimatePresence>` + `motion.div`); `MotionAccordionAdornment` replaces the native-`<details>` Accordion with a height-animated panel.
- **`@rxc/forms-dnd`** — separate package. `SortableArrayRenderer` mirrors `ArrayRenderer` and reorders via `wc.updateElements(arr, (elems) => arrayMove(elems, …))` driven by `@dnd-kit/sortable`. `dnd-kit` is a peer dep so apps that don't import this package don't pay for it.

### `@rxc/forms-datagrid` — display-only DataGrid port ✅

Port of the legacy `@astroapps/schemas-datagrid` `DataGridRenderer` (display-only subset), driven by the comparison-app workstream (ServiceTas `MrsDemeritsSummary` form).

- Depends on the **published** `@astroapps/datagrid` (1.2.0) base grid directly — it has zero Control/forms deps (only `react` + `clsx`), so no fork was needed.
- `dataGridResolveChildren` (registered via `dataPlugin`'s `resolveChildren` on render type `DataGrid`) expands the bound array into one `Contents`-group row per element; each row's `node: form` sources the grid's declared column controls, so `row.getChildren(rc)` yields the per-column cells bound to that element. This skips the legacy two-level (synthesized-headers-group + data-array) resolver — column header metadata is read directly from `definition.children` in the renderer. Mirrors the `resolveOptionChildren` pattern in `forms-core/src/nodes/resolveChildren.ts`.
- `createDataGridRenderer` (controls()-wrapped) maps each column definition → `ColumnDefInit` (title + `getColumnHeaderFromOptions` classes from the `ColumnOptions` adornment, `columnTemplate`), precomputes the `cellGrid` (rows × column cells) for closure-safe cell rendering via `<Field>`, and renders the base `<DataGrid>`.
- `ColumnOptions` adornment (`columnAdornment.ts`) ported verbatim (schema + `isColumnAdornment` + `getColumnHeaderFromOptions` + `defaultDataGridClasses`).
- Registration order matters: `combineRegistries(dataGridRegistry(), defaultRegistry())` so the `DataGrid` render type beats the default collection (Array) matcher.
- **Not ported (Phase B):** add/remove/edit array actions, `searchField` filter/sort (needs `@astroapps/searchstate` + `FilterPopover` + `SortableHeader`), `groupByField` row-spanning, per-column `visible`/`rowSpan` expressions, and the trailing delete-check column (legacy renders an empty `auto` column even in display-only; this port omits it). 3 integration tests in `packages/forms-datagrid/test`.
- Wired into both compare apps (`MrsDemeritsSummary` form, port 3002 legacy reference via `@astroapps/schemas-datagrid` 8.2.0 / port 3003 rxc) with a shared `sampleData` seed so the grid shows rows. SSR-verified: identical column templates (`1fr 1fr 3fr`), headers, and cell values across both.

#### DataGrid Phase B — pickup plan (not started)

Goal: make `RWVPRenewalSearch` (the third DataGrid form) work, which needs filter/sort + paging. Suggested order:

1. **searchstate dep.** Add published `@astroapps/searchstate` (2.0.0, zero deps) to `@rxc/forms-datagrid`. Provides `SearchOptions`, `setFilterValue`, `rotateSort`, `findSortField`.
2. **Missing forms-core helpers.** The legacy renderer's header/filter wiring uses `schemaDataForFieldRef`, `fieldPathForDefinition`, `schemaForFieldPath` — none exist in `@rxc/forms-core` yet. Either port them (small, schema-nav) or inline equivalents. `searchField` resolves a sibling `SearchOptions` control via `schemaDataForFieldRef(searchField, parentNode)`.
3. **FilterPopover + SortableHeader.** Port from `astrolabe-common/astrolabe-schemas-datagrid/src/{FilterPopover,SortableHeader,Popover}.tsx` (Radix popover, ~110 lines total). Wire into the base grid's `renderHeaderContent`.
4. **Array actions.** Port `createArrayActions` / `applyArrayLengthRestrictions` / `getLengthRestrictions` / `getExternalEditData` (currently MISSING in rxc) for add/remove/edit. The rxc `ArrayRenderer` has an inline `getLengthRange` to crib from.
5. **groupByField row-spanning + per-column `visible`/`rowSpan` expressions** via `runExpression` (last, only `MrsSummary`/`MrsDemeritsSummary` use rowSpan and they leave it empty `{}`).

Reference source: `astrolabe-common/astrolabe-schemas-datagrid/src/DataGridControlRenderer.tsx` (597 lines — the display-only subset is already ported; lines for filter/sort/actions are the remainder).

#### ServiceTas form-portability survey (reference)

One-time scan of all ~70 ServiceTas forms (`astrolabe/ServiceTas/ServiceTasAPI/NewClientApp/client-common/formDefs`) against the rxc default renderer set. **All expression types, dynamic property types, and validators are fully supported** — gaps are purely custom data renderers the host must provide. Unknown render types fall through to the Textfield catch-all (degrade, don't crash).

- **Clean (only rxc-supported features), good next ports:** `Burn` (65k, sibling of Fire), `MrsLicenceDetails`, `MrsRegistrationDetails`, `MrsRegistrationsSummary`, plus ~40 smaller forms.
- **Need custom renderers, grouped by missing capability:**
  - Payment widgets — `QuickstreamCC`/`QuickstreamPay` (TempPaymentForm, TUP, MrsLicenceRenewal, MrsRegistrationRenewal, ShortTermPermit). Third-party, not portable.
  - `Switch` (SecurityPreferences, NotificationPreferences, TuoPreferences, LinkMastWizard) — cheap win, likely a styled checkbox.
  - `AddressFinder` (Address, ShortTermPermit, PlatesPlusRegistrationWizard) — geocoding widget.
  - `DataGrid`+`Pager`+`ColumnOptions` (MrsSummary, MrsDemeritsSummary ✅ done display-only, RWVPRenewalSearch needs Phase B).
  - `Chart` (MrsSummary, MrsDemeritsSummary), `Map`/`MapPoints` (FireInitial, MastMooringPermitSummary) — viz widgets.
  - Long tail: `CopyableData`, `Tooltip`, `Spotlight`, `HtmlRenderer`, `displayData.Custom` (RWVPVerificationWizard already stubs some).

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
- Action stubbing in `/designer` could be a dedicated `<DesignActionScope>` rather than ad-hoc `<ActionScope onAction={() => true}>`
- `ScrollListRenderer` host data plumbing — `meta.$scrollList.{loading, hasMore}` is the contract; ship a small helper for hosts to keep that in sync with their data fetcher.
- Confirm `ButtonAction` visual parity with legacy `createButtonActionRenderer` on the `/buttons` demo page. The Font Awesome Kit is wired in (`apps/dev/src/app/globals.css` imports the same kit URL as the legacy formServer / storybook apps), so a side-by-side comparison against a legacy app should be like-for-like. Markup is intentionally lighter than legacy: a single `<button>` element (no `<div role="button">` for Group), `inline-flex items-center` defaults so icon+text align cleanly without consumer config, `gap`-based spacing rather than per-icon margin defaults. Class composition still follows legacy (`rendererClass(buttonClass, primary/secondary)`, `textClass` threading into the text span, `definition.styleClass`/`textClass` honoured). Things to eyeball: busy spinner swap, `ReplaceText` icon-only sizing, link-style underline metrics, FA vs Material glyph weight.
