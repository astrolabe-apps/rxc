# `@rxc/forms` Renderer Design

Design doc for the Phase 4 renderer package. Settles the core abstractions and specifies enough renderers to implement against. Scope: most of the legacy default set — text/number/date inputs, options (select/radio/checklist/autocomplete), display-only, arrays, compound; standard/inline/flex/grid/tabs/accordion/dialog groups; the button action; the four display data types; icon/optional/setfield/accordion adornments. Out of scope for this round: wizard, scroll-list, jsonata data, element-selected, array-element external dialog, multi-value optional rendering. Those go in Phase 4b once the core lands.

This doc supersedes `FORM-FUTURE-API-DESIGN.md` for the **rendering** half (FormStateNode internals are still authoritative there). Legacy details referenced from `docs/legacy/`.

## Goals

1. **Components, not factories.** A renderer is a React component. Dispatch chooses which component to render. No factories returning factories.
2. **One dispatch path.** Custom registrations and built-in defaults live in the same list; the engine has one mechanism, not two.
3. **Layouts compose by swap, adornments compose by wrap.** No mutable layout bag, no slot registry.
4. **Renderers don't know about chrome.** Label, error, helper text, and adornments are owned by `Layout` and `Field`. A renderer renders the input only.
5. **Reactivity is explicit.** Renderers receive a `ReadContext` for fine-grained tracking. No globals, no `trackControls`.
6. **JSON shape is fixed.** Wire format remains compatible with `@astroapps/forms-core` and the C# server. Internal API may change freely.

## Non-goals

- **Backwards compatibility with `@react-typed-forms/schemas`.** That's `@rxc/compat-forms`'s job, layered on top.
- **Bundling an animation library.** `Visibility` is a swappable component (see below). The default unmounts immediately; hosts that want enter/exit animations bring their own library (Framer Motion, react-transition-group, etc.) and supply a custom Visibility component.
- **Editor-mode features.** The visual form designer's needs (custom render-type metadata, design-mode renders) live in a separate `editor` extension package. Renderers must accept a `designMode` flag but no renderer is required to vary on it.
- **Rendering for non-React hosts.** React Native / MUI ports are out of scope here; the abstractions are React-shaped.

## Lessons from the legacy renderer

Before settling on this design, we audited the legacy `@react-typed-forms/schemas` + `schemas-html` packages end-to-end (see `docs/legacy/`). The legacy design solved real problems, but several of its core abstractions accumulated complexity that the rxc design can shed by leaning more on React's built-in composition. The points below motivate the choices above; each names the legacy issue and where in this design it's addressed.

### Layered escape hatches

The legacy renderer had a half-dozen "you can also tweak it here" hooks: `processLayout` (data/group transformer slot), `wrapLayout` (composed wrap chain on `RenderedLayout`), `adjustLayout` (final tweak before `renderLayout`), `customDisplay` (Custom-display callback on render options), `useDataHook` (per-definition `DataRendererProps` factory), `match` predicate on registrations, and the `extraRenderers`-vs-`customRenderers` priority lanes. Each was added to fix a real case; cumulatively they meant the actual rendering behaviour for a given node was determined by which escape hatches the host happened to use, learnable only by reading the host.

**Addressed by:** Component composition makes most of these unnecessary. `processLayout` use cases (override className, drop the label, swap the error control) become rendering a different React tree. `wrapLayout` becomes a `field`-kind adornment. `adjustLayout` becomes wrapping `<Field>` in a host component. `customDisplay` becomes a typed map on `<Form options={...}>`. `match` becomes "a matcher is a function." `useDataHook` is dropped — renderers read what they need from `node.getState(rc)` directly.

### Two dispatch systems for the same job

`createFormRenderer` matched registrations by `renderType`/`schemaType`/`collection`/`options`/`match`, picked the first match, and fell back to `defaultRenderers.data`. But `defaultRenderers.data` was *itself* one registration — `createDefaultDataRenderer` — whose body was a hand-coded `if/else` ladder doing its own dispatch (display-only short-circuit, boolean-options re-entry, options-with-Standard, explicit type switch, multiline check, textfield fallback). The dispatch system couldn't dispatch over its own defaults; adding a specialization between two existing ones meant forking that function.

**Addressed by:** One matcher list per registration kind. Defaults are matchers at the end of the same list. Custom registrations and built-ins use the same mechanism. To insert a new specialization between two existing ones, splice the array.

### Adornments are split-personality

The registration shape said adornments were synchronous mutators of `RenderedLayout` — `apply(layout)` injects content into a slot. In practice, anything stateful (accordion expansion, set-field expression evaluation) had to render a React component into a slot, which could host hooks. So one adornment was a genuine mutator and the next was a component smuggled through the mutator API. Patterns like `SetFieldWrapper` existed solely to host hooks — they had no rendered output.

**Addressed by:** Adornments are React components. `kind` (`label` | `control` | `field`) declares what they wrap; `priority` orders the wrapping. Stateful adornments use hooks naturally; stateless ones are still trivially small. No mutator API, no slot bag.

### Anaemic, fixed slot set

Six slots: `labelStart`, `labelEnd`, `controlStart`, `controlEnd`, `children`, `label`. Real hosts (MUI especially) wanted more — `helperText`, `description`, `inputAdornments`, `prefix`/`suffix`. Adding a slot meant touching `RenderedLayout`, every layout renderer, the helper functions (`appendMarkup`, `wrapMarkup`, `layoutKeyForPlacement`), the `MarkupKeys` type, and every adornment that targeted it. `wrapLayout` was the only general composition primitive.

**Addressed by:** `Layout` is a single swappable component. Its slots are named props. A new Layout adds whatever props it needs; existing forms ignore them. There's no central slot enum to extend, no helper-function suite to update. Adornments wrap by component composition rather than pushing into named slots.

### Over-engineered match predicate

A `DataRendererRegistration` had five filter fields — `renderType`, `schemaType`, `collection`, `options`, `match` — with subtle interactions (`schemaType` only counted when `renderType === Standard`; `options: true` required `fieldOptions` to be non-empty; `collection: null` meant either; `match` could short-circuit anything). The terminal disjunction `isSchemaAllowed || isRendererAllowed || (!x.renderType && !x.schemaType && noMatch === false)` was genuinely hard to read. In practice, every registration used one of three patterns, so five fields were expressing three cases.

