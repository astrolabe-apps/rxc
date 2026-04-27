# Legacy Renderer Catalog (`@react-typed-forms/schemas-html`)

Reference document. Catalogs every renderer in `astrolabe-common/schemas-html` — what it matches, what it returns, and what makes it non-trivial. Companion to `RENDERER-ARCHITECTURE.md` (the engine interface) and `LAYOUT-PIPELINE.md` (the layout flow). DefaultLayout and DefaultVisibility live in this package but are documented in `LAYOUT-PIPELINE.md`.

## How registrations are assembled

`createDefaultRenderers(options)` returns the `DefaultRenderers` slot map consumed by `createFormRenderer`:

```ts
{
  data:        createDefaultDataRenderer(options.data),
  display:     createDefaultDisplayRenderer(options.display),
  action:      createButtonActionRenderer(undefined, options.action),
  array:       createDefaultArrayRenderer(options.array),
  group:       createDefaultGroupRenderer(options.group, options.adornment),
  label:       createDefaultLabelRenderer(options.label),
  adornment:   createDefaultAdornmentRenderer(options.adornment),
  renderLayout: createDefaultLayoutRenderer(options.layout),
  visibility:  createDefaultVisibilityRenderer(),
  extraRenderers: options.extraRenderers?.(options) ?? [],
  html:        options.html ?? StandardHtmlComponents,
}
```

Each entry except `extraRenderers`, `html`, and the singletons (`label`, `array`, `renderLayout`, `visibility`) is a single `RendererRegistration` (`data`/`group`/`action`/`display`/`adornment`). Of those, `data` and `group` are dispatch ladders that internally try a series of more-specific registrations before falling through to a default. The same factory functions are exported individually so apps can compose their own slot maps — e.g. `createSelectRenderer`, `createRadioRenderer`, `createMultilineFieldRenderer` — and pass them via `extraRenderers`.

`createClassStyledRenderers()` is a convenience wrapper that supplies BEM-ish class names for all the layout slots — useful in tests and in non-Tailwind hosts.

## Data renderer dispatch ladder

`createDefaultDataRenderer` builds one big `createDataRenderer((props, renderers) => …)` whose body is a fixed match ladder. It first instantiates every leaf renderer it might dispatch to (`elementSelectedRenderer`, `jsonataRenderer`, `nullToggler`, `multilineRenderer`, `checkboxRenderer`, `selectRenderer`, `radioRenderer`, `checkListRenderer`, `arrayElementRenderer`, `arrayRenderer`, `autocompleteRenderer`, `scrollListRenderer`), then walks the ladder per render:

1. **Array of elements**: `field.collection && elementIndex == null && renderType ∈ {Standard, Array, ArrayElement}` → `arrayElementRenderer` if `ArrayElement`, otherwise `arrayRenderer`. The `elementIndex` guard is what makes per-element renders fall through to the leaf type instead of recursing into the array renderer.
2. **Compound dispatch**: `field.type === Compound && (isDataGroupRenderer(renderOptions) || renderType === Standard)` → re-dispatch as a group with `renderOptions = groupOptions ?? {type: "Standard", hideTitle: true}`. This is the inverse of the compound-field rewrite in `renderControlLayout` — if a `dataControl` lands on a compound field, the data renderer hands it off to the group renderer.
3. **Display-only short-circuit**: `displayOnly` flag or `isDisplayOnlyRenderer(renderOptions)` → returns a `processLayout` that injects `<DefaultDisplayOnly>` as `children` and applies `displayOnlyClass`. This bypasses every leaf renderer below.
4. **Boolean → options coercion**: `fieldType === Bool && booleanOptions != null && props.options == null` → re-dispatches `renderData` with `options: booleanOptions` (default `[{name: "Yes", value: true}, {name: "No", value: false}]`). After this re-entry, the next iteration takes the options-with-Standard branch instead of falling through to a checkbox.
5. **Options + Standard**: `renderType === Standard && hasOptions(props)` → `optionRenderer.render(...)` (default `selectRenderer`). Apps that want radio-as-default for options pass `optionRenderer: radioRenderer`.
6. **Explicit `DataRenderType`**: switch on `renderType` for `NullToggle`, `CheckList`, `ScrollList`, `Dropdown`, `Radio`, `Checkbox`, `Jsonata`, `Autocomplete`, `ElementSelected`.
7. **Unrenderable Any**: `fieldType === Any && !isTextfieldRenderer(renderOptions)` → emits a literal `Can't render field: …` JSX node instead of throwing. Renders inline so dev-mode hosts can spot the problem in place.
8. **Multiline textfield**: `isTextfieldRenderer && multiline` → `multilineRenderer`.
9. **Default**: `<ControlInput>` with `createInputConversion(field.type)` for type marshalling.

