# Legacy Extension Model (`@react-typed-forms/schemas`)

Reference document. Captures every plug-in seam in the legacy renderer: how custom registrations dispatch ahead of the defaults, how `ControlDefinitionExtension` augments the editor schema, how custom render types and expressions are added, and the smaller hooks (`customDisplay`, `useDataHook`, `adjustLayout`, `actionHandler`). Companion to `RENDERER-ARCHITECTURE.md`, `LAYOUT-PIPELINE.md`, `RENDERER-CATALOG.md`, and `ADORNMENTS-AND-VISIBILITY.md`.

## The two-tier registration list

`createFormRenderer(customRenderers, defaultRenderers)` builds the `FormRenderer` from two sources:

```ts
const allRenderers = [
  ...customRenderers,                          // explicit custom (highest priority)
  ...(defaultRenderers.extraRenderers ?? []),  // bundled extras
];
```

`defaultRenderers` itself is the `DefaultRenderers` slot map produced by `createDefaultRenderers(...)` (see `RENDERER-CATALOG.md` for what each slot contains). The `defaultRenderers.{data,group,action,display,adornment,label,renderLayout,visibility,array}` entries are **fallbacks** — they're only used if nothing in `allRenderers` matches.

There is no third tier. Hosts that want to override a default register a custom renderer that wins the match; the default sits dormant.

`allRenderers` is partitioned once by registration `type`:

```ts
const dataRegistrations      = allRenderers.filter(isDataRegistration);
const groupRegistrations     = allRenderers.filter(isGroupRegistration);
const adornmentRegistrations = allRenderers.filter(isAdornmentRegistration);
const displayRegistrations   = allRenderers.filter(isDisplayRegistration);
const labelRenderers         = allRenderers.filter(isLabelRegistration);
const arrayRenderers         = allRenderers.filter(isArrayRegistration);
const actionRenderers        = allRenderers.filter(isActionRegistration);
const layoutRenderers        = allRenderers.filter(isLayoutRegistration);
const visibilityRenderer     = allRenderers.find(isVisibilityRegistration)
                              ?? defaultRenderers.visibility;
```

Each render call then walks its bucket once. Since the buckets are filtered at construction time, dispatch is `O(matching registrations)` per render — typically a handful.

## Match predicates per registration type

`isOneOf(x, v)` is the workhorse helper:

```ts
function isOneOf<A>(x: A | A[] | undefined, v: A) {
  return x == null ? true : Array.isArray(x) ? x.includes(v) : v === x;
}
```

`undefined` means "no constraint" (matches anything); arrays let one registration handle several types.

### Data — `DataRendererRegistration`

The most complex match. `matchData(formState, renderOptions, dataNode)`:

```ts
function matchesRenderer(x: DataRendererRegistration) {
  const noMatch = x.match ? !x.match(formState, renderOptions) : undefined;
  if (noMatch === true) return false;

  const matchCollection =
    x.collection === null ||
    (x.collection ?? false) ===
      (dataNode.elementIndex == null && (field.collection ?? false));

  const isSchemaAllowed =
    !!x.schemaType && renderType == DataRenderType.Standard
      ? isOneOf(x.schemaType, field.type)
      : undefined;

  const isRendererAllowed =
    !!x.renderType && isOneOf(x.renderType, renderType);

  const optionsMatch =
    isRendererAllowed || (x.options ?? false) === options;

  return (
    matchCollection &&
    optionsMatch &&
    (isSchemaAllowed ||
      isRendererAllowed ||
      (!x.renderType && !x.schemaType && noMatch === false))
  );
}
```

Five filters, all of which can be combined:

| Field | Type | Meaning |
|---|---|---|
| `match?: (formState, renderOptions) => boolean` | predicate | Custom escape hatch. Returning `false` short-circuits. |
| `collection?: boolean \| null` | nullable bool | `true` matches array fields *only at the array level*; `false` matches scalars and per-element renders; `null` matches both. The "elementIndex == null" check is what makes `collection: true` skip per-element dispatches. |
| `schemaType?: FieldType \| FieldType[]` | type filter | Only checked when `renderType === Standard` — i.e. "default for this field type". |
| `renderType?: string \| string[]` | type filter | Match an explicit `DataRenderType` value (or any string). |
| `options?: boolean` | flag | `true` requires the field to have `fieldOptions` (resolved by `FormStateNode.resolved.fieldOptions`). |

