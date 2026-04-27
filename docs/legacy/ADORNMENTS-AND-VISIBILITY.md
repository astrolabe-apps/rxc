# Legacy Adornments & Visibility (`@react-typed-forms/schemas`)

Reference document. Captures how the adornment system and the visibility wrapper work in the legacy engine + `schemas-html` defaults. Companion to `RENDERER-ARCHITECTURE.md`, `LAYOUT-PIPELINE.md` (which already covers the adornment loop in `renderLayoutParts`), and `RENDERER-CATALOG.md` (which catalogs the four built-in adornment renderers).

## Adornment overview

An adornment is **a reusable visual decoration applied to any control** — an icon next to an input, a tooltip, a help-text panel, an "is this field present?" checkbox, an accordion wrapper. Adornments are declared on `ControlDefinition.adornments[]` (alongside `validators`, `renderOptions`, etc.) and resolved at render time by the engine via `renderer.renderAdornment(...)`, producing an `AdornmentRenderer` that mutates the in-flight `RenderedLayout`.

The system has three moving parts:

1. **Type union** — six discriminated `ControlAdornmentType` variants in `forms-core/src/controlDefinition.ts`.
2. **Engine plumbing** — `RenderFormNode` collects them, `renderLayoutParts` sorts and applies them.
3. **Renderer registrations** — `schemas-html` ships four default implementations; `Tooltip` and `HelpText` exist in the type system but have no default renderer (extension points only).

## `ControlAdornmentType` — the discriminated union

```ts
export enum ControlAdornmentType {
  Tooltip   = "Tooltip",
  Accordion = "Accordion",
  HelpText  = "HelpText",
  Icon      = "Icon",
  SetField  = "SetField",
  Optional  = "Optional",
}
```

Each subtype carries its own data:

```ts
interface IconAdornment {
  type: ControlAdornmentType.Icon;
  iconClass: string;
  icon?: IconReference;
  placement?: AdornmentPlacement | null;
}

interface TooltipAdornment {
  type: ControlAdornmentType.Tooltip;
  tooltip: string;
}

interface AccordionAdornment {
  type: ControlAdornmentType.Accordion;
  title: string;
  defaultExpanded?: boolean | null;
}

interface HelpTextAdornment {
  type: ControlAdornmentType.HelpText;
  helpText: string;
  placement?: AdornmentPlacement | null;
}

interface SetFieldAdornment {
  type: ControlAdornmentType.SetField;
  field: string;                       // sibling field path
  defaultOnly?: boolean | null;
  expression?: EntityExpression;
}

interface OptionalAdornment {
  type: ControlAdornmentType.Optional;
  placement?: AdornmentPlacement | null;
  allowNull?: boolean;                 // adds a separate "set null" toggle
  editSelectable?: boolean;            // adds an "enable editing" toggle
}
```

The C# server (`Astrolabe.Schemas`) generates this same JSON shape — `type` is the wire-level discriminator, so any new adornment must be added on both ends.

Type guards live in `schemas/src/renderers.tsx`:

```ts
isIconAdornment(a)      // a.type === ControlAdornmentType.Icon
isAccordionAdornment(a) // a.type === ControlAdornmentType.Accordion
isSetFieldAdornment(a)  // a.type === ControlAdornmentType.SetField
isOptionalAdornment(a)  // a.type === ControlAdornmentType.Optional
```

No guards for `Tooltip` or `HelpText` — they have no built-in renderer, so the engine never branches on them.

### `AdornmentPlacement`

```ts
enum AdornmentPlacement {
  ControlStart,   // before the input element
  ControlEnd,     // after the input element
  LabelStart,     // before the label text
  LabelEnd,       // after the label text
}
```

Maps to the `RenderedLayout` slot keys via `layoutKeyForPlacement`:

| Placement | Slot |
|---|---|
| `ControlStart` | `controlStart` |
| `ControlEnd` | `controlEnd` |
| `LabelStart` | `labelStart` |
| `LabelEnd` | `labelEnd` |

`children` and `label` are *not* placements — they're the slots that the data renderer's main output and the resolved label live in.

