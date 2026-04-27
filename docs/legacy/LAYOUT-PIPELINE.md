# Legacy Layout Pipeline (`@react-typed-forms/schemas`)

Reference document. Captures how a `FormStateNode` produces a single rendered React subtree — the transformation from leaf renderer contributions into a `ControlLayoutProps`, then into a `RenderedLayout`, then into a `RenderedControl` wrapped by visibility. Companion to `RENDERER-ARCHITECTURE.md`.

## The pipeline at a glance

```
FormStateNode
   │
   │  RenderFormNode (React component)
   │    builds ControlDataContext, builds adornments[], childOptions
   ▼
renderControlLayout(props): ControlLayoutProps
   │  one branch per definition kind:
   │    Data    → {processLayout: renderer.renderData(dataProps), label, errorControl, errorId}
   │    Group   → {processLayout: renderer.renderGroup(groupProps), label}
   │                   ↑ compound-field group rewritten as Data first
   │    Action  → {children: renderer.renderAction(actionProps)}
   │    Display → {children: renderer.renderDisplay(displayProps)}
   ▼
ControlLayoutProps merged with {adornments, className, style} from RenderFormNode
   │  options.adjustLayout?(dataContext, layoutProps)   ← user-level final tweak
   ▼
renderer.renderLayout(layoutProps): RenderedControl
   │  inside the registered LayoutRenderer (DefaultLayout):
   │    1. renderLayoutParts(props, renderer): RenderedLayout
   │        a. resolve processLayout?: ControlLayoutProps → expanded props
   │        b. seed RenderedLayout from {children, errorControl, style, className, inline, errorId}
   │        c. sort adornments asc, apply each (mutates RenderedLayout)
   │        d. label = label && !label.hide ? renderer.renderLabel(label, labelStart, labelEnd) : undefined
   │        e. set inlineLabel if label.type === Inline
   │    2. wrap final element with layout.wrapLayout(<DefaultLayout layout={...}/>)
   │    3. return RenderedControl {children, className, style, divRef, inline}
   ▼
renderer.renderVisibility({visibility, ...renderedControl}): ReactNode
   │  Visibility renderer: gates on visibility.value.visible/showing,
   │  wraps in outer Div (or Fragment for inline)
   ▼
React subtree
```

Three stages of the pipeline are user-overridable:

| Stage | Override |
|---|---|
| Per-node leaf | The matched data/group/action/display **registration**. |
| Final tweak | `ControlRenderOptions.adjustLayout(dataContext, layoutProps)`. |
| Layout assembly | The matched **layout** registration (or `defaultRenderers.renderLayout`). |
| Visibility wrap | The matched **visibility** registration (singleton). |

## `ControlLayoutProps`

This is the data structure that crosses every boundary in the pipeline.

```ts
interface ControlLayoutProps {
  label?: LabelRendererProps;
  errorControl?: Control<any>;
  errorId?: string;
  adornments?: AdornmentRenderer[];
  children?: ReactNode;
  processLayout?: (props: ControlLayoutProps) => ControlLayoutProps;
  className?: string | null;
  style?: React.CSSProperties;
  inline?: boolean;
}
```

Fields are **additive** as the pipeline progresses:

- `renderControlLayout` produces an initial set populated from the leaf branch.
- `RenderFormNode` then merges in `adornments`, layoutClass-derived `className`, and `definition.layoutStyle` as `style`.
- `adjustLayout` may rewrite anything before the layout renderer runs.
- The layout renderer consumes everything and produces `RenderedControl`.

### `processLayout` — the data/group transformer slot

A data or group registration's `render` returns either a `ReactNode` or a function `(layout: ControlLayoutProps) => ControlLayoutProps`. The function form is stored in `processLayout` and invoked once at the very start of `renderLayoutParts`. This lets a renderer:

- Replace `children` with its custom UI.
- Override `className` / `style` / `inline`.
- Drop or rewrite `label` (e.g. a renderer that draws its own header).
- Hand off `errorControl` to a different control (e.g. an aggregate error for an array).

A registration that returns a plain `ReactNode` is wrapped at the engine level as `(l) => ({...l, children: result})` — the simple case becomes the same shape.

The default `renderControlLayout` only sets `processLayout` for Data and Group definitions; Action and Display drop straight to `children`.

## `renderControlLayout` — building the initial props

Switch on the definition kind:

### Data control (`isDataControl`)

