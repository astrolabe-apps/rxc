# CLAUDE.md

## What is this?

RXC is a Rush monorepo for reactive controls and schema-driven forms. It unifies packages previously spread across `@astroapps/*` and `@react-typed-forms/*` under the `@rxc/*` npm scope.

## Packages

| Package | Dir | Purpose |
|---|---|---|
| `@rxc/controls-core` | `packages/controls-core` | Pure TypeScript control tree. No React, no globals. Zero dependencies. |
| `@rxc/controls` | `packages/controls` | React adapter: `controls()` wrapper, `ControlContextProvider`. Re-exports all of controls-core. |
| `@rxc/forms-core` | `packages/forms-core` | Full canonical schema types + persistent SchemaNode/DataNode/FormNode handles, cursor-based reactive traversal, FormStateNode, validators, jsonata, scripted-proxy. |
| `@rxc/forms-react-core` | `packages/forms-react-core` | Headless React forms layer: registry, matchers, dispatch helpers, adornment composition, plugin builders, contexts (Registry/Options/ActionScope/DesignMode), hooks (useFormStateNode/useLabelText/useExpression/useAsyncAction/useFormErrors), and the `getExternalEdit` staged-edit controller accessor (a memoized get-or-create on the array Control's meta — deliberately **not** a `use*` hook). Also exports `<Action>` (the only "component" — a one-liner over `pickActionRenderer`). No DOM-emitting components — platform packages provide those. |
| `@rxc/forms` | `packages/forms` | HTML platform package on top of forms-react-core. Provides `<Form>`/`<Field>`/`<Label>`/`<Error>`/`<Layout>`/`<Visibility>`, all default data + group + display + adornment renderers, and `defaultRegistry()`. Re-exports the headless surface so consumers import from `@rxc/forms` only. |
| `@rxc/forms-motion` | `packages/forms-motion` | Optional Framer Motion add-on. Ships `FadeVisibility`, `SlideVisibility`, and `MotionAccordionAdornment` to upgrade the no-op default Visibility / native `<details>` accordion. |
| `@rxc/forms-dnd` | `packages/forms-dnd` | Optional dnd-kit add-on. Ships `SortableArrayRenderer` for reorderable arrays. |
| `@rxc/forms-datagrid` | `packages/forms-datagrid` | Optional DataGrid add-on. Ships `dataGridRegistry()` — `DataGrid` + `Pager` data renderers + `ColumnOptions` adornment, layered on the published `@astroapps/datagrid` base grid. Columns + rows from the bound array, column **filter/sort** header controls (driven by a sibling `SearchOptions` control via `searchField`), offset/length **paging**, per-column `visible`/`rowSpan` expressions, adjacent-key `groupByField` row-spanning, and **add/remove/edit** array actions including the **editExternal** modal-staged flow (via `getExternalEdit`): Add/Edit stage a draft, and the modal is hosted by a **sibling `renderType: ArrayElement` control** bound to the same array (the same two-sibling pattern `Array` uses — DataGrid does **not** self-host the modal). `clientSearchPage`/`fieldClientSearch`/`schemaClientSearch` helpers for client-side search (filters/sort/query). All buttons (Add/Edit/Remove + Pager prev/next) render via `<Action>` so hosts can override chrome per id via `matchActionId`. |
| `@rxc/compat-controls` | `packages/compat-controls` | Legacy compat for `@react-typed-forms/core` consumers. **Not yet implemented.** |
| `@rxc/compat-forms` | `packages/compat-forms` | Legacy compat for `@react-typed-forms/schemas` consumers. **Not yet implemented.** |
| `rxc-dev-app` | `apps/dev` | Next.js 16 playground with Tailwind CSS. Routes: `/` simple controls demo, `/tree` FormStateNode visualizer, `/showcase` kitchen-sink renderer demo, `/interactive` tabs/dialog/accordion/async-action demo, `/designer` plugin + design-mode demo, `/phase4b` motion/dnd add-ons, `/buttons` ButtonAction variants, `/externaledit` editExternal staged-edit modal. |
| `rxc-legacy-demos` | `apps/legacy-demos` | Standalone Next.js app (port 3001) hosting legacy reference renderings via the published `@react-typed-forms/schemas` + `@react-typed-forms/schemas-html` with `defaultTailwindTheme`. Routes: `/buttons` (ButtonAction parity baseline — pair with dev `/buttons`), `/externaledit` (editExternal modal baseline — pair with dev `/externaledit`). Add more pages here when a new rxc feature needs a side-by-side legacy comparison that doesn't fit the Fire-form-shaped `legacy-compare`. |
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

### Legacy semantics only — no extensions (current goal)

The renderer port (`@rxc/forms` / `@rxc/forms-react-core` / `@rxc/forms-datagrid`) is **replicating the behavior of the legacy `@react-typed-forms/schemas` + `@react-typed-forms/schemas-html` (+ `@astroapps/schemas-datagrid`) renderers — nothing more.** Each render type, adornment, and renderer must mean exactly what its legacy counterpart means.

**Do not invent new capabilities or overload a render type with a second meaning** while porting, even when a richer behavior seems obviously useful. If the legacy renderer for a given render type does one thing, the rxc renderer does that one thing; an input the legacy renderer ignores, rxc ignores too. When in doubt, open the legacy source (`astrolabe-common/schemas-html/src/components/*`, `astrolabe-common/astrolabe-schemas-datagrid/src/*`) and match it.

Extensions/divergences are a **separate, later** effort — flag them, don't slip them in. (Example of a divergence that was removed once caught: a `renderType: ArrayElement` element-level "summary + Edit button" renderer. Legacy `ArrayElement` means *only* the `editExternal` draft host — see `ArrayElementModalHostRenderer`. The known **intentional** divergence still in the tree — `ActionRendererProps.children` accepted for any action style, not just `Group` — is documented as a divergence on the `/buttons` demos.)

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
- `ButtonAction` (icon placement variants, ActionStyle classes). **Signature is plain-props `(props: ActionRendererProps) => ReactNode`** — see "Upstream changes" below for the post-Phase-4a refactor that moved actions off the node-driven shape onto the legacy plain-props shape.
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

#### Rendering performance — `Field` is `React.memo`-wrapped
`Field` (`packages/forms/src/Field.tsx`) is `memo(FieldRender)`. Because `FormStateNode` is a stable handle, the `node` prop is referentially stable, so a parent group re-rendering (child-list / visibility / disabled change) does **not** cascade into every descendant Field — each re-renders only when its own reactive subscription fires or its props change. Benchmarked in `packages/forms/test/memoBenchmark.test.tsx` (500-field form): a single field value toggle re-renders 1 field with or without memo (the reactive layer already isolates it), while an ancestor re-render drops from 500 renders → 0. This makes `Form`-provided context stability **load-bearing** (memo is a bailout boundary that context value changes punch through) — hence the stable `defaultRegistry()` / `options` fallbacks in `Form.tsx`. Don't memo `Layout`/`Label` (they take `ReactNode` children → shallow-compare always misses). The benchmark added `happy-dom` + `react-dom` devDeps to `@rxc/forms` and widened its vitest glob to `.test.{ts,tsx}`.

## Testing

- **Framework**: Vitest + fast-check (property-based testing)
- **Location**: `test/` dir in each package
- **Config**: `vitest.config.ts` per package
- Current counts:
  - `controls-core`: **54** (uniqueId determinism)
  - `forms-core`: **113** (+3 acquireDisabler / disabler stack)
  - `forms-react-core`: **61** (+14 getExternalEdit suite including sibling-FormStateNode controller sharing + session-staged Cancel/confirm actions)
  - `forms`: **45** (+1 `React.memo(Field)` render benchmark — mounts a 500-field form via `react-dom/client` + happy-dom and asserts value-toggle re-renders 1 field while an ancestor re-render bails out to 0)
  - `forms-datagrid`: **22** (+4 editExternal integration tests: draft form mirrors columns, add commit, edit commit-snapshot, edit cancel)
  - Known flaky: `controls-core` `general > can set computation` is a fast-check property test that occasionally fails on an unlucky seed and passes on re-run (pre-existing, seed-dependent).

## Comparison-app workstream

The `apps/legacy-compare` + `apps/rxc-compare` pairing exists to validate that the rxc renderer set can reproduce the legacy `@react-typed-forms/schemas`-html rendering of real-world forms (currently just the "Fire" registration form from ServiceTas) **and to drive upstream API improvements in `@rxc/*` whenever the port hits a gap.**

### Goals

1. **Visual parity on the Fire form.** Both apps share the same `Fire.json` definition, the same generated `schemas.ts` (import path swapped to `@rxc/forms-core` in the new app), and the same `bootstrap.min.css` + `theme.css` baseline. Run side-by-side: legacy on port 3002, rxc on port 3003.
2. **Use the comparison to find missing capabilities in `@rxc/forms`.** Each parity gap is evaluated for whether it's host-specific (handle in the compare app's customizations) or a missing core capability (extend `@rxc/forms`, update `docs/MIGRATION-FROM-LEGACY.md`, then use the new API in the compare app).

