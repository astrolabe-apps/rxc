# Migrating from `@react-typed-forms/schemas` to `@rx-controls/forms`

A Rosetta stone for porting a host (or a custom renderer set) from the legacy `@react-typed-forms/schemas` + `@react-typed-forms/schemas-html` packages onto `@rx-controls/forms` + `@rx-controls/forms-react-core`.

This doc maps **legacy concept → new equivalent** and calls out where the port is mechanical, where it requires translation, and where there's no equivalent and the host needs to redesign.

For background on *why* the redesign turned out the way it did, see `docs/legacy/RENDERER-ARCHITECTURE.md` (legacy) and the implementations in `packages/forms-react-core/src` and `packages/forms/src` (new).

## Package mapping

```
@react-typed-forms/core             → @rx-controls/react + @rx-controls/core
@react-typed-forms/schemas          → @rx-controls/forms-core (data model)
                                      @rx-controls/forms-react-core (dispatch + hooks)
@react-typed-forms/schemas-html     → @rx-controls/forms (HTML renderers + chrome)
                                      @rx-controls/forms-motion (animated visibility / accordion — opt-in)
                                      @rx-controls/forms-dnd (sortable arrays — opt-in)
```

`@rx-controls/forms` re-exports `@rx-controls/forms-react-core` so consumers import from `@rx-controls/forms` only. The split exists so a future `@rx-controls/forms-native` (or `@rx-controls/forms-mui`) can sit on the same headless layer.

For the *controls* layer, `@react-typed-forms/core@5` — the compat package at `packages/compat-controls`, published under the legacy name — is a drop-in upgrade for v4 consumers (see `docs/COMPAT-CONTROLS-DESIGN.md`). For the schemas/renderer layer there is deliberately no compat package — this doc's direct port is the migration path.

## Entry points

| Legacy | New | Notes |
|---|---|---|
| `<RenderForm form={…} data={…} renderer={…} options={…} />` | `<Form node={…} registry={…} options={…} />` | `Form` no longer builds the `FormStateNode`. Build it once with `useFormStateNode(controlContext, formNode, dataNode, { registry, … })` and pass it in. |
| `<RenderFormNode node={…} renderer={…} options={…} />` | `<Field node={…} />` | `Field` reads the registry from context (`<RegistryProvider>` set up by `<Form>`). Layout/Visibility/designMode can be overridden per-Field. |
| `createFormStateNode(form, data, globals, options)` (engine) | `createFormStateNode(controlContext, form, dataNode, globals)` (`@rx-controls/forms-core`) | Now requires an explicit `ControlContext`. The `useFormStateNode` hook handles this for you. |

The new flow is:

```tsx
const cc = useControlContext();
const data = useControl(initialValue);
const dataNode = makeDataNode(form, data);   // one-line helper from forms-core
const node = useFormStateNode(cc, form, dataNode, { registry: defaultRegistry() });
return <Form node={node} />;
```

## Registration shapes

The legacy engine has nine `RendererRegistration` kinds and one `extraRenderers` lane. The new engine has three matcher arrays (`data`/`group`/`action`/`display`), one adornment registration list, and two metadata maps (`schemaExtensions`, `childResolvers`) — all on a single `FormRegistry`.