Order is significant — every guard above the switch consumes its match. In particular, `displayOnly` wins over options/render-type, and the boolean coercion runs before the explicit `Checkbox` case, so a `Bool` field with no options *does not* hit `Checkbox` unless `renderType === DataRenderType.Checkbox` is set explicitly.

### `ControlInput` — the textfield fallback

`ControlInput` is not a registered renderer; it's the primitive used by the bottom of the ladder. Renders an `Input` (from `renderer.html`) with HTML `type` derived from `convert[0]`. Three pieces of `convert: ConvertHook`:

- `[0]: string` — the `type` attribute (`"text"`, `"number"`, `"date"`, `"datetime-local"`, `"time"`).
- `[1]: (raw: string) => any` — parser from input string to control value.
- `[2]: (value: any) => string` — formatter for display.

It maintains an internal `textValue` control so the user can type freely — the control value only updates when parsing succeeds. `useControlEffect` syncs back from the outer control to `textValue` on programmatic changes. `aria-describedby` and `aria-invalid` are wired to `errorId` for screen-reader association.

### `MultilineTextfield`

`createMultilineFieldRenderer(multilineClass, multilineContentEditable)` matches `isTextfieldRenderer(renderOptions) && renderOptions.multiline === true`. Two modes:

- **`<textarea>`** (default) — straightforward two-way bind on `control.value`.
- **`<code contentEditable>`** (when `useContentEditable: true`) — for code-style inputs where preserving caret position is important. Uses `useControlEffect` to copy the control value into `element.textContent` only when it differs, so typing doesn't blow away the cursor. ARIA: `role="textbox"`, `aria-multiline="true"`, plus `aria-readonly`/`aria-disabled`.

### `SelectDataRenderer` (the default `optionRenderer`)

Renders a native `<select>`. Reads `convert: (val) => string` (memoized) for HTML option values — `String`/`Int`/`Double` round-trip via primitive `String()`; other types use `toString()`. Supports option groups (`option.group` field) by collecting groups upfront and emitting `<optgroup>` blocks before the un-grouped tail. Required-vs-empty placeholder handling:

- If `required` and value is non-null → no placeholder option.
- If `required` and value is null → option with `requiredText` (or `defaultRequiredText`), `disabled`, `value=""`.
- If not required → option with `emptyText`.

Disabled options are emitted with the HTML `disabled` attribute.

### `CheckRenderer` family — `Radio` / `CheckList` / `Checkbox` / `ElementSelected`

All four live in `CheckRenderer.tsx` and ultimately delegate to `HtmlCheckButtons` (multi-button list) or `Fcheckbox` (single boolean). They differ only in the `isChecked`/`setChecked` callbacks and whether the value is scalar or array.

| Renderer | Match | Value | `setChecked` |
|---|---|---|---|
| `createRadioRenderer` | `DataRenderType.Radio` | scalar, equality check | `setValue(option.value)` |
| `createCheckListRenderer` | `DataRenderType.CheckList`, `collection: true` | array, includes check | `setIncluded(arr, opt.value, checked)` |
| `createCheckboxRenderer` | `DataRenderType.Checkbox` | boolean | direct toggle via `Fcheckbox` |
| `createElementSelectedRenderer` | `DataRenderType.ElementSelected` | boolean (managed) | via `useElementSelectedRenderer` (manages parent-array selection) |