```ts
{
  inline,
  processLayout: renderer.renderData(rendererProps),  // dataProps from createDataProps
  label: {
    type: (c.children?.length ?? 0) > 0 ? LabelType.Group : LabelType.Control,
    label: !c.hideTitle ? controlTitle(c.title, field) : undefined,
    forId: rendererProps.id,                          // "c" + control.uniqueId
    required: c.required && !displayOnly,
    hide: c.hideTitle,
    className: rendererClass(labelClass, c.labelClass),
    textClass: rendererClass(labelTextClass, c.labelTextClass),
  },
  errorControl: control,
  errorId: rendererProps.errorId,                     // "err_" + id
}
```

`controlTitle(title, field)` falls back to `fieldDisplayName(field)` when `title` is null.

If the data control has children (`(c.children?.length ?? 0) > 0`), the label type becomes `LabelType.Group`, so a different label registration can render it differently from a leaf-data label.

### Group control (`isGroupControl`)

If `c.compoundField` is set, the group is rewritten as a `dataControl(c.compoundField, c.title, {children: c.children, hideTitle: c.groupOptions?.hideTitle})` and dispatched through the data branch. *No standalone "compound group" path exists.*

Otherwise:

```ts
{
  inline,
  processLayout: renderer.renderGroup({
    formNode, definition: c, renderChild, runExpression, dataContext,
    renderOptions: c.groupOptions ?? {type: "Standard"},
    className, textClass, style, designMode, actionHandler,
  }),
  label: {
    label: c.title,
    className, textClass,
    type: LabelType.Group,
    hide: c.groupOptions?.hideTitle,
  },
}
```

Note: groups carry `errorControl: undefined`. Errors at group level surface only via the data controls inside them.

### Action control (`isActionControl`)

```ts
{
  inline,
  children: renderer.renderAction({
    actionText: c.title ?? c.actionId,
    actionId, actionData, actionContent,    // actionContent = renderActionGroup() if ActionStyle.Group
    actionStyle, textClass, iconPlacement, icon,
    inline, disabled: formNode.disabled, busy: formNode.busy,
    onClick: handler ? (...) => { /* see ACTIONS-AND-WIZARD.md */ } : () => {},
    className, style,
  }),
}
```

The handler is resolved via `props.actionHandler?.(c.actionId, actionData, dataContext)`. If the handler returns a `Promise`, the engine calls `formNode.ui.getDisabler(disableType)()` and `formNode.setBusy(true)` for the duration. `disableType` is mutated by the handler via `actionContext.disableForm()` before the click handler fires its real work.

`ActionStyle.Group` renders all child FormStateNodes inside the action, so an action can host a sub-form (e.g. "submit dialog" patterns).

### Display control (`isDisplayControl`)

```ts
{
  inline,
  children: renderer.renderDisplay({
    data: c.displayData ?? {},
    className, textClass, style, dataContext, inline, noSelection: c.noSelection,
  }),
}
```

If `data.type === DisplayDataType.Custom` and `customDisplay` is supplied via `ControlRenderOptions`, `customDisplay(customId, displayProps)` is used instead of `renderer.renderDisplay`.

### Anything else

Returns `{}` — an empty layout. The layout renderer still runs but produces an empty container.

## `RenderedLayout`

```ts
interface RenderedLayout {
  labelStart?: ReactNode;        // markup at the start of the label
  labelEnd?: ReactNode;          // markup at the end of the label
  controlStart?: ReactNode;      // markup before children
  controlEnd?: ReactNode;        // markup after children
  label?: ReactNode;             // resolved label (post-renderLabel)
  children?: ReactNode;
  errorControl?: Control<any>;
  errorId?: string;
  className?: string;
  style?: React.CSSProperties;
  wrapLayout: (layout: ReactElement) => ReactElement;   // composed wrap chain
  inline?: boolean;
  inlineLabel?: boolean;         // set when label.type === LabelType.Inline
}
```

This is the **mutable** layout: adornments mutate it in place via their `apply(rl)` callback. After all adornments have run, `label` gets *resolved* by calling `renderer.renderLabel(label, labelStart, labelEnd)` — adornments that injected into `labelStart`/`labelEnd` thus end up surrounding the rendered label text.

`wrapLayout` starts as the identity function; adornments may compose onto it to wrap the entire output (used by `Accordion`, `SetField`, etc.).

## `renderLayoutParts` — the workhorse

```ts
function renderLayoutParts(props: ControlLayoutProps, renderer: FormRenderer): RenderedLayout {
  const { className, children, style, errorControl, label, adornments, inline, errorId } =
    props.processLayout?.(props) ?? props;

  const layout: RenderedLayout = {
    children, errorControl, style, className: className!, inline, errorId,
    wrapLayout: (x) => x,                              // identity, will be composed by adornments
  };

  (adornments ?? [])
    .sort((a, b) => a.priority - b.priority)
    .forEach((x) => x.apply(layout));

  layout.label = label && !label.hide
    ? renderer.renderLabel(label, layout.labelStart, layout.labelEnd)
    : undefined;

  if (label?.type === LabelType.Inline) {
    layout.inlineLabel = true;
  }
  return layout;
}
```