| Legacy registration | New equivalent |
|---|---|
| `DataRendererRegistration` | `DataMatcher` in `registry.data[]`, optionally via `dataPlugin({…})` |
| `GroupRendererRegistration` | `GroupMatcher` in `registry.group[]`, optionally via `groupPlugin({…})` |
| `ActionRendererRegistration` | `ActionMatcher` in `registry.action[]`, optionally via `actionPlugin({…})` |
| `DisplayRendererRegistration` | `DisplayMatcher` in `registry.display[]`, optionally via `displayPlugin({…})` |
| `LabelRendererRegistration` | No registration. Swap `<Label>` via `Layout` or write a custom `Layout` that renders its own label. |
| `ArrayRendererRegistration` | No separate kind. Array UI is part of the data renderer; replace `ArrayRenderer` by registering a `matchCollection(MyArray)` matcher. |
| `AdornmentRendererRegistration` | `AdornmentRegistration` in `registry.adornments[]` |
| `LayoutRendererRegistration` | Swap the `<Layout>` component via `<Form layout={…}>`, `<LayoutProvider>`, or `<Field layout={…}>` |
| `VisibilityRendererRegistration` | Swap the `<Visibility>` component via `<Form visibility={…}>`, `<VisibilityProvider>`, or `<Field visibility={…}>` |
| `schemaExtension: ControlDefinitionExtension` | `schema?: SchemaField[]` on the plugin spec — merged into `registry.schemaExtensions` |
| `resolveChildren` on a registration | `resolveChildren?: ChildResolverFunc` on the plugin spec — merged into `registry.childResolvers` |
| `extraRenderers` lane | Just earlier matcher entries. Composition order is `combineRegistries(custom, defaultRegistry())`. |

Combining registries:

```tsx
import { combineRegistries } from "@rx-controls/forms-react-core";
import { defaultRegistry } from "@rx-controls/forms";

const registry = combineRegistries(
  myCustomRegistry,        // matchers here run first — same as legacy "custom wins"
  defaultRegistry(),
);
```

`combineRegistries` accepts `Partial<FormRegistry>`, so a plugin can return only the fields it touches.

## Dispatch & matching

Legacy data dispatch combined `schemaType`, `renderType`, `collection`, `options`, and `match` into a single non-trivial predicate evaluated against each registration in order. The new design replaces all of that with **matcher functions** — each takes the node and returns `{component, hidesLabel?} | null`. First non-null wins.

Sugar helpers cover the common cases:

| Legacy field | New matcher helper |
|---|---|
| `renderType: "Foo"` | `matchRenderType("Foo", Component, meta?)` |
| `renderType: ["Foo","Bar"]` | `matchRenderTypeOneOf(["Foo","Bar"], Component, meta?)` |
| `schemaType: "String"` | `matchSchemaType(FieldType.String, Component, meta?)` |
| `options: true` | `matchHasOptions(Component, meta?)` |
| `collection: true` | `matchCollection(Component, meta?)` (matches the array as a whole, not its elements — same as legacy) |
| `match: (state, ro) => bool` | Inline matcher: `(node, rc) => predicate ? { component } : null` |
| `(no flags) — fallback` | `matchDataAlways(Component)` / `matchGroupAlways` / `matchActionAlways` / `matchDisplayAlways` |

Combining predicates:

```tsx
matchAll(matchCollection, matchRenderType("Standard"), MyArray)   // AND, returns the last match
matchAny(matcherA, matcherB)                                       // OR, first hit wins (rare)
```

`matchAll`'s "last match wins" rule means the producer (the matcher that supplies the component) goes last. Predicates first, producer at the tail.

Custom registrations in legacy *also* contributed to `resolveChildren` and `schemaExtension` lookups via the same registration object. The new equivalent: use a `*Plugin` helper, which emits a `Partial<FormRegistry>` covering all three:

```tsx
const myChart = dataPlugin({
  type: "MyChart",
  component: MyChartRenderer,
  schema: [
    { field: "title",  type: FieldType.String, tags: [SchemaTags.ScriptNullInit] },
    { field: "series", type: FieldType.String, tags: [SchemaTags.ScriptNullInit] },
  ],
  resolveChildren: (node, rc) => …,
});
```

## Renderers

### Data and group renderers — components, not factories

Legacy `createDataRenderer((props, renderers) => ReactNode | (layout) => ControlLayoutProps)` returned **either** a React node **or** a layout transformer. The new shape is just a React component.

