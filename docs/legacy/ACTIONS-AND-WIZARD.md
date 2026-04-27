# Legacy Actions & Wizard (`@react-typed-forms/schemas`)

Reference document. Captures the action lifecycle (handler resolution, busy/disable cascading, `ControlActionContext`) and the wizard renderer (page navigation, validation gates, step strip, action wiring). Companion to `RENDERER-ARCHITECTURE.md`, `LAYOUT-PIPELINE.md` (which references this for the action branch), `RENDERER-CATALOG.md` (which lists the wizard renderer), and `EXTENSION-MODEL.md` (which describes the composable `actionHandler` chain).

## Why a separate doc?

Actions and the wizard share two design ideas that don't fit cleanly elsewhere:

1. **A single click → an arbitrary async lifecycle.** Click handlers can return Promises, and the engine takes responsibility for marking the form busy, disabling input until done, and cleaning up. This is the only place in the renderer pipeline that owns time-extended state.
2. **The wizard is the canonical async-action consumer.** Page navigation goes through the same handler chain as ordinary buttons; validation gates are dispatched as actions; per-page state is held in the data tree. Understanding actions and understanding the wizard are the same problem viewed twice.

## Action data shape

`ActionControlDefinition` from `forms-core/src/controlDefinition.ts`:

```ts
interface ActionControlDefinition extends ControlDefinition {
  type: ControlDefinitionType.Action;
  actionId: string;
  actionData?: string | null;
  icon?: IconReference | null;
  actionStyle?: ActionStyle | null;
  iconPlacement?: IconPlacement | null;
  disableType?: ControlDisableType | null;
}

enum ActionStyle {
  Button    = "Button",
  Secondary = "Secondary",
  Link      = "Link",
  Group     = "Group",
}

enum IconPlacement {
  BeforeText  = "BeforeText",
  AfterText   = "AfterText",
  ReplaceText = "ReplaceText",
}

enum ControlDisableType {
  None   = "None",
  Self   = "Self",
  Global = "Global",
}
```

`actionId` is the dispatch key — the handler chain matches on it. `actionData` is opaque payload data (a JSON string, by convention) passed through to the handler. `disableType` declares the *default* disable scope while the handler is running; the handler can override it via `actionContext.disableForm(type)`.

`ActionStyle.Group` is special: it turns the action into a *container* rendering all its child FormStateNodes inline. Used for action menus and submit-dialog footer rows.

## The action branch in `renderControlLayout`

From `schemas/src/controlRender.tsx`, the `isActionControl(c)` branch:

```ts
if (isActionControl(c)) {
  const actionData = c.actionData;
  const actionStyle = c.actionStyle ?? ActionStyle.Button;
  const actionContent =
    actionStyle == ActionStyle.Group ? renderActionGroup() : undefined;
  const handler = props.actionHandler?.(c.actionId, actionData, dataContext);
  return {
    inline,
    children: renderer.renderAction({
      actionText: c.title ?? c.actionId,
      actionId: c.actionId,
      actionData,
      actionContent,
      actionStyle,
      textClass: rendererClass(textClass, c.textClass),
      iconPlacement: c.iconPlacement,
      icon: c.icon,
      inline,
      disabled: formNode.disabled,
      onClick: handler ? makeAsyncClick() : () => {},
      className: rendererClass(styleClass, c.styleClass),
      style,
      busy: formNode.busy,
    }),
  };

  function renderActionGroup() {
    return <>{formNode.children.map(x => renderChild(x))}</>;
  }
}
```

Three things happen at construction time:

1. **Handler is resolved once.** `props.actionHandler?.(actionId, actionData, dataContext)` walks the composed handler chain (see `EXTENSION-MODEL.md` for `actionHandlers(...)` composition). The result is either `undefined` (no handler — the button is wired to a no-op) or a function that takes a `ControlActionContext`.
2. **`actionContent` is materialized eagerly for `Group` style.** All child FormStateNodes render now, into the action's inner content slot. The renderer then decides how to lay them out.
3. **`disabled` and `busy` are read from the `formNode`.** Both are reactive — when the handler flips `busy` to true, this branch re-renders and the button is now disabled.

### The async click flow

The constructed `onClick`:

```ts
function makeAsyncClick() {
  return () => {
    let disableType: ControlDisableType = c.disableType ?? ControlDisableType.Self;
    const actionContext: ControlActionContext = {
      disableForm(type: ControlDisableType) {
        disableType = type;            // mutated before async work starts
      },
      runAction(actionId, actionData) {
        const h = props.actionHandler?.(actionId, actionData, dataContext);
        if (h) h(actionContext);       // recursive dispatch reuses this context
      },
    };
    const r = handler(actionContext);
    if (r instanceof Promise) {
      const cleanup = formNode.ui.getDisabler(disableType)();
      formNode.setBusy(true);
      r.then(() => {
        cleanup();
        formNode.setBusy(false);
      });
    }
  };
}
```

