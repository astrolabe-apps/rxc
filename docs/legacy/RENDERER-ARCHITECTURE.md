# Legacy Renderer Architecture (`@react-typed-forms/schemas`)

Reference document. Captures the renderer architecture of `astrolabe-common/schemas` (the engine) and how `astrolabe-common/schemas-html` (the default UI implementation) plugs into it. Extracted from source — sibling docs cover layout pipeline, renderer catalog, adornments, extensions, and actions in more depth.

## Scope

Covers:
- The `FormRenderer` interface — the abstraction every UI library plugs into.
- The nine `RendererRegistration` kinds and their dispatch logic.
- `createFormRenderer` — how a registration list collapses into a `FormRenderer` instance.
- The `RenderForm` / `RenderFormNode` entry path — how a `FormStateNode` tree becomes React output.
- The `resolveChildren` override hook — how a custom data renderer can replace the standard child-resolution logic.
- Auxiliary contexts threaded through the pipeline: `ControlDataContext`, `ControlActionContext`, `ControlActionHandler`, `RunExpression`.

Layered details are in companion docs:
- Layout flow (`ControlLayoutProps`, label/adornment/visibility wrapping, `processLayout` chain): see `LAYOUT-PIPELINE.md`.
- Per-component behaviour (each renderer in `schemas-html/src/components/`): see `RENDERER-CATALOG.md`.
- Adornments (placement, priorities, optional-toggle): see `ADORNMENTS-AND-VISIBILITY.md`.
- Schema extension model and custom render types: see `EXTENSION-MODEL.md`.

## Two-package split

```
@react-typed-forms/schemas          (engine — UI-agnostic)
    │
    ├── FormRenderer interface
    ├── RendererRegistration types
    ├── createFormRenderer (dispatch)
    ├── RenderForm / RenderFormNode (React entry)
    ├── renderControlLayout (per-node layout)
    └── ControlActionContext / RunExpression / ControlDataContext
              ▲
              │ implements
              │
@react-typed-forms/schemas-html     (default HTML implementation)
    ├── createDefaultRenderers (returns DefaultRenderers + extraRenderers[])
    ├── components/*.tsx (one file per renderer kind)
    └── adornments/*.tsx
```

The engine never imports anything DOM-specific; it talks to the registered renderers and to a small `HtmlComponents` slot (`Div`, `Span`, `Input`, …) that the host supplies. React Native and MUI ports replace `schemas-html` wholesale.

## The render pipeline

The runtime path for one node:

```
RenderForm
  │  builds FormGlobalOptions, creates root FormStateNode
  ▼
RenderFormNode (React component, recursive)
  │  attaches FormNodeUi, builds ControlDataContext, builds adornment array,
  │  derives childOptions (readonly/disabled/hidden/variables inheritance)
  ▼
renderControlLayout({formNode, renderer, renderChild, …})
  │  switches on definition kind:
  │    isDataControl   → renderer.renderData(props)   → returns processLayout fn
  │    isGroupControl  → renderer.renderGroup(props)  → returns processLayout fn
  │    isActionControl → renderer.renderAction(props) → returns ReactNode (children)
  │    isDisplayControl→ renderer.renderDisplay(props)→ returns ReactNode (children)
  │  also: builds default LabelRendererProps and an optional errorControl
  ▼
ControlLayoutProps {
  label?, errorControl?, errorId?, adornments?,
  children?, processLayout?, className?, style?, inline?
}
  │
  │  options.adjustLayout?(dataContext, layoutProps) ← user-level final tweak
  ▼
renderer.renderLayout(layoutProps) → RenderedControl
  │  internally calls renderLayoutParts() to:
  │    1. resolve processLayout → expanded ControlLayoutProps
  │    2. seed RenderedLayout from props
  │    3. sort adornments by priority asc, apply each (mutates layout)
  │    4. call renderer.renderLabel(label, labelStart, labelEnd) if not hidden
  │    5. wrapLayout chain composed by adornments wraps the final element
  ▼
renderer.renderVisibility({visibility, ...renderedControl}) → ReactNode
```