All return a `processLayout` that sets `children` and forces `LabelType.Inline` on the label, so `DefaultLayout` puts the label next to the control instead of above it. `formNode.disabled` always overrides individual button disabled state.

### `HtmlCheckButtons` — the shared check-button presenter

The DOM structure rendered by Radio/CheckList/Checkbox/ElementSelected (and exposed on `HtmlComponents.CheckButtons` so non-HTML hosts can override it):

```html
<div role="group">
  {options.map(o => (
    <div className={selectedClass | notSelectedClass}>
      <input type={radio|checkbox} name={uniqueName} checked={isChecked} disabled={...}/>
      <label htmlFor={...}>{o.name}</label>
      {entryAdornment?.(o, i, checked)}
    </div>
  ))}
</div>
```

- `name` is uniqueId-derived per control, so multiple radio groups on one page don't collide.
- `entryAdornment` lets a host slot per-option content (descriptions, badges) after the label.
- Iteration uses `RenderArrayElements` from core to keep per-row React reconciliation cheap.
- Read-only and disabled state are checked inside `onChange` rather than just on the input attribute, so programmatic changes are also blocked.

### `AutocompleteRenderer`

Matches `DataRenderType.Autocomplete`. Wraps `@mui/base/useAutocomplete` with `freeSolo: true` and a custom case-insensitive substring filter. Two modes selected by `field.collection`:

- **Single** — outer control bound to selected option's `value`; internal `selectedOptionControl` holds the chosen `FieldOption | string`.
- **Multi** — outer control is the array; internal `selectedOptionsControl` is the parallel array of full `FieldOption` objects, rendered as deletable chips above the input.

Internal `inputControl` mirrors the text input. `useControlEffect` syncs internal → outer (commits the parsed value) and outer → internal (handles programmatic resets). Class plumbing: `controlClasses` overrides win over per-renderer `classes`.

### `JsonataRenderer`

Matches `DataRenderType.Jsonata`. Renders a `<div>` whose body is the result of evaluating `definition.expression` as JSONata, coerced to string and dropped through `dangerouslySetInnerHTML`. Bindings exposed: `value` (tracked via `trackedValue(control)`), `readonly`, `disabled`, `dataPath`. Tracked reads make the renderer reactive to control changes inside the expression. Sanitization is the host's responsibility — the renderer trusts the expression author.

### `NullToggle`

Matches `DataRenderType.NullToggle`. Doesn't render its own UI — instead synthesizes a checkbox bound to a *toggler* control derived from the data control:

```ts
const toggler = getNullToggler(control);     // pseudo-control: present <-> absent
const lastValue = getLastDefinedValue(control) ?? definition.defaultValue;
return renderers.renderData({...props, control: toggler, ...});
```

Setting the toggler to true restores `lastValue`; setting it to false nulls the field but stashes the prior value so the user can flip back without losing data. The actual UI is whatever the dispatched data renderer chose for a Bool — usually `Checkbox`.

### `ScrollListRenderer`

Matches `DataRenderType.ScrollList`, `collection: true`. Renders the array's children inline (no add/remove actions) plus an `IntersectionObserver`-based sentinel that fires a `bottomActionId` action when the bottom comes into view. State piggybacks on per-control meta:

- `getLoadingControl(dataNode.control)` — boolean, set by the host's data-loading code.
- `getHasMoreControl(dataNode.control)` — boolean, prevents firing when end is reached.

The trigger only fires when `!loading && hasMore` and the sentinel is at least 50% visible. A spinner icon (configurable) sits in a sticky div at the bottom; the renderer doesn't manage data fetching itself — it just signals.

### `ArrayElementRenderer`