Five steps:

1. **Resolve `processLayout`.** Run the leaf transformer once. After this point the props are fully populated and immutable for this render.
2. **Seed `RenderedLayout`.** Copy the relevant fields. Note `labelStart`, `labelEnd`, `controlStart`, `controlEnd` start as undefined — they are exclusively populated by adornments.
3. **Sort adornments ascending by priority.** `AppendAdornmentPriority = 0` runs first; `WrapAdornmentPriority = 1000` runs last (so it wraps everything else's contribution).
4. **Apply each adornment.** Each `adornment.apply(layout)` mutates `layout` in place — appending markup, wrapping elements, composing `wrapLayout`.
5. **Resolve label.** Renders the label text once, *consuming* `labelStart`/`labelEnd`. After this step, `label` is a `ReactNode`; the start/end fields still exist on the layout but the layout renderer typically ignores them.

Adornment ordering is critical. An "append icon at LabelStart" adornment with priority 0 runs before a "wrap whole layout in accordion" adornment with priority 1000 — so the icon ends up inside the accordion content, not outside it.

## Adornment helpers

Adornments are typically built using these helpers from `controlRender.tsx`:

```ts
type MarkupKeys = "labelStart" | "labelEnd" | "controlStart" | "controlEnd"
                | "label" | "children";

function appendMarkup(k: MarkupKeys, markup: ReactNode): (rl: RenderedLayout) => void;
function wrapMarkup(k: MarkupKeys, wrap: (ex: ReactNode) => ReactNode): (rl: RenderedLayout) => void;

function layoutKeyForPlacement(pos: AdornmentPlacement): MarkupKeys;
function appendMarkupAt(pos: AdornmentPlacement, markup: ReactNode): (rl: RenderedLayout) => void;
function wrapMarkupAt(pos: AdornmentPlacement, wrap: (ex) => ReactNode): (rl: RenderedLayout) => void;

function wrapLayout(wrap: (layout: ReactElement) => ReactElement): (rl: RenderedLayout) => void;
```

`AdornmentPlacement` → `MarkupKeys`:

| Placement | Key |
|---|---|
| `ControlStart` | `controlStart` |
| `ControlEnd` | `controlEnd` |
| `LabelStart` | `labelStart` |
| `LabelEnd` | `labelEnd` |

`appendMarkup` adds markup *after* whatever's already there; `wrapMarkup` replaces the slot with `wrap(existing)`. Most adornments use `appendMarkupAt(placement, ...)` so users can configure placement on the adornment definition.

`wrapLayout` is the heaviest tool — it composes onto `RenderedLayout.wrapLayout`, which the layout renderer applies to the *entire* React element it produces. Used by `Accordion`, `SetField`, dialog adornments etc. — anything that needs to put a portal/wrapper *around* the whole control.

## Default layout renderer

`schemas-html`'s `DefaultLayout` is the canonical layout renderer:

```tsx
createLayoutRenderer((props, renderers) => {
  const layout = renderLayoutParts(props, renderers);
  return {
    children: layout.wrapLayout(
      <DefaultLayout layout={layout} {...options} renderer={renderers} />,
    ),
    inline: layout.inline,
    className: rendererClass(layout.className, options.className),
    style: layout.style,
    divRef: (e) => e && props.errorControl
      ? (props.errorControl.meta.scrollElement = e)
      : undefined,
  };
});

function DefaultLayout({errorClass, renderer, renderError, layout}) {
  const {controlEnd, controlStart, label, children, errorControl, errorId, inlineLabel} = layout;
  const errorText = errorControl?.touched ? errorControl.error : undefined;
  return (
    <>
      {!inlineLabel && label}
      {controlStart}
      {inlineLabel
        ? <Div className="inline-flex items-center gap-1">{children}{label}</Div>
        : children}
      {renderError(errorText, errorId)}
      {controlEnd}
    </>
  );
}
```

Notable points:

- **`wrapLayout` runs at the outer boundary** — wraps the entire `DefaultLayout` element, so accordion/dialog/setField adornments end up outside.
- **Label and inlineLabel** — for normal layouts the label appears before `controlStart`. For `LabelType.Inline` it's inlined into a flex container after children (typical for checkboxes).
- **`errorText` only renders when `errorControl.touched`** — this is what gates "show errors after the user has interacted" without any extra plumbing. The data renderer just passes a control as `errorControl` and the layout decides when to surface its message.
- **`divRef`** stores the resolved DOM element on `errorControl.meta.scrollElement` so external code can `errorControl.meta.scrollElement?.scrollIntoView()` to focus the offending field.
- **Inline mode** — when `layout.inline` is true, the layout still renders the same parts but tells the visibility renderer to skip the wrapping `<Div>`.

## Visibility renderer

`renderer.renderLayout` produces a `RenderedControl`:

```ts
interface RenderedControl {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  divRef?: (e: HTMLElement | null) => void;
  inline?: boolean;
}
```

`RenderFormNode` then calls:

```ts
renderer.renderVisibility({
  visibility,                 // Control<{visible, showing} | undefined>
  ...renderedControl,
});
```

`DefaultVisibility`:

```tsx
function DefaultVisibility({visibility, children, className, style, divRef, renderer, inline}) {
  const v = visibility.value;
  useEffect(() => {
    if (v) visibility.setValue(ex => ({visible: v.visible, showing: v.visible}));
  }, [v?.visible]);
  if (inline) return v?.visible ? children : undefined;
  return v?.visible ? <Div className={...} style={...} nativeRef={divRef} children={children}/> : <></>;
}
```

The default implementation is non-animated: `showing` is mirrored to `visible` synchronously inside an effect, and the control is shown only when `visible` is true. Custom visibility renderers (e.g. fading/sliding) decouple the two — `visible` toggles immediately when state changes, but `showing` only flips after the exit animation finishes. Inside the component:

- `visible: false → true` — render starts hidden, animation runs, `showing` set to true.
- `visible: true → false` — animation runs, on completion `showing` set to false, component unmounts.

`inline` skips the wrapping `<Div>` so adornment-imposed wrappers (`wrapLayout`) sit cleanly inline.

## `adjustLayout` — the user escape hatch

`ControlRenderOptions.adjustLayout(dataContext, layoutProps)` is invoked at the very end of `RenderFormNode`, just before `renderer.renderLayout`. Use cases:

- A host wants every node in a particular subtree to gain a class.
- An external "design mode" overlay wants to wrap each control in a draggable handle.
- A test harness wants to stamp `data-testid` attributes on every layout.

This runs *after* adornments have been registered but *before* `renderLayoutParts` has executed — so it sees `processLayout` and `adornments[]` but not yet `RenderedLayout`. Mutating `processLayout` here is unusual but legal.

## Settled invariants

1. **One `processLayout` per node.** Data and group renderers contribute exactly one transformer; chaining is the renderer's responsibility, not the engine's.
2. **Adornments are in-place mutators with priority order.** The mental model is "build a layout, decorate it"; never "wrap a node in a node".
3. **`wrapLayout` is the only mechanism that survives outside the inner layout renderer.** Any wrapping that needs to be at a higher level than the label/children/error block must compose onto `wrapLayout`.
4. **Label resolution happens after adornments.** Adornments can inject into `labelStart`/`labelEnd`; label renderers consume both as positional content.
5. **Errors are gated by `touched`.** The renderer passes a control; the layout decides when to display.
6. **Visibility is a global wrapper, not a per-control concern.** Renderers don't decide whether to render — they always produce content; `DefaultVisibility` decides whether to mount it.
7. **Inline mode is a transitive flag.** `inline` set on a leaf flows through every layer (data renderer → ControlLayoutProps → RenderedLayout → RenderedControl → visibility) so the host can build inline forms without per-renderer changes.
8. **Compound-field groups are rewritten before dispatch.** There is no separate "compound group" path through the layout pipeline.

## Open questions for the redesign

- **Mutation vs. fold for adornments.** Today adornments mutate `RenderedLayout`. With explicit reactivity in rxc, an adornment that needs to track state (e.g. accordion expansion) currently does it via React hooks inside `wrapLayout`. A cleaner alternative might be component-shaped adornments returning ReactNode wrappers — at the cost of losing the "in-place mutate" simplicity.
- **`processLayout` vs. node return.** The dual return type (function or node) for data/group renderers exists for ergonomics. The redesign could pick one — likely the transformer form, since it's strictly more general.
- **Error timing.** `errorControl.touched` gating is hard-wired into `DefaultLayout`. Some hosts want eager error display (e.g. on submit). Currently this is solved by calling `setTouched(true)` — could be made first-class.
- **Layout slot model.** Today the slots are `labelStart`/`labelEnd`/`controlStart`/`controlEnd`/`children`/`label`. RTL layouts, complex MUI form helpers, etc. sometimes want more slots (e.g. `helperText`, `inputAdornments`). Either generalise the slot set, or accept that custom layout renderers are the answer.
- **Inline label placement.** Currently hardcoded as `flex items-center gap-1` in `DefaultLayout`. Should be configurable via the layout renderer's options.