Key invariants:

- **`disableType` is captured by closure.** The handler can call `actionContext.disableForm(type)` synchronously before its real async work to change the disable scope. After the Promise is awaited, the captured `disableType` is consulted via `getDisabler`.
- **`getDisabler(type)()` is curried.** The factory is acquired with the type; calling it returns the cleanup function. This two-step lets the disabler stack — multiple in-flight actions can each acquire and release independently without trampling each other (see `DefaultFormNodeUi` below).
- **Synchronous handlers don't disable.** The check is `r instanceof Promise` — if the handler returns void/undefined, no disable, no busy. Synchronous click handlers (open dialog, toggle local state) bypass the busy lifecycle entirely.
- **`runAction` reuses the same context.** Recursive action dispatch flows through the same `disableType` capture — a child action can also call `disableForm`. Errors in this chain are not handled at this layer; they propagate to whoever awaited the outer Promise.

### `ActionRendererProps`

What `renderer.renderAction(...)` receives:

```ts
interface ActionRendererProps {
  key?: Key;
  actionId: string;
  actionContent?: ReactNode;     // pre-rendered children when Group style
  actionText: string;
  actionData?: any;
  actionStyle?: ActionStyle | null;
  icon?: IconReference | null;
  iconPlacement?: IconPlacement | null;
  onClick: () => void;
  className?: string | null;
  textClass?: string | null;
  style?: React.CSSProperties;
  disabled?: boolean;
  hidden?: boolean;
  inline?: boolean;
  busy?: boolean;
}
```

The renderer's only structural decision is whether to honour `busy` separately from `disabled`. The default `createButtonActionRenderer` (in `RENDERER-CATALOG.md`) swaps `icon` for `busyIcon` while busy, and the layout's `disabled` cuts the click event regardless.

## `formNode.busy` and `disabled`

From `forms-core/src/formStateNode.ts`:

- `busy` is a reactive boolean stored on the FormStateNode's `base` Control.
- `setBusy(b)` mutates it transactionally.
- The reactive `disabled` cascade includes `busy` indirectly: when `busy` is true, the disabler typically calls `setForceDisabled(true)`, which propagates through the FormStateNode tree the same way any disable does.

Reading from `FormState`:

```ts
get busy(): boolean { return this.rc.getValue(this.baseFields.busy); }
```

Both `busy` and `forceDisabled` are visible to the action renderer (which reads `formNode.disabled`, the rolled-up cascade). A button next to a busy button doesn't get disabled unless the disabler scoped to `Self` was actually `Global`.

## `FormNodeUi` and `DefaultFormNodeUi`

The UI hook layer sits above the FormStateNode for actions and visibility-coordination concerns:

```ts
interface FormNodeUi {
  ensureVisible(): void;
  ensureChildVisible(childIndex: number): void;
  getDisabler(type: ControlDisableType): () => () => void;
}
```

`ensureVisible()` is the "scroll/switch tabs/expand accordion to bring me on screen" hook. The default implementation walks up to the parent and asks it. Tab and accordion renderers override `ensureChildVisible` on themselves (via `formNode.attachUi(...)`) so they can switch tabs / expand panels when an inner control needs focus.

`getDisabler` is the action-specific hook. The default in `DefaultFormNodeUi`:

```ts
getDisabler(type: ControlDisableType): () => () => void {
  if (type === ControlDisableType.Self) {
    return () => {
      const old = !!this.node.forceDisabled;
      this.node.setForceDisabled(true);
      return () => { this.node.setForceDisabled(old); };
    };
  }
  if (type === ControlDisableType.Global) {
    let topLevel = this.node;
    while (topLevel.parentNode) topLevel = topLevel.parentNode;
    return topLevel.ui.getDisabler(ControlDisableType.Self);
  }
  return () => () => {};
}
```

Behaviour:

- **`Self`** — the factory captures the current `forceDisabled` flag, sets it to true, and returns a cleanup that restores the old value. Stacking works: two overlapping disablers each capture/restore independently, the form stays disabled until both release.
- **`Global`** — walks to the root FormStateNode and delegates to its `Self` disabler.
- **`None`** — no-op factory and no-op cleanup. Used when the action explicitly opts out of disable.