The terminal `isSchemaAllowed || isRendererAllowed || (!x.renderType && !x.schemaType && noMatch === false)` clause means: for a registration with neither `renderType` nor `schemaType`, the only path to a match is via the custom `match` predicate returning `true`.

The first matching registration wins; everything else is skipped.

### Group — `GroupRendererRegistration`

```ts
groupRegistrations.find(x => isOneOf(x.renderType, renderType))
```

Just `renderType` matching against `groupOptions.type` (`GroupRenderType`).

### Display — `DisplayRendererRegistration`

```ts
displayRegistrations.find(x => isOneOf(x.renderType, props.data.type))
```

Matches against `DisplayDataType`.

### Action — `ActionRendererRegistration`

```ts
actionRenderers.find(x => isOneOf(x.actionType, props.actionId))
```

Matches against the action's string ID. `actionType: undefined` matches any action ID — useful for catch-all custom button styling.

### Adornment — `AdornmentRendererRegistration`

```ts
adornmentRegistrations.find(x => isOneOf(x.adornmentType, props.adornment.type))
```

Matches against `ControlAdornmentType`. The default adornment registration in `schemas-html` has no `adornmentType`, so it matches any adornment that no custom registration claimed (and routes internally — see `ADORNMENTS-AND-VISIBILITY.md`).

### Label — `LabelRendererRegistration`

```ts
labelRenderers.find(x => isOneOf(x.labelType, props.type))
```

Matches against `LabelType` (`Control`, `Group`, `Text`, `Inline`).

### Layout — `LayoutRendererRegistration`

```ts
layoutRenderers.find(x => !x.match || x.match(props))
```

No type filter — purely a custom predicate. Use case: a layout renderer that only kicks in for nodes inside an "advanced" section, or with a particular adornment present.

### Array — `ArrayRendererRegistration`

```ts
(arrayRenderers[0] ?? defaultRenderers.array).render(props, formRenderers)
```

No matching at all. The first registered array renderer wins. Hosts with multiple array styles need to pick by feeding `ArrayRendererProps.className` or wrapping at the data renderer level.

### Visibility — `VisibilityRendererRegistration`

```ts
allRenderers.find(isVisibilityRegistration) ?? defaultRenderers.visibility
```

Singleton — see `ADORNMENTS-AND-VISIBILITY.md`. Custom registrations replace the default wholesale.

## Factory helpers

`schemas/src/renderers.tsx` provides one factory per registration type — every factory is `(render, options?) => Registration`:

```ts
export function createDataRenderer(
  render: DataRendererRegistration["render"],
  options?: Partial<DataRendererRegistration>,
): DataRendererRegistration {
  return { type: "data", render, ...options };
}
// createGroupRenderer, createDisplayRenderer, createActionRenderer,
// createAdornmentRenderer, createLabelRenderer, createLayoutRenderer,
// createArrayRenderer, createVisibilityRenderer follow the same pattern.
```

The second argument is the partial registration body — `renderType`, `schemaType`, `match`, `schemaExtension`, etc. Putting these as a partial means hosts spread them: `createDataRenderer(myRender, { renderType: "MyType", schemaExtension: ... })`.

## `ControlDefinitionExtension` — augmenting the editor schema

A registration can carry a `schemaExtension?: ControlDefinitionExtension` that contributes new options/fields to the **editor's** view of `ControlDefinition`. This isn't about runtime rendering — it's about making the visual form designer aware of the new render type so it can offer it in dropdowns and emit the right JSON.

The shape:

```ts
export type ControlDefinitionExtension = {
  RenderOptions?:       CustomRenderOptions | CustomRenderOptions[];
  GroupRenderOptions?:  CustomRenderOptions | CustomRenderOptions[];
  ControlAdornment?:    CustomRenderOptions | CustomRenderOptions[];
  SchemaValidator?:     CustomRenderOptions | CustomRenderOptions[];
  DisplayData?:         CustomRenderOptions | CustomRenderOptions[];
  IconReference?:       CustomRenderOptions | CustomRenderOptions[];
  ControlDefinition?:   CustomRenderOptions | CustomRenderOptions[];
  SchemaField?:         CustomRenderOptions | CustomRenderOptions[];
};

export interface CustomRenderOptions {
  value?: string;             // discriminator value (e.g. "MyType")
  name: string;               // display name in the editor
  fields?: SchemaField[];     // extra fields specific to this type
  groups?: EditorGroup[];     // grouping in the editor UI
  applies?: (sf: SchemaNode) => boolean;
  optionField?: string;       // shortcut: register an option on an existing field
}
```