```tsx
// Legacy
createDataRenderer((props, renderers) => {
  const { control, field } = props;
  return (l) => ({ ...l, children: <input value={control.value} … /> });
});

// New
const TextfieldRenderer = controls<DataRendererProps>(
  ({ node, id }, { rc, update }) => {
    const { data } = node.getState(rc);
    return <input
      id={id}
      value={String(data?.getValue(rc) ?? "")}
      onChange={(e) => update(wc => wc.setValue(data!, e.target.value))}
    />;
  },
);
```

Renderers are plain function components that call `useReactive()` for their rc. Reads through `rc` (`rc.getValue`, `rc.getError`, `node.getState(rc)`, `node.getChildren(rc)`) are tracked per-render — finer-grained than legacy `@trackControls` — and **every return path must be wrapped in `rendered(…)`**, which is what turns the tracked reads into live subscriptions. Annotate the return type `Rendered` so a missed path is a build error; see `docs/RENDER-BOUNDARY.md`.

The legacy "influence the chrome" use cases collapse to rendering different React trees:

| Legacy (mutated `ControlLayoutProps`) | New |
|---|---|
| Override `label` | Render the label inside your renderer's own DOM and declare `hidesLabel: true` on the matcher (e.g. `BoolRenderer`, `RadioRenderer`). |
| Set `errorControl` to an aggregate | Render `<Error node={someOtherNode}/>` directly — `<Error>` is a normal component, not a slot. |
| Drop the label entirely | Same — `hidesLabel: true` on the matcher. |
| Append `displayOnlyClass` | Apply the class inside your renderer; nothing in the chrome system needs to know. |
| Set `inline: true` | Render an inline tree (`<span>` etc.) yourself. The legacy `inline` slot has no engine equivalent. |

`DataRendererProps` carries `node: FormStateNode` and `id: string` (from `useId()`). Everything else is read off `node.getState(rc)`. There is no `renderers` parameter — recursive rendering is `<Field node={child}/>`.

### Display and action renderers — already components

Legacy `renderDisplay` / `renderAction` already returned `ReactNode`, so the port is mechanical:

```tsx
// Legacy
createDisplayRenderer({
  renderType: "MyTag",
  render: (props) => <span className="tag">{props.data.text}</span>,
})

// New
displayPlugin({ type: "MyTag", component: ({ data }) => <span className="tag">{data.text}</span> })
```

The `displayDataType: "Custom"` callback (`ControlRenderOptions.customDisplay`) is now a typed map:

```tsx
<Form options={{ customDisplays: { foo: FooDisplay, bar: BarDisplay } }} … />
```

### Array renderer — no separate kind

Legacy `createArrayRenderer` was a singleton — only the first match won. There's now no separate `ArrayRendererRegistration`; the array UI is the **data renderer for collection fields**. Replace it by registering your own matcher:

```tsx
combineRegistries(
  { data: [matchCollection(MySortableArrayRenderer)] },   // earlier = wins
  defaultRegistry(),
);
```

`@rx-controls/forms-dnd`'s `SortableArrayRenderer` is exactly this — a drop-in replacement for the default `ArrayRenderer` that consumes `@dnd-kit/sortable`.

The new array renderer mutates the underlying control directly (`wc.addElement`/`wc.removeElement`) instead of going through an `ArrayRendererProps.add/remove` indirection.

### Label, layout, visibility — swappable components, not registrations

`<Label>`, `<Layout>`, `<Visibility>` are plain components with three resolution sites:

- **Global** — `<Form layout={…} visibility={…}>`
- **Subtree** — `<LayoutProvider>`/`<VisibilityProvider>`
- **Per-node** — `<Field layout={…} visibility={…}>`

Resolution: prop > nearest provider > default.

`LabelType.Inline` (legacy hint to render the label after the input for checkboxes) becomes `hidesLabel: true` on the matcher — the renderer absorbs the label entirely (semantic `<label><input/></label>`). The `inline-vs-not` chrome decision moves into the renderer's own DOM.