## `AdornmentRenderer` — the runtime shape

```ts
interface AdornmentRenderer {
  apply(layout: RenderedLayout): void;   // mutates in place
  adornment?: ControlAdornment;
  priority: number;
}
```

Adornments are not React components — they're synchronous mutators. `apply(rl)` runs once during `renderLayoutParts` and pokes content into the layout's slots. Returning a component would mean nesting wrappers; mutating slots means content lives in the layout renderer's own DOM tree.

### Priority constants

```ts
export const AppendAdornmentPriority = 0;
export const WrapAdornmentPriority   = 1000;
```

`renderLayoutParts` sorts ascending by `priority` before applying. Convention:

- **`0`** — append/inject markup into a slot. Most adornments use this.
- **`1000`** — wrap the entire layout with `wrapLayout`. Used by Accordion (when applied as a wrapping adornment).
- Anything in between — custom adornments that need to interleave with existing append/wrap behaviour.

A `wrapLayout` adornment with priority 1000 wraps everything that earlier adornments contributed — append-to-`labelStart` ends up *inside* the wrapper, not outside.

### Helper functions

Adornments compose `apply` from helpers in `controlRender.tsx`:

```ts
type MarkupKeys =
  "labelStart" | "labelEnd" | "controlStart" | "controlEnd" | "label" | "children";

appendMarkup(k: MarkupKeys, markup: ReactNode):
    (rl: RenderedLayout) => void;

wrapMarkup(k: MarkupKeys, wrap: (existing: ReactNode) => ReactNode):
    (rl: RenderedLayout) => void;

layoutKeyForPlacement(pos: AdornmentPlacement): MarkupKeys;
appendMarkupAt(pos: AdornmentPlacement, markup: ReactNode): (rl) => void;
wrapMarkupAt  (pos: AdornmentPlacement, wrap):              (rl) => void;

wrapLayout(wrap: (layout: ReactElement) => ReactElement): (rl) => void;
```

`appendMarkup` adds *after* whatever's already in the slot (so multiple adornments on the same placement compose left-to-right by priority). `wrapMarkup` replaces the slot with the result of `wrap(existing)` — useful when an adornment needs to surround the existing content rather than sit alongside it.

`wrapLayout` is the heaviest: it composes onto `RenderedLayout.wrapLayout`, which the layout renderer applies to the *final* React element. This is the only mechanism that survives outside the inner `DefaultLayout` block.

## How `RenderFormNode` collects adornments

In `schemas/src/RenderForm.tsx`:

```ts
const adornments =
  definition.adornments?.map((x) =>
    renderer.renderAdornment({
      adornment: x,
      dataContext,
      formNode: state,
    }),
  ) ?? [];

const layoutProps: ControlLayoutProps = {
  ...labelAndChildren,
  adornments,
  className: rendererClass(options.layoutClass, definition.layoutClass),
  style: state.definition.layoutStyle as React.CSSProperties,
};

const renderedControl = renderer.renderLayout(
  options.adjustLayout?.(dataContext, layoutProps) ?? layoutProps,
);
```

`AdornmentProps`:

```ts
interface AdornmentProps {
  adornment: ControlAdornment;
  dataContext: ControlDataContext;
  runExpression?: RunExpression;
  designMode?: boolean;
  formNode: FormStateNode;
}
```

`runExpression` is optional and currently passed by the *adornment renderer registration* via the engine's surrounding context — `SetFieldAdornment` is the only built-in that reads it. `designMode` lets adornments suppress decorative wrappers in the visual editor (for instance, the design overlay would prefer to see the bare child, not an accordion that's collapsed by default).

The engine never re-resolves adornments mid-render — once collected, they're frozen for the life of this React render, then the render loop runs again next time `definition.adornments` changes.

## Application — `renderLayoutParts` recap

From `LAYOUT-PIPELINE.md`:

```ts
function renderLayoutParts(props, renderer): RenderedLayout {
  const { className, children, style, errorControl, label, adornments, inline, errorId } =
    props.processLayout?.(props) ?? props;
  const layout: RenderedLayout = {
    children, errorControl, style, className, inline, errorId,
    wrapLayout: (x) => x,
  };
  (adornments ?? [])
    .sort((a, b) => a.priority - b.priority)
    .forEach((x) => x.apply(layout));
  layout.label = label && !label.hide
    ? renderer.renderLabel(label, layout.labelStart, layout.labelEnd)
    : undefined;
  if (label?.type === LabelType.Inline) layout.inlineLabel = true;
  return layout;
}
```

Critical sequencing — adornments mutate `labelStart`/`labelEnd` *before* the label is resolved. So:

1. An adornment can inject a leading icon at `LabelStart` (priority 0).
2. An adornment can wrap the whole layout in an accordion (priority 1000) — the header sees the post-label content, and the wrapper closes around everything.
3. The label renderer consumes `labelStart` + `labelEnd` once and produces the final `label` ReactNode. From this point on, `labelStart`/`labelEnd` are stale.

## The four built-in adornment renderers

`createDefaultAdornmentRenderer` in `schemas-html/src/createDefaultRenderers.tsx` is one `AdornmentRendererRegistration` that internally dispatches:

```ts
const optional = createOptionalAdornment(options.optional);
return {
  type: "adornment",
  render: (props, renderers) => {
    if (isOptionalAdornment(props.adornment))
      return optional.render(props, renderers);
    const { adornment, designMode, dataContext, runExpression } = props;
    return {
      apply: (rl) => {
        if (isSetFieldAdornment(adornment) && runExpression) {
          return wrapLayout((x) => (
            <SetFieldWrapper
              children={x}
              parentContext={dataContext}
              adornment={adornment}
              runExpression={runExpression}
            />
          ))(rl);
        }
        if (isIconAdornment(adornment)) {
          const { I } = renderers.html;
          const { icon, placement, iconClass } = adornment;
          return appendMarkupAt(
            placement ?? AdornmentPlacement.ControlStart,
            <I className={iconClass} iconName={icon?.name} iconLibrary={icon?.library} />,
          )(rl);
        }
        if (isAccordionAdornment(adornment)) {
          return wrapLayout((x) => (
            <DefaultAccordion isGroup={false} renderers={renderers}
              children={x} title={renderers.renderLabelText(adornment.title)}
              defaultExpanded={adornment.defaultExpanded}
              contentStyle={rl.style} contentClassName={rl.className}
              designMode={designMode} dataContext={dataContext}
              options={options.accordion}
            />
          ))(rl);
        }
      },
      priority: 0,
      adornment,
    };
  },
};
```

Notes:

- `Optional` is split out into `createOptionalAdornment` because it needs its own `AdornmentRendererRegistration` (it carries `adornmentType: ControlAdornmentType.Optional` for engine-level filtering and is much more complex than the others).
- All four built-ins use `priority: 0`. `Accordion` *also* composes `wrapLayout`, but with priority 0 — it still wraps everything at priority 0 because nothing else wraps. If a custom adornment also wraps at priority 0, ordering depends on declaration order in `definition.adornments`.
- `Tooltip` and `HelpText` fall through with no `apply` work — they're rendered as no-ops by the default renderer. Hosts that want them must register their own adornment renderer (or replace the default).

### `IconAdornment`

Trivial: `appendMarkupAt(placement ?? ControlStart, <I .../>)`. The `I` component comes from the `HtmlComponents` slot — non-DOM hosts replace it.

### `SetFieldAdornment`

Wraps the entire layout in `<SetFieldWrapper>`, which side-effects sibling field values rather than rendering decoration:

```ts
function SetFieldWrapper({ children, adornment, parentContext, runExpression }) {
  const fieldNode = schemaDataForFieldRef(adornment.field, parentContext.parentNode);
  const otherField = fieldNode.control;
  const always = !adornment.defaultOnly;
  const value = useExpression<any>(undefined, runExpression, adornment.expression, x => x);

  useControlEffect(
    () => [value?.value, otherField?.value == null],
    ([v]) => {
      otherField?.setValue((x) => (always || x == null ? v : x));
    },
    true,
  );
  return children;
}
```