### Collection and merging

`createFormRenderer` collects extensions from every registration in `allRenderers`:

```ts
const extensions = allRenderers
  .map(x => x.schemaExtension)
  .filter((x): x is ControlDefinitionExtension => x != null);

const controlDefinitionSchema =
  extensions.length > 0
    ? createSchemaLookup(
        applyExtensionsToSchema(ControlDefinitionSchemaMap, extensions),
      ).getSchema("ControlDefinition")
    : undefined;
```

`applyExtensionsToSchema` walks each extension and folds it into the canonical `ControlDefinitionSchemaMap` (the self-describing schema for control definitions, in `forms-core/src/json/schemaSchemas.ts`):

```ts
export function applyExtensionToSchema<A extends SchemaMap>(
  schemaMap: A,
  extension: ControlDefinitionExtension,
): A {
  const outMap = { ...schemaMap };
  Object.entries(extension).forEach(([field, cro]) => {
    outMap[field] = (Array.isArray(cro) ? cro : [cro]).reduce(
      (a, cr) =>
        cr.optionField
          ? mergeOption(a, cr.name, cr.value, cr.optionField)
          : mergeFields(a, cr.name, cr.value, cr.fields ?? []),
      outMap[field],
    );
  });
  return outMap;
}
```

Two paths:

- **`optionField` shortcut** — adds a new value to an enum-like field. e.g. registering a new `RenderOptions.type` value without changing field structure.
- **`fields[]` shortcut** — adds new fields that only show when the parent's `type` is `cr.value`. Used by `RenderOptionsSchema` and friends, which already use `onlyForTypes` in their field metadata to gate per-type fields.

`createSchemaLookup(...).getSchema("ControlDefinition")` returns the resolved `SchemaNode` representing the augmented control-definition tree, which the renderer attaches as `formRenderers.controlDefinitionSchema`. The form editor uses this to render its own UI.

### Example: data-grid extension

```ts
export const DataGridExtension: ControlDefinitionExtension = {
  RenderOptions:      DataGridDefinition,           // adds DataRenderType.DataGrid
  ControlAdornment:   DataGridAdornmentDefinition,  // adds GridAdornment
  GroupRenderOptions: DataGridGroupDefinition,      // adds GroupRenderType.DataGrid
};
```

A host imports this and registers it via the data-grid renderer's registration:

```ts
createDataRenderer(myDataGridRender, {
  renderType: "DataGrid",
  schemaExtension: DataGridExtension,
});
```

When the renderer is built, the editor schema includes `DataGrid` in every relevant dropdown — and the runtime knows to dispatch render-type `DataGrid` to the registered renderer.

## Custom render types

`DataRenderType` and `GroupRenderType` are **string enums**, so any registration can declare a custom string and the dispatch will match it via `isOneOf`. The built-in enum values:

```ts
enum DataRenderType {
  Standard, Textfield, Radio, HtmlEditor, IconList, CheckList,
  UserSelection, Synchronised, IconSelector, DateTime, Checkbox,
  Dropdown, DisplayOnly, Group, NullToggle, Autocomplete, Jsonata,
  Array, ArrayElement, ElementSelected, ScrollList,
}

enum GroupRenderType {
  Standard, Grid, Flex, Tabs, GroupElement, SelectChild,
  Inline, Wizard, Dialog, Contents, Accordion,
}
```

Adding a new type is a one-liner:

```ts
createDataRenderer(myRender, { renderType: "MyType" })
```

The string flows through the same dispatch as built-ins. The only caveat: the C# server's `Astrolabe.Schemas` won't know about it — so JSON round-trips work, but server-side validation/codegen needs the type added on its end too.

## `defaultDataProps` — the data-props factory