Each `RenderFormNode` recursion happens via `renderChild(child, options?)` — the leaf renderers (or their `processLayout` functions) call `renderChild` to render their children.

## `FormRenderer`

```ts
interface FormRenderer {
  renderData    : (p: DataRendererProps)        => (l: ControlLayoutProps) => ControlLayoutProps;
  renderGroup   : (p: GroupRendererProps)       => (l: ControlLayoutProps) => ControlLayoutProps;
  renderDisplay : (p: DisplayRendererProps)     => ReactNode;
  renderAction  : (p: ActionRendererProps)      => ReactNode;
  renderArray   : (p: ArrayRendererProps)       => ReactNode;
  renderAdornment: (p: AdornmentProps)          => AdornmentRenderer;
  renderLabel   : (p: LabelRendererProps, ls?, le?) => ReactNode;
  renderLayout  : (p: ControlLayoutProps)       => RenderedControl;
  renderVisibility: (p: VisibilityRendererProps)=> ReactNode;
  renderLabelText: (p: ReactNode)               => ReactNode;
  html          : HtmlComponents;          // primitive components (Div/Span/Input/…)
  controlDefinitionSchema?: SchemaNode;    // schema used by the scripted proxy walker
  resolveChildren(c: FormStateNode): ChildNodeSpec[];
}
```

Three observations that drive the design:

1. **`renderData` and `renderGroup` return *layout transformers*, not React nodes.** A data/group renderer returns `(layout) => layout`, which is stored in `ControlLayoutProps.processLayout` and invoked once during `renderer.renderLayout`. This is what lets a data renderer override the default label, attach an error control, or replace `children` while still going through the standard adornment/label/visibility wrapping.

   For convenience, a registration's `render` function may return a `ReactNode` directly; `createFormRenderer` then wraps it as `(l) => ({...l, children: result})`.

2. **`renderDisplay` / `renderAction` return plain `ReactNode`** — they don't participate in the layout-transformer chain because their output is the children. The leaf node code just sets `{children: renderer.renderX(...)}` and lets the rest of the pipeline run.

3. **`renderLayout` and `renderVisibility` are global wrappers** invoked exactly once per node, after every other renderer has contributed.

## `RendererRegistration` (nine kinds)

```ts
type RendererRegistration =
  | DataRendererRegistration       // "data"
  | GroupRendererRegistration      // "group"
  | DisplayRendererRegistration    // "display"
  | ActionRendererRegistration     // "action"
  | LabelRendererRegistration      // "label"
  | ArrayRendererRegistration      // "array"
  | AdornmentRendererRegistration  // "adornment"
  | LayoutRendererRegistration     // "layout"
  | VisibilityRendererRegistration // "visibility"
```

All registrations carry an optional `schemaExtension: ControlDefinitionExtension` — extensions accumulate across all registrations and are merged into `ControlDefinitionSchemaMap` to produce the final scripted-proxy schema. See `EXTENSION-MODEL.md`.

### Data — `DataRendererRegistration`

```ts
{
  type: "data";
  schemaType?: string | string[];   // FieldType (e.g. "String", "Int")
  renderType?: string | string[];   // DataRenderType (e.g. "Standard", "CheckList")
  options?:    boolean;             // requires fieldOptions present?
  collection?: boolean | null;      // null = any; true = collection only; false = scalar only
  match?: (formState, renderOptions) => boolean;
  render: (props: DataRendererProps, renderers: FormRenderer)
       => ReactNode | ((layout: ControlLayoutProps) => ControlLayoutProps);
  resolveChildren?: ChildResolverFunc;
}
```

#### `matchData` dispatch (inside `createFormRenderer`)

For a data control, scan registrations in order; the first that satisfies all of these wins (else fall back to `defaultRenderers.data`):