**Addressed by:** A matcher is a function `(node, rc) => Component | null`. Sugar helpers (`matchRenderType`, `matchSchemaType`, `matchAll`) cover the common cases; ad-hoc conditions are inline functions. Same expressiveness, fewer rules to memorise.

### Renderers were factories, not components

`createDataRenderer((props, renderers) => ReactNode | (layout) => ControlLayoutProps)` returned either a node or a layout transformer. The dual return existed almost entirely so renderers could influence chrome (add `displayOnlyClass`, drop the label, reassign `errorControl`, propagate `inline`). Factory + dual return = two extra layers of indirection over what is fundamentally "render this thing."

**Addressed by:** Renderers are plain React components. The "influence chrome" use cases collapse to rendering a different React tree (`<DisplayOnlyLayout>` instead of `<Layout>`, render label inside the renderer's own DOM via `Renderer.hidesLabel`, render an aggregate error directly). The `(props, renderers) =>` callback shape goes away — recursive rendering uses `<Field node={child}/>`.

### Visibility's two-flag state

Legacy `Visibility` was `Control<{visible, showing} | undefined>` so animated visibility renderers could decouple intended state (`visible`) from rendered state (`showing`, set after exit animation completes). The form engine had to expose both flags because the visibility renderer was a single registration that owned the timing.

**Addressed by:** `Visibility` is a swappable component receiving a single `visible: boolean | null` prop. Animation libraries (`<AnimatePresence>`, `<Transition>`) already manage "stay mounted during exit" inside their own components — there's no need to expose the rendered-state flag at the form-engine level. Hosts that need form-level animation coordination publish that state from their custom Visibility into a host-managed context.

### Coupled concerns on registrations

`schemaExtension` (editor metadata) and `resolveChildren` (FormStateNode child topology) lived on `RendererRegistration`. Editor metadata isn't a runtime concern; child topology isn't a renderer concern (picking a renderer shouldn't silently change which children the node expands). Both were on registrations because that was the only extension surface.

**Addressed by:** `schemaExtension` moves to a separate editor package with its own registry. `resolveChildren` belongs on `FormStateNode` / its definition, independent of how it renders — pulled out of the renderer system entirely.

### Action handler chain was a global

`actionHandlers(...)` composed handlers as a flat first-match chain passed top-down through `ControlRenderOptions`. Scoping a handler to a subtree (e.g. "intercept `closeDialog` only inside this dialog") meant manually re-composing the chain at each render boundary. The internal handlers for `openDialog`/`closeDialog`/wizard `next`/`prev` were intercepted *inside the renderer*, but array `add`/`remove`/`reorder` weren't dispatched through the chain at all.

**Addressed by:** `<ActionScope onAction={...}>` is a React context. `useActionHandler(node)` walks ancestor scopes; handlers in a subtree shadow handlers above. Dialog/wizard renderers wrap their content in their own `<ActionScope>`. Array operations remain renderer-internal — the asymmetry stays, but it's now consistent: actions inside a renderer are routed via `<ActionScope>`; renderer-internal flows are just `useState`.

### Async action lifecycle was incomplete

The legacy click handler did `result.then(() => { cleanup(); setBusy(false); })` — no `.catch`. A rejected handler left the form busy indefinitely, with no recovery short of remounting. The `disableType`-mutation contract ("call `actionContext.disableForm()` *before* your first await") was implicit and unenforced.

**Addressed by:** `useAsyncAction` wires `.catch`/`.finally` so rejections always release busy and run cleanup. The `disableType` mutation contract remains (it's an inherent property of synchronous closure capture), but it's documented in this design rather than buried in the click-handler closure.

## Package layout

```
@rxc/forms
├── src/
│   ├── Field.tsx            // entry point: renders a FormStateNode
│   ├── Form.tsx             // builds the root FormStateNode + renders Field
│   ├── registry.ts          // Renderer + matcher types, FormRegistry
│   ├── matchers.ts          // matchRenderType, matchSchemaType, etc.
│   ├── Layout.tsx           // DefaultLayout component + Layout context
│   ├── Adornment.tsx        // Adornment base types + composition
│   ├── renderers/
│   │   ├── data/{Textfield,Multiline,Number,Date,Bool,Select,Radio,
│   │   │         CheckList,Autocomplete,DisplayOnly,Array,Compound}.tsx
│   │   ├── group/{Standard,Inline,Flex,Grid,Tabs,Accordion,Dialog,
│   │   │          SelectChild,Contents}.tsx
│   │   ├── action/Button.tsx
│   │   └── display/{Icon,Text,Html,Custom}.tsx
│   ├── adornments/{Icon,Optional,SetField,Accordion}.tsx
│   ├── builtins.ts          // assembles default registry
│   └── index.ts
└── package.json
```

No subpath exports. Compat layers (`@rxc/compat-forms`) reach into source via the published index only.

## Core abstractions

### `Field`

```tsx
function Field({ node, layout, ...slots }: FieldProps): ReactElement;

interface FieldProps {
  node: FormStateNode;
  layout?: ComponentType<LayoutProps>;          // override Layout for this node
  visibility?: ComponentType<VisibilityProps>;  // override Visibility for this node
  helperText?: ReactNode;                       // forwarded to Layout
  description?: ReactNode;
  designMode?: boolean;
}
```

`Field` is the only public entry point for rendering one node. Internally it:

1. Picks the data/group/action/display renderer via the registry.
2. Composes adornments (label, control, field) via wrapping.
3. Wraps in the chosen `Layout` component.
4. Wraps the Layout in the chosen `Visibility` component, which owns mount/unmount + animation.

`Field` itself uses `controls()` so reads of `node.getState(rc)` are reactive — visibility, renderer-choice, and adornments all re-render when the underlying state changes.

### `Form`

```tsx
function Form({ form, data, registry, layout, options }: FormProps): ReactElement;

interface FormProps {
  form: FormDefinition | FormNode;              // schema + control definitions
  data: Control<unknown>;                       // root data
  registry?: FormRegistry;                      // dispatch
  layout?: ComponentType<LayoutProps>;          // global layout override
  visibility?: ComponentType<VisibilityProps>;  // global visibility override (animations)
  options?: FormOptions;
}
```

Builds the root `FormStateNode` from `form` + `data`, then renders `<Field node={root}/>` inside a `<FormProvider>` carrying the registry, Layout, and options.

### Renderer

A renderer is a React component:

```tsx
type DataRenderer    = ComponentType<DataRendererProps>;
type GroupRenderer   = ComponentType<GroupRendererProps>;
type ActionRenderer  = ComponentType<ActionRendererProps>;
type DisplayRenderer = ComponentType<DisplayRendererProps>;
```

Props carry the `FormStateNode`, the resolved field/definition, and the `ReadContext` (via `controls()`). No callbacks back into the form renderer — recursive rendering uses `<Field node={child}/>`.

```tsx
interface DataRendererProps {
  node: FormStateNode;
  // Convenience: pre-resolved at the dispatch level, all reactive via rc.
  // Renderers that need more reach for node.getState(rc).
}
```

The renderer's job is **the input only** — no label, no error, no helper text, no adornments. Those are the responsibility of the surrounding `Field`/`Layout`/adornment components.

### Matcher

Dispatch is a list of matcher functions. Each takes the node and returns a renderer or `null`:

```tsx
type DataMatcher    = (node: FormStateNode, rc: ReadContext) => DataRenderer | null;
type GroupMatcher   = (node: FormStateNode, rc: ReadContext) => GroupRenderer | null;
type ActionMatcher  = (id: string) => ActionRenderer | null;
type DisplayMatcher = (data: DisplayData) => DisplayRenderer | null;
```

The first matcher to return non-null wins. The list is ordered most-specific to least-specific; the catch-all sits at the end.

Sugar helpers for common patterns:

```tsx
matchRenderType(t: string, r: DataRenderer): DataMatcher;
matchSchemaType(ft: FieldType, r: DataRenderer): DataMatcher;
matchHasOptions(r: DataRenderer): DataMatcher;
matchCollection(r: DataRenderer): DataMatcher;
matchAll(...preds: DataMatcher[]): DataMatcher;       // AND, returns last component
matchAny(...preds: DataMatcher[]): DataMatcher;       // OR (rare, but available)
matchAlways(r: DataRenderer): DataMatcher;            // catch-all
```

Equivalent helpers for `GroupMatcher`/`ActionMatcher`/`DisplayMatcher`.

A matcher is just a function — hosts that need anything weird write the function inline:

```tsx
const customMatcher: DataMatcher = (node, rc) => {
  const state = node.getState(rc);
  return state.field?.tags?.includes("private") ? PrivateRenderer : null;
};
```

### Registry

```tsx
interface FormRegistry {
  data:    DataMatcher[];
  group:   GroupMatcher[];
  action:  ActionMatcher[];
  display: DisplayMatcher[];
}

function combineRegistries(...regs: FormRegistry[]): FormRegistry;
function defaultRegistry(): FormRegistry;
```

`combineRegistries` concatenates matcher arrays in argument order — earlier registries take precedence. Hosts compose:

```tsx
const registry = combineRegistries(
  myCustomRegistry,
  defaultRegistry(),
);
```

The default registry is just an array of matcher calls — no special "fallback" path. The catch-alls at the end of each list (`Textfield` for data, `StandardGroup` for group) are how the engine handles "no specific match."

### Layout

```tsx
interface LayoutProps {
  node: FormStateNode;
  label?: ReactNode;        // already-decorated by label adornments
  children: ReactNode;      // already-decorated by control adornments
  error?: ReactNode;
  helperText?: ReactNode;
  description?: ReactNode;
  inline?: boolean;
  className?: string;
  style?: CSSProperties;
}
```

A single component. Hosts swap it via:

- `<Form layout={MyLayout}>` (global)
- `<LayoutProvider value={MyLayout}>...</LayoutProvider>` (subtree)
- `<Field layout={MyLayout}>` (per-node)

`Field` resolves: prop > nearest provider > `DefaultLayout`.

Layouts ignore props they don't use. Adding a slot (e.g. `inputAdornments` for MUI) is additive — `LayoutProps` gains an optional field; `DefaultLayout` ignores it; `MuiLayout` consumes it.

### Adornment

Adornments are wrapper components. Three kinds:

```tsx
type AdornmentKind = "label" | "control" | "field";

interface AdornmentRenderProps<A extends ControlAdornment = ControlAdornment> {
  adornment: A;
  node: FormStateNode;
  children: ReactNode;       // the wrapped content
}

interface AdornmentRegistration<A extends ControlAdornment = ControlAdornment> {
  type: A["type"];
  kind: AdornmentKind;
  priority?: number;          // default 0; higher = outer wrap
  render: ComponentType<AdornmentRenderProps<A>>;
}
```

`Field` partitions `node.adornments` by `kind`, sorts each partition by `priority` ascending, and `reduceRight`s wrappers around the appropriate target:

- `label` adornments wrap the label.
- `control` adornments wrap the renderer's output.
- `field` adornments wrap the entire `<Layout>` element.

A higher-priority adornment is the outer wrap (it sees the inner adornments' decorated output).

There's no `apply(layout)` mutator. There's no slot registry. Slot-style "push content into `LabelEnd`" is replaced by either:

- A `label` adornment that wraps the label and appends content.
- A new explicit `Layout` slot (named prop) for hosts that genuinely need it.

## Dispatch flow in `Field`

```tsx
const Field = controls<FieldProps>("Field", (props, { rc }) => {
  const { node, layout: layoutProp, visibility: visibilityProp,
          designMode, ...slotProps } = props;
  const state = node.getState(rc);

  const { kind } = node.definition;        // "data" | "group" | "action" | "display"
  const registry = useRegistry();
  const Layout = layoutProp ?? useLayout();
  const Visibility = visibilityProp ?? useVisibility();

  // Pick the renderer
  const Renderer = pickRenderer(registry, kind, node, rc);
  const Inner = <Renderer node={node} />;

  // Build label
  const labelText = useLabelText(node, rc);  // null when hideTitle / no field
  const Label = labelText != null ? <Label node={node}>{labelText}</Label> : null;

  // Compose adornments
  const adornments = state.adornments ?? [];
  const labelAdornments   = adornments.filter(a => a.kind === "label");
  const controlAdornments = adornments.filter(a => a.kind === "control");
  const fieldAdornments   = adornments.filter(a => a.kind === "field");

  const decoratedLabel = wrap(labelAdornments, Label, node);
  const decoratedInner = wrap(controlAdornments, Inner, node);

  const layout = (
    <Layout
      node={node}
      label={decoratedLabel}
      error={<Error node={node} />}
      {...slotProps}
    >
      {decoratedInner}
    </Layout>
  );

  return (
    <Visibility visible={state.visible}>
      {wrap(fieldAdornments, layout, node)}
    </Visibility>
  );
});
```

`wrap(adornments, target, node)` sorts ascending and `reduceRight`s — the array `[A, B, C]` (priority 0, 1, 2) produces `<C><B><A>{target}</A></B></C>`.

**Wrap order, outermost to innermost:** Visibility → field-kind adornments → Layout → control-kind adornments → Renderer. Label-kind adornments wrap the label inside Layout.

Visibility being outermost means a hidden field unmounts everything inside it — including any field-level adornments like Accordion. An accordion shell doesn't render around an invisible control. (If a host wanted the opposite — keep the accordion shell, just hide its contents — they'd write a custom field-kind adornment that does the visibility check itself instead of relying on the Visibility wrapper.)

## Concrete renderer specs

Each spec gives: matcher entry, props consumed, DOM/output, notable behaviour. All renderers are React components built with `controls(...)` so they can read through `rc`.

### Data renderers

The default data matcher list, in order:

```tsx
[
  matchAll(matchCollection,    matchRenderTypeOneOf(["Standard","Array"]), ArrayRenderer),
  matchAll(matchCompoundField, matchRenderTypeStandard,                    CompoundDelegate),
  matchDisplayOnly(DisplayOnlyRenderer),
  matchBoolDefault(BoolRenderer),         // Bool with no options/renderType → checkbox
  matchAll(matchHasOptions, matchRenderTypeStandard, SelectRenderer),
  matchRenderType("Radio",        RadioRenderer),
  matchRenderType("Checkbox",     CheckboxRenderer),
  matchRenderType("CheckList",    ChecklistRenderer),
  matchRenderType("Dropdown",     SelectRenderer),
  matchRenderType("Autocomplete", AutocompleteRenderer),
  matchRenderType("DisplayOnly",  DisplayOnlyRenderer),
  matchAll(matchTextfield, matchMultiline, MultilineRenderer),
  matchSchemaType(FieldType.Int,    NumberRenderer),
  matchSchemaType(FieldType.Double, NumberRenderer),
  matchSchemaType(FieldType.Date,   DateRenderer),
  matchSchemaType(FieldType.DateTime, DateTimeRenderer),
  matchSchemaType(FieldType.Time,   TimeRenderer),
  matchAlways(TextfieldRenderer),
]
```

#### `TextfieldRenderer` — fallback, also `String` default

```tsx
const TextfieldRenderer = controls<DataRendererProps>(({ node }, { rc, update }) => {
  const { data } = node.getState(rc);
  const value = data?.getValue(rc) ?? "";
  const placeholder = readPlaceholder(node, rc);
  return <input
    type="text"
    value={String(value)}
    placeholder={placeholder ?? undefined}
    aria-describedby={errorId(node)}
    aria-invalid={hasError(node, rc) || undefined}
    disabled={node.getState(rc).disabled}
    readOnly={node.getState(rc).readonly}
    onChange={(e) => update(wc => wc.setValue(data!, e.target.value))}
  />;
});
```

No internal text-buffer control (legacy used one for parsing intermediate states). Reasoning: `String` round-trips trivially; for typed inputs the Number/Date renderers handle parse-on-blur explicitly.

#### `NumberRenderer` — `FieldType.Int` / `Double`

`<input type="number">` with parse-on-blur. Internal `useState<string>` for the input buffer; blur commits the parsed number (or leaves the field untouched on parse failure — error is surfaced via the field's validators, not by the renderer).

#### `DateRenderer` / `DateTimeRenderer` / `TimeRenderer`

`<input type="date">` / `datetime-local` / `time`. Value formatting via `schemaInterface.formatDate(value, type)`. Same buffer-on-blur pattern as Number.

#### `MultilineRenderer` — `Textfield` with `multiline: true`

`<textarea>` only — drop the legacy `contentEditable` mode (reachable by host via custom registration if needed; not a default).

#### `BoolRenderer` — `FieldType.Bool` with no options, no explicit type

Renders `<input type="checkbox">` inline with the label as part of the *renderer's own output* (not via Layout):

```tsx
<label className="inline-flex items-center gap-2">
  <input type="checkbox" checked={...} onChange={...} />
  <span>{labelText}</span>
</label>
```

This means BoolRenderer is unusual — it absorbs the label. To make this work cleanly, BoolRenderer signals to Field that the label is consumed via:

```tsx
interface DataRenderer {
  // optional static property
  readonly hidesLabel?: boolean;
}
```

`Field` checks `Renderer.hidesLabel` before computing `decoratedLabel`. Default false.

This replaces the legacy `LabelType.Inline` mechanism — a renderer that wants the label inside its own DOM declares it; Field stays out of the way. Layout never sees a label for these.

#### `SelectRenderer` — Standard with options, or `Dropdown`

Native `<select>`. Empty option for non-required or null-valued fields. `<optgroup>` when options have `group` set. Value-to-string conversion based on `field.type` (String/Int/Double pass through; others go through `String()`).

#### `RadioRenderer` — `Radio`

Renders a `<fieldset>` with radio inputs. Reuses BoolRenderer's "absorb the label" pattern via `hidesLabel = true` — `<legend>` is the label, no separate label needed.

```tsx
<fieldset>
  <legend>{labelText}</legend>
  {options.map(o => (
    <label key={o.value}>
      <input type="radio" name={fieldName} value={...} checked={...} onChange={...}/>
      <span>{o.name}</span>
    </label>
  ))}
</fieldset>
```

#### `ChecklistRenderer` — `CheckList`, collection

Same shape as Radio but `<input type="checkbox">` and array-membership checks. `hidesLabel = true`, uses `<legend>`.

#### `CheckboxRenderer` — `Checkbox` (explicit, including non-Bool)

Same as `BoolRenderer` but doesn't require `FieldType.Bool` — used when `renderType === "Checkbox"` is set on a non-Bool field with options (single value selection via checkbox).

#### `AutocompleteRenderer` — `Autocomplete`

Combo box. Single or multi mode based on `field.collection`. Implementation uses `useCombobox`/`useMultipleSelection` from Downshift (lighter than `@mui/base`). No internal `inputControl` — uses `useState` for transient input value; commits to data control on selection.

#### `DisplayOnlyRenderer` — `displayOnly` flag or `DisplayOnly`

`<span>` (inline) or `<div>` with formatted text. Calls `schemaInterface.formatValue(value, field)`. Returns empty-text fallback for empty values. Doesn't render the label — the chrome around it is the host's choice (often a description-list-style layout).

#### `ArrayRenderer` — collection at element level

Renders a list of children with add/remove/edit-external buttons.

```tsx
const ArrayRenderer = controls<DataRendererProps>(({ node }, { rc, update }) => {
  const children = node.getChildren(rc);
  const data = node.getState(rc).data!;
  const { addText, removeText, noAdd, noRemove } = readArrayOptions(node, rc);
  const { min, max } = getLengthRestrictions(node, rc);

  return <div>
    {children.map((child, i) => (
      <div key={child.childKey} className="array-row">
        <Field node={child} />
        {!noRemove && children.length > (min ?? 0) && (
          <button onClick={() => removeAt(data, i, update)}>{removeText ?? "Remove"}</button>
        )}
      </div>
    ))}
    {!noAdd && children.length < (max ?? Infinity) && (
      <button onClick={() => append(data, update)}>{addText ?? "Add"}</button>
    )}
  </div>;
});
```

No separate `array` registration kind — the row layout is part of the data renderer. Hosts who want different per-row chrome write a custom data renderer; there's no dedicated "array layout" extension point.

Reorder: out of scope for v1. Added later via a separate `SortableArrayRenderer` that consumes `dnd-kit`.

#### `CompoundDelegate` — `FieldType.Compound` with Standard

Just delegates to the group dispatch:

```tsx
const CompoundDelegate: DataRenderer = ({ node }) => <GroupRenderer node={node} />;
```

`GroupRenderer` is the internal group dispatcher — picks the matching group renderer from the registry and renders it.

This replaces the legacy data ↔ group ping-pong with a one-way delegation. A compound `dataControl` is a group at heart; treat it as one.

### Group renderers

The default group matcher list:

```tsx
[
  matchGroupRenderType("Tabs",        TabsRenderer),
  matchGroupRenderType("Grid",        GridRenderer),
  matchGroupRenderType("Accordion",   AccordionGroupRenderer),
  matchGroupRenderType("Dialog",      DialogRenderer),
  matchGroupRenderType("SelectChild", SelectChildRenderer),
  matchGroupRenderType("Contents",    ContentsRenderer),
  matchGroupRenderType("Flex",        FlexRenderer),
  matchGroupRenderType("Inline",      InlineGroupRenderer),
  matchGroupRenderType("Standard",    StandardGroupRenderer),
  matchAlways(StandardGroupRenderer),                      // catch-all
]
```

Wizard intentionally absent — Phase 4b.

#### `StandardGroupRenderer`

```tsx
<div className={className}>
  {children.map(c => <Field key={c.childKey} node={c}/>)}
</div>
```

#### `InlineGroupRenderer`

Same as Standard but `<span>` and propagates `inline` to each child via context, which `Field` reads and passes to `Layout`.

#### `FlexRenderer`

```tsx
<div style={{ display: "flex", gap, flexDirection }}>
  {children.map(...)}
</div>
```

`gap` and `flexDirection` from `renderOptions` (`FlexRenderOptions`). No `cellClass` per-child — hosts wanting per-child styling use a custom renderer.

#### `GridRenderer`

Chunks children into rows of `columns` (default 2). Uses CSS grid with `gridTemplateColumns: repeat(N, 1fr)` rather than legacy row-flex. Per-column class via `cellClass` comma-separated string preserved for compat.

#### `TabsRenderer`

```tsx
const TabsRenderer = controls<GroupRendererProps>(({ node }, { rc }) => {
  const children = node.getChildren(rc);
  const visibleChildren = children.filter(c => c.getState(rc).visible !== false);
  const [active, setActive] = useState(0);
  return <div>
    <ul role="tablist">
      {visibleChildren.map((c, i) => (
        <li role="tab" aria-selected={i === active} onClick={() => setActive(i)}>
          {c.definition.title ?? `Tab ${i+1}`}
        </li>
      ))}
    </ul>
    <div role="tabpanel">
      {visibleChildren[active] && <Field node={visibleChildren[active]} />}
    </div>
  </div>;
});
```

Active index is local state. No external override (legacy `TabUi.ensureChildVisible`) for v1 — added later via a `useTabController(node)` hook that registers itself on the node's UI surface.

#### `AccordionGroupRenderer`

Wraps children in `<Accordion>` shells. State per-section persisted on the data control via `meta`.

```tsx
{children.map(c => (
  <Accordion key={c.childKey}
    title={c.definition.title}
    defaultExpanded={getStoredExpanded(c) ?? defaultFromOptions}
    onToggle={(open) => storeExpanded(c, open)}>
    <Field node={c}/>
  </Accordion>
))}
```

Uses native `<details>`/`<summary>` for v1 — semantic and accessible without JS state. Animated variant (Phase 4b) replaces with custom JSX.

#### `DialogRenderer`

Trigger + modal pattern. Children with `placement === "trigger"` render inline; rest render in a modal opened by a state control. The state control (`open: boolean`) is internal; the `actionHandler` intercepts `openDialog`/`closeDialog` action IDs to drive it.

```tsx
const DialogRenderer = controls<GroupRendererProps>(({ node }, { rc }) => {
  const [open, setOpen] = useState(false);
  const children = node.getChildren(rc);
  const triggers = children.filter(c => c.definition.placement === "trigger");
  const content  = children.filter(c => c.definition.placement !== "trigger");
  return <>
    <ActionScope onAction={(id) => {
      if (id === "openDialog")  { setOpen(true);  return true; }
      if (id === "closeDialog") { setOpen(false); return true; }
      return false;
    }}>
      {triggers.map(c => <Field node={c}/>)}
    </ActionScope>
    <Modal open={open} onClose={() => setOpen(false)} title={renderOptions.title}>
      {content.map(c => <Field node={c}/>)}
    </Modal>
  </>;
});
```

`<ActionScope>` is a context-based local action handler — see Actions below.

#### `SelectChildRenderer`

Evaluates `childIndexExpression` (jsonata or static), renders only that child:

```tsx
const idx = useExpression(rc, node, renderOptions.childIndexExpression);
const child = children[idx];
return child ? <Field node={child}/> : null;
```

#### `ContentsRenderer`

```tsx
return <>{children.map(c => <Field node={c} inline />)}</>;
```

Truly transparent — no wrapping element, propagates `inline` so the parent's flex/grid layout handles spacing.

### Action renderer

One default matcher: `matchAlways(ButtonAction)`.

```tsx
const ButtonAction = controls<ActionRendererProps>(({ node }, { rc }) => {
  const state = node.getState(rc);
  const handler = useActionHandler(node);
  const onClick = useAsyncAction(node, handler);
  const Icon = state.actionIcon ? <ActionIcon icon={state.actionIcon}/> : null;
  return <button
    type="button"
    disabled={state.disabled || state.busy}
    onClick={onClick}
    className={state.actionStyle === "Link" ? "btn-link" : "btn"}
  >
    {state.iconPlacement === "BeforeText" && Icon}
    {state.iconPlacement !== "ReplaceText" && state.actionText}
    {state.iconPlacement === "AfterText" && Icon}
    {state.iconPlacement === "ReplaceText" && Icon}
  </button>;
});
```

#### `useAsyncAction` — the lifecycle hook

```tsx
function useAsyncAction(node: FormStateNode, handler: ActionHandler | null): () => void {
  return useCallback(() => {
    if (!handler) return;
    let disableType: ControlDisableType = node.definition.disableType ?? "Self";
    const ctx: ActionContext = {
      disableForm: (t) => { disableType = t; },
      runAction: (id, data) => useActionHandler(node)?.(id, data, ctx),
    };
    const result = handler(ctx);
    if (result instanceof Promise) {
      const cleanup = node.ui.acquireDisabler(disableType);
      node.setBusy(true);
      result
        .catch((err) => { console.error("Action failed", err); /* TODO surface as error */ })
        .finally(() => { cleanup(); node.setBusy(false); });
    }
  }, [node, handler]);
}
```

Two changes from legacy:

1. **`.catch` is wired** so a rejected handler doesn't pin the form busy. Errors are logged for now; surfacing as a form-level error is a follow-up.
2. **`acquireDisabler` is one call** (factory + invocation merged). Stacking via internal counter, not nested closures.

#### `<ActionScope>`

Context-based local action interceptor. A renderer that wants to handle specific action IDs internally (Dialog, Wizard) wraps its scope:

```tsx
<ActionScope onAction={(id, data, ctx) => boolean | "handled" | undefined}>
  {children}
</ActionScope>
```

Returning a truthy value claims the action; returning `undefined` falls through to the parent. `useActionHandler(node)` walks up the React tree's `ActionScope`s, then falls back to the host's `actionHandler` from `<Form options={...}>`.

Replaces the legacy `actionHandlers(...)` first-match composer with React-native context propagation. A handler installed in a subtree only affects descendants — no global handler chain.

### Display renderers

Default matcher list:

```tsx
[
  matchDisplayDataType("Icon",   IconDisplay),
  matchDisplayDataType("Text",   TextDisplay),
  matchDisplayDataType("Html",   HtmlDisplay),
  matchDisplayDataType("Custom", CustomDisplay),
]
```

#### `IconDisplay`

```tsx
<i className={cssClassFor(icon)} aria-hidden />
```

`cssClassFor(icon)` switches on `iconLibrary` (FontAwesome → `fa fa-X`, Material → raw class, CssClass → raw). One static helper, no `HtmlComponents` slot.

#### `TextDisplay`

`<span>` / `<div>` with text. Renders nothing if text is empty (no whitespace placeholders).

#### `HtmlDisplay`

`<div dangerouslySetInnerHTML={{ __html: html }} />`. Caller is responsible for sanitization. Documented loudly.

#### `CustomDisplay`

```tsx
const customRenderers = useCustomDisplay();   // from FormProvider
const Renderer = customRenderers[data.customId];
return Renderer ? <Renderer data={data}/> : <div>Unknown custom display: {data.customId}</div>;
```

Hosts register custom display IDs via `<Form options={{ customDisplays: { foo: FooDisplay, ... } }}>` — replaces legacy `customDisplay` callback with a typed map.

### Adornments

Default registrations:

```tsx
[
  { type: "Icon",      kind: "control", priority: 0,    render: IconAdornment },
  { type: "Optional",  kind: "control", priority: 0,    render: OptionalAdornment },
  { type: "SetField",  kind: "field",   priority: 0,    render: SetFieldAdornment },
  { type: "Accordion", kind: "field",   priority: 1000, render: AccordionAdornment },
]
```

#### `IconAdornment`

```tsx
function IconAdornment({ adornment, children }: AdornmentRenderProps<IconAdornmentDef>) {
  const icon = <Icon className={adornment.iconClass} library={adornment.icon?.library} name={adornment.icon?.name}/>;
  return adornment.placement === "ControlEnd"
    ? <span className="inline-flex items-center gap-1">{children}{icon}</span>
    : <span className="inline-flex items-center gap-1">{icon}{children}</span>;
}
```

`LabelStart`/`LabelEnd` placements ignored for v1 — moved to `kind: "label"` adornment if/when needed (not used by any production schema we've audited).

#### `OptionalAdornment`

A `control`-kind adornment that wraps the renderer's output with a "is value present?" checkbox.

```tsx
function OptionalAdornment({ adornment, node, children }: AdornmentRenderProps<OptionalAdornmentDef>) {
  // ... see legacy reference for the editSelectable/allowNull semantics
  return <div>
    {adornment.allowNull && <NullToggleCheckbox node={node}/>}
    {children}
  </div>;
}
```

`editSelectable` is dropped from v1 — combination of two toggles (`editSelectable` + `allowNull`) is too subtle and rarely used together. Hosts that need it write a custom adornment.

Interaction with `defaultValue`: FormStateNode's default-value effect already checks `definition.adornments` for an `Optional` entry and skips initialization. That logic is unchanged.

#### `SetFieldAdornment`

`field`-kind adornment that runs an expression and writes the result into a sibling field.

```tsx
function SetFieldAdornment({ adornment, node, children }: AdornmentRenderProps<SetFieldAdornmentDef>) {
  useSetFieldEffect(node, adornment);
  return children;
}

function useSetFieldEffect(node, adornment) {
  // resolves target field via schemaDataForFieldRef
  // evaluates adornment.expression via useExpression
  // useEffect: if !defaultOnly || target value is null, writes evaluated value to target
}
```

Unchanged semantically from legacy. `useExpression` is the rxc port of the legacy hook.

#### `AccordionAdornment`

`field`-kind adornment, priority 1000 (outer wrap). Renders the entire layout inside a native `<details>` shell:

```tsx
function AccordionAdornment({ adornment, node, children }: AdornmentRenderProps<AccordionAdornmentDef>) {
  const [open, setOpen] = useStoredExpanded(node, adornment.defaultExpanded);
  return <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary>{adornment.title}</summary>
    {children}
  </details>;
}
```

Same `<details>` primitive as `AccordionGroupRenderer` — one component, two callsites.

## Visibility

Every `Field` wraps its rendered output in a `<Visibility>` component (outermost, around field-kind adornments). The component owns the mount/unmount decision and any enter/exit transitions. It's swappable — same pattern as `Layout`.

### Component interface

```tsx
interface VisibilityProps {
  visible: boolean | null;       // null = pending (e.g. async script eval not yet resolved)
  children: ReactNode;
}

type VisibilityComponent = ComponentType<VisibilityProps>;
```

`Field` reads `state.visible` reactively and re-renders Visibility with the new `visible` prop on every change. Visibility owns the response — render, hold, animate, unmount.

The component receives `visible` as a plain prop, not `node`, so it can be a pure presentation component. It doesn't need `rc`, doesn't read `FormStateNode`, doesn't depend on the schema package — that lets the same Visibility component work for any node and lets hosts test it in isolation.

### `DefaultVisibility`

```tsx
function DefaultVisibility({ visible, children }: VisibilityProps) {
  return visible === true ? <>{children}</> : null;
}
```

Unmounts immediately when `visible !== true`. Pending (`null`) renders nothing — same as legacy `DefaultVisibility`.

### Animated variant (host opt-in)

The standard React exit-animation problem: the children must stay mounted long enough to animate out. Solve it the standard way — `<AnimatePresence>` from Framer Motion, `<Transition>` from react-transition-group, or any equivalent. The form engine doesn't ship an animation dependency; hosts pick.

Example with Framer Motion:

```tsx
import { AnimatePresence, motion } from "framer-motion";

function FadeVisibility({ visible, children }: VisibilityProps) {
  return (
    <AnimatePresence initial={false}>
      {visible === true && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

`AnimatePresence` defers unmount until exit completes — that's the whole mechanism. No need for the legacy `{visible, showing}` two-flag dance; the animation library closes over the rendered state internally.

### Override mechanisms

Mirror `Layout`:

- **Global** — `<Form visibility={FadeVisibility}>` for whole-form replacement.
- **Subtree** — `<VisibilityProvider value={FadeVisibility}>...</VisibilityProvider>` overrides for a section. Useful when the dialog content fades but the rest of the form is instant.
- **Per-node** — `<Field visibility={SlideVisibility} node={node} />` for one-off variations.

Resolution: prop > nearest provider > `DefaultVisibility`.

### Pending state

`visible === null` is the schema engine's signal for "I don't know yet" — typically an async jsonata visibility expression that hasn't resolved. The default treats it as hidden. Hosts that want a loading skeleton swap the component:

```tsx
function PendingAwareVisibility({ visible, children }: VisibilityProps) {
  if (visible === null) return <FieldSkeleton />;
  if (visible === false) return null;
  return <>{children}</>;
}
```

This is a swap, not a separate hook — Visibility owns the entire "what shows on screen" decision.

### Why no `{visible, showing}` two-flag state

Legacy `Visibility` was `{ visible, showing }` so animated visibility renderers could decouple intended state from rendered state — the engine flipped `visible` immediately, custom renderers ran an exit animation, then mirrored `showing` to false to actually unmount.

In a component-based design this distinction collapses. The animation library (`AnimatePresence` etc.) already manages "stay mounted during exit" inside its own component — there's no need for the form engine to expose the rendered-state flag. Visibility receives `visible: boolean`, the host's animation primitive handles the rest.

Hosts that need form-level coordination ("is anything currently animating out?" — useful for delaying form submit) can publish that state from their custom Visibility into a host-managed context. The form engine doesn't try to coordinate it centrally.

### Wrap order recap

From the `Field` flow:

```tsx
<Visibility visible={state.visible}>
  {wrap(fieldAdornments, <Layout>{...}</Layout>, node)}
</Visibility>
```

Visibility is outside field-kind adornments. When a field hides, the entire layout — including any Accordion/SetField wrappers — unmounts. If you want an accordion that animates collapse but keeps mounted children, that's a different feature (an animated `<Accordion>` component handling its own internal show/hide), not a Visibility concern.

## Label resolution

`useLabelText(node, rc)`:

```tsx
function useLabelText(node, rc) {
  const state = node.getState(rc);
  const def = node.definition;
  if (def.kind === "data" && !def.hideTitle) {
    return def.title ?? state.field?.displayName ?? state.field?.field;
  }
  if (def.kind === "group" && !def.groupOptions?.hideTitle) {
    return def.title;
  }
  return null;
}
```

`<Label node={node}>{labelText}</Label>` is itself a tiny component that renders `<label htmlFor={controlId(node)} className={...}>` plus a required marker (`<span aria-hidden> *</span>` if `state.required`). Hosts override `<Label>` via the `Layout` swap or a separate `<LabelProvider>`.

## Errors

`<Error node={node} />` renders the error message:

```tsx
const Error = controls<{ node: FormStateNode }>(({ node }, { rc }) => {
  const state = node.getState(rc);
  if (!state.touched) return null;
  if (!state.errors || Object.keys(state.errors).length === 0) return null;
  const message = Object.values(state.errors)[0];
  return <div role="alert" id={errorId(node)}>{message}</div>;
});
```

`touched` gating preserved from legacy. Hosts that want eager errors override `<Error>` via Layout-swap or `<ErrorProvider>`.

Multiple errors: only the first is shown for v1. Hosts that want all (e.g. summary panel) read `state.errors` directly.

## Reactivity boundary

Every renderer is a `controls(...)` component, so its render function receives a fresh `ReadContext` each render and tracks reads automatically. Re-renders happen on:

- `node.getState(rc).visible` change → `Field` re-renders, picks renderer fresh
- `node.getState(rc).disabled` / `readonly` / `touched` / `valid` → reactive in renderer's own reads
- `node.getChildren(rc)` change → group/array renderers re-render
- Direct data control changes → renderer's `data?.getValue(rc)` reads trigger re-render

This is finer-grained than legacy `@trackControls` — each renderer subscribes only to what it actually reads, not to the whole node.

## Open questions

- **Label as adornment or as Layout slot?** Today's design has `<Label>` as a separate component invoked by `Field`, decorated by label-kind adornments, then handed to Layout as a prop. Alternative: Layout owns label rendering entirely (it gets `node` and renders its own label). The current design splits the work; the alternative is fewer moving parts. Probably the right call once we've implemented one MUI-style alternate Layout.

- **Label-text encoding hook (HTML/markdown labels).** Real-world legacy hosts use `LabelRendererRegistration` with `labelType: LabelType.Text` to register a global label-text transformer — e.g. ServiceTas registers an `HtmlLabelRenderer` that runs strings through `html-react-parser` so any `title` declared in a schema can contain HTML markup. The legacy engine exposed `renderers.renderLabelText(text)` and called it from *every* place a label string materialized: the main `<Label>`, `HelpText` adornment titles, action button labels, custom renderers that needed to render a sublabel. The current rxc design only swaps `<Label>` (via prop / `<LabelProvider>` / Layout) — that covers the main field label but **not** adornment-rendered labels or any other place a `title: string` becomes DOM. To preserve parity we likely need either: (a) a `useLabelText(): (text: string) => ReactNode` hook backed by a `<LabelTextProvider>` context that every label-string-rendering site (Field's `<Label>`, HelpText adornment, action button text, anywhere a renderer renders `title`) funnels through, or (b) require all label strings to flow through a single `<LabelText>{title}</LabelText>` component that hosts swap. Option (a) is closer to the legacy ergonomics; option (b) is more discoverable. Either way, the contract needs to be documented so adornment authors know to route label strings through the hook rather than dropping them into JSX directly.

- **Renderer "absorbs label" mechanism.** `Renderer.hidesLabel` as a static property on the component is unusual in React. Alternatives: a sentinel return (`Renderer` returns a `[input, label]` tuple), or a `LabelContext` the renderer suppresses. The current approach is the most conservative.

- **`<ActionScope>` propagation.** Walking the React tree to find action handlers is clean but means a handler installed in one subtree can't shadow a parent handler that already returned `undefined` (React doesn't re-walk). For nested dialogs this is correct; for unusual cases hosts may need to compose handlers explicitly.

- **Tab/Wizard external control.** Phase 4b. Likely a `useStepController(node)` hook that registers on `node.ui` and exposes `goToStep(i)`/`activeStep`. Cleaner than legacy `attachUi` mutation.

- **Reorder in arrays.** Out of scope for v1. Adding via a separate `SortableArrayRenderer` registration that consumes `dnd-kit` — keeps the default array renderer dependency-free.

- **Custom group `Contents` semantics.** The legacy `Contents` group dropped the wrapping `<Div>` *and* the label. The proposed `ContentsRenderer` keeps the label-drop but lets adornments still wrap. Worth checking against real usage.

- **JSONata-only data renderer.** Punted to Phase 4b along with wizard. The `useExpression` infrastructure exists; the renderer is a one-pager once we've validated the layout/adornment design end-to-end.

## Phase 4b

After Phase 4a (this doc) lands and is validated by the dev app:

- `WizardRenderer` (group) + `useWizardController` hook
- `ScrollListRenderer` (data, collection)
- `JsonataRenderer` (data)
- `ElementSelectedRenderer` (data, Bool)
- `ArrayElementRenderer` (data, dialog-based external edit)
- `OptionalAdornment.editSelectable` flag
- `LabelStart`/`LabelEnd` placement support via `kind: "label"` adornments
- Optional `@rxc/forms-motion` add-on package shipping `FadeVisibility`, `SlideVisibility`, animated `<Accordion>` (Framer-Motion based — opt-in dependency)
- Reorder support in arrays
- Multi-error rendering primitive

Each is additive — none require revisiting Phase 4a's API.

## Migration from legacy

`@rxc/compat-forms` is the bridge. It implements the old `FormRenderer` interface by:

- Wrapping the new `Field` as the legacy `RenderForm` entry point.
- Reconstructing `ControlLayoutProps` from the new component tree (lossy — renderers that returned a `processLayout` lose the dual-return type and must be ported).
- Mapping legacy `RendererRegistration[]` to new matcher functions.

Compat is best-effort: most legacy custom data renderers (those that returned plain `ReactNode`) port mechanically. Renderers that mutated `ControlLayoutProps` need manual translation. Document that as a known limitation.