When a data registration's `render(props, renderers)` is called, `props: DataRendererProps` has already been shaped by `defaultDataProps`:

```ts
export function defaultDataProps(
  { formNode, style, schemaInterface, styleClass, textClass: tc,
    displayOnly, inline, ...props }: RenderLayoutProps,
  definition: DataControlDefinition,
  control: Control<any>,
): DataRendererProps {
  const dataNode = props.dataContext.dataNode!;
  const field = dataNode.schema.field;
  const required = !!definition.required && !displayOnly;
  const id = "c" + control.uniqueId;
  return {
    dataNode, formNode, definition, control, field,
    id, errorId: "err_" + id,
    inline: !!inline,
    options: formNode.resolved.fieldOptions,
    readonly: formNode.readonly,
    displayOnly: !!displayOnly,
    renderOptions: definition.renderOptions ?? { type: "Standard" },
    required,
    hidden: !formNode.visible,
    className: rendererClass(styleClass, definition.styleClass),
    textClass: rendererClass(tc, definition.textClass),
    style,
    ...props,
  };
}
```

Hosts can override this per-definition via `ControlRenderOptions.useDataHook`:

```ts
interface ControlRenderOptions extends ControlClasses {
  useDataHook?: (c: ControlDefinition) => CreateDataProps;
  // ...
}

type CreateDataProps = (
  layoutProps: RenderLayoutProps,
  definition: DataControlDefinition,
  control: Control<any>,
) => DataRendererProps;
```

`useDataHook` is called per-definition (lets the host return different data-props factories for different control kinds). Use cases:

- Inject host-specific context into `DataRendererProps` (auth, theme, locale).
- Override `id`/`errorId` generation for accessibility frameworks.
- Compute a different `readonly`/`required` from external state.

The factory always returns a `DataRendererProps` — callers spread its result into the renderer call.

## Expression evaluators — `RunExpression`

`EntityExpression` is a discriminated union of expression types:

```ts
enum ExpressionType {
  Jsonata     = "Jsonata",      // full JSONata expression
  Data        = "Data",          // reference another field's value
  DataMatch   = "FieldValue",    // field equality check
  UserMatch   = "UserMatch",     // user-claim check
  NotEmpty    = "NotEmpty",      // field non-empty check
  UUID        = "UUID",          // generate a UUID
  Not         = "Not",           // negate the inner expression
}
```

The runtime evaluator type:

```ts
type RunExpression = (
  scope: CleanupScope,
  expression: EntityExpression,
  returnResult: (v: unknown) => void,
  variables?: (changes: ChangeListenerFunc<any>) => Record<string, any>,
) => void;
```

`RenderFormNode` constructs one per-render:

```ts
runExpression: (scope, expr, returnResult) => {
  if (expr?.type) {
    defaultEvaluators[expr.type](expr, {
      dataNode: state.parent,
      schemaInterface,
      scope,
      returnResult,
      runAsync,
    });
  }
},
```

`defaultEvaluators` is a record of `ExpressionEval` functions:

```ts
export const defaultEvaluators: Record<string, ExpressionEval<any>> = {
  [ExpressionType.DataMatch]: dataMatchEval,
  [ExpressionType.Data]:      dataEval,
  [ExpressionType.NotEmpty]:  notEmptyEval,
  [ExpressionType.Jsonata]:   jsonataEval,
  [ExpressionType.UUID]:      uuidEval,
};

interface ExpressionEvalContext {
  scope: CleanupScope;
  returnResult: (k: unknown) => void;
  dataNode: SchemaDataNode;
  schemaInterface: SchemaInterface;
  variables?: (changes: ChangeListenerFunc<any>) => Record<string, any>;
  runAsync(effect: () => void): void;
}

type ExpressionEval<T extends EntityExpression> = (
  expr: T, context: ExpressionEvalContext,
) => void;
```

Hosts add custom expression types by passing a custom `runExpression`:

```ts
options.runExpression = (scope, expr, returnResult, variables) => {
  if (expr.type === "MyCustom") {
    return myEval(expr, { scope, returnResult, ... });
  }
  return defaultEvaluators[expr.type]?.(expr, { scope, returnResult, ... });
};
```