### Upstream changes already driven by this work

- **`@rxc/forms`: centralized default theme (`defaultHtmlTheme`) + merge-once.** Ported the legacy `@react-typed-forms/schemas-html` model where all default classes live in one object (`defaultTailwindTheme`) deep-merged with the host theme, and renderers read a single resolved slot per concern. Previously rxc scattered `DEFAULT_*` class constants across ~30 renderer files and each did its own `theme.X ?? DEFAULT_X` — and some layered extra state classes (e.g. input `VALID_BORDER`) *on top of* a slot, which leaked over a host's `inputClass` (the bug that started this). Now:
  - `src/defaultTheme.ts` exports `defaultHtmlTheme` (every default class string, one place) + `deepMergeTheme`.
  - `useHtmlTheme()` returns `deepMergeTheme(defaultHtmlTheme, hostTheme)`, **cached by host-theme object identity** (WeakMap) — the merge runs once per distinct theme object (once total for a stable module-const theme), shared across every renderer/render, not per call. No host theme → `defaultHtmlTheme` as-is.
  - Every renderer reads `theme.X` directly; no `DEFAULT_*` constants remain. Input valid/error/disabled/readonly are **state variants baked into the single `inputClass`** (`aria-invalid:` / `disabled:` / `read-only:`) rather than renderer-layered classes, so a host that sets `inputClass: "form-control"` fully owns the input chrome (no leak; matches legacy's single-class model). New theme slots added for renderers that lacked them (`data.arrayElement`/`scrollList`/`elementSelectedClass`, `group.wizard`, `group.accordion.sectionClass`, `helpText.inline/blockClass`, `optional.labelWrapClass`).
  - SSR-verified output unchanged across Fire / RWVP / MrsDemerits in the compare app; the `themedInput` band-aid from the parity fixes below is gone (subsumed).
  - **`HtmlFormTheme` is now fully required (no optional slots).** The type is the *resolved* theme — `defaultHtmlTheme: HtmlFormTheme` must fill every slot (TS enforces exhaustiveness; a new slot won't compile until defaulted), and renderers read `theme.X` with **no** `?? "fallback"` — the hardcoded-class fallbacks (and the text-content fallbacks `"*"`/`"—"`/`"Null"`) were removed and moved into the default. Slots with no default styling are `""`; genuinely-absent values (`action.icon`/`busyIcon`, `optional.customRender`) are typed `T | null` with a `null` default. Hosts pass a **`PartialHtmlFormTheme` (= `DeepPartial<HtmlFormTheme>`)** — `HtmlFormOptions.theme` and `deepMergeTheme`'s `over` param take the partial; `useHtmlTheme()` returns the required resolved type. One deliberate semantic shift: `data.select.className` now defaults to the concrete input chrome rather than inheriting `data.inputClass` via `??`, so a host overriding only `inputClass` no longer restyles selects (override `select.className` too). Every renderer reads the theme by **direct access** (`useHtmlTheme().data.array`) — the old defensive `?? {}` reads are gone, since the resolved theme is guaranteed complete.
- **RWVPRenewalSearch parity fixes (Phase B follow-up).** Driven by side-by-side comparison of the filter/sort/paging form:
  - **Pager buttons** (`@rxc/forms-datagrid`) originally composed `theme.action` classes onto bare `<button>`s. After the action-renderer signature refactor (see below), Pager renders prev/next via `<Action>` with action ids `pagerPrev` / `pagerNext` (exposed on `PagerClasses` for host override), so the host's matched action renderer draws the chrome — fully matching the legacy "pager routes prev/next through the host action renderer" model.
  - **Input border** (`@rxc/forms` Text/Number/Date/Select/Multiline/Autocomplete): a host's `inputClass` (e.g. `form-control`) owns the input border; rxc no longer layers its default `border-zinc-300` over it. (Superseded by the centralized-theme port above — the input chrome, including state borders, is now the single `inputClass` slot with state variants.)
  - **Flex group** (`@rxc/forms` `FlexRenderer`): dropped the hardcoded `flexWrap: "wrap"` so a Flex group defaults to nowrap like the legacy renderer.
  - **DateTime timezone** (`@rxc/forms-core` `DefaultSchemaInterface.parseToMillis`): a naive date-time (time component, no zone designator) is now interpreted as **UTC** (append `Z`), matching legacy `@internationalized/date` `parseDateTime(s).toDate("UTC")`. Without it, `DateTime` `toLocaleString()` output was shifted by the local offset. Date-only and zoned values are unaffected.
- **`@rxc/forms-core`: `SchemaInterface.textValue` + `@rxc/forms` DisplayOnly parity.** Added `textValue(field, value, options?)` to `SchemaInterface` / `DefaultSchemaInterface`, ported from legacy `defaultSchemaInterface.textValue` — option-`name` lookup then type-aware formatting (`Date → toLocaleDateString()`, `DateTime → toLocaleString()`, `Time → toLocaleTimeString()`, `Bool → Yes/No`). `DisplayOnlyRenderer` now formats through `node.schemaInterface.textValue` (so dates render `1/12/2024` not the raw ISO string), layers the definition's `textClass` over the theme class (so per-cell text styles like `!text-accent` apply), no longer stamps an unused `id` on the value element, and emits a `<div>` by default / `<span>` when inline (matching legacy `DefaultHtmlDivRenderer`'s `inline ? "span" : "div"`). To support that last point, `DataRendererProps` gained an `inline?: boolean` flag that `Field` threads into the data-renderer dispatch. The display-only flex wrapper class is host-applied (rxc has no renderer→layout-class hook): `apps/rxc-compare/HtmlLayout` re-applies the legacy `displayOnlyClass` (`flex flex-row items-center gap-2`) for display-only controls and the theme sets `data.displayOnlyClass: ""` so the value element carries only `textClass`.
- **`@rxc/forms`: swappable `Label` / `Error`.** Added `LabelProvider` + `useLabel()` and `<Form label={MyLabel}>` so hosts can swap the label component without rebuilding Field. Same pattern for `Error`: `DefaultError` + `ErrorProvider` + `useError()` + `<Form error={MyError}>`. `FieldProps` and `FormProps` gained matching `label?` / `error?` slots for per-Field overrides. (No back-compat `Label`/`Error` aliases — per the Constraints "No deprecations" rule, the old names were just deleted.)
- **`@rxc/forms`: `theme.label.groupClassName` + `isGroupLabel()` predicate.** `DefaultLabel` now layers `theme.label.groupClassName` on top of `theme.label.className` whenever the rendered control is group-shaped (`type: "Group"` definitions OR compound Data controls with `renderOptions.type === "Group"`). Mirrors the legacy `DefaultRendererOptions.label.groupLabelClass` slot. The `isGroupLabel(def)` predicate is exported so custom `<Label>` components can reuse it.
- **`@rxc/forms-react-core`: `useFormErrors(rc, node)`.** Recursive walker returning `FormError[]` (`{ node, uniqueId, error }`) — one entry per touched descendant with a published validation error. Skips hidden subtrees (`visible === false`) so messages don't surface for fields the user can't see. Replaces hand-rolled walkers in error-summary panels.
- **`@rxc/forms-core`: resolver factories exported.** `createSchemaTreeResolver` and `createFormTreeResolver` (plus their `SchemaTreeFactory` / `FormTreeFactory` types) are now re-exported from `nodes/index.ts`. Hosts that previously inlined a cached `Record<string, SchemaField[]> → SchemaTree` resolver can drop the boilerplate.
- **`@rxc/forms`: Radio / Checklist render `entryWrapperClass` + `selectedClass` / `notSelectedClass` + per-option children.** `RadioRenderer` and `ChecklistRenderer` now read `entryWrapperClass` / `selectedClass` / `notSelectedClass` from the form definition's `renderOptions` (typed via `RadioButtonRenderOptions` / `CheckListRenderOptions`), layered with matching theme slots on `HtmlOptionGroupTheme`. Each option's wrapper `<div>` carries those classes, and the per-option children that `defaultResolveChildren` already spawns (keyed by `meta.fieldOptionValue`) are rendered inside the wrapper via `<Field>` — matching the legacy `fieldOptionAdornment(p)` + `HtmlCheckButtons` shape. Outer `<fieldset>`/`<legend>` retained for a11y.
- **`@rxc/forms-react-core` (`useFormStateNode`): deferred `runAsync` queue.** Mirrors the legacy `useAsyncRunner` from `astrolabe-common/schemas/src/RenderForm.tsx`: `runAsync` callbacks fired during render are queued on a stable component-scoped ref, then drained inside a `useEffect` after React commits. This is what keeps SSR snapshots and the first client hydration in agreement when Jsonata scripts would otherwise resolve via `queueMicrotask` between SSR HTML ship and CSR commit — a hydration-mismatch trap that surfaced the first time a `Display`-typed Jsonata script ran during initial render. Custom runners can still be supplied via `options.runAsync` for tests.
- **`@rxc/forms`: display renderers wrapped in `controls()` and read through `node.getState(rc).definition`.** `HtmlDisplayRenderer`, `TextDisplayRenderer`, `IconDisplayRenderer`, and `CustomDisplayRenderer` are now `controls()`-wrapped and ignore the `data` prop's properties for reactive reads — they re-resolve through their own `rc` from `node.getState(rc).definition.displayData`. The `data` prop is bound to the dispatching Field's rc, whose `reconcile()` has already happened by the time the renderer body runs; reads through it never establish subscriptions. Reading via the renderer's own rc is the working contract. All three also layer `definition.styleClass` over the theme class via `rendererClass`, matching legacy `rendererClass(className, options.htmlClassName)`.
- **`@rxc/controls-core`: `ReadContext.isFinalized` + render-window enforcement.** `TrackingReadContext` flips a `rendering` flag back to false in `finalize()` (called by the React `controls()` wrapper immediately after `reconciler.reconcile()`). While finalized, `track()` returns the impl without mutating `tracked`, so escaped-proxy reads can no longer corrupt the next render's subscription set. Reads still return current values (event handlers, refs, etc. work). `noopReadContext.isFinalized` is permanently `true`.
- **`@rxc/forms-core` (`createOverrideProxy`): dev-mode escape warning.** The scripted-override proxy now checks `rc.isFinalized` on each scriptable property read; if true, a one-per-call-site `console.warn` fires explaining the read landed past the owning rc's reconcile window and the consumer won't re-render on script updates. Includes a call-site stack frame and a one-line fix recipe (wrap the consumer in `controls()` and read via `node.getState(rc)`).
- **`@rxc/forms-react-core`: `getExternalEdit` + the sibling `ArrayElementModalHostRenderer` pattern.** Ported the legacy `@react-typed-forms/schemas` "Add / Edit stages a draft, modal commits on Apply" flow for arrays. Two pieces:
  - **`getExternalEdit(arrayNode, options?)`** — returns a per-array controller exposing `session(rc)`, `beginAdd(initialValue?)`, `beginEdit(index)`, `apply({ dontValidate? })`, `cancel()`. Session is a standalone draft `Control` + standalone `FormStateNode` rooted on the array's element schema/form; `apply()` validates via `draftForm.validate()` (touching all nodes on failure so errors surface) and writes through `wc.addElement` / `wc.setValue(elem, draft)`. **The Cancel + confirm actions are staged on the session** (`session.actions: ExternalEditAction[]` = `{ action: ActionRendererProps; dontValidate? }`), mirroring legacy's `getExternalEditData(control).fields.actions` — the controller builds them (Cancel = `cancel`/"Cancel"/`dontValidate`; confirm = the array's `addActionId`/`addText` for an `add` session, `apply`/"Apply" for an `edit` session), and the modal host renders them rather than hardcoding its own buttons. Each action's `onClick` performs the raw commit/cancel; the host wraps the non-`dontValidate` one with draft validation (legacy `applyValidation`). The `apply()`/`cancel()` controller methods remain (used by tests + programmatic callers) and back the staged actions' `onClick`. **The controller is cached on `arrayControl.meta["$externalEdit"]`** — not on the FormStateNode meta — so two sibling FormStateNodes bound to the same array field share **one** controller and **one** session. The shared cache is the linchpin: `Array` writes a session, the sibling modal host reads from the same cache. `staticDef` arg added to `createFormStateNode` so a custom draft definition can shadow the form node's own definition for the root. **Multi-child draft auto-detect:** with no `options`, the draft root form node is the single element-template child when the array has one child; for a **multi-child** array (e.g. DataGrid columns) it roots on the array's own form but defaults the root *definition* to a `Contents` group — otherwise the root would re-dispatch to the array's own collection renderer (a nested Array/DataGrid bound to one element). This is what lets `DataGrid` use the sibling-host pattern with plain `getExternalEdit(node)` (no per-caller override). Explicit `options.elementForm`/`elementDefinition` still win.
  - **`ArrayElementModalHostRenderer`** (`@rxc/forms`) — the renderer for `renderType: ArrayElement` *bound to an array itself* (not an element; `elementIndex === undefined` + `field.collection === true`). This is the **only** meaning `DataRenderType.ArrayElement` carries — a faithful port of the legacy `@react-typed-forms/schemas-html` `ArrayElementRenderer` (an element-level `ArrayElement` is not special and degrades to the catch-all). Renders **nothing** until a session exists, then pops a native `<dialog>` with the draft form + the session's staged actions — **unless `renderOptions.showInline` (or design mode)**, in which case the draft body renders inline with no dialog chrome, matching legacy's `showInline || designMode` branch. The Cancel + confirm actions come from `session.actions` (staged by the controller — see above), each rendered via `<Action>` (so hosts override chrome per id with `matchActionId`) wrapped by an `applyValidation` helper that validates the draft before the confirm action's `onClick`, exactly mirroring legacy's `formRenderer.renderAction(applyValidation(c.value))`. The two-sibling form-definition shape is:
    ```ts
    dataControl("items", "...", { renderOptions: { type: Array, editExternal: true }, children: tpl }),
    dataControl("items", undefined, { renderOptions: { type: ArrayElement }, children: tpl }),
    ```
    `<Field>` dispatches each control to its own renderer; both resolve to the same array `Control`, so they share the session. `ArrayRenderer` (and its per-row Edit button) *does not* host its own modal — only the sibling `ArrayElementModalHostRenderer` does. **`DataGrid` follows the same sibling-host pattern** (it does not self-host): pair the `renderType: DataGrid` control with a sibling `renderType: ArrayElement` control bound to the same array (same columns as children). Both call `getExternalEdit(node)` with no options → shared `$externalEdit` controller; the no-options auto-detect roots the multi-column draft in a `Contents` group (see "multi-child draft" below). Reproduces the legacy `@react-typed-forms/schemas-html@5.2.1` shape; the legacy package shipped a fix during this work to wire the previously-stubbed modal body via `createChildNode("draft", ...) + getResolvedChildren()`.
- **`@rxc/forms-react-core`: `ActionRenderer` signature changed to plain props (legacy parity).** Previously `(props: { node: FormStateNode })` — node-driven like every other renderer. Now `(props: ActionRendererProps)` where `ActionRendererProps` is a flat POJO: `{ actionId, actionText?, onClick, disabled?, busy?, icon?, actionStyle?, iconPlacement?, disableType?, styleClass?, textClass?, children? }`. Matches the legacy `@react-typed-forms/schemas` shape so the same custom action renderers port across (legacy `RendererRegistration` for actions worked the same way). Three flow-on changes:
  - **`<Action>` component** in `@rxc/forms-react-core`. One-liner that `useRegistry()` + `pickActionRenderer(reg.action, props)` + renders the matched component. The single entry point for inline action buttons in any renderer (Array / DataGrid / Pager all use it).
  - **`FieldAction` adapter** in `@rxc/forms` — own `controls()`-wrapped component (not a switch case in `Field.tsx`) that translates a form-tree `Action` `FormStateNode` to `ActionRendererProps`. Wires `onClick` through `useAsyncAction(node, dispatch, …)` so busy state ties back to the node; renders child action defs (each via `<Field>`) into `props.children`. Extracted because `useActionHandler`/`useAsyncAction` inside `Field`'s `switch` were technically rules-of-hooks landmines (fine in practice but only because `def.type` is stable per node lifetime).
  - **`ActionRendererProps.children?: ReactNode`** — rendered content for nested action def children. **`ButtonAction` uses `children` as the button body when present**, otherwise composes `icon + text` per `iconPlacement`. Lets you render any nested form-defined content inside the clickable element (multi-line label, custom icon+text layouts, an HTML chunk). **Legacy divergence**: legacy `@react-typed-forms/schemas` gates this flow on `actionStyle === Group` (`actionContent = isGroup ? renderChildren() : undefined`); rxc accepts children for *any* style. Documented on the `/buttons` demos in both `apps/dev` and `apps/legacy-demos` with a "Non-Group ignores children" row in the legacy demo highlighting the gap.
- **`apps/legacy-buttons` renamed → `apps/legacy-demos`** (port 3001, package `rxc-legacy-demos`). Now a generic multi-page legacy reference app rather than a single buttons demo. Routes: `/buttons` (existing ButtonAction baseline) + `/externaledit` (legacy `editExternal` modal baseline, paired with rxc `/externaledit` at port 3000). Add new pages here whenever a new rxc feature needs a side-by-side legacy comparison that doesn't fit the Fire-form-shaped `legacy-compare`. The app's `globals.css` registers `@source "../node_modules/@astroapps/aria-base/lib/**/*.js"` so the legacy Modal's Tailwind classes get emitted, plus a small v3→v4 compat shim (`.bg-black.bg-opacity-50 { background-color: rgb(0 0 0 / 0.5); }`) for the modal underlay since `bg-opacity-*` was removed in Tailwind v4.

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
- **`renderType: ArrayElement`** — routes to `ArrayElementModalHostRenderer` (the `editExternal` draft host; see "Upstream changes" above). This is the **only** meaning of the render type, matching legacy. The per-row Edit button + array mutation chrome live in `ArrayRenderer` itself (legacy parity), not in a separate element renderer. *(An earlier rxc-only `ArrayElementRenderer` that rendered a per-element "summary + Edit button" / local compact-view `<dialog>` was removed — it had no legacy counterpart and overloaded the render type. See the "Legacy semantics only" constraint.)*
- **`@rxc/forms-motion`** — separate package. `FadeVisibility` / `SlideVisibility` (cross-fade / slide-down via `<AnimatePresence>` + `motion.div`); `MotionAccordionAdornment` replaces the native-`<details>` Accordion with a height-animated panel.
- **`@rxc/forms-dnd`** — separate package. `SortableArrayRenderer` mirrors `ArrayRenderer` and reorders via `wc.updateElements(arr, (elems) => arrayMove(elems, …))` driven by `@dnd-kit/sortable`. `dnd-kit` is a peer dep so apps that don't import this package don't pay for it.

### `@rxc/forms-datagrid` — display-only DataGrid port ✅

Port of the legacy `@astroapps/schemas-datagrid` `DataGridRenderer` (display-only subset), driven by the comparison-app workstream (ServiceTas `MrsDemeritsSummary` form).

- Depends on the **published** `@astroapps/datagrid` (1.2.0) base grid directly — it has zero Control/forms deps (only `react` + `clsx`), so no fork was needed.
- `dataGridResolveChildren` (registered via `dataPlugin`'s `resolveChildren` on render type `DataGrid`) expands the bound array into one `Contents`-group row per element; each row's `node: form` sources the grid's declared column controls, so `row.getChildren(rc)` yields the per-column cells bound to that element. This skips the legacy two-level (synthesized-headers-group + data-array) resolver — column header metadata is read directly from `definition.children` in the renderer. Mirrors the `resolveOptionChildren` pattern in `forms-core/src/nodes/resolveChildren.ts`.
- `createDataGridRenderer` (controls()-wrapped) maps each column definition → `ColumnDefInit` (title + `getColumnHeaderFromOptions` classes from the `ColumnOptions` adornment, `columnTemplate`), precomputes the `cellGrid` (rows × column cells) for closure-safe cell rendering via `<Field>`, and renders the base `<DataGrid>`.
- `ColumnOptions` adornment (`columnAdornment.ts`) ported verbatim (schema + `isColumnAdornment` + `getColumnHeaderFromOptions` + `defaultDataGridClasses`).
- Registration order matters: `combineRegistries(dataGridRegistry(), defaultRegistry())` so the `DataGrid` render type beats the default collection (Array) matcher.
- The trailing `auto`-width delete-check column **is** rendered (empty `removeColumnClass` div in display-only) so column templates + per-row markup match legacy. Headers wrap their title in `titleContainerClass` via `renderHeaderContent`, matching legacy.
- Wired into both compare apps (`MrsDemeritsSummary` form, port 3002 legacy reference via `@astroapps/schemas-datagrid` 8.2.0 / port 3003 rxc) with a shared `sampleData` seed so the grid shows rows. SSR-verified: identical column templates (`1fr 1fr 3fr`), headers, and cell values across both.

#### DataGrid Phase B — filter/sort/paging ✅

`RWVPRenewalSearch` (the third DataGrid form) now works: column filter + offset/length paging. Shipped:

- **`@astroapps/searchstate` (2.0.0, zero-dep) added** to `@rxc/forms-datagrid` (+ `@radix-ui/react-popover` for the filter popover). Provides `SearchOptions`, `setFilterValue`, `rotateSort`, `findSortField`, `makeClientSortAndFilter`, `getPageOfResults`.
- **No new forms-core helpers needed.** The legacy `schemaDataForFieldRef`/`fieldPathForDefinition`/`schemaForFieldPath` are covered by existing rxc cursor utils — the `searchField` SearchOptions control resolves via `dataRef(node.parent.cursor(rc), searchField)` (`FormStateNode.parent` is the legacy `dataContext.parentNode`).
- **`Popover` / `SortableHeader` / `FilterPopover`** ported (`src/{Popover,SortableHeader,FilterPopover}.tsx`). `SortableHeader`/`FilterPopover` are `controls()` components that read/write the SearchOptions `sort`/`filters`/`offset` fields through their own rc/wc (`updateValue` matches the `setFilterValue`/`rotateSort` updater shape). Filter options are resolved by the renderer (from a populated cell's `fieldOptions`) and passed in — no `getFilterOptions` added to `SchemaInterface`.
- **`DataGrid` renderer** resolves `renderOptions.searchField` and wires `FilterPopover`/`SortableHeader` into `renderHeaderContent`, driven per-column by `ColumnOptions.enabledFilter`/`enabledSort` (filter/sort key defaults to the column's bound field). `DataGridOptions` gained `searchField` + `disableClear`; `DataGridClasses` gained `popoverClass`/`clearFilterClass`/`clearFilterText`.
- **`Pager` renderer** (`src/Pager.tsx`, `pagerPlugin()`, render type `Pager`) — binds to the SearchOptions control, reads total from a sibling field (default `results/total`), renders "Showing page X of Y" + Previous/Next (plain `<button>`s; legacy routed these through the host action renderer). `dataGridRegistry()` now combines the DataGrid + Pager plugins.
- **Client-side search helper** (`src/clientSearch.ts`): `fieldClientSearch({ searchableFields?, getSearchText? })` (plain `row[field]` filter/compare; full-text `query` joins the listed fields or runs a custom builder) + `clientSearchPage(allRows, search, client)` → `{ entries, total }`, standing in for a server. Both compare apps wire it in their host (rxc via `effect` + `cc.update`; legacy via `useControlEffect`) so filter/sort/paging/query actually slice the rows; both set `results.total = filtered.length` so the pager reflects the filtered count. 9 unit tests in `packages/forms-datagrid/test/clientSearch.test.ts`.
- **`RWVPRenewalSearch` wired into both compare apps** (12-row seed, page size 5 → 3 pages; `viewDetail` action stubbed via `<ActionScope>`; query box searches `firstName`/`lastName`/`registrationNumber`/`licenceNumber`/`status`). SSR-verified: identical 7-column + `cdeleteCheck` grid template, `fa-filter` on Status, pager chrome, first-page rows, and View buttons across both.

#### DataGrid Phase C — `visible`/`rowSpan` / `groupByField` / array actions ✅

- **`@rxc/forms-react-core`: `ensureExpressionResult(ctx, node, expr, metaKey, initial?)`.** Node-meta variant of `useExpression` — registers an evaluator once per `metaKey` on a `FormStateNode` and returns the result `Control<unknown>` (subsequent calls with the same key reuse the same control without re-registering). Cleanup runs on node cleanup. Designed for dynamic cell/column counts where a hook isn't viable.
- **Per-column `visible` expression** (`@rxc/forms-datagrid` `DataGrid`): when `ColumnOptions.visible` has a non-empty `type`, the column is filtered out reactively when the expression evaluates to `false` (default `true`). Empty `{}` placeholders authored by the form editor are treated as "no expression" via a small `isExpr()` guard.
- **Per-cell `rowSpan` expression**: when `ColumnOptions.rowSpan` has a non-empty `type`, each cell evaluates it against the row's data context via `ensureExpressionResult(ctx, cell, …, "$cellRowSpan", 1)` and the result is passed through `getRowSpan` on the column.
- **`groupByField` row-spanning** (`computeGroupRowSpans(keys)` exported for testing): adjacent same-key runs collapse — the first row in a run gets the run length, subsequent rows get 0 (the base grid hides those cells in the grouped column). By default rxc does NOT reorder the underlying array (no data mutation during render — explicit reactivity). Set **`reorderGroups: true`** to opt in to legacy `useGroupedRows` behavior: a post-commit `effect` clusters same-key rows adjacently via `wc.updateElements` (stable — first-appearance key order preserved, idempotent so it converges). `stableGroupByKey(items, keyOf)` is exported for testing. A grouped column is either the column bound to `groupByField` or any column with `groupedColumn: true` on its `ColumnOptions`.
- **Array add/remove/edit actions**: `addText`/`removeText`/`editText` + `addActionId`/`removeActionId`/`editActionId` added to `DataGridOptions`. Renderer reads `min`/`max` via `getDataGridLengthRange(def)` (`Length` validator, with `required` defaulting `min` to 1) and disables buttons at the boundaries. Each button is rendered via `<Action>` so hosts can swap the renderer per id (`matchActionId("add", FancyAddRenderer)`); the `onClick` dispatches the configured action id through `useActionHandler` first, falling back to direct `wc.addElement`/`wc.removeElement` mutation if no `<ActionScope>` claims it. `editExternal: true` on `DataGridOptions` enables the staged-edit modal flow: Add/Edit call `getExternalEdit(node)` (no options) to stage a draft; the modal is hosted by a **sibling `renderType: ArrayElement` control** bound to the same array (same columns), exactly like `ArrayRenderer` — DataGrid no longer self-hosts a `<dialog>`. Add/Edit/Remove are disabled while a draft is open. Buttons hidden in `displayOnly` mode and when the cascade reports `readonly`/`disabled`. Add button below the grid; remove/edit in the trailing `cdeleteCheck` cell.

Reference source: `astrolabe-common/astrolabe-schemas-datagrid/src/DataGridControlRenderer.tsx` (597 lines — display-only + filter/sort/paging + visible/rowSpan/groupByField + array add/remove are ported; deferred items below).

#### DataGrid Phase D — parity gap closures ✅

A file-by-file diff against the legacy `astrolabe-schemas-datagrid/src` closed the remaining behavioral gaps:

- **Grid-level adornment columns**: `ColumnOptions` adornments placed on the **grid itself** (not a child control) now synthesize standalone leading columns bound to `.` (the row element) — e.g. a row-index column. `dataGridResolveChildren` resolves each row's children explicitly (synthetic adornment columns `cc{i}` ++ declared column controls `c{node.id}`, mirroring legacy `resolveColumns`); the std-column branch is byte-identical to `defaultResolveChildren`, so grids with no grid-level adornment resolve exactly as before. The renderer prepends `adornmentColumnDef(x)` to its column list so cell indices line up. `adornmentColumnDef` exported helper.
- **`schemaClientSearch(fields, schemaInterface)`** (`clientSearch.ts`): schema-aware sibling of `fieldClientSearch` — resolves nested `field/path` references through compound children, compares via `SchemaInterface.compareValue` (numeric/date-correct, not lexical), and builds full-text corpus from `SchemaInterface.textValue` over scalar top-level fields (option names, formatted dates). Ported from legacy `schemaNodeClientSideSearch` (`textValue` stands in for the legacy `searchText`). `fieldClientSearch` unchanged for the simple flat case.
- **`rowClass`** now applied via the base grid's `wrapBodyRow` (was a declared-but-unused slot).
- **Edit-session button disabling**: Add/Edit/Remove grey out while an `editExternal` draft is open (legacy `disableActionIfEdit`).
- **Pager `designMode` guard**: paging is a no-op in design mode (legacy parity).

22 → 29 datagrid tests.

#### DataGrid — still deferred

- **`noReorder` / drag-to-reorder**: rxc has no built-in row reordering. The `@rxc/forms-dnd` `SortableArrayRenderer` is the closest analogue but isn't wired into the grid; a future port could combine the two. (Note: legacy's `DataGridControlRenderer` doesn't implement row dragging either — `noReorder` just rides along.)
- **`DataGridGroup` (`GroupRenderType: "DataGrid"`)**: deliberately not ported — the legacy renderer is itself a non-functional stub (visibility logic commented out, `maxRows = 1`, `getBodyRow` returns `undefined`). Porting it would add a broken renderer, not parity. Revisit when a real use case appears.

#### ServiceTas form-portability survey (reference)

One-time scan of all ~70 ServiceTas forms (`astrolabe/ServiceTas/ServiceTasAPI/NewClientApp/client-common/formDefs`) against the rxc default renderer set. **All expression types, dynamic property types, and validators are fully supported** — gaps are purely custom data renderers the host must provide. Unknown render types fall through to the Textfield catch-all (degrade, don't crash).

- **Clean (only rxc-supported features), good next ports:** `Burn` (65k, sibling of Fire), `MrsLicenceDetails`, `MrsRegistrationDetails`, `MrsRegistrationsSummary`, plus ~40 smaller forms.
- **Need custom renderers, grouped by missing capability:**
  - Payment widgets — `QuickstreamCC`/`QuickstreamPay` (TempPaymentForm, TUP, MrsLicenceRenewal, MrsRegistrationRenewal, ShortTermPermit). Third-party, not portable.
  - `Switch` (SecurityPreferences, NotificationPreferences, TuoPreferences, LinkMastWizard) — cheap win, likely a styled checkbox.
  - `AddressFinder` (Address, ShortTermPermit, PlatesPlusRegistrationWizard) — geocoding widget.
  - `DataGrid`+`Pager`+`ColumnOptions` (MrsSummary, MrsDemeritsSummary ✅ display-only, RWVPRenewalSearch ✅ filter+paging via Phase B).
  - `Chart` (MrsSummary, MrsDemeritsSummary), `Map`/`MapPoints` (FireInitial, MastMooringPermitSummary) — viz widgets.
  - Long tail: `CopyableData`, `Tooltip`, `Spotlight`, `HtmlRenderer`, `displayData.Custom` (RWVPVerificationWizard already stubs some).

### TODO — platform-agnostic renderer hooks (React Native readiness)

Goal: keep **all platform-agnostic renderer logic in `@rxc/forms-react-core` as hooks**, so the eventual `@rxc/forms-native` (RN views/text/`TextInput`) reuses the exact same behaviour and only swaps the emitted elements + styling. The HTML renderers in `@rxc/forms` should trend toward being **thin views** over these hooks. `useWizardController` is the model: state + logic live in the hook, the renderer just draws. `forms-react-core` must stay **DOM-free** (no HTML element types, no class strings — chrome/theme stays in the platform package).

Existing hooks to build on: `useFormStateNode`, `useLabelText`, `useExpression`, `useAsyncAction`, `useFormErrors`, `useWizardController`, `useDeferredCleanup`.

- [x] **Audit each `@rxc/forms` data renderer** — full audit + phased plan in `docs/RENDERER-HOOK-EXTRACTION.md`.
- [x] **Phase 1 extracted** (text/number/date + options widgets). Shipped in `@rxc/forms-react-core`: `optionCoerce.ts` (`valueToString`/`stringToValue`/`mapChildrenByOptionValue`), `useInputControllers.ts` (`useTextInputController` for Textfield+Multiline, `useNumberController`, `useDateController`), `useOptionControllers.ts` (`useSelectController`/`useRadioController`/`useChecklistController`/`useCheckboxController`/`useElementSelectedController`). All eight HTML renderers rewritten to thin views. Contract: `(rc, node)`, writes via `useControlContext().update`; controller surfaces `data` (null-bail) + `styleClass` (theme composition stays in renderer). Tests green.
- [x] **Phase 2 extracted** (stateful groups + collections). Shipped in `@rxc/forms-react-core`: `useAutocompleteController.ts` (open/query state machine; click-outside listener stays DOM), `useCollectionControllers.ts` (`useArrayActions` — length range + add/edit/remove `ActionRendererProps` + editExternal via `getExternalEdit`; `useScrollListController` — `$scrollList` meta + paging trigger, `IntersectionObserver` stays DOM), `useGroupControllers.ts` (`useTabsController`, `useDisclosure` for Dialog incl. `openDialog`/`closeDialog` ActionScope handler, `useAccordionSection`). All six renderers rewritten to thin views. Layout-only groups (Flex/Grid/Inline/Standard/Contents) + `AccordionGroup` wrapper left as-is (no state). Tests green.
- [ ] **Phase 3 — spike `@rxc/forms-native`** with one renderer (Textfield → RN `TextInput`) end-to-end to validate the hook boundary before porting the rest. All platform-agnostic controllers now exist, so the native package is a pure new view layer over `forms-react-core`.
- [ ] **Group open/active state** — `Tabs` (active index), `AccordionGroup` / `AccordionAdornment` (expanded set), `Dialog` (open + ActionScope open/close) all keep this state inline. Extract → `useTabsController` / `useDisclosure` so RN reuses the state machine.
- [ ] **Contract:** hooks take `(node, rc, …)` and return values + handlers only — never `ReactNode`, never class strings. Anything DOM-shaped (input `type`, element choice, `className`) stays in the platform renderer.
- [ ] Once a few are extracted, **spike `@rxc/forms-native`** with one data renderer (e.g. Textfield → RN `TextInput`) end-to-end to validate the hook boundary before porting the rest.

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