`renderLabelText` (the global text-transformer hook used by HTML-in-label hosts like ServiceTas's `HtmlLabelRenderer`) has **no current equivalent**. Adornment-rendered labels and action button text don't funnel through any single hook. If you need this, swap `<Label>` for now and treat HTML-in-help-text/button-text as a known gap.

## Layout pipeline

Legacy: `renderData`/`renderGroup` produced `(layout) => ControlLayoutProps`, which fed into `renderLayoutParts` that mutated a `RenderedLayout` (slots: `labelStart`, `labelEnd`, `controlStart`, `controlEnd`, `children`, `label`), then `renderLabel`/adornments mutated it more, then `renderLayout` produced the final tree.

New: composition by component wrapping. `Field` builds the tree like this:

```
<Visibility visible={state.visible}>
  {wrapAdornments(fieldAdornments, kind="field",
    <Layout label={wrapAdornments(labelAdornments, kind="label", <Label/>)}
            error={<Error/>}>
      {wrapAdornments(controlAdornments, kind="control", <Renderer/>)}
    </Layout>
  )}
</Visibility>
```

Slot-style "push content into `LabelEnd`" → either a `kind: "label"` adornment that wraps the label, or — for hosts that need a genuinely new chrome slot — a custom `<Layout>` with an extra prop.

### `processLayout` chain → component composition

| Legacy hook | New equivalent |
|---|---|
| `processLayout` (per-renderer transformer) | Render a different React tree from your renderer. |
| `wrapLayout` (chained wrapping of `RenderedLayout`) | A `kind: "field"` adornment, or a host component wrapping `<Field>`. |
| `adjustLayout(dataContext, layout)` (final tweak) | Wrap `<Field>` in a host component that reads what it needs from `node`. |
| `useDataHook` (per-definition prop factory) | Read whatever you need from `node.getState(rc)` directly inside the renderer. |

There is no central `RenderedLayout` value being passed around. There is no `MarkupKeys` enum to extend. Adding a chrome slot now means adding a prop to your `<Layout>`; existing forms ignore the prop.

## Adornments

Legacy `AdornmentRenderer = { adornment?, priority, apply(layout: RenderedLayout): void }` — a synchronous mutator.

New `AdornmentRegistration` — a React component that wraps content. Three composition slots (`kind`):

```tsx
{
  type: ControlAdornmentType.Icon,
  kind: ["label", "control"],            // multi-slot supported — the render fn branches on `kind`
  priority: 0,                           // higher = outer wrap
  render: ({ adornment, node, kind, children }) => {
    if (kind === "label") return <span>{adornment.icon}{children}</span>;
    return <span>{children}{adornment.icon}</span>;
  },
}
```

- `kind: "label"` adornments wrap the label.
- `kind: "control"` adornments wrap the renderer's output.
- `kind: "field"` adornments wrap the entire `<Layout>` element.
- `kind: ["label", "control"]` — same registration emits in both slots; the render fn reads `kind` to decide what to emit.

Priority semantics are preserved: ascending sort, highest-priority wraps outermost. The legacy `AppendAdornmentPriority = 0` / `WrapAdornmentPriority = 1000` constants map directly.

`AdornmentPlacement` (`ControlStart`, `ControlEnd`, `LabelStart`, `LabelEnd`) is now interpreted **inside the adornment's render fn** rather than steering `RenderedLayout` mutation:

- `ControlStart` / `ControlEnd` — branch on `placement` inside a `kind: "control"` registration.
- `LabelStart` / `LabelEnd` — branch on `placement` inside a `kind: "label"` registration. Use the multi-kind shape (`kind: ["label", "control"]`) if a single adornment supports both.

Stateful legacy adornments that smuggled a React component into a slot (e.g. `SetFieldWrapper` to host hooks) become trivially natural — the render is a component, hooks just work.

## Visibility

Legacy `Visibility` was `Control<{visible, showing} | undefined>` — the engine flipped `visible`, custom renderers ran an exit animation then mirrored `showing` to false to actually unmount.

New `<Visibility>` receives a single `visible: boolean | null` prop. The animation library (Framer Motion's `<AnimatePresence>`, react-transition-group, etc.) handles "stay mounted during exit" inside its own component. There is no two-flag dance.

```tsx
// Legacy: animated unmount required custom Visibility logic
// New: use Framer Motion (or your favourite) directly:
import { FadeVisibility } from "@rx-controls/forms-motion";
<Form visibility={FadeVisibility} … />
```

`@rx-controls/forms-motion` ships `FadeVisibility`, `SlideVisibility`, and a height-animated `MotionAccordionAdornment` (replaces the native-`<details>` Accordion).

`visible === null` (pending — async script not yet resolved) is rendered as hidden by `DefaultVisibility`. Hosts that want a loading skeleton swap the component.

## Actions

Legacy:

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

The handler returned a click handler. Inside the click handler the host called `actionContext.disableForm(t)` *before* the first `await` to set the disable scope. `actionHandlers(parent, child)` chained handlers as a flat first-match list.

New:

```ts
type ActionHandler = (
  actionId: string,
  actionData: unknown,
) => unknown | Promise<unknown>;

<ActionScope onAction={(id, data) => /* boolean | "handled" | undefined */}>
  {children}
</ActionScope>
```

| Legacy | New |
|---|---|
| `actionHandlers(parent, child)` flat chain | `<ActionScope>` — nested scopes shadow ancestors. `useActionHandler()` walks up via React context. |
| Internal `openDialog`/`closeDialog`/`next`/`prev` interception | `DialogRenderer`/`WizardRenderer` install their own `<ActionScope>` around their content. |
| `actionContext.disableForm(t)` (mutation before first await) | `definition.disableType` is read at click time and passed to `useAsyncAction(node, handler, actionId, actionData, disableType)`. The mutation contract is gone — the disable scope is committed at dispatch. |
| Engine sets busy + calls `formNode.ui.getDisabler(t)()` after promise rejection (no `.catch`) | `useAsyncAction` wires `.catch` + `.finally` so a rejected handler always releases busy and the disabler hold. |
| `formNode.ui.getDisabler(type)` | `node.acquireDisabler(type)` returns a release function. Disabler counter on `FormStateNode` lets multiple actions stack. |

Note: legacy `useActionHandler` had a fallback to `options.actionHandler` from `<Form options={…}>`. The new `useActionHandler()` only walks `<ActionScope>`s — there is no `FormOptions.actionHandler`. If your host needs a top-level fallback, install one `<ActionScope>` at the form root.

## Expressions

Legacy `RunExpression` (`(scope, expression, returnResult, variables) => void`) becomes `useExpression(rc, node, expr)` — a hook returning the latest result reactively. Async expressions (Jsonata) re-run as their inputs change.

```tsx
// Legacy
runExpression(cleanupScope, expr, (v) => setResult(v), () => ({ foo: bar }));

// New (inside a controls() renderer)
const result = useExpression(rc, node, expr);
```

Variables come from `node.getState(rc).variables` — set them when building the FormStateNode via `FormNodeOptions.variables`.

## Custom render types — `schemaExtension` → plugin spec

Legacy: a registration carried `schemaExtension: ControlDefinitionExtension`; all extensions were merged into `controlDefinitionSchema` at `createFormRenderer` time.

New: pass a `schema: SchemaField[]` on the plugin spec. The renderer collects these into `extraRenderOptionFields` and threads them into `createFormStateNode`'s globals — the scripted-proxy walker discovers scriptable fields without any extra wiring.

```tsx
// Legacy
createDataRenderer({
  renderType: "MyChart",
  schemaExtension: { … },
  render: (props) => …,
});

// New
dataPlugin({
  type: "MyChart",
  component: MyChartRenderer,
  schema: [ /* SchemaField[] */ ],
});
```

The schema shape is `SchemaField[]` (the renderOptions sub-fields), not a full `ControlDefinitionSchema` map entry. The plugin author lists the scriptable fields; the engine handles the rest.

## `HtmlComponents` slot → CSS theme

Legacy `FormRenderer.html: HtmlComponents` was a slot of primitive components (`Div`, `Span`, `Input`, …) that every renderer dispatched DOM through, so a host could swap implementations.

New: renderers emit DOM directly. Host customisation goes through `HtmlFormOptions.theme` — a tree of class-name overrides for every renderer/adornment, merged via `rendererClass()` with the legacy `@ ` override-prefix convention preserved.

```tsx
<Form
  options={{
    theme: {
      data: {
        inputClass: "my-input",
        select: { className: "my-select" },
      },
      action: { primaryClass: "my-btn-primary" },
    },
  }}
  …
/>
```

Per-control class on the form definition (`styleClass`, `labelClass`, `labelTextClass`, `layoutClass`, `textClass`) is layered on top — same merging rules as legacy `astrolabe-common/util.ts`. Prefix a class with `"@ "` to opt out of merging and override.

For React Native or MUI, the boundary line is **does it emit DOM?**. `@rx-controls/forms-react-core` is DOM-free — a separate `@rx-controls/forms-native` or `@rx-controls/forms-mui` package would supply its own `<Field>`/`<Layout>`/renderers/adornments on top of the same headless dispatch.

## Compound-field rewrite

Legacy `renderControlLayout` rewrote `isGroupControl(c) && c.compoundField` into a `dataControl(...)` and re-dispatched. The data ladder then dispatched compound fields back to the group renderer in step 2.

New: one direction only. `CompoundDelegate` is a data matcher that delegates compound fields to the group dispatch. Compound *groups* (`isGroupControl(c) && c.compoundField`) are no longer rewritten — the engine treats compound nodes as data controls that delegate, period.

If your host had a custom `compoundField` group renderer, port it as a custom data matcher instead.

## Scripted proxy / dynamic options

Legacy `evalDynamic` + `dynamic[]` arrays on a definition → automatically converted by `buildLegacyScripts` (in `@rx-controls/forms-core`) into the `$scripts` bucket the new scripted-proxy reads. **No host changes needed** — JSON definitions with legacy `dynamic` entries are still understood.

The scripted-proxy walker now drives off `ControlDefinitionSchema` (`@rx-controls/forms-core/json/schemaSchemas.ts`) plus per-render-type extensions registered via `dataPlugin({ schema: … })`. There is no longer a per-renderer hardcoded `SCRIPTABLE_FIELDS` table.

## Settled invariants — what carried over unchanged

These legacy invariants are preserved:

1. JSON wire format for `ControlDefinition` and `SchemaField` — exact same C# server output.
2. First-match dispatch order — earlier registrations win.
3. Adornment priorities — ascending sort, highest = outermost.
4. `resolveChildren` overrides at the registration level (now via `dataPlugin({ resolveChildren })`).
5. `defaultValue` / `clearHidden` semantics on `FormStateNode` — including the "skip default-value init when the node has an `Optional` adornment" rule.
6. `displayOnly` short-circuits options/render-type matching (now: `matchDisplayOnly` runs before option-aware matchers in the default list).
7. `Bool` field with no options → checkbox (now: `matchBoolDefault` with `hidesLabel: true`).
8. CheckList/Radio per-option child expansion (now: `defaultResolveChildren` recognises these render types and expands).
9. `Length` validator's array auto-pad behavior — preserved by `setupValidation`.
10. Required-vs-empty placeholder logic in `<select>` — preserved by `SelectRenderer`.

## Settled invariants — what changed

1. **Renderer factories are gone.** Renderers are React components; recursive rendering is `<Field node={child}/>`, not `renderChild(child)`.
2. **Layout is a component, not slot mutation.** `processLayout`/`wrapLayout`/`adjustLayout` have no equivalent — host customisation is component swap or tree shape.
3. **Visibility is one prop, not two.** `{visible, showing}` collapses to `visible: boolean | null` — exit animations are the host's concern.
4. **Action handler signature.** No `ActionContext` parameter, no "disableForm before first await" mutation contract. `disableType` is read off the definition at dispatch and passed to `useAsyncAction`.
5. **Compound-field group rewrite is gone.** Use `CompoundDelegate` (a data matcher) — there is no implicit re-dispatch.
6. **`HtmlComponents` slot is gone.** Renderers emit DOM directly; theme customisation goes through `HtmlFormOptions.theme`.
7. **`FormRenderer` interface is gone.** There's no aggregated renderer object — dispatch reads `useRegistry()` directly. Code that took a `FormRenderer` parameter ports to taking a `FormRegistry`.
8. **`useDataHook` is gone.** Read `node.getState(rc)` directly.
9. **Reactivity boundary is per-renderer.** Each renderer is an ordinary function component that calls `useReactive()` and returns `rendered(…)`. Replace `@trackControls` with `const { rc, rendered } = useReactive()` plus a `: Rendered` return annotation.

## Known limitations / port hazards

- **Renderers that returned `(layout) => ControlLayoutProps`.** No mechanical port — the layout-mutation surface is gone. Translate manually:
  - `processLayout` mutating `children` → render that React tree directly.
  - `processLayout` setting `errorControl` → render `<Error node={…}/>` for the alternate node directly.
  - `processLayout` adding to `controlStart`/`controlEnd` → wrap your renderer's output with the extra content directly, or register a `kind: "control"` adornment.
- **`renderLabelText` / HTML-in-label.** No equivalent today. `<Label>` is swappable, but adornment-rendered labels and action button text don't funnel through any single hook. Track this gap if your host depends on it.
- **`actionHandlers(...)` chain spanning the whole form.** No global handler chain — install a root `<ActionScope>` at the form level if you need a fallback.
- **`Visibility.showing` mirroring.** Hosts that read `showing` to coordinate "is anything currently animating out?" need to publish that state from their custom Visibility component. The form engine no longer exposes it.
- **`controlDefinitionSchema` discovery at runtime.** Legacy merged extensions at `createFormRenderer` time — fixed for the lifetime of the renderer. The new engine reads `registry.schemaExtensions` from React context, so editor hosts that mutate the registry at runtime get reactive schema discovery for free.
- **`FormRenderer.html.Input` etc.** Hosts that wrapped legacy primitives for ARIA injection or styling now need to provide a custom renderer for each affected control type. There is no shared DOM-primitive slot.
- **Multi-error display.** Default `<Error>` shows the first error. Pass `<Error all>` per-call, or `<Form options={{ showAllErrors: true }}>` form-wide. No "summary panel" component is shipped — read `state.errors` (or `rc.getErrors(data)`) directly for that.
- **Reorder for arrays.** Default `ArrayRenderer` is reorder-free. `@rx-controls/forms-dnd`'s `SortableArrayRenderer` adds reorder; install via `combineRegistries({ data: [matchCollection(SortableArrayRenderer)] }, defaultRegistry())`.
- **`OptionalAdornment` multi-value mode.** Legacy's `OptionalEditRenderer` accepted a `renderMultiValues` callback driven by `getAllValues(dataControl)` — when N controls were bound to the same field (bulk edit), the inactive state showed "Differing values" (or a host-supplied summary) instead of the field. The new port has no equivalent of `getAllValues` (controls-core doesn't model fan-out from one `Control` to many backing controls), but the adornment exposes `theme.adornment.optional.customRender` — hosts get the resolved data control, the editing toggle, current `isNull`/`isEditing`/`shouldDisable`, the wrapped field, and the `defaultBody` the adornment would render. Hosts that maintain their own bulk-edit projection (e.g. a `Control<unknown[]>` of distinct values stored in `meta`) read it inside `customRender` and decide whether to render `defaultBody` or a "Differing values" summary. Known consumer: `hvams.roadmanager.server`'s `internalForm/useInternalFormRenderer.tsx`.

## Worked examples

### Porting a custom data renderer

Legacy:

```tsx
const PercentRenderer = createDataRenderer({
  schemaType: FieldType.Double,
  renderType: "Percent",
  render: ({ control, field, readonly }, renderers) => {
    const pct = (control.value ?? 0) * 100;
    return <input
      type="number"
      value={pct}
      readOnly={readonly}
      onChange={(e) => control.setValue(Number(e.target.value) / 100)}
    />;
  },
});

const renderer = createFormRenderer([PercentRenderer], defaultRenderers);
```

New:

```tsx
import { controls } from "@rx-controls/react";
import { dataPlugin, type DataRendererProps } from "@rx-controls/forms-react-core";
import { combineRegistries } from "@rx-controls/forms-react-core";
import { defaultRegistry } from "@rx-controls/forms";

const PercentRenderer = controls<DataRendererProps>(
  ({ node, id }, { rc, update }) => {
    const { data, readonly } = node.getState(rc);
    const value = (rc.getValue(data!) as number ?? 0) * 100;
    return <input
      id={id}
      type="number"
      value={value}
      readOnly={readonly}
      onChange={(e) =>
        update((wc) => wc.setValue(data!, Number(e.target.value) / 100))
      }
    />;
  },
);

const registry = combineRegistries(
  dataPlugin({ type: "Percent", component: PercentRenderer }),
  defaultRegistry(),
);
```

Match-by-`schemaType` happens upstream in the registry; pass it explicitly if you want it:

```tsx
combineRegistries(
  { data: [
    matchAll(matchSchemaType(FieldType.Double),
             matchRenderType("Percent", PercentRenderer)),
  ]},
  defaultRegistry(),
);
```

### Porting a custom adornment

Legacy:

```tsx
const HighlightAdornment = createAdornmentRenderer({
  adornmentType: "Highlight",
  render: ({ adornment }) => ({
    adornment,
    priority: 100,
    apply: (layout) => {
      layout.wrap.unshift((node) => <div className="hl">{node}</div>);
    },
  }),
});
```

New:

```tsx
import type { AdornmentRegistration, AdornmentRenderProps } from "@rx-controls/forms-react-core";

interface HighlightAdornmentDef { type: "Highlight" }

export const HighlightAdornment: AdornmentRegistration<HighlightAdornmentDef> = {
  type: "Highlight",
  kind: "field",      // wraps the entire Layout, like legacy `wrap`
  priority: 100,
  render: ({ children }: AdornmentRenderProps<HighlightAdornmentDef>) => (
    <div className="hl">{children}</div>
  ),
};

const registry = combineRegistries(
  { adornments: [HighlightAdornment] },
  defaultRegistry(),
);
```

## Reference layout

- `docs/CONTROL-SEMANTICS.md` — control tree behavior. Tagged `[core]` / `[patch]` per section;
  the semantics carried over, but not identically — see its Key Invariants for where `[core]`
  deliberately differs (write batches do not nest, a throwing listener propagates instead of
  being logged, per-control `equals` is gone).
- `docs/FORM-SEMANTICS.md` — FormStateNode / FormState semantics
- `docs/legacy/` — frozen reference for the old engine
- `packages/forms-react-core/src/` — registry, matchers, plugins, hooks
- `packages/forms/src/` — HTML platform: components, default renderers, adornments
- `packages/forms-motion/src/` — animated visibility, animated accordion
- `packages/forms-dnd/src/` — sortable array renderer