| Predicate | Rule |
|---|---|
| **`match`** | If supplied and returns `false`, the registration is rejected (and the rest is skipped). If returns `true`, this on its own can be enough (see "isRendererAllowed/isSchemaAllowed" combinator). |
| **`collection`** | `null` → match any. Otherwise must equal `(elementIndex == null) && (field.collection ?? false)`. So `collection: true` matches *the array as a whole*, `collection: false` matches scalars and individual array elements. |
| **`options`** | `false` (default) → only match when no `fieldOptions`. `true` → only when `fieldOptions` present. |
| **schemaType / renderType pair** | Combined via `isSchemaAllowed \|\| isRendererAllowed`. `schemaType` matches against the field's `type`, but only when `renderOptions.type === "Standard"` — i.e. an explicit non-Standard render type bypasses schemaType check. `renderType` matches against `renderOptions.type`. With neither flag set, requires `match` to have returned `true`. |
| `optionsMatch` | If a renderer specifies a non-default `renderType`, the `options` check is skipped (`isRendererAllowed \|\| (x.options ?? false) === options`). |

The default data renderer is the one supplied by `defaultRenderers.data` and matches anything not picked up earlier — typically the standard text input renderer.

#### `resolveChildren` override

If the matched data registration carries `resolveChildren`, the engine uses it instead of `defaultResolveChildNodes` to determine children for that node. This is how renderers like CheckList expand option children, or DataGrid expands per-row children.

The `FormRenderer.resolveChildren(c)` method on the merged renderer dispatches into `matchData` first; if no override applies it falls back to `defaultResolveChildNodes(c)`.

### Group — `GroupRendererRegistration`

```ts
{
  type: "group";
  renderType?: string | string[];   // GroupRenderType (e.g. "Standard", "Tabs", "Wizard")
  render: (props: GroupRendererProps, renderers: FormRenderer)
       => ReactElement | ((layout: ControlLayoutProps) => ControlLayoutProps);
  resolveChildren?: ChildResolverFunc;
}
```

Dispatch: first registration whose `renderType` matches `props.renderOptions.type` (with `isOneOf` semantics); else `defaultRenderers.group`.

A **compound-field** group definition — `isGroupControl(c) && c.compoundField` — is rewritten on the fly to a `dataControl(c.compoundField, c.title, {children: c.children, hideTitle: c.groupOptions?.hideTitle})` and then dispatched as a data control. This is why some compound subtrees end up at data renderers.

### Display — `DisplayRendererRegistration`

```ts
{
  type: "display";
  renderType?: string | string[];   // DisplayDataType: "Text" | "Html" | "Icon" | "Custom"
  render: (props: DisplayRendererProps, renderers: FormRenderer) => ReactElement;
}
```

Dispatch: first registration whose `renderType` matches `props.data.type`; else `defaultRenderers.display`.

A `customDisplay` callback in `ControlRenderOptions` short-circuits this for `DisplayDataType.Custom` — see `RenderForm.tsx`.

### Action — `ActionRendererRegistration`

```ts
{
  type: "action";
  actionType?: string | string[];   // matched against props.actionId
  render: (props: ActionRendererProps, renderers: FormRenderer) => ReactElement;
}
```

Dispatch: first registration whose `actionType` matches `props.actionId`; else `defaultRenderers.action`. Action invocation is wired in `renderControlLayout`'s action branch — see `ACTIONS-AND-WIZARD.md`.

### Label — `LabelRendererRegistration`

```ts
{
  type: "label";
  labelType?: LabelType | LabelType[];   // Control | Group | Text | Inline
  render: (props, labelStart, labelEnd, renderers) => ReactNode;
}
```

Dispatch: first registration whose `labelType` matches `props.type`; else `defaultRenderers.label`.

`LabelType.Text` is special: invoked via `renderer.renderLabelText(node)`, used for free-form label text outside the control system.