Matches `DataRenderType.ArrayElement` for collection fields. This is **not** a per-element renderer — it's the per-element dialog that opens when the host wants out-of-band element editing. Renders a `Dialog`+`Modal` (from `@astroapps/aria-base`) populated with action buttons sourced from `getExternalEditData(control).fields.actions`. Returns an empty fragment if external edit data isn't attached. `showInline: true` flattens the dialog into an inline div for design-mode previews.

### `DefaultArrayRenderer` (data + presentation)

Two registrations live in `DefaultArrayRenderer.tsx`:

- **`createDefaultArrayDataRenderer`** — the `data`-side hook for `DataRenderType.Array` and `Standard` collection. Computes add/remove/edit/reorder action sets via `createArrayActions(...)`, walks `formNode.getChild(i)` for each element, and returns a `processLayout` that delegates to `renderers.renderArray(arrayProps)`.
- **`createDefaultArrayRenderer`** — the `array`-side presentation registration. Wraps each element in a row div (`childClass`), appends per-row edit/remove buttons, and emits the add button after the last row.

Length restrictions (`getLengthRestrictions(definition)`) gate add/remove. `editExternal` tells the data side to use `arrayElementRenderer` for per-element rendering. Reorder uses `noReorder` to suppress drag handles. The split between data and presentation is the only place the engine routes through the `array` slot — letting alternate UI libraries replace just the row layout without rewriting the per-element loop.

## Group renderer dispatch

`createDefaultGroupRenderer` dispatches on `renderOptions.type` (`GroupRenderType`):

| Type | Renderer | Notes |
|---|---|---|
| `Standard` (default) | inline `<Div>` with `className` | block layout |
| `Inline` | `<Div className={inlineClass} inline>` | inline layout |
| `Flex` | `<Div style={display: flex, gap, flexDirection}>` | from `flexOptions` |
| `Tabs` | `TabsRenderer` | one tab per visible child |
| `Grid` | `GridRenderer` | `numColumns` rows |
| `Wizard` | `DefaultWizardRenderer` | paged with prev/next |
| `Dialog` | `DefaultDialogRenderer` | trigger + modal |
| `Accordion` | `createAccordionGroupRenderer` (delegates to `DefaultAccordion`) | expand/collapse |
| `SelectChild` | `SelectChildGroupRenderer` | one child by expression |
| `Contents` | layout fn returning `inline: true` with embedded children | bypasses wrapper |

`Contents` is special: it returns a `processLayout` that sets `inline` and fills `children` with the rendered children directly, with no wrapping `<Div>`. The label is dropped. This is the "transparent group" pattern used to insert organizational structure into the schema without affecting DOM.

### `TabsRenderer`

Renders a `<ul>` tab strip plus one active panel. Internal `tabIndex` control (`useControl(0)`) drives selection; `formNode.ui` gets a `TabUi` instance with `ensureChildVisible(i)` so external code (e.g. error scrollers, wizards) can switch tabs programmatically. Hidden children are filtered out of the strip. Design mode skips the panel logic and stacks all children. Class slots: `tabListClass`, `tabClass`, `labelClass`, `activeClass`, `inactiveClass`, `contentClass`.

### `GridRenderer`

Chunks visible children into rows of `columns` (default 2). `cellClass` is comma-separated for per-column classes (`"flex-1,flex-2,flex-1"` lets a 3-column row have asymmetric widths). `rowClass` wraps each row. Hidden children are filtered before chunking, so grid alignment respects visibility — there's no empty-cell behaviour.

### `DefaultWizardRenderer`

Renders a step strip + the active page + nav buttons. State managed by `useWizardRenderer(formNode, ...)` from the engine package: tracks `pageIndex`, computes step visibility from child visibility, and runs validation on `next` if `validate: true` is set on the action.

- Default nav layout: prev (left) / spacer / next (right). Customizable via `renderNavigation()` — host can supply `leftContent`, `middleContent`, `rightContent`, or replace the whole thing.
- Action button text/icons configurable: `nextText`, `prevText`, `nextIcon`, `prevIcon`, `iconPlacement`.
- Design mode renders all pages stacked, no nav.
- Step strip rendered via the registered label renderer for each step's title.