`ensureChildVisible(childIndex)` is wired to `ensureVisible()` by default — it just propagates upward. The wizard and tab renderers replace this on their `formNode.ui` (via `attachUi`) so calls bubble up to "switch to my tab" or "go to my page" rather than just scroll.

## `ControlActionContext` API

```ts
interface ControlActionContext {
  disableForm(disable: ControlDisableType): void;
  runAction(action: string, actionData?: any): void | Promise<any>;
}
```

Two methods:

- `disableForm(type)` — change the captured `disableType` for the *current* action's lifecycle. Useful when a handler wants to do "disable this button only while I show a confirm dialog, then disable the entire form during submission" — call it again before each await.
- `runAction(actionId, actionData)` — recursively dispatch another action. The handler chain is consulted again with the new ID. Note: this returns `void | Promise<any>` but the dispatch site doesn't await it on behalf of the caller — the caller is responsible for chaining.

The exported no-op:

```ts
export const NoOpControlActionContext: ControlActionContext = {
  disableForm() {},
  runAction() {},
};
```

Used when an evaluator needs to invoke a handler outside of a click context (e.g. the wizard's validator-action call).

## Built-in action IDs

The default renderers intercept a small set of action IDs internally — these don't go through the host's handler chain:

| Action ID | Intercepted by | Effect |
|---|---|---|
| `openDialog` | `DefaultDialogRenderer` | Opens the modal overlay |
| `closeDialog` | `DefaultDialogRenderer` | Closes the modal overlay |
| `next` / `prev` (or configured `navActionId`) | `DefaultWizardRenderer` | Navigate wizard pages |

Array operations (`add`, `remove`, `reorder`) are *not* dispatched through the action handler chain — the array renderer creates `ActionRendererProps` directly and binds `onClick` to its own internal callbacks. Same for `ScrollListRenderer`'s bottom-trigger action: it dispatches by ID through the host handler, so it *is* customizable.

## Wizard renderer

`useWizardRenderer(props, options?)` is the state machine; `DefaultWizardRenderer` is the UI shell. They're separated so hosts can write their own UI (custom step strips, progress bars, etc.) while reusing the navigation/validation logic.

### `useWizardRenderer` signature

```ts
function useWizardRenderer(
  props: GroupRendererProps,
  options?: UseWizardRendererOptions,
): WizardRendererState;

interface UseWizardRendererOptions {
  actions?: {
    next?: WizardNavActionOptions;
    prev?: WizardNavActionOptions;
    navActionId?: string;       // overrides "next"/"prev" dispatch
    validateActionId?: string;  // dispatched before nav; can block navigation
  };
  defaultShowSteps?: boolean;
}

interface WizardNavActionOptions extends Partial<ActionRendererProps> {
  text?: string;
  validate?: boolean;
  hide?: boolean;
}
```

### Returned state

```ts
interface WizardRendererState {
  currentPage: number;             // raw 0-based index into pageChildren
  pageChildren: FormStateNode[];   // children with placement: "content" or none
  childrenLength: number;
  pageControl: Control<number>;    // either internal counter or pageIndexField
  page: number;                    // visible-only index
  totalPages: number;              // visible count
  steps: WizardStepInfo[];
  next: ActionRendererProps;
  prev: ActionRendererProps;
  hasNext: boolean;
  hasPrev: boolean;
  validatePage: () => boolean;
  isPageValid: () => boolean;
  nav: (dir: number, validate: boolean) => Promise<void>;
  goToPage: (index: number) => void;
  countVisibleUntil: (untilPage: number) => number;
  nextVisibleInDirection: (dir: number) => number | null;
  manualNavigation: boolean;
  showSteps: boolean;
  leftNavChildren:   FormStateNode[];
  middleNavChildren: FormStateNode[];
  rightNavChildren:  FormStateNode[];
}

interface WizardStepInfo {
  index: number;       // visible-only
  title: string;
  visible: boolean;
  active: boolean;
  completed: boolean;
  valid: boolean;
}
```

### Child placement routing

Wizard children are filtered by `definition.placement`:

```ts
const leftNavChildren   = allChildren.filter(x => x.definition.placement === "leftNav");
const middleNavChildren = allChildren.filter(x => x.definition.placement === "middleNav");
const rightNavChildren  = allChildren.filter(x => x.definition.placement === "rightNav");
const pageChildren      = allChildren.filter(x => !x.definition.placement
                                                 || x.definition.placement === "content");
```

The wizard's "content" is `pageChildren`; the "navigation row" can pull additional content from `leftNav`/`middleNav`/`rightNav` slots. This lets a wizard footer host arbitrary controls (cancel buttons, breadcrumbs, side-nav text) without giving up the next/prev buttons.

### Step computation

```ts
function buildSteps(): WizardStepInfo[] {
  const result: WizardStepInfo[] = [];
  let visibleIndex = 0;
  for (let i = 0; i < childrenLength; i++) {
    const child = pageChildren[i];
    const visible = !!child.visible;
    result.push({
      index: visibleIndex,
      title: child.definition.title ?? `Step ${visibleIndex + 1}`,
      visible,
      active: i === currentPage,
      completed: visible && i < currentPage,
      valid: child.valid,
    });
    if (visible) visibleIndex++;
  }
  return result;
}
```

`steps` is reactive — `child.visible` and `child.valid` are reactive reads on each FormStateNode. The strip re-renders any time visibility or validity flips on any page.

### Navigation gate

`nav(dir, validate)`:

```ts
async function nav(dir: number, validate: boolean) {
  if (validate) {
    const syncValid = validatePage();
    const validator = validateActionId
      ? props.actionHandler?.(validateActionId, { current: currentPage, dir }, props.dataContext)
      : undefined;
    const validateResult = await validator?.(NoOpControlActionContext);
    if (!syncValid || validateResult === false) return;
  }
  const nextPage = nextVisibleInDirection(dir);
  if (nextPage != null) pageControl.value = nextPage;
}
```

Three gates:

1. **Sync validation.** `validatePage()` calls `pageNode.validate()` (depth-first re-validation) and `pageNode.setTouched(true)` so error messages show up in the UI.
2. **Async validator action.** If `validateActionId` is configured, it's dispatched through the *host's* action handler chain with the current page index and direction. Returning `false` blocks navigation. Returning anything else (including a resolved Promise) allows it.
3. **Hidden-page skip.** `nextVisibleInDirection(dir)` walks past hidden pages, returning `null` only if no further visible page exists in that direction.

The validator-action mechanism lets hosts implement server-side validation: dispatch a custom `validateStep` action that calls a server endpoint, returns `false` if the server rejects, and the wizard stays on the current page.

`validatePage()` is also exposed standalone — hosts that want manual control can call it without navigating.

### Page persistence via `pageIndexField`

```ts
const { pageIndexField } = wizardOptions;
const pageFieldNode = pageIndexField
  ? schemaDataForFieldRef(pageIndexField, props.dataContext.parentNode)
  : null;
const pageControl: Control<number> =
  pageFieldNode?.control.as<number>() ?? internalPage;
```

If the wizard definition specifies `pageIndexField: "currentStep"`, the page index is bound to a sibling data field. This:

- Persists the user's place across remounts (e.g. saving and reopening the form).
- Lets server-side workflow logic read which step the user is on.
- Allows external code to navigate by writing to the field.

If no field is configured, an internal `Control<number>` holds the page index and resets when the wizard remounts.

### `WizardRenderOptions`

```ts
interface WizardRenderOptions extends GroupRenderOptions {
  type: GroupRenderType.Wizard;
  showSteps?: boolean | null;
  pageIndexField?: string | null;
  manualNavigation?: boolean | null;
}
```

`manualNavigation: true` hides the prev/next buttons. The host is then responsible for triggering navigation via `goToPage(i)` (e.g. binding to custom buttons in `leftNav`/`rightNav` slots, or programmatic page changes from a side panel).

## `DefaultWizardRenderer`

The UI consumer of `useWizardRenderer`:

```ts
export function createWizardRenderer(options?: DefaultWizardRenderOptions) {
  return createGroupRenderer(
    (props, formRenderer) => (
      <WizardRenderer groupProps={props} formRenderer={formRenderer} options={options}/>
    ),
    { renderType: GroupRenderType.Wizard },
  );
}
```

Renders three regions:

1. **Steps strip** (optional, gated by `showSteps`) — visible-only step list with active/completed/visible/valid styling. Hosts can replace via `renderSteps(steps, formRenderer)`.
2. **Page content** — `pageChildren[currentPage]` in normal mode; *all* `pageChildren` stacked in design mode (so the visual editor can edit any page without navigating to it).
3. **Navigation bar** — prev (left) + middle nav children + next (right). Replaceable wholesale via `renderNavigation(props)`.

The default navigation:

```tsx
function defaultNavigationRender({ prev, next, leftNav, middleNav, rightNav,
                                   className, leftNavClass, middleNavClass, rightNavClass }) {
  return (
    <div className={className}>
      <div className={leftNavClass}>
        {renderAction(prev)}
        {leftNav}
      </div>
      <div className={middleNavClass}>{middleNav}</div>
      <div className={rightNavClass}>
        {rightNav}
        {renderAction(next)}
      </div>
    </div>
  );
}
```

`renderAction` here is the form renderer's action dispatch — so the prev/next buttons go through the same registered action renderer as any other action. They get the same icons, the same style classes, the same busy/disabled treatment.

### Class slots

`DefaultWizardRenderOptions.classes`:

| Slot | Purpose |
|---|---|
| `className` | Outer wizard container |
| `contentClass` | Page content wrapper |
| `navContainerClass` | Nav bar wrapper |
| `stepsContainerClass` | Step strip container |
| `stepClass` | Individual step item |
| `activeStepClass` | Active step variant |
| `completedStepClass` | Completed step variant |
| `stepLabelClass` | Step label text |
| `stepNumberClass` | Step number badge |
| `leftNavClass` / `middleNavClass` / `rightNavClass` | Nav bar regions |

## Wizard ↔ tab interplay

Both wizards and tabs implement `FormNodeUi.ensureChildVisible` so that focus-into-a-hidden-child works. The default UI's `ensureVisible` walks parent-ward; the wizard's UI implementation switches to the right page first, then propagates upward. The same pattern works for tabs and accordions.

This matters most for error-scrolling: an `errorControl.meta.scrollElement?.scrollIntoView()` call from outside the form (set up by `DefaultLayout`) walks the FormStateNode tree to navigate to the error's location — switching tabs, expanding accordions, navigating wizards — before scrolling. Hosts that implement custom error focusing can mimic this by walking up `formNode.parentNode` calling `ui.ensureVisible()`.

## Settled invariants

1. **Action handlers are first-match.** The action handler chain (see `EXTENSION-MODEL.md`) returns `undefined` to pass; first non-undefined handler commits.
2. **Promise return triggers busy + disable.** Sync handlers don't pay the busy/disable cost. The check is `instanceof Promise` — async functions that return synchronously (e.g. early returns before any await) do still pass the check.
3. **`disableType` is captured at call time.** The handler can mutate it before its first await; after that, the captured value drives the disabler scope.
4. **`getDisabler` is curried for stacking.** Two overlapping actions each acquire and release independently. The form stays disabled until both releases run.
5. **`Group` action style materializes children synchronously.** Performance cost is paid up-front per render; children render whether or not the user expands a menu.
6. **Wizard navigation is just an action.** The next/prev buttons go through the renderer's normal action dispatch; the wizard intercepts a custom `navActionId` if configured, otherwise has its own internal handler.
7. **Validation is a two-stage gate.** Sync `validatePage()` first, then optional async `validateActionId`. Either can block.
8. **Hidden pages skip.** Navigation auto-skips invisible pages. Step indices in `WizardStepInfo.index` are visible-only; raw `currentPage` is over the full child array.
9. **Per-page touch happens on validation.** `setTouched(true)` is called on the page node when validation runs, so error messages appear on first nav attempt.

## Open questions for the redesign

- **Async error handling.** The Promise-from-handler `.then(...)` chain doesn't catch rejections — an async failure in a click handler hangs the busy state forever. Worth wrapping in `.catch(...)` and logging, or surfacing via `formNode.setError`.
- **`disableType` mutation timing.** The spec is "mutate before first await" but nothing enforces it. A second call after the await would have no effect because the disabler is already acquired. Could be tightened with a `freeze` step or by documenting more loudly.
- **Group-style eager children.** Always rendering the menu's children, even when collapsed, costs work. A `lazy` flag or a portal-based mount would let menus render on demand.
- **Wizard validator-action shape.** Returning `false` blocks; anything else passes. A more structured return (`{ valid, errors }`) would let the wizard show server-validation errors inline.
- **`runAction` in `ControlActionContext`.** Doesn't return a Promise from the dispatched action — only the void/Promise return is exposed. A `runActionAndWait` would simplify chained submits.
- **Step strip is opaque.** Can't be customized per-step (a custom badge for the active step, an asterisk for invalid, a checkmark for complete) without replacing `renderSteps` wholesale. A per-step render slot would help.
- **`pageIndexField` requires schema cooperation.** A wizard inside a non-data group (e.g. a SettingsGroup) can't bind. Worth allowing an explicit `Control<number>` to be passed in via options.
- **`manualNavigation` is binary.** "Hide all nav, the host drives" or "show prev/next, the host doesn't". A third mode — show some buttons, hide others — would be useful for kiosk-style workflows.
- **No "submit on last page" affordance.** The wizard treats every page identically; the host has to wire a submit action to the last page. A `submitActionId` option on the wizard would make this declarative.