`LabelType.Inline` triggers `RenderedLayout.inlineLabel = true` so the layout renderer puts the label after the control instead of before it (typical for checkboxes).

### Array — `ArrayRendererRegistration`

```ts
{
  type: "array";
  render: (props: ArrayRendererProps, renderers: FormRenderer) => ReactElement;
}
```

Only the **first** array registration wins (else `defaultRenderers.array`). The data-control path for collection fields builds `ArrayRendererProps` (add/remove/edit actions, length restrictions, render-element callback) and calls `renderer.renderArray(props)` from inside its data renderer's `render` function.

### Adornment — `AdornmentRendererRegistration`

```ts
{
  type: "adornment";
  adornmentType?: string | string[];  // ControlAdornmentType (e.g. "Icon", "Accordion", "Optional")
  render: (props: AdornmentProps, renderers: FormRenderer) => AdornmentRenderer;
}
```

`AdornmentRenderer = { adornment?, priority, apply(layout: RenderedLayout): void }` — adornments are *mutators* that modify the working layout. Sorted by priority ascending before being applied (`AppendAdornmentPriority = 0`, `WrapAdornmentPriority = 1000`). See `ADORNMENTS-AND-VISIBILITY.md`.

`RenderFormNode` builds `adornments = definition.adornments?.map(a => renderer.renderAdornment({adornment: a, dataContext, formNode}))` once per render and passes the array down through `ControlLayoutProps`.

### Layout — `LayoutRendererRegistration`

```ts
{
  type: "layout";
  match?: (props: ControlLayoutProps) => boolean;
  render: (props, renderers) => RenderedControl;
}
```

Dispatch: first registration whose `match` returns `true` (or has no `match`); else `defaultRenderers.renderLayout`. Layout renderers are responsible for the final composition — taking `RenderedLayout` parts (label, controlStart/End, children, wrapLayout) and producing the actual DOM/RN tree. Most apps rely on the default layout.

### Visibility — `VisibilityRendererRegistration`

```ts
{
  type: "visibility";
  render: (props: VisibilityRendererProps, renderer: FormRenderer) => ReactNode;
}
```

A single visibility renderer applies to the whole tree: `allRenderers.find(isVisibilityRegistration) ?? defaultRenderers.visibility`. It receives the `RenderedControl` from `renderLayout` plus a live `Control<Visibility | undefined>` (`{visible, showing}`) and decides how to enter/exit (e.g. fade animation, immediate hide).

## `createFormRenderer`

```ts
createFormRenderer(custom: RendererRegistration[], defaults: DefaultRenderers): FormRenderer
```

Internally:

1. Concatenate `custom` with `defaults.extraRenderers`. Custom registrations appear *first* in the lookup order — they take precedence over `extraRenderers`, and both take precedence over the per-kind default in `defaults` (which is only consulted when no registration matched).
2. Bucket registrations by `type` (one filter per kind).
3. Collect every `schemaExtension` from all registrations; if any exist, build `controlDefinitionSchema` from `applyExtensionsToSchema(ControlDefinitionSchemaMap, extensions)` and expose it on the returned `FormRenderer`.
4. Construct the `FormRenderer` object whose `renderX` methods do the per-kind dispatch into the bucketed lists.
5. `resolveChildren` first checks `matchData(c, c.definition.renderOptions ?? Standard, c.dataNode)`; if the matched data registration has `resolveChildren`, use it; else `defaultResolveChildNodes(c)`.