Behaviour:

- Resolves the target field via `schemaDataForFieldRef` (sibling lookup against the parent schema node).
- `useExpression(...)` runs the adornment's `expression` reactively — re-evaluates when its data dependencies change.
- `useControlEffect(...)` syncs the result into the target field.
- `defaultOnly: true` means "only set when the target is null" — handy for derived-but-overridable values (e.g. a slug computed from a title that the user can still edit).
- `defaultOnly: false` (default) means "always overwrite" — handy for one-way computed fields.

The wrapper renders `children` unchanged — the side effect is the whole point.

### `AccordionAdornment`

Wraps the entire layout in `DefaultAccordion isGroup={false}`. See `RENDERER-CATALOG.md` for `DefaultAccordion` details — the only adornment-vs-group difference is:

- **Group mode** (`isGroup: true`) — children with `placement: "title"` move into the header row; rest go in the content body.
- **Adornment mode** (`isGroup: false`) — the header is just the static `adornment.title`; the entire wrapped layout sits in the content body.

State sources are identical between the two modes (`openCtrl > meta.accordionState > defaultExpanded`).

`DefaultAccordion` reads `displayProps` from the wrapped element if present, so an inner Display renderer's class/text-class can leak into the accordion header — useful for matching the styling of the wrapped content's title.

### `OptionalAdornment` — the only stateful adornment

`schemas-html/src/adornments/optionalAdornment.tsx` is its own `AdornmentRendererRegistration` (created via `createAdornmentRenderer((props, renderers) => ..., { adornmentType: ControlAdornmentType.Optional })`). The body:

```ts
const dataControl = dataContext.dataNode?.control ?? newControl(undefined);
const adornment = props.adornment as OptionalAdornment;
const editing = getIsEditing(dataControl);
const isEditing = editing.value;
const nullToggler = getNullToggler(dataControl);

if (isEditing === undefined && adornment.editSelectable)
  editing.value = false;

dataControl.disabled =
  !isEditing || !!(adornment.allowNull && !nullToggler.value);

return {
  apply: (rl) => {
    if (props.formNode.readonly) return rl;
    if (!options.hideEdit && adornment.editSelectable)
      appendMarkupAt(
        adornment.placement ?? options.defaultPlacement ?? AdornmentPlacement.LabelStart,
        <Fcheckbox control={editing} className={options.checkClass} />,
      )(rl);
    wrapMarkup("children", (children) => {
      const props = { allValues: getAllValues(dataControl), editing, children,
                      adornment, nullToggler, dataContext, options, dataControl };
      return options.customRender ? options.customRender(props) : <OptionalEditRenderer {...props} />;
    })(rl);
  },
  priority: 0,
  adornment,
};
```

#### Two orthogonal toggles

`OptionalAdornment` is the only adornment that mutates control state, and it has **two independent toggles** controlled by flags on the adornment:

- **`editSelectable: true`** — adds an "edit?" checkbox (the `editing` control). When unchecked, the adornment force-disables the data control. Used for "this field is read-only by default; flip the checkbox to enable editing" patterns. The `editing` checkbox is appended at `LabelStart` by default.
- **`allowNull: true`** — adds a "set null" checkbox (the `nullToggler` control) inline next to the children. When unchecked, the data control is also disabled. Used for "this field is optional; flip the checkbox to indicate the value is intentionally null" patterns.

The two combine: a field with both flags shows two checkboxes (one in the label area, one in the content) and is only editable when both are on.

```ts
dataControl.disabled = !isEditing || !!(adornment.allowNull && !nullToggler.value);
```

#### State helpers

The adornment delegates to three helpers from the engine (in `controlBuilder.ts`):