### `DefaultDialogRenderer`

Renders the children whose `placement === "trigger"` inline; the rest go inside a modal. Internal `open` control + `createOverlayState(open)` from aria-base. The action handler intercepts `"openDialog"` / `"closeDialog"` action IDs to drive the overlay — so any `actionControl` inside the trigger or dialog content with those IDs becomes a control button. Design mode: clicking the toggle expands the dialog inline rather than mounting the modal.

### `DefaultAccordion`

Used by both the `Accordion` group renderer (`isGroup: true`) and the `AccordionAdornment` (`isGroup: false`). Renders a header (toggle button + custom title renderer) and a content region with `role="region"` and `aria-controls` linkage via `useId()`.

State sources, in priority order:

1. `openCtrl` — externally supplied control (e.g. bound to a schema field for persisted accordion state).
2. `dataControl.meta.accordionState` — cached on the data control so nav-away-and-back preserves expansion.
3. `defaultExpanded` — initial value if neither source has state.

Modes:

- Default → unmounts content when collapsed.
- `useCss: true` → keeps content mounted with `display: none` (preserves child state, defeats lazy mounting in children).
- Design mode → always shows content.

Class slots: `className`, `titleClass`, `titleTextClass`, `contentClass`, `contentStyle`, `iconOpen`, `iconClosed`. For groups, children with `placement: "title"` move into the header row; everything else stays in the content body.

### `SelectChildGroupRenderer`

Evaluates `renderOptions.childIndexExpression` (a JSONata expression on the parent data context), bounds-checks the result, and renders only that child. Effectively a discriminated-union switch driven by data — pair with `Contents` children to make the active child render seamlessly inline.

## Action renderer

`createButtonActionRenderer(customClasses, options)` is the only action registration. Renders `<Button>` (from `renderer.html.Button`) with:

- `actionStyle` → maps to `primaryClass` / `secondaryClass` / `linkClass` / `groupClass`. `Group` is the special "container" style for action menus.
- `iconPlacement` → `BeforeText`, `AfterText`, or `ReplaceText`. `ReplaceText` hides the label and exposes it as the button's `title` so the visible content is just an icon.
- `busy` → swaps `icon` for `busyIcon` while a Promise-returning handler is in flight (the engine sets `formNode.busy` before/after; see `LAYOUT-PIPELINE.md` action branch).
- `notWrapInText` → for `actionStyle === Group`, suppresses the inner text wrapper so the button can host non-text content (the rendered child action group).
- `androidRippleColor` → passed through for React Native parity.
- `renderContent(props)` → user-supplied callback that wins over icon+text composition.

`onClick` is wrapped to `e.stopPropagation()` first, so deeply nested actions don't trigger ancestor click handlers.

## Display renderer

`createDefaultDisplayRenderer` dispatches on `data.type` (`DisplayDataType`):

| Type | Output |
|---|---|
| `Icon` | `<I className={iconClass} iconName iconLibrary>` |
| `Text` | `<Div text={text} inline?>` |
| `Html` | `<Div html={html} inline?>` (uses `dangerouslySetInnerHTML`) |
| `Custom` | `<Div className={customId}>` placeholder unless host overrides via `customDisplay` |

Reads no controls. `noSelection: true` adds `style={userSelect: "none"}` so display content can't be accidentally selected (helpful in actions and chips).

## Display-only renderer

`DefaultDisplayOnly` is what `displayOnly` on the data branch substitutes in. Renders `<Div>` (or `<Span>` if inline) with text from:

1. `overrideText` (highest priority — comes from `DisplayOnlyRenderOptions.overrideText`).
2. `schemaInterface.textValueForData(field, control.value)`.
3. `emptyText` if the value is "empty" per `schemaInterface.isEmptyValue`.

