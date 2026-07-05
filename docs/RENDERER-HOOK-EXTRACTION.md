# Renderer Hook Extraction Audit

Goal: move every **platform-agnostic** renderer controller out of `@rxc/forms` (HTML) into
hooks in `@rxc/forms-react-core`, so `@rxc/forms-native` can reuse the exact behaviour and only
swap emitted elements + styling. Contract: hooks take `(node, rc, …)`, return **values + handlers
only** — never `ReactNode`, never class strings, never DOM element types / input `type` / aria.
React state (`useState`) is allowed (it's React, not DOM); browser APIs (IntersectionObserver,
`<dialog>.showModal()`) stay in the platform renderer, with the hook exposing the callback/gate.

Model to emulate: `useWizardController` (already fully extracted — `Wizard.tsx` is pure chrome).

## Summary table

| Renderer(s) | Proposed hook | Complexity | Notes |
|---|---|---|---|
| Textfield | `useTextInputController` | Low | value↔string, hasError, onChange/onBlur |
| Multiline | `useTextInputController` (+placeholder) | Low | same as Textfield + placeholder from renderOptions |
| Number | `useNumberController` | Med | Int/Double parse-on-blur, internal raw buffer, NaN guard |
| Date/Time/DateTime | `useDateController` | Low | raw buffer, null-on-empty, **no parse** (input type owns format) |
| Select | `useSelectController` | Med | value↔string (type-aware), option grouping, required/empty placeholder |
| Radio | `useRadioController` | Med | value↔string, checked compare, per-option children map |
| Checklist | `useChecklistController` | Med | array membership toggle, per-option children map |
| Checkbox | `useCheckboxController` | Low | bool coerce, required, hasError |
| ElementSelected | `useElementSelectedController` | Med | `useExpression` element value, array membership, disable-when-undefined |
| Autocomplete | `useAutocompleteController` | High | query/filter/open/selected state machine (click-outside stays DOM) |
| Array | `useArrayActions` | High | length range from validators, add/remove/edit dispatch+fallback, editExternal via `getExternalEdit` |
| ScrollList | `useScrollListController` | Low | reads `$scrollList.{loading,hasMore}` meta, dispatch gate (observer stays DOM) |
| Tabs | `useTabsController` | Med | active index state, visible-child filter, title fallback |
| AccordionGroup | `useAccordionSection` | Low | per-section open state + title |
| Dialog | `useDisclosure` | Med | open state + trigger/content child split + ActionScope open/close intercept |
| SelectChild | `useSelectChildIndex` (optional) | Low | thin wrapper over `useExpression` |
| Flex / Grid / Inline / Standard / Contents | **none** | — | pure layout, no state |
| Wizard | `useWizardController` | — | ✅ already done |

## Shared primitives (extract once, compose upward)

- **`useOptionsController(node, rc)`** → `{ options, groups, usesGroups }` — Select/Radio/Checklist.
- **`useArrayMembership(node, rc)`** → `{ selected, includes(v), toggle(v, checked) }` — Checklist/ElementSelected.
- **`useValueString(fieldType)`** → `{ valueToString, stringToValue }` — Select/Radio (Int/Double/Bool coercion). Duplicated verbatim in both today.
- **`usePerOptionChildren(node, rc)`** → `Map<unknown, FormStateNode>` keyed by `meta.fieldOptionValue` — Radio/Checklist.

The three per-widget controllers (`useSelectController` etc.) compose these + widget-specific bits
(placeholder, checked compare) so the HTML renderers become thin.

## Contract resolutions / gotchas

- **Autocomplete state stays in the hook.** `open`/`query` are part of the state machine RN must
  reuse — expose them (`query/setQuery`, `open/setOpen`, `onSelectOption`, `filtered`, `display`).
  Only the container ref + click-outside document listener stay in the HTML renderer.
- **Number/Date buffer is internal to the hook.** Expose `displayValue` + `onChangeRaw` +
  `onBlurCommit`; don't leak the buffer setter.
- **`useActionHandler` already lives in forms-react-core**, so the dispatch-with-fallback wiring in
  Array/ScrollList and the ActionScope open/close intercept in Dialog can all move into hooks.
- **`getExternalEdit` is already extracted.** `useArrayActions` should consume it internally and
  call `beginAdd()`/`beginEdit()` from its returned handlers.
- **`hasError = touched && !!rc.getError(data)`** recurs in nearly every data renderer — fold into
  each controller's return so the renderer never touches it directly.

## Sequencing

**Phase 1 — shared primitives + text/number/date + options widgets** ✅ **DONE.** Shipped in
`@rxc/forms-react-core`: `optionCoerce.ts` (`valueToString` / `stringToValue` /
`mapChildrenByOptionValue` — pure), `useInputControllers.ts` (`useTextInputController` [Textfield +
Multiline], `useNumberController`, `useDateController`), `useOptionControllers.ts`
(`useSelectController`, `useRadioController`, `useChecklistController`, `useCheckboxController`,
`useElementSelectedController`). All eight HTML renderers in `@rxc/forms` rewritten to thin views —
they call `node.getState(rc)` only through the controller (which surfaces `data` for the null-bail
and `styleClass` for `rendererClass` composition); DOM element + theme + `rendererClass` stay in the
renderer. Contract settled: `(rc, node)`, writes via `useControlContext().update` (matches
`useWizardController`); pure per-option classes surfaced as raw strings, never composed in the hook.
Full monorepo build green; forms-react-core (61) + forms (45) tests pass — the `builtins` suite
covers every rewritten renderer.

The originally-proposed `useValueString` / `useOptionsController` / `useArrayMembership` /
`usePerOptionChildren` were folded in more directly: string coercion + child-map are pure functions
in `optionCoerce.ts`; option grouping and array-membership toggle live inside their owning
controllers (`useSelectController` / `useChecklistController`) rather than as separate shared hooks —
no cross-widget sharing justified the extra indirection.

**Phase 2 — stateful groups + collections**: `useTabsController`, `useDisclosure`,
`useAccordionSection`, `useArrayActions`, `useScrollListController`, `useAutocompleteController`.

**Phase 3 — spike `@rxc/forms-native`** with one renderer (Textfield → RN `TextInput`) end-to-end to
validate the boundary before porting the rest. Optional: `useSelectChildIndex`.

Each extraction: create hook in `packages/forms-react-core/src/`, export from `index.ts`, rewrite the
`@rxc/forms` renderer to call it (DOM + theme only), keep tests green. No behaviour change — pure move.