- `getIsEditing(control)` — returns/creates a `Control<boolean | undefined>` stored on `control.meta` for the editing toggle.
- `getNullToggler(control)` — returns/creates a derived `Control<boolean>` whose value is "is the control non-null?" — set by user, applies via the `getNullToggler` write hook (see `NullToggle` in `RENDERER-CATALOG.md`).
- `getAllValues(control)` — returns a `Control<unknown[]>` of distinct historical values (used by `OptionalEditRenderer` to render "Differing values" if there's been more than one).

#### `OptionalEditRenderer`

The default content wrapper:

```ts
function OptionalEditRenderer({ children, options, adornment, editing, allValues, nullToggler }) {
  const multipleValues = allValues.value.length > 1;
  const nullEdit = adornment.allowNull ? (
    <div className={options.nullWrapperClass}>
      <Fcheckbox control={nullToggler} className={options.checkClass} notValue />
      <span>{options.setNullText ?? "Null"}</span>
    </div>
  ) : undefined;
  return (
    <div className={options.className}>
      {multipleValues && editing.value === false ? (
        <div className={options.multiValuesClass}>
          {options.multiValuesText ?? "Differing values"}
        </div>
      ) : (
        <div className={options.childWrapperClass}>
          {nullEdit}
          {children}
        </div>
      )}
    </div>
  );
}
```

Hosts override the structure by passing `customRender` in `OptionalAdornmentOptions`.

#### Interaction with default-value initialization

In `formStateNode.ts`, the `defaultValue` initialization effect explicitly skips fields that have an `OptionalAdornment` or `DataRenderType.NullToggle` render type:

```ts
if (
  vis &&
  currentValue === undefined &&
  defVal != null &&
  !(def.adornments ?? []).some(a => a.type === ControlAdornmentType.Optional) &&
  def.renderOptions?.type !== DataRenderType.NullToggle
) {
  ctx.update(wc => wc.setValue(dc, defVal));
}
```

The reasoning: if the user explicitly opted into "this field can be null", auto-populating with a default value defeats the choice. The user can still toggle it on, at which point `getNullToggler` restores the last value (or falls back to `defaultValue` if there is none).

## Visibility

Visibility is a separate wrapper around the entire rendered control. It's the outermost layer of the render — `renderer.renderVisibility(...)` runs after `renderer.renderLayout(...)`, and it decides whether the inner element gets mounted at all.

### `VisibilityRendererRegistration` and `Visibility` shape

```ts
interface Visibility {
  visible: boolean;
  showing: boolean;
}

interface VisibilityRendererProps extends RenderedControl {
  visibility: Control<Visibility | undefined>;
}

interface VisibilityRendererRegistration {
  type: "visibility";
  schemaExtension?: ControlDefinitionExtension;
  render: (props: VisibilityRendererProps, renderer: FormRenderer) => ReactNode;
}
```

There is exactly one visibility renderer registered per `FormRenderer` instance — it's a singleton, not a dispatch ladder. `Visibility` itself has two booleans: `visible` (the desired state) and `showing` (the rendered state). Splitting them lets animated visibility renderers run an exit transition before unmounting:

- `visible: false → true` — render starts hidden, enter animation runs, `showing` flips to true.
- `visible: true → false` — exit animation runs, on completion `showing` flips to false, content unmounts.

The default (`DefaultVisibility`) doesn't animate — it mirrors `showing` to `visible` synchronously.

### How the visibility control is created

In `RenderFormNode` (see `schemas/src/RenderForm.tsx`):

```ts
const visible = state.visible;        // FormStateNode.visible — boolean | null
const visibility = useControl<Visibility | undefined>(() =>
  visible != null ? { visible, showing: visible } : undefined,
);
if (visible != null) {
  visibility.fields.visible.value = visible;
}
```

The `useControl` initializer runs once per `RenderFormNode` mount; subsequent renders update only `visibility.fields.visible.value` from `state.visible` (which itself is a reactive computed on the FormStateNode). When `state.visible === null` (e.g. async script pending), `visibility.value` remains `undefined` — the visibility renderer renders nothing.

### `DefaultVisibility`

The full implementation:

```tsx
export function DefaultVisibility({
  visibility, children, className, style, divRef, renderer, inline,
}: VisibilityRendererProps & { renderer: FormRenderer }) {
  const v = visibility.value;
  useEffect(() => {
    if (v) {
      visibility.setValue(ex => ({ visible: v.visible, showing: v.visible }));
    }
  }, [v?.visible]);
  const { Div } = renderer.html;
  if (inline) return v?.visible ? children : undefined;
  return v?.visible ? (
    <Div className={className} style={style} nativeRef={divRef} children={children}/>
  ) : (
    <></>
  );
}
```

Three branches:

1. `v === undefined` — visibility hasn't been determined yet. Returns `<></>` (or `undefined` for inline). This is the async-pending state.
2. `v.visible === false` — explicitly hidden. Same empty render. Children never mount, so they don't run side effects, fetch data, or hold state.
3. `v.visible === true` — render `children`. Wrapped in `<Div>` for block layout; no wrapper for inline.

The `useEffect` mirroring is what makes this visibility renderer non-animated: every time `v.visible` changes, `showing` is set to the same value. Custom animated visibility renderers would *not* mirror — they'd transition `showing` separately.

`divRef` is forwarded to the `<Div>` so error scrollers (set by `DefaultLayout`) can find the element to scroll into view. In inline mode there's no wrapper, so `divRef` is silently dropped — error scroll-to-view doesn't work for inline controls.

### Inline visibility

`inline: true` returns `children` directly when visible, `undefined` when hidden. The `undefined` (vs empty fragment) matters for parents that conditionally render based on whether children are present — e.g. a flex container with `gap` shouldn't allocate gap for a hidden inline child.

## Settled invariants

1. **Adornments mutate, don't wrap (mostly).** The mental model is "build a layout, decorate slots." `wrapLayout` is the deliberate exception for whole-layout wrapping.
2. **Priority order is critical.** Append-style (priority 0) runs before wrap-style (priority 1000) so the wrapper closes around everything else's contributions.
3. **Adornment renderers are synchronous.** Reactive work happens inside React components rendered into a slot, not inside `apply()`. `apply` runs once per render and is expected to be cheap.
4. **`OptionalAdornment` is the only adornment that mutates control state.** It's also the only adornment that participates in default-value semantics — `formStateNode.ts` explicitly defers to it.
5. **`Tooltip` and `HelpText` are extension points.** The default renderer ignores them; hosts wire them up via custom registrations.
6. **Visibility is a singleton.** One renderer wraps every node — there's no per-node visibility customization, only via custom renderer plug-in.
7. **Visibility renders either children or nothing.** No "lazy mount" mode in the default — once hidden, children unmount and lose state. Hosts that want preserved state use `useCss: true` on the surrounding accordion or render visibility themselves.
8. **`Visibility.showing` decouples render from state.** Animation-aware renderers gate unmount on `showing`, not `visible`.

## Open questions for the redesign

- **Adornment registration granularity.** The default registration combines four very different adornments. A redesign could give each its own `AdornmentRendererRegistration` with `adornmentType` discriminator (the way `OptionalAdornment` already does), making them independently overridable.
- **Tooltip/HelpText defaults.** The legacy treats them as extension points — but every real consumer ships some implementation. A renderer-agnostic default (e.g. inject `aria-describedby` + a wrapper div) could be sensible.
- **`apply` mutation vs. component shape.** Today an adornment that needs state (e.g. accordion expansion) does it via React hooks inside the wrap function. A component-shaped adornment would let the hook live in the adornment's own render tree, but breaks the in-place mutation model.
- **`OptionalAdornment`'s two-toggle design.** `editSelectable` and `allowNull` are subtly different and the combination is hard to reason about. Worth reconsidering as separate adornment types or as a unified mode enum.
- **Visibility `useEffect` mirroring.** The default fires an effect on every visibility change, even when nothing animates. Could be a no-op when the renderer is non-animated; the effect exists today purely to keep `showing` in sync.
- **Visibility-aware adornments.** An accordion adornment around a hidden child still mounts the accordion shell. Whether that's correct (preserves expansion across hide/show) or wrong (wastes DOM) depends on the host.
- **Hidden-but-mounted state.** With `state.visible === null` (async pending), `DefaultVisibility` renders nothing, which means the loading fallback has to live elsewhere. Worth providing a slot.