`noSelection` applies the same user-select-none style. No interactivity, no error display, no validation — it's strictly read-only output.

## Label renderer

`createDefaultLabelRenderer` is one registration covering all `LabelType`s:

- `LabelType.Text` → `<Span>{label}</Span>` only. Used for inline accents.
- `LabelType.Group` → `<Label>` with `groupLabelClass` + `groupLabelTextClass`.
- `LabelType.Control` → `<Label>` with `controlLabelClass` + `controlLabelTextClass`.
- `LabelType.Inline` → same `<Label>` markup; placement is `DefaultLayout`'s job (it sticks the label after children in a flex row).

The `<Label>` body composes `[labelStart, renderLabelText(label), required && requiredElement(html)] + labelEnd`. `requiredElement` defaults to `<Span> *</Span>`; hosts can replace it with anything (asterisk-with-tooltip, badge, etc.). `labelContainer` is an outer wrap escape hatch (default identity) for hosts that need to wrap every label (e.g. for tooltips).

## Adornment renderer

`createDefaultAdornmentRenderer` matches four adornment types:

- **`OptionalAdornment`** → `createOptionalAdornment(...)`. Renders the optional toggle (a checkbox that nulls the field when off). Documented in `ADORNMENTS-AND-VISIBILITY.md`.
- **`SetFieldAdornment`** → composes `wrapLayout` with `<SetFieldWrapper>`, which uses `useExpression` + `useControlEffect` to push an evaluated value into a sibling field. Either always (`defaultOnly: false`) or only when the target is null (`defaultOnly: true`).
- **`IconAdornment`** → `appendMarkupAt(placement ?? ControlStart, <I .../>)` — by default the icon goes at the start of the control.
- **`AccordionAdornment`** → `wrapLayout(<DefaultAccordion isGroup={false} ...>)` — wraps the entire layout. Uses the inner element's `displayProps` (when present) for class/text-class so the accordion header inherits the wrapped element's styling.

All four use `priority: 0` (the `AppendAdornmentPriority` baseline). Custom adornments compose by setting their own priority — see `LAYOUT-PIPELINE.md` for the priority semantics.

## Layout / visibility

Documented in `LAYOUT-PIPELINE.md`. Recap:

- `createDefaultLayoutRenderer` builds `RenderedLayout` via `renderLayoutParts`, then wraps the inner JSX in `<DefaultLayout layout={layout} ...>` and applies the composed `wrapLayout` chain. Stores the `divRef` on `errorControl.meta.scrollElement` so external code can scroll-into-view.
- `createDefaultVisibilityRenderer` returns `DefaultVisibility`, which mirrors `showing` to `visible` synchronously (no animation) and renders the inner element only when `visible` is true. `inline` skips the wrapping `<Div>`.

## HTML primitives slot

`StandardHtmlComponents` is the default `HtmlComponents` map plugged into the renderer. It's intentionally minimal — every renderer reaches DOM exclusively through this slot, so React Native and other non-DOM hosts replace the slot wholesale rather than forking the renderers.

| Slot | Default | Notes |
|---|---|---|
| `Button` | `DefaultHtmlButtonRenderer` | Picks `span`/`div`/`button` based on `inline`/`nonTextContent`. Always `e.stopPropagation()` before `onClick`. |
| `Label` | `DefaultHtmlLabelRenderer` | `<label>` with merged class+textClass. |
| `I` | `DefaultHtmlIconRenderer` | Maps `iconLibrary` → class prefix (`fa fa-` / raw / library-prefixed). Renders nothing for null icons. |
| `Span` | `"span"` | |
| `Div` | `DefaultHtmlDivRenderer` | Supports `text`, `html`, `inline` (renders `span`), `nativeRef`. |
| `H1` | `"h1"` | |
| `B` | `"b"` | |
| `Input` | `DefaultHtmlInputRenderer` | Wraps `onChangeValue` / `onChangeChecked` to forward `target.value` / `target.checked`. |
| `CheckButtons` | `HtmlCheckButtons` | The check-button presenter — see Check section. |