`DefaultRenderers` (from `schemas-html`'s `createDefaultRenderers`) supplies:
- `data`, `label`, `action`, `array`, `group`, `display`, `adornment`, `renderLayout`, `visibility` — one per kind, used as final fallback.
- `extraRenderers` — preregistered specialist renderers (Autocomplete, CheckList, Tabs, Wizard, Accordion, Grid, ScrollList, JsonataRenderer, etc.).
- `html: HtmlComponents` — the primitive component slot (`Div`, `Span`, `Input`, …).

## `RenderForm` / `RenderFormNode`

`RenderForm` is the entry point. It:

1. Wraps `useAsyncRunner()` to defer `runAsync` calls until React effects flush.
2. Builds `FormGlobalOptions`:
   - `runAsync` from the runner above
   - `evalExpression` = `(e, ctx) => defaultEvaluators[e.type]?.(e, ctx)`
   - `resolveChildren = renderer.resolveChildren`
   - `controlDefinitionSchema` from `options.controlDefinitionSchema ?? renderer.controlDefinitionSchema`
3. Memoises `createFormStateNode(form, data, globals, {forceReadonly, forceDisabled, forceHidden, variables})` keyed on `form.id`.
4. Pushes any prop changes into `state.globals.value` and `state.options.setValue(...)` on each render — `forceX` and `variables` flow through to the live FormStateNode.
5. Calls `state.cleanup()` on unmount.
6. Renders `<RenderFormNode node={state} renderer={renderer} options={options} />`.

`RenderFormNode` is the recursive React component:

1. On mount, attaches a `DefaultFormNodeUi(state)` so the FormStateNode can call `ui.ensureVisible()` / `ui.getDisabler(type)` (see `ACTIONS-AND-WIZARD.md`).
2. Maintains a `Visibility` control (`{visible, showing}`) — `visible` is mirrored from `state.visible`; `showing` is what the visibility renderer toggles after enter/exit animation.
3. Builds `dataContext: ControlDataContext = {schemaInterface, dataNode, parentNode}` from the node.
4. Builds the adornment array eagerly: `definition.adornments?.map(a => renderer.renderAdornment({adornment, dataContext, formNode}))`.
5. Computes `childOptions` — child renderers inherit `readonly/disabled/hidden/variables` from the parent FormStateNode plus class names from `ControlRenderOptions` (with `getGroupClassOverrides(definition)` letting a group apply class overrides to its descendants).
6. Calls `renderControlLayout({...})` with `renderChild` set to a recursive `<RenderFormNode>`, `runExpression` wired to `defaultEvaluators`, and `createDataProps: defaultDataProps`.
7. Wraps the result in adornments, applies `adjustLayout`, calls `renderer.renderLayout`, then `renderer.renderVisibility`.

`renderControlLayout` switches on the definition kind and produces `ControlLayoutProps` — the bridge between this stage and the layout dispatch. Details belong in `LAYOUT-PIPELINE.md`.

## Auxiliary contexts

### `ControlDataContext`

```ts
{ schemaInterface, dataNode: SchemaDataNode | undefined, parentNode: SchemaDataNode }
```

Threaded through every renderer prop. `dataNode` is the field this control binds to (if any); `parentNode` is the resolved data context for sibling resolution. Built fresh each render in `RenderFormNode`. `lookupChildDataContext(parent, c)` walks one definition step down for renderers that need to peek at child data without rendering.

### `ControlActionHandler` and `ControlActionContext`

```ts
type ControlActionHandler = (
  actionId: string,
  actionData: any,
  dataContext: ControlDataContext,
) => ((actionContext: ControlActionContext) => void | Promise<any>) | undefined;

interface ControlActionContext {
  disableForm(disable: ControlDisableType): void;
  runAction(action: string, actionData?: any): void | Promise<any>;
}
```

Resolved at render time via `options.actionHandler ?? options.actionOnClick`. When the user clicks an action control, the handler receives `(actionId, actionData, dataContext)` and *returns* the actual click handler — letting the host decide per-call whether to handle the action and how. Returning `undefined` makes the action a no-op.

The returned click handler may return a `Promise` — the engine then calls `formNode.ui.getDisabler(disableType)()` to disable Self/Global, sets `formNode.setBusy(true)`, and clears both when the promise settles.

`actionHandlers(parent, child)` (in `util.ts`) chains two handlers — used so child renderers' `actionHandler` option can extend the parent's rather than replace it.

### `RunExpression`

```ts
type RunExpression = (
  scope: CleanupScope,
  expression: EntityExpression,
  returnResult: (v: unknown) => void,
  variables?: (changes: ChangeListenerFunc<any>) => Record<string, any>,
) => void;
```

Lets a renderer evaluate an arbitrary expression on demand (e.g. an inline jsonata expression in a `JsonataRenderer`, or computing a derived label inside a custom renderer). Wired in `RenderFormNode` to `defaultEvaluators[expr.type]` against the parent data node.

## Defaults and their data flow

`defaultDataProps(props, definition, control)` is the canonical builder for `DataRendererProps`. It pulls from the `RenderLayoutProps` and the FormStateNode's resolved state to populate:
- `dataNode`, `field` — from `props.dataContext.dataNode!`
- `id = "c" + control.uniqueId`, `errorId = "err_" + id`
- `options` — `formNode.resolved.fieldOptions`
- `readonly`, `hidden = !formNode.visible`
- `required = !!definition.required && !displayOnly`
- `renderOptions` — `definition.renderOptions ?? {type: "Standard"}`
- `className/textClass` — `rendererClass(parent, definition.styleClass)` etc.

A renderer or extension can replace `defaultDataProps` via `ControlRenderOptions.useDataHook` to inject extra props (uncommon — most extensions use `match` callbacks).

## Settled semantics worth preserving

The `@rx-controls/forms` redesign should keep these invariants:

1. **Renderer registration is the only extension surface.** Adding a new render type means appending a registration, not subclassing or patching.
2. **Dispatch is by simple flag combinations** — `schemaType`, `renderType`, `collection`, `options`, `match`, `actionType`, `adornmentType`, `labelType`. No back-references between renderers.
3. **Custom registrations win over defaults via list order**, with `extraRenderers` between custom and per-kind fallback.
4. **Data and group renderers are layout transformers** — they can override label/error/className/style, not just produce children.
5. **Adornments are mutators with priorities**, not wrappers. The same `RenderedLayout` is mutated in-place by each adornment in priority order.
6. **`processLayout` is the single hook** between a leaf renderer's contribution and the layout pipeline. There is no other "render then re-render" step.
7. **Visibility is one global wrapper.** Per-control visibility decisions stay inside `state.visible`; the visibility renderer only animates enter/exit.
8. **`resolveChildren` overrides at the registration level**, not by subclassing the FormStateNode. CheckList/Radio/DataGrid expansion all flow through this hook.
9. **Action invocation goes through a returned-handler indirection** so the host owns side effects and the engine owns busy/disabled state.
10. **Compound-field groups are rewritten as data controls** before dispatch — there's exactly one path through the renderers, not two.

## Open questions for the redesign

These are decisions the renderer rewrite needs to make explicitly; the legacy answer is implicit:

- **Layout transformer vs node return.** Today some renderers can return either. Consider committing to one shape per renderer kind.
- **`HtmlComponents` slot.** Today it's a sibling of the renderer registry, included on every `FormRenderer`. With Tailwind/MUI/RN as separate packages, is this still the right factoring or do `html` primitives belong in the same package as their renderers?
- **Extension surface for new `RenderOptions` types.** Today a new render type requires both a `CustomRenderOptions` schema entry (so the editor can configure it) and a registration. Could the registration carry both?
- **Synchronous `renderAdornment`.** Returns an `AdornmentRenderer` synchronously; mutating an animation/portal-bound adornment requires hooks-via-`apply`. With explicit reactivity in rxc, this could become a first-class component instead of a mutator.
- **`controlDefinitionSchema` discovery.** Today extensions are merged at `createFormRenderer` time, so the schema is fixed for the lifetime of the renderer. For editor mode that lets users add new render types at runtime, schema discovery may need to be reactive.