Note: in the legacy code `defaultEvaluators` is a module-level object, so it *could* be patched globally — but every registration that consumes it does so via the host-supplied `runExpression`, so the cleaner path is per-host.

The `useExpression(defaultValue, runExpression, expression, coerce, bindings?)` hook is the React-side wrapper used by `SetFieldAdornment`, `JsonataRenderer`, and any host code that wants to bind UI to an expression.

## `actionHandler` — composable action dispatch

`ControlActionHandler`:

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

Returning `undefined` means "I don't handle this action — let the next handler try." Returning a function commits — that function runs when the user clicks.

Composition via `actionHandlers(...handlers)`:

```ts
export function actionHandlers(
  ...handlers: (ControlActionHandler | undefined)[]
): ControlActionHandler | undefined {
  const nonNullHandlers = handlers.filter(x => x != null);
  if (nonNullHandlers.length === 0) return undefined;
  return (actionId, actionData, ctx) => {
    for (const h of nonNullHandlers) {
      const res = h(actionId, actionData, ctx);
      if (res) return res;
    }
    return undefined;
  };
}
```

First handler that returns a non-undefined function wins. `RenderFormNode` composes parent + child handlers as it descends, so an outer "intercept all add-row clicks" handler can run alongside the inner "open dialog" default.

The convenience builder `makeActionHandler(handlerMap)` converts a `Record<string, fn>` to a `ControlActionHandler`:

```ts
export function makeActionHandler(
  handlerMap: Record<string, (actionData, actionCtx, dataCtx) => void | Promise<any>>,
): ControlActionHandler {
  return (actionId, actionData, dataCtx) => {
    const h = handlerMap[actionId];
    if (h) return (actionCtx) => h(actionData, actionCtx, dataCtx);
    return undefined;
  };
}
```

Built-in action IDs include `openDialog`, `closeDialog` (intercepted by `DefaultDialogRenderer`), wizard `next`/`prev` (intercepted by the wizard renderer), and array `add`/`remove`/`reorder` (handled internally by the array renderers). Custom action IDs flow through to the host's handler.

## Smaller render-time hooks

All on `ControlRenderOptions` (passed to `<RenderForm options={...}>`):

| Hook | Signature | Purpose |
|---|---|---|
| `customDisplay?` | `(customId: string, props: DisplayRendererProps) => ReactNode` | Renders `DisplayDataType.Custom` entries. The `customId` is the `customId` field on the display data. |
| `useDataHook?` | `(c: ControlDefinition) => CreateDataProps` | Per-definition factory replacement for `defaultDataProps`. |
| `adjustLayout?` | `(ctx: ControlDataContext, props: ControlLayoutProps) => ControlLayoutProps` | Final tweak to layout props before `renderLayout`. See `LAYOUT-PIPELINE.md`. |
| `actionHandler?` | `ControlActionHandler` | Custom action dispatch. |
| `actionOnClick?` | `ControlActionHandler` | Legacy alias, used as fallback if `actionHandler` is absent. |
| `schemaInterface?` | `SchemaInterface` | Override field-value semantics (empty detection, comparison, length, validation messages, date parsing). |

Class hooks (`styleClass`, `labelClass`, `labelTextClass`, `textClass`, `layoutClass`, `controlLabelClass`, `controlLabelTextClass`, `groupLabelClass`, `groupLabelTextClass`) are also on `ControlRenderOptions` — they cascade to children unless overridden by a child's definition.

Inheritable options (`readonly`, `disabled`, `variables`, `hidden`) flow down via `RenderFormNode`'s `childOptions` build:

```ts
const { readonly, visible: vis, disabled, variables } = state;
const childOptions: ControlRenderOptions = {
  ...inheritableOptions,
  readonly,
  disabled,
  variables,
  hidden: vis === false,
};
```

## `resolveChildren` override

`FormRenderer.resolveChildren(c: FormStateNode): ChildNodeSpec[]` is consulted by `FormStateNode` when materializing children. The default uses `defaultResolveChildNodes` (which expands array elements, compound fields, etc.). A data registration can override:

```ts
interface DataRendererRegistration {
  type: "data";
  resolveChildren?: ChildResolverFunc;
  // ...
}
```

The dispatch:

```ts
resolveChildren(c: FormStateNode): ChildNodeSpec[] {
  const def = c.definition;
  if (isDataControl(def)) {
    if (!c.dataNode) return [];
    const matching = matchData(c, def.renderOptions ?? { type: "Standard" }, c.dataNode);
    if (matching?.resolveChildren) return matching.resolveChildren(c);
  }
  return defaultResolveChildNodes(c);
}
```

A custom data renderer that wants to expand its own children differently — e.g. a check-list renderer that creates one child node per option for per-option validators — can supply `resolveChildren` and own the child topology entirely.

## Summary: registration anatomy

A complete custom data renderer that exercises every extension point:

```ts
const myRenderer = createDataRenderer<MyProps>(
  (props, renderers) => /* render fn */ <MyComponent {...props} />,
  {
    renderType: "MyType",                    // dispatch key
    schemaType: FieldType.String,            // optional: also default for Strings
    collection: false,                       // scalar only
    options: false,                          // doesn't need fieldOptions
    match: (formState, renderOpts) =>        // custom predicate (rarely needed)
      someAdditionalCondition(formState),
    resolveChildren: (formNode) =>           // custom child topology
      myChildSpecs(formNode),
    schemaExtension: {                       // editor metadata
      RenderOptions: {
        value: "MyType",
        name: "My Type",
        fields: [/* per-type editor fields */],
      },
    },
  },
);
```

Plug it into `createFormRenderer`:

```ts
const renderer = createFormRenderer(
  [myRenderer],
  createDefaultRenderers(),
);
```

Or via `extraRenderers` for bundled distribution:

```ts
const renderer = createFormRenderer(
  [],
  createDefaultRenderers({
    extraRenderers: () => [myRenderer],
  }),
);
```

## Settled invariants

1. **Custom always wins.** `customRenderers` precede `extraRenderers` in `allRenderers`, and `allRenderers` precedes `defaultRenderers.X` in every dispatch path. There is no override mechanism for the defaults beyond not matching them.
2. **Match-by-string.** `renderType`, `actionType`, `adornmentType`, `labelType`, `schemaType` are all strings under the hood. New values are valid as long as both ends (renderer + producer) agree.
3. **Predicate-only matching is opt-in.** A registration with no `renderType`/`schemaType` only matches via `match: () => true`. This prevents accidental catch-alls.
4. **Extension schema is editor-only.** `controlDefinitionSchema` is computed but never consumed by the runtime renderer — it exists for the visual form designer.
5. **Expression evaluators are per-host.** `defaultEvaluators` is a module-level object but every consumer routes through the host-supplied `runExpression`, so customization happens at render-call time, not by global mutation.
6. **Action handlers are first-match.** Composition is sequential — the first handler that returns a function commits; later handlers never see the action.
7. **Single visibility, single layout per matching predicate.** Layout uses a custom `match` (not type), and visibility doesn't dispatch at all — so these are at most once-per-app-overrides.

## Open questions for the redesign

- **Predicate-based matching ergonomics.** The `match`/`renderType`/`schemaType` interaction is subtle. A redesign could collapse to a single predicate, or commit to type-based dispatch only — the current dual-track is hard to reason about.
- **Default behaviour for `collection: undefined`.** Defaults to `false`, which trips users who don't read the docs. A `null` value (matches both) is more sensible as default.
- **`extraRenderers` vs explicit custom.** Both achieve the same thing with the same priority; the split exists historically because `createDefaultRenderers` is parameterized but `createFormRenderer` takes a separate list. Worth flattening.
- **Editor-schema separation.** The `schemaExtension` field on every registration mixes runtime concerns with editor concerns. A separate "editor extension" registry would make the runtime renderers thinner.
- **Expression dispatch.** The current path goes through a per-render `runExpression` factory; a registry similar to renderers would let evaluator extensions compose more cleanly.
- **`useDataHook` is per-definition.** Since it's called every render, hosts that want to memoize the factory have to do it themselves. A "props transformer" registry keyed by render type might be cleaner.
- **Action handlers are first-match, not by ID.** Custom hosts that want a default fallback for unhandled IDs can chain a catch-all at the end — but the API doesn't make this obvious. A `Record<string, fn>` would be more discoverable than the function-of-function shape.