## `ValueForFieldRenderer`

A non-default renderer included in `extraRenderers` (when wired). Matches a custom `RenderType.ValueForField`. Reads a field reference (literal path or evaluated control value), resolves the matching `SchemaField`, builds an ephemeral form tree with that single field, and renders it via `RenderForm`. `noOptions: true` strips options off the resolved field so the rendered control is a plain value editor instead of a select. Re-keys on `field + ":" + type` so changing the resolved field forces a clean remount.

This is the primary tool for dynamic-union-type rendering: pick a field at runtime based on a discriminator, render its value with the standard data path.

## Settled invariants

1. **The data-renderer ladder is fixed.** Specialisation (display-only, options, render-type switch) happens above the textfield fallback, in that order. Adding a new render type means adding a `case` to the switch, not mutating the order.
2. **Compound fields ping-pong.** A compound `dataControl` re-dispatches as a group; a compound group rewrites itself as a `dataControl` first (per `LAYOUT-PIPELINE.md`). Both paths converge before the leaf branch runs.
3. **Boolean coercion is a re-dispatch, not a special case.** `Bool` fields with no options re-enter `renderData` with synthetic options; they then hit the same option-renderer path as any other field. This keeps the dispatch ladder linear.
4. **Renderers don't decide visibility or errors.** They always emit content; visibility wraps it; `DefaultLayout` decides whether to show errors based on `errorControl.touched`.
5. **`HtmlComponents` is the only DOM coupling.** Replacing the slot map is sufficient to retarget every renderer. Renderers never call native DOM APIs directly except for the controlled exceptions: `IntersectionObserver` in `ScrollListRenderer`, `useId` in `DefaultAccordion` for `aria-controls`, and `element.textContent` in the `MultilineTextfield` contentEditable mode.
6. **Per-element array rendering goes through `renderChild(formNode.getChild(i))`, not through `renderArray`.** The array slot is for the *row layout*; the engine drives the per-element loop. This prevents alternate array renderers from accidentally short-circuiting the FormStateNode lifecycle.
7. **Action handlers are routed through `dataContext.actionHandler`.** Built-in IDs (`openDialog`, `closeDialog`, wizard `next`/`prev`) are intercepted by the relevant group renderer; everything else falls through to the host's handler.

## Open questions for the redesign

- **Data renderer ladder vs. registry.** The fixed ladder is a pain point — adding a new specialisation that needs to slot between, say, "options" and "explicit render type" requires forking the function. A pure registration order (priority-based, like adornments) might be cleaner, at the cost of making the dispatch order less greppable.
- **The boolean-options re-dispatch hack.** It works because `renderData` is reentrant and the second call doesn't loop, but it's unobvious. A redesign could make options inference explicit on the data props rather than via re-entry.
- **Compound ping-pong.** The data ↔ group rewrite is invisible to anyone reading `renderControlLayout` for the first time. Worth keeping or worth flattening into a single dispatch?
- **`HtmlComponents` minimalism.** Some hosts (MUI, native) want richer primitives — `Button` with start/end icons, `Input` with adornments. The current slot is too small for those without forking. Either expand the slot or accept that those hosts ship their own renderer set.
- **Renderer ↔ adornment overlap.** `DefaultAccordion` is both a group renderer and an adornment. The redesign should pick one — the duplication today means two code paths to keep in sync (especially for the design-mode rules and the meta-cached state).
- **`ScrollListRenderer` action plumbing.** The bottom-trigger fires an action ID, but the loading/has-more state lives on the data control's meta. That coupling makes the renderer hard to use without a matching server-side cursor model. A more declarative API (host supplies `loadMore: () => Promise<boolean>`) would be more portable.
- **`ValueForFieldRenderer` re-keying.** Today it remounts on `field + ":" + type`, which loses internal state on every switch. For reactive schemas, ideally the form tree would morph in place rather than remount.
