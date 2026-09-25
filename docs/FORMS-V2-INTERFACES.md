# Forms v2 — key interfaces

Status: **proposal**. Goals, and the reasoning behind everything here, are in
[`FORMS-V2-GOALS.md`](./FORMS-V2-GOALS.md).

Nothing in `packages/` implements this. One throwaway build does — `poc/forms-v2`, a Rush
project so it can link the workspace's own core: the field, options, collection, group, action
and display boundaries, a tab container, a wizard, a staged-edit modal and a JSON loader, each
in four implementations (plain HTML, MUI, Ant, Mantine), plus a third-party widget that reuses
each one's chrome without importing it. Everything below marked **(built)** is a
change that build forced, and its README carries the long form of each. What it never touched
— Base UI — is listed under *Still open*.
(`FORMS-V2-GOALS.md` reserves "the POC" for `@rx-controls/forms`, so this one is "the build"
throughout, whatever its folder is called.)

The shape is JSX-first: these are the types a hand-written form is built from. JSON is
downstream — each section ends with **From JSON**, saying what the loader's translator produces
for it. No type here mentions `ControlDefinition` **or `SchemaField`** except `FormNode`, which
only the loader makes.

**One rule throughout:** every prop is a `FormProp`, except the three that cannot be — `field`
(the binding), `id` (stable by construction) and `children`.

## What a boundary is

The organising idea, used throughout. **Every component an author writes in a form is a
boundary.**

A boundary is the wrapper that `fieldRenderer` / `groupRenderer` / `actionRenderer` /
`displayRenderer` generates around an implementation. The author writes the boundary; the
implementation is what actually draws.

```
<TextField field={f.$.name} required label="Name" />   ← the boundary (generated)
  │  resolve FormProps · register validators · attach to the nearest validation scope
  │  apply presence · route class slots · wrap design-mode chrome · resolve the implementation
  └── <TextFieldImpl {...resolved} />                  ← the implementation (html / MUI / native)
```

**Everything the framework guarantees happens in the boundary and nowhere else.** That is why
an implementation cannot drop a validator — it never receives one — and why a third-party
renderer gets `silent`, design mode and the cascade without knowing they exist. It is also why
a custom renderer is not a special case: `fieldRenderer(MyImpl)` produces the same wrapper as
`fieldRenderer({ key: "textfield" })`, differing only in how the implementation is found.

This includes the structural wrappers — a hidden region is a chrome-less group with a
`hidden` prop (§8), a repeated row is a collection boundary (§8). Anything that governs a
region of a form has to *bind* to it, or validators, `clearHidden` and the locks go missing at
exactly the place an author would expect them.

---

## 1. Reactive props

```ts
type FormProp<T> = T | ((rc: ReadContext) => T) | Control<T>;

/** Resolve in the *consuming* component's tracking window, never the dispatcher's. */
function getProp<T>(rc: ReadContext, p: FormProp<T> | undefined): T | undefined;
```

Read-only by construction — a value the renderer *writes* is a `Control<T>` binding, never a
`FormProp`. Discrimination checks `Control` first, then `typeof === "function"`, so
`FormProp<SomeFn>` is unsupported; nothing needs it.

`getProp`, not `use…`: it takes an `rc` and returns a value, with no React involved, and a
`use` prefix on a non-hook trips `react-hooks/rules-of-hooks`. Both it and `FormProp` belong in
the **non-React** layer alongside `fieldState` — React only ever supplies the `rc`.

**From JSON:** this is where the expression engine terminates, and the build confirms it —
`$scripts`, `dynamic`, `EntityExpression` and jsonata get no further than the loader. A literal
`renderOptions.x` becomes `T`; a **synchronous** expression becomes `(rc) => …` closing over the
evaluator, read in the consumer's own tracking window.

**The `Control<T>` arm is what makes an async expression expressible (built).** `(rc) => T` has
to return now, and jsonata cannot: it evaluates into a `Control<T>`, and the prop *is* that
control. Drop that arm of the union and async expressions need a second mechanism — which, at
418 jsonata uses across 40 of 80 forms, would not be a corner. Composition works uniformly over
both arms, so inverting a `Visible` expression into a `hidden` prop is just
`(rc) => !getProp(rc, expr)` and never has to know which kind it wrapped.

## 2. Class values

```ts
type ClassValue = string | { replace: string };

/** Only the implementation knows its own class for a slot, so it does the merge. */
function mergeClass(own: string | undefined, given: ClassValue | undefined): string | undefined;
```

**From JSON (built):** five slots, five props — `styleClass` → `className` (the control),
`textClass` → `textClassName`, `layoutClass` → `shellClassName`, `labelClass` →
`labelClassName`, `labelTextClass` → `labelTextClassName`. The legacy `"@ "` prefix, which
means *replace rather than merge* and accounts for about a third of class usage in the corpus,
becomes `{ replace }`. Every boundary kind carries the slots it can use — an action has
`className` and `textClassName`, a display the same, a group `className`.

**Container and text are two slots wherever there is text (decided, built).** `className` /
`textClassName` on a control and `labelClassName` / `labelTextClassName` on its label are the
same split for the same reason: on React Native text styles do not cascade from a `View`, so
the words need their own class. The contract defines the text slot semantically — *the
element's text; an implementation whose label is a single text element may apply it together
with the container's class* — which is what lets every web implementation merge the pair with
`combineClass` and add no markup, while `forms-native` puts one on the `View` and one on the
`Text`. Corpus evidence for the label pair: `labelTextClass` 248 uses to `labelClass` 39.

## 3. The binding

```ts
/** The binding is a core control — nothing wraps it. */
type Binding<T> = Control<T>;

interface FieldState {
  disabled: boolean;
  readOnly: boolean;
  touched: boolean;
  dirty: boolean;
  errors: string[];
}

/** Control + the scope the field is rendered in. A boundary calls it with the scope it narrowed. */
function fieldState<T>(rc: ReadContext, control: Control<T>, scope: ScopeState): FieldState;
/** The same, against the scope at the calling component's position. */
function useFieldState<T>(rc: ReadContext, control: Control<T>): FieldState;
```

Presence is **not** on `FieldState`: by the time an implementation runs, presence is always
`rendered` — the boundary handled the other two. Design mode showing a hidden field is
`useDesignMode()`, not a value that is constant in production.

`state` cannot be answered from the `Control` alone (**built**): `readOnly` has no home there,
and `disabled` has to fold in the enclosing scope's. So it is a function of the control **and**
the scope the field is rendered in. The boundary computes it with the scope it just narrowed and
**publishes that scope** around the implementation, so an implementation's `useFieldState`
agrees with the boundary that dispatched it — and so do the rows of a collection, which before
this read the scope *outside* their collection.

**There is no handle around the control (built, then removed).** The first cut had
`FormField<T>` = `{ control, state(rc), $ }`: `$` a typed mirror of `control.fields`, `state` a
method, both there so a scope captured at *bind* time travelled with the binding through
navigation. The case it was built for — a staged-edit draft, rendered by a host outside the
region it came from, still honouring that region's lock — did not survive scrutiny. A collection
that honours the cascade disables Edit under a lock, so a session cannot begin locked; when the
lock arrives *during* a session the right behaviour is for the dialog to close, not for a visible
draft to turn read-only; and for `silent` the handle was actively wrong, blanking a dialog the
moment the user switched tabs. The build's README, finding 19, has the measurements. What
remained of the handle was `Control<T>` plus a helper, so that is the contract. The dialog reads
the scope where it renders, like everything else; the region's lock reaches the session through
the collection boundary (§8).

`focused` and `filled` are not here either, though several UI libraries publish them alongside
the rest. They are the frame's business, not the form's — see `FrameState` in §7.

```ts
interface FormNode {
  readonly control: Control<unknown>;
  readonly definition: ControlDefinition;
  children(rc: ReadContext): FormNode[];
  /** Checked narrowing. Throws naming the path and both types — never a bare cast. */
  at<T>(path: string): Control<T>;
}
```

**No `schema` on the binding (built).** Nothing at this layer reads one: a label is a prop —
the author writes it, the loader passes `displayName` — options are a prop on the widgets that
have them, and validators are declared at the usage, never inherited from the field.

**Options, built.** The contract declares its own `FieldOption`, and its shape is constrained by
the format it will be fed from — `{ name, value: string | number }`, not `{ label, id }` — or
the loader would re-map every option it passes through, for nothing. The value type is the part
that needs care: `<select>` and every library built on one speak **strings**, so the controller
restores the original by looking the string back up in the option list rather than guessing with
`Number()`, which would turn a legitimate `"3"` into `3`. Verified both ways: a numeric option
stores a number, a string option stores a string. So
`SchemaField` becomes loader-only, exactly as `ControlDefinition` already is — and typed
navigation needs none of it, because `control.fields` is typed from `T`, which is where
TypeScript was getting it from all along. `buildSchema` leaves the JSX path with it.

What is lost is free labels over a large hand-written form. That is host code — a helper that
emits pre-labelled components — not contract surface.

**From JSON:** the loader produces `FormNode`s and hands renderers a `Control`. It **creates
the binding itself** — a translator never binds one, or field semantics could register below
the renderer and be dropped. `at<T>` is the untyped seam every translator crosses.

**Field references need a cursor, and it is the loader's (built).** A `Control` alone cannot
answer two things the format asks: `../x` needs a parent, and a jsonata expression inside an
array row needs the path from the root. So the loader threads a `DataScope` — control, schema
fields, parent, path — alongside the control, and resolves a definition's `field` through it
exactly as legacy's `dataRef` did: `a/b` into a compound, `..` to the parent scope, `.` the
scope itself. Rows get legacy's two-level chain (the array, then the element), which is what
makes the corpus's `../../selectedMessages` mean the root. Expressions compile with legacy's
prefix — `pets#$i[2].(expr)` — and evaluate against the **root** through a tracked proxy, so
the scope's data is the expression's context, `$$` the form's root, `$i` the row index, and
exactly what the expression touches re-runs it. None of this reaches a boundary: a `field`
becomes a `Control<T>` at translation and a `FormProp` closes over what it read. That is the
answer to whether v2 needs a cursor — it does, on the JSON side only. Corpus: 146 `a/b`
references, 43 `../x`, 50 jsonata expressions inside rows, 10 reading `$i`, 5 reading `$$`.

**`meta` schema fields bind to a side store (built, loader-only).** Legacy hangs a `metaFields`
control off the parent's meta and binds a field flagged `meta` there, so UI state like
`showPostalAddressDetails` or `cardDetails` is never in the submitted value. The loader's
`fieldControl` does the same, with legacy's key. 75 such fields in the corpus; found by the
parity run (README finding 66).

## 4. Presence

```ts
type Presence = "rendered" | "silent" | "hidden";
```

| state | renders | validates | `clearHidden` |
|---|---|---|---|
| `rendered` | yes | yes | no |
| `silent` | no | **yes** | no |
| `hidden` | no | no | yes |

**Presence is derived, never authored.** It lives in the scope context, and a component
narrows it — never widens it, so a child cannot be more visible than its parent. Two things
narrow it, and neither of them is an author writing `presence=`:

- **A `hidden` prop** on any boundary (§5) narrows to `hidden`, for that control and — on a
  group — its children. This is the authored half, one-to-one with the JSON `hidden` flag and
  with the `Visible` dynamic property, which at 599 uses across 43 forms is the most-used
  thing in the format.
- **A container implementation** narrows to `silent`: `<Tabs>` on its inactive panels, a
  wizard on pages not yet reached, a grid on rows off the current page. `silent` has no JSON
  counterpart and no author ever writes it — it is structural, which is precisely why it is a
  scope facet rather than a prop.

That is the whole mechanism; there is no separate visibility system.

**Pending is not hidden (built).** A `hidden` prop may resolve to `undefined` — an async
expression that has not answered yet, legacy's `visible: null`. The boundary treats that as
shown, and holds every write cycle: no `clearHidden`, no `defaultValue`, no validation until
the answer lands. The first cut initialised async results to `false`, so a `Visible` expression
hid its field for one tick at mount and `clearHidden` wiped it; the parity run found this on a
few hundred fields (README finding 66).

**`inline` is a scope facet too (built).** Legacy's Inline group is prose — a bare span whose
children render with no shell and no block. A group receives opaque `children`, so the only
channel to them is the scope: `inline` sits beside `presence` and `designMode`, is set by a
`groupRenderer` built with `{ inline: true }`, and reaches an implementation as `inline` on
the field and display render props, where it means "draw a span, skip the shell". Anything a
boundary wraps its output in (the `visibility` slot, the design chrome) must be inline-safe.
README finding 60.

**A `silent` producer can be written outside the package (built).** `useBoundScope`,
`narrowScope` and `FormScopeProvider` are public, and that is all a container needs to put a
branch off screen and keep it validating — the POC's third-party `SelectChild` (legacy's
data-chosen child; zero corpus uses, so not a built-in) does it with no registry slot and no
boundary factory. It is the fourth container to build *items × presence* by hand after Tabs,
Wizard and Dialog; a shared `useSwitch(items, active)` is the obvious v2 extraction (README
finding 57).

**`silent` is real, and a tab strip is what proves it (built).** An inactive tab shows an error
marker for content that is rendering nothing, and the marker *updates live* — fix the offending
field inside the inactive tab and it clears while that tab is still off screen. Three things the
build had to get right for that, each a constraint on any container that sets `silent`:

- **Every panel is mounted, always.** A panel that never mounted registers nothing and validates
  nothing, so this forces each library's keep-mounted escape hatch on: Ant's `forceRender`,
  Mantine's `keepMounted`, and MUI, which leaves panel rendering to the caller anyway. A
  container that mounts lazily is not implementing `silent`.
- **Nothing may tear down the effects — so never `<Activity>` (decided).** `silent` lives in
  effects: validator registration, validation-scope attachment, `clearHidden`. React's
  `<Activity mode="hidden">` preserves the DOM and **destroys effects**, which is the opposite
  answer to the same question, so the two are incompatible by construction. The rule: a
  container that keeps panels mounted hides them with `display:none` (Mantine's
  `keepMountedMode="display-none"` — its default wraps them in `<Activity>`), and a form
  region a host places under `<Activity>` stops validating and is unsupported. A dev-mode guard
  is feasible and is an implementation follow-up: in a boundary's effect cleanup, a genuine
  unmount has already removed the DOM node while an `<Activity>` hide leaves it connected, so
  `ref.current?.isConnected` while presence is still `rendered` / `silent` names the misuse.
- **The panel hides itself.** Boundaries suppress themselves under `silent`; plain JSX among
  them does not — the same leak as a hidden group in §8, and the same fix.

`silent` exists because *unmounted is not hidden* — if it were, switching tabs would run
`clearHidden` and wipe what you typed.

**`clearHidden` is a form-wide option**, set on `<Form>` (§10), with `dontClearHidden` on a
control as the only per-control knob. Its *effect* is per-node: each boundary clears the field
it bound, gated by the global and its own opt-out — which is what legacy and the POC already
do (`impl.globals.clearHidden && !def.dontClearHidden`), and in a JSX form is the only thing
that can work. §8 has the reason.

**`defaultValue` is its other half (built).** While a field is not hidden and its value is
`undefined`, the boundary writes the default; `null` counts as a value. Re-evaluated when
presence, value or the default move, so the two form legacy's cycle — hide → cleared → show →
defaulted again — and a section that reappears comes back in its initial state. Boundary
semantics like the validators, so no implementation can drop it, and never applied by a
write-free boundary. README finding 65.

Two things the build pinned down:

- **The scope carries rc-resolvers, not resolved values** — `presence: (rc) => Presence`, not
  `presence: Presence`. A facet driven by form data — `hidden` off a jsonata expression, which
  is what those 599 `Visible` uses are — then reaches the fields that read it as an ordinary
  control write, with no provider component re-rendering at all. Resolved values in a context
  can only be delivered by re-rendering the subtree. Narrowing is function composition.
- **`hidden` is an input to validation, not a wrapper around it.** Hooks are not conditional
  and presence changes after mount, so the boundary registers unconditionally and feeds the
  resolved presence to the validators through a control they read via their own `rc`; a field
  that becomes `hidden` clears its errors by re-running rather than by unregistering.

## 5. Contract props

Two types per kind: what the **author** writes, and what the **implementation** receives after
the boundary has resolved every `FormProp` and consumed what it owns.

```ts
type Validator<T> = (value: T, rc: ReadContext) => string | null | Promise<string | null>;

interface FieldProps<T> {
  field: Control<T>;
  id?: string;                                   // generated if absent
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  dontClearHidden?: boolean;                     // static, like the JSON flag it mirrors
  defaultValue?: FormProp<T>;                    // written while shown and undefined — the other half of clearHidden (finding 65)
  label?: FormProp<ReactNode>;
  required?: FormProp<boolean>;
  requiredMessage?: FormProp<string>;
  validate?: Validator<T> | Record<string, Validator<T>>;
  helpText?: FormProp<ReactNode>;
  startIcon?: FormProp<ReactNode>;
  endIcon?: FormProp<ReactNode>;
  className?: FormProp<ClassValue>;
  labelClassName?: FormProp<ClassValue>;
  labelTextClassName?: FormProp<ClassValue>;    // the label's text — see §2
  shellClassName?: FormProp<ClassValue>;
  textClassName?: FormProp<ClassValue>;
}

/** What an implementation sees. Flat and resolved, so `<Shell {...p}>` composes. */
interface FieldRenderProps<T> {
  field: Control<T>;
  id: string;
  label?: ReactNode;
  required: boolean;
  error?: ReactNode;                             // resolved by the boundary (built)
  helpText?: ReactNode;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  className?: ClassValue;
  labelClassName?: ClassValue;
  labelTextClassName?: ClassValue;
  shellClassName?: ClassValue;
  textClassName?: ClassValue;
}
```

`validate`, `requiredMessage`, `hidden`, `disabled`, `readOnly` and `dontClearHidden` are
absent from the render props — the boundary consumed them. A renderer cannot see, and
therefore cannot drop, a validator; the two locks arrive folded into `useFieldState(rc, field)` instead,
already combined with everything inherited.

**The three flags are props because the format has them per control** — `hidden`, `disabled`
and `readonly` are plain booleans on every `ControlDefinition`. An *inherited* lock is a
different thing and stays in the scope (§4), so the boundary holds both and folds them
restriction-only: a prop or an ancestor can add a lock, neither can re-enable a control that
disabled itself.

`error` is resolved by the boundary and handed *to* the implementation (**built**), because the
implementation is what renders the shell; it is also what makes `<Shell {...p}>` line up slot
for slot. Whether an error is shown *at all* — in the build, only once touched — stays boundary
policy; the implementation draws what it is given.

`required` is a flag, never baked into `label`: MUI renders its own asterisk from
`<FormControl required>`.

**Validators may be async (built).** `Validator<T>` returns a message or a promise of one. The
boundary runs each keyed validator in its own tracking window, which closes when the function
returns: reads through `rc` before the first `await` are the dependencies, reads after it are
untracked. A promise publishes on resolve; a run superseded by a newer one is dropped, and the
previous message stays up until the answer lands, so nothing flickers. There is no debounce in
the contract — a validator that is expensive wraps itself. While a promise is outstanding the
field is **pending** in its validation scope and every scope above it (§8), which is what a
gate awaits before it decides.

**A trailing label is still the shell's business (built).** A checkbox's label sits after the
control, and every library attaches it differently: an html `<label>` wrapping the input, MUI's
`FormControlLabel` wrapping both, Mantine a `label` prop on the control, Ant the checkbox's own
*child*. So `FieldShellProps` takes `labelPosition` (§7), where `"after"` also licenses the
shell to **wrap** the control, and each implementation maps it to its own idiom. It has to be
the shell's: in three of the four the trailing label is not a sibling at all, so nothing
rendered *next to* the control — a renderer drawing its own, or a standalone `Label` primitive —
can express it.

```ts
interface GroupProps  { hidden?; disabled?; readOnly?; title?; children: ReactNode;
                        className?; shellClassName?; labelClassName?; labelTextClassName? }
// The same slots a field has, for the same anatomy — body, wrapper, title container, title text.
// Legacy styled groups against all of them (224 / 127 / 39 uses); built, README finding 63.
// `title` is a heading the implementation draws when given (built); a JSON group's `title`
// arrives here unless `groupOptions.hideTitle`, and a control's `hideTitle` empties its `label`.

/** The radio's extras — the select's, plus legacy's per-option content and entry classes (built). */
interface RadioExtra extends SelectExtra {
  children?: (option: FieldOption, selected: boolean) => ReactNode;  // called for EVERY option;
                                        // gate with <Contents hidden={!selected}>, never `selected && …`
  entryClassName?: FormProp<ClassValue>;         // legacy CheckEntryClasses: the option's wrapper …
  selectedClassName?: FormProp<ClassValue>;      // … and its two states
  notSelectedClassName?: FormProp<ClassValue>;
}
// `FieldOption.value` is `string | number | boolean` — legacy's is `any`, and its `AllowedOptions`
// expressions build Yes/No radios over Bool fields with no schema options at all (README finding 59).

/** A container needing per-child metadata takes it structured, not as children. */
interface TabsProps  { items: { key: string; title: ReactNode; children: ReactNode }[]; … }
interface ActionProps {
  actionId: string;
  text?: FormProp<ReactNode>;
  icon?: FormProp<ReactNode>;
  iconPlacement?: FormProp<"before" | "after" | "replace">;
  onClick?: () => void | Promise<void>;
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  disableType?: "none" | "self" | "global";     // what a running async handler locks
  style?: FormProp<ActionStyle>;
  className?: FormProp<ClassValue>;              // the control (the button)
  textClassName?: FormProp<ClassValue>;          // its text
  shellClassName?: FormProp<ClassValue>;         // the wrapper it sits in — legacy's layout element (finding 63)
  children?: ReactNode;                          // any style, not just Group
}
interface ActionRenderProps { /* resolved, plus: */ busy: boolean; onClick: () => void }

/** Per-id appearance, provided by the app rather than the implementation. */
type ActionOverrides = Record<string, ComponentType<ActionRenderProps>>;
```

**No `actionData` (decided, built).** JSON gives a button an id and a payload because it
cannot write a closure; a JSX author's payload *is* the closure. So the payload, the host
resolver that pairs the two, and `runAction`/`disableForm` are all **loader-only** — see *From
JSON* below — and the contract carries only what an author writes by hand: `iconPlacement`,
and `disableType`, because "lock the whole form while this saves" is asked of a button
regardless of where it came from. `"global"` is implemented by a lock counter `<Form>` holds
on the scope, which the root reads as `disabled` for every boundary (built).

**Different buttons for different ids (built).** Three situations hide behind that, and only
the third needs dispatch. An **author** can see the call site, so `style` and ordinary props
settle it. An **implementation** with a house style branches on `actionId` inside its own
button. A **host** that cannot reach the call site — a button the loader produced from JSON, or
one a renderer draws itself — has only the id, and gets an id-keyed override map consulted
before the implementation's default. A map rather than a matcher list, because the id is the
only predicate anyone has needed, and it provides by context so it nests and can be scoped to a
section.

That only works if the ids are **known**, so the framework's own buttons use a documented set —
`add`, `remove`, `edit`, `apply`, `cancel` — never a private string, and a definition may rename
one (`addActionId`) so two grids on a page can be styled apart. Ids name the deed, not the look:
`apply`, never `primaryButton`. Appearance is `style` plus the override map.

**From JSON — actions (built):** `<JsonForm actionHandler>` takes legacy's resolver shape,
`(actionId, actionData) => onClick | undefined` (`ControlRenderOptions.actionHandler`, which
every host already has), and the translator builds `onClick` from it — `actionData` static, or
the `dynamic: ActionData` expression read untracked at click time. Asked at *translate* time,
`undefined` means nobody claims the id and the loader **warns** rather than shipping a button
that does nothing, which is what legacy does silently. `actionStyle` → `style`, `icon` /
`iconPlacement` / `disableType` map one-to-one. Legacy's **Dialog group** is a loader component:
`placement: "trigger"` children render in place, the rest inside `<Dialog>` (§6), and the
translator owns the `open` control and claims `openDialog` / `closeDialog` for its subtree with
the host's handler as fall-through — a `Translator` may `retranslate` its children under its
own options and declare `ownsChildren` so the loader does not build them twice.

**From JSON:** adornments do not survive translation — `HelpText` → `helpText`, `Icon` →
`startIcon`/`endIcon`, `Tooltip` → `accessibleName` on the display it sits on (§6),
`Accordion` → a wrapper the loader emits, `SetField` → a computed-write registration
(`useControlEffect`). `AdornmentKind`, priority ordering and `wrapAdornments` have
nothing left to be about once the renderer owns the whole field. A host's own adornment
kinds — and its take-over of a built-in one, to read a property the loader does not
(`helpLabel`) — go through `LoaderOptions.adornments`: per type, amend the props before the
control translates or wrap what translated, declining by returning `undefined`, which the
loader then reports as dropped. Custom displays go through `LoaderOptions.displays`, keyed
by `customId` (legacy's `customDisplays`), and icons through `LoaderOptions.icon`, which
draws every `IconReference` the format names (legacy's `<i>` by default — finding 71). A host
render type needs none of these: a `Translator` already gets the props the loader built.
README finding 70. `def.hidden` /
`def.disabled` / `def.readonly` → the three flags, and a `Visible` / `Disabled` dynamic
property → the same prop as a `(rc) => …` — the spelling shifts to `readOnly` to match
`@rx-controls/react`, which the boundary folds with; `def.dontClearHidden` →
`dontClearHidden`; `def.required` → `required`; `def.requiredErrorText` → `requiredMessage`;
`def.validators[]` → the keyed `validate` record, one key per entry so each clears
independently; a `Jsonata` validator is an async validator (above), evaluated with the same
prefix and root as every other expression — the result is the message, `null` is valid;
`renderOptions.type: "DisplayOnly"` → `<DisplayOnlyField>` (§6) with `required` dropped, as
legacy ignores it there; a non-collection `Compound` data control → a chrome-less group over
its children, which is the region a child's `../x` climbs out of; and `def.title` beats the
schema's `displayName` for the label, as legacy resolves it.

## 6. The four boundaries

```ts
/** Generic in the value type, not fixed to the one the boundary was built for. */
type FieldComponent<T, P> = <V extends T>(props: FieldProps<V> & P) => Rendered;

function fieldRenderer<T, P = {}>(impl: ComponentType<FieldRenderProps<T> & P>)
  : FieldComponent<T, P>;
function fieldRenderer<T, P = {}>(builtIn: { key: keyof FormRenderers })
  : FieldComponent<T, P>;

function collectionRenderer<T, P = {}>(impl: ComponentType<CollectionRenderProps<T> & P>)
  : <V extends T>(props: CollectionProps<V> & P) => Rendered;

function groupRenderer<P = {}>(impl: ComponentType<GroupRenderProps & P>, opts?: { scope?: boolean })
  : ComponentType<GroupProps & P>;
// `P` reaches the implementation unresolved, as for the field and collection factories (built —
// the first third-party group needed a `defaultOpen`; README finding 55). A `designAs` option
// was planned here and never built: the built-in substitution went through `inline` on the
// dialog boundary, and a third-party container opts in itself with `open || designMode`.
function actionRenderer(impl);
function displayRenderer(impl);
```

These are the boundary factories (see *What a boundary is*). One kind of component, two
ways of resolving the implementation: **fixed** — a custom renderer, imported directly and
type-safe for free — or **from the registry**, a built-in that `<FormProvider renderers>` can
swap. They differ in what framework work each kind needs:

| boundary | binds data | under `silent` | distinctive work |
|---|---|---|---|
| `fieldRenderer` | yes | `null` | register validators, attach to the nearest scope |
| `collectionRenderer` | yes | `null` | the above, plus resolve elements into per-element scopes |
| `groupRenderer` | no | `<>{children}</>` | derive the scope context, optional validation scope |
| `actionRenderer` | no | `null` | async/busy, disabler acquisition, handler stubbing in design mode |
| `displayRenderer` | no | `null` | content and presence only |

**A display is a boundary with the data half removed (built), and nothing else had to change.**
With no binding there is no field to validate, nothing to clear when hidden, no locks to fold
and no `state(rc)`; what survives is presence, the class slots, the `visibility` slot and design
chrome. That the guarantees come apart along exactly that line — and that the remaining half
needed no special casing — is the best evidence so far that the boundary is factored correctly.

One consequence for the loader: prop-building is **field-shaped**, so it has to branch on the
control's *type* rather than hand every translator the same props. A display takes `hidden`,
the class slots and one thing more:

```ts
interface DisplayProps {
  hidden?: FormProp<boolean>;
  accessibleName?: FormProp<string>;
  className?: FormProp<ClassValue>;
  textClassName?: FormProp<ClassValue>;
  shellClassName?: FormProp<ClassValue>;   // the wrapper it sits in — legacy's layout element (finding 63)
  children?: ReactNode;
}
```

**`accessibleName` is where the legacy `Tooltip` adornment lands (built).** Every real use
of it — three, all in `MastRegistrationsSummary` — is on a `Display` whose `displayData` is a
bare icon, with the tooltip supplying the meaning the glyph does not carry: a `fa-regular
person` / `fa-regular building` pair switched by Jsonata `Visible` expressions, plus one more.
The icon itself is a node — `IconDisplayExtra.icon: FormProp<ReactNode>`, the same shape as
`ActionProps.icon` and a field's `startIcon`/`endIcon` — so the author draws it and the
implementation places and names it; the loader draws the format's `IconReference` as
legacy's `<i class="{library} fa-{name}">` unless `LoaderOptions.icon` says otherwise
(README finding 71).
None is on a data field, so nothing is added to `FieldProps`; the loader converts a `Tooltip`
adornment on a display to this prop.

Two things follow from naming it after the a11y concept rather than after the widget. It is
**redundant on a display that already renders text** — a `<p>` has an accessible name, and an
implementation is free to ignore the prop there; it is load-bearing only where the content is
non-textual, which is the icon case and the reason the corpus reached for a tooltip at all.
And **whether it is also visible is the implementation's call**: in the build, html uses
`title` and MUI, Ant and Mantine each wrap the glyph in their own `Tooltip`; a text display
may do nothing. That is what keeps the Mast rendering reproducible without a portal-based
tooltip — and a provider requirement — in the contract. It is also why the prop is a `string` rather than a
`ReactNode`: an accessible name is text, and anything richer is a tooltip renderer's business.

All of them also resolve `FormProp`s, apply presence, route class slots, and wrap design-mode
chrome.

**The locks fold in one place, and are republished (built).** The boundary ORs its own
`disabled` / `readOnly` props with the scope's and with `@rx-controls/react`'s `FormEditState`
— the same cascading lock the binding layer (`useFormControlProps`, `ControlInput`) already
honours — and then publishes the merged pair back down as a `FormEditProvider`. So a renderer
built on that binding layer obeys exactly the lock a built-in does, without knowing the scope
exists: one mechanism, two audiences. Because what is published is the *merged absolute value*
rather than a delta, this needs no change to `@rx-controls/react` — its provider replacing
rather than merging stops mattering.

**Every wrapper a boundary adds is unconditional (built).** The provider above, and the
design-mode chrome, are rendered whether or not they have anything to do — the chrome sits at
`display: contents` when off. A wrapper added only when needed is a **remount**: the element at
that position changes the instant a lock or design mode toggles, React discards the
implementation, and the input loses focus, selection and animation state mid-edit. The rule:
**in a form library, a wrapper whose presence depends on state must not be conditional.** The
hidden group in §8 is the same rule.

**The produced component has to stay generic in the value type (built).** A boundary is built
for one concrete `T`, but a schema legitimately yields `string`, `string | undefined` or
`string | null` for the same widget, and `Control<string>` is not a
`Control<string | undefined | null>`. Fixed to one `T`, every schema has to spell out the
widget's exact union instead.

**Renderer-specific props reach the implementation as the author wrote them (built).** The
boundary resolves the contract props it knows by name and spreads everything else through
untouched; the implementation resolves each renderer-specific `FormProp` with `getProp` in its
own window — the same rule §1 states for every other prop, with no exception. The boundary
cannot do it: it has no way to tell `(rc) => T` from a callback such as `(index) => void`, and
a callback resolved by the boundary is invoked with an `rc` during render. There is therefore
no `Resolved<P>` in the contract — an implementation's props type is
`FieldRenderProps<T> & P` for the `P` the author sees. The cost, measured in the build, is a
`getProp` per renderer-specific read (seven per implementation) and a tracking window in
implementations that had none — the displays.

**Where validators publish from is not a free choice (built).** Errors are published from a
commit effect, as `@rx-controls/react`'s own `useValidator` does, while `useReactive`
subscribes during *render*. Swapping one implementation for another under a live form
therefore trips React's "state update on a component that hasn't mounted yet": the outgoing
tree's cleanup clears its errors in the same commit in which the incoming tree has rendered
but not yet mounted. Nothing an end user does reaches it — only a registry swap — but it is
the seam to watch if error publication ever moves off the commit effect.

### Validation scopes

A group can be invalid because its descendants are, and the data tree cannot express that —
non-data groups, per-control validators, per-node gating, array-level errors. React cannot walk
its own children, so it works in reverse: **a field's boundary attaches its validity-bearing
control to the nearest ancestor scope from context**, and a scope-bearing group attaches its
scope to *its* parent. Scopes nest, validity bubbles, and it all still happens under `silent`
because the boundary runs even when nothing renders.

`{ scope: true }` is opt-in — only containers that get asked "is my content invalid" need one
(a tab header, a step marker). A collection needs none: array elements are already children of
the array control, so element validity bubbles natively. That is the one case where the data tree
really is enough.

**A group implementation must keep its children mounted (built, and unenforceable).** A
collapsed disclosure is `rendered`, not `hidden`: it keeps validating and clears nothing, which
is what lets its header badge mean anything. The children of a group *are* the boundaries, so an
implementation that renders `{open && children}` unregisters every validator beneath it and
clears nothing — the `<Activity>` state (§4) by another route, and no guard can tell that
unmount from a legitimate one. For a field the contract makes the equivalent mistake impossible
(validators register above the boundary); for a group it is a rule, the same class as "a tabs
implementation may not lazily mount panels". The third-party `Collapsible` in the POC is the
worked example; README finding 55.

**Built (built).** A field's boundary attaches its validity-bearing control to the nearest
scope; a scope attaches itself to *its* parent, so validity reaches every enclosing scope and
nesting is just another member. `{ scope: true }` is a boundary option, not a renderer one —
`<Contents>` and `<Section>` in the build are the same implementation with and without it, and
the implementation sees the result as `invalid` in its render props. A scope also reports
**pending** — an async validator under it has not answered — and `settled()` resolves once none
is. `isValid` stays optimistic while pending, so a step marker does not flash invalid on every
keystroke; anything that has to *decide* awaits `settled()` first.

**Error keys are per boundary, not per validator name (built).** Errors live on the control;
validators live on the boundary; and one control is routinely bound by two boundaries — the
field a modal shows *is* the field, a select and a radio over one status, a branch that
requires what another region shows. Each boundary runs its own `required` and publishes a
verdict, and under a shared key the last writer wins on a timing nothing controls — which
is exactly what the first cut did, and it silently lost a `required` to a `required: false`
sibling. Legacy scoped the key to the node (`uniqueId + "default"`); the framework's key is
now `required@<boundary id>`, so a boundary clears only what it set. Author keys stay as
written, and `fieldState.errors` is a set so two boundaries agreeing read as one error.
README finding 58. The same rule holds per validator: legacy keyed every Jsonata validator
on a control under one `jsonata`, so a control with two loses whichever answered first —
three controls in the corpus do, and parity found it (README finding 69). The loader keys
them `jsonata`, `jsonata1`, … and `date` the same way.

The scope **is** a real `Control` — which is what makes validity an ordinary tracked read,
`touchAll` a `setTouched` cascade, and nesting just another member — built on core's
`createDerivedGroup`: a group whose value is composed from its children and **never written
back down**, with `detachFields` as the counterpart to `attachFields`. Derived is load-bearing,
not a nicety: a scope always holds both a control and a descendant of it (a collection
registers its array, its rows register fields inside it), so a group that synced values
downward would write a stale copy of that datum back into the child. See
`CONTROL-SEMANTICS.md` § O.

**A stateful container offers two homes for its state, and the author picks (built).** A tab
strip keeps its active key in component state, which is right. A wizard's page index usually
must not: it wants to survive a remount, a deep link, or save-and-resume. So `WizardProps` takes
an optional `page?: Control<number>` — bound, the index lives in the data and shows up in the
payload; omitted, it is component state. A container that only offers the second is unusable for
half its cases, and one that only offers the first pollutes the schema for the other half.

**Gating is what a validation scope is actually for.** The wizard refuses Next while the current
page's scope reports invalid, and a refusal `touchAll()`s that page so the errors it already had
become visible. Next first awaits the page's `settled()`, so an async validator that has not
answered cannot let it through — and because `next()` returns that promise, the `<Action>`
drawing it shows busy for the wait with no wizard code involved. That needs two methods beyond
`isValid` (`touchAll`, `settled`), and it only works because an unreached
page is `silent` — validating without rendering, so the step marker can show a page invalid
before the user has ever seen it. Everything else the wizard needed already existed: presence,
the scope, actions, structured `items`. The two buttons it draws use the documented ids `next`
and `back`, so a host restyles them the same way as any other.

**A container that needs per-child metadata cannot take `children`.** A tab strip needs titles,
and `children: ReactNode` is opaque — React cannot inspect it. So tabs take `items` (§5), which
is what the surveyed libraries do too: Ant an `items` array, Mantine and Base UI compound
components with context, MUI the caller pairing a `Tab` with a panel. The generic group boundary
stays for containers that need nothing but a box.

That is the structural parent link this design needed from core — validity, touched and
dirty aggregated *without* value flow — and `createDerivedGroup` is it. Closed.

**The portal container is a tab strip with one panel (built).** `<Dialog open onClose title>`
narrows its content to `silent` while closed — a required field inside a never-opened dialog
reports its error, and a trigger outside can read the dialog's scope — and hands the
implementation the content already scoped and **always mounted**: native `<dialog>` driven by
`showModal()`/`close()` from an effect, MUI `keepMounted`, Ant `forceRender`, Mantine
`keepMounted` with `keepMountedMode="display-none"` (its default is `activity`; §4's rule again).
In design mode the boundary passes `inline: true` and the implementation renders the content in
place with no portal — the `Dialog → Contents` substitution, done above the renderer. The one
cost: switching `inline` moves the content between a portal and an in-place parent, which
remounts it; tolerable for an authoring-mode switch, and the reason design mode is not a
mid-edit toggle.

**From JSON:** the design-mode substitution is not per-implementation — `Dialog → Contents`,
`Tabs → all stacked`, `Wizard → all pages` holds for every implementation, so it is a framework
constant that an implementation may extend.

**A read-only field is a field boundary over a read-only widget (built).** Legacy's
`DisplayOnly` render type is 372 uses across 52 corpus forms — the single largest thing the
loader did not translate. It binds data, so it is a `fieldRenderer`, not a `displayRenderer`:
`hidden` clears it, it attaches to the validation scope, it sits in the shell with a label and
help text. What differs is the widget.

```ts
interface DisplayOnlyExtra {
  options?: FormProp<FieldOption[]>;        // value → name, per element for an array
  emptyText?: FormProp<ReactNode>;          // when the value is empty
  sampleText?: FormProp<ReactNode>;         // in design mode, when the value is empty
  format?: (value: unknown) => string;      // one non-option value as text; default String(v)
  noSelection?: boolean;                    // legacy's flag: not selectable
}
const DisplayOnlyField = fieldRenderer<unknown, DisplayOnlyExtra>({ key: "displayOnly" });
```

Type-aware formatting — a `Date` as `toLocaleDateString()`, a `Bool` as Yes/No — is the
loader's, built from the schema into `format`, because the schema is loader-only (§3); a JSX
author passes a `format` or takes `String(v)`. `sampleText` is the one place design mode
enters a widget's data path: a designer's stand-in for a value that is not there, chosen by
the controller (`useDisplayValue`) so every implementation agrees. `required` is dropped by
the loader, as legacy ignored it on a display-only control.

**It is write-free, and that is a deliberate divergence from legacy (decided).** A display-only
control usually shows a value some other field owns — a summary on a later page, a status the
server set. Legacy's `clearHidden` and `defaultValue` cycles had no display-only exception, so
hiding the summary under a `clearHidden` host wiped the value it summarised; 76 of the
corpus's 375 DisplayOnly controls are hidden by an expression. In v2 the boundary is built with
`{ writes: false }` — a property of the boundary, not a prop a caller can forget — and never
writes the data it binds, whatever the form says. The other display-only rules stay legacy's:
`required` is ignored, and `hideDisplayOnly` (auto-hide when empty with no `emptyText`) and the
`Display` dynamic property as `overrideText` are still to build.

## 7. Structural primitives

Resolved from the active implementation, which is what lets a third-party renderer reuse
MUI's chrome without importing MUI.

```ts
function useFieldShell(): ComponentType<FieldShellProps>;   // label + required + help + error
function useInputFrame(): ComponentType<InputFrameProps>;   // the editable surface, start/end slots
```

A widget that draws its own surface — stars, a map, a signature pad — uses the shell and skips
the frame.

**Dispatched or composed — not "primitive versus renderer" (built).** Everything an
implementation provides lives in one registry (§9) and is resolved by a hook. What differs is
who looks it up, and what they get:

- **Dispatched** — a boundary picks it on the author's behalf (`textfield`, `tabs`, `action`).
  It arrives with everything the framework guarantees: validators, presence, the lock cascade,
  `clearHidden`, design-mode stubbing.
- **Composed** — another renderer draws it (`fieldShell`, `inputFrame`). It gets **appearance
  and nothing else**.

So the test for adding a registry entry is simply: **does anything other than this component
need to draw it?** The shell and frame pass, because a third-party widget needs the chrome;
`visibility` passes, because every boundary needs it; `action` passes because every renderer
that draws a button dispatches to it. `Text`, `Pressable` and `View` fail — nothing composes
them, and goal 4 scopes portability to the built-in set.

**Buttons are never composed (built, then corrected).** A collection's Add, a modal's Apply, a
wizard's Next are all `<Action>`s — the same boundary an author writes. The build first gave
those renderers a `useAction(id)` returning the implementation's button as chrome, and removed
it: every call site repeated the id and filled in `busy={false}` by hand, and every such button
wanted what the boundary provides — busy state on Apply, the design-mode stub on Add and
Remove, the lock on Next, and the per-id override map, which the boundary consults anyway.

### Survey: eight UI libraries

Shapes below are not invented. Eight libraries, picked to span composition styles rather than
popularity, scanned for the same four questions. This is the evidence the prop shapes are
derived from, and it is what a third implementation would otherwise have had to discover
([FORMS-V2-GOALS.md](./FORMS-V2-GOALS.md) — *a third implementation is the only real test*).

| | shell | frame | how the control gets in | border on |
|---|---|---|---|---|
| **MUI** | `FormControl` + `InputLabel` + `FormHelperText`, state via context | `OutlinedInput`, `startAdornment`/`endAdornment` | renders its own input; `inputComponent` swaps it | the frame |
| **Mantine** | `Input.Wrapper` (label/description/error, `inputWrapperOrder`) — wired by **`id` only, no context** | `Input`, `leftSection`/`rightSection` (absolute + input padding) | polymorphic `component="button" \| "select"` + children | the frame |
| **Chakra v3** | `Field.Root` + `.Label` + `.RequiredIndicator` + `.HelperText` + `.ErrorText`, context | `InputGroup` `startElement`/`endElement`; `InputAddon` for outside | children | the input |
| **Base UI** | `Field.Root` + `.Label` + `.Description` + `.Error`, context + data-attrs | — | **`render={(props, state) => …}`** on every part | — |
| **shadcn** | `Field` + `FieldLabel` + `FieldDescription` + `FieldError`, `data-invalid` | `InputGroup` + `InputGroupAddon align=…` | children | the group |
| **Ant** | `Form.Item` (label/help/validateStatus/extra/tooltip) — **clones `value`/`onChange` into its single child** | `Input` `prefix`/`suffix` (inside) vs `addonBefore`/`addonAfter` (outside) | renders its own input | both, separately |
| **Bootstrap** | none — markup convention (`.form-label`, `.invalid-feedback`) | `.input-group` + `.input-group-text` | children | **`.form-control`**; addons are siblings |
| **RN Paper** | none — the label lives *inside* `TextInput`; `HelperText` is a sibling | `TextInput` `left`/`right` | renders its own; v6 moves to `startAccessory`/`endAccessory` **render fns** | the frame |

Six things it settles:

1. **Both primitives are real.** Every library has a shell, seven of eight have a frame.
   Neither is our invention, which is the strongest available evidence for the "earns its
   place" test above.
2. **There are two slot kinds, and only one is a slot.** *Inside the border* (MUI adornment,
   Mantine section, Chakra `startElement`, Ant `prefix`, shadcn addon, Paper `left`) versus
   *outside* (Bootstrap `.input-group-text`, Chakra `InputAddon`, Ant `addonBefore`). Ant
   ships both and names them apart; Bootstrap has only the second, MUI only the first.
   `start`/`end` are defined as **inside**, and an outside addon is `<Row>` + the frame — it
   genuinely is two adjacent boxes, which the layout box already expresses.
3. **The control slot is a render prop, not children.** Four of the eight frames render their
   own input and cannot host an arbitrary child at all. The two newest designs in the set
   arrived at the same answer from opposite ends: Base UI puts `render(props, state)` on every
   part, and Paper v6 migrates `left`/`right` from elements to render functions receiving
   `{ style, error, disabled, multiline }`. The frame hands the control what it must spread —
   class, ref, focus handlers — and the control decides what to draw.
4. **Frame state is not field state.** Base UI's field state is
   `{ disabled, touched, dirty, valid, filled, focused }`; §3's `FieldState` has no `focused`
   or `filled`, deliberately — that type is form semantics. But MUI's floating label,
   Mantine's and Paper's all need both, and a widget hosting its own focus has no other way to
   report it upward. They live in the frame's render-prop state, which is what Base UI and
   Paper v6 both do. The build settled the half that was left open there — `filled` is *told*
   to the frame, not derived by it; see below.
5. **The label is a sibling everywhere except MUI**, where `OutlinedInput` needs the label
   text a second time to cut the notch in its own border. One outlier does not bend the
   contract: a shell and a frame always come from the same implementation, so `forms-mui`
   passes the label frame-ward through a **private context** of its own. The contract only has
   to guarantee they compose in the same tree.
6. **An implementation builds its own built-ins on its own primitives.** `forms-mui`'s
   textfield is `MuiFieldShell` + `MuiInputFrame`, not `<TextField>` — even though MUI
   documents `TextField` as exactly that composition. Otherwise built-ins take one visual path
   and third parties take another, and the drift lands entirely on the renderers the
   primitives exist to serve. Same rule for `forms-html`, or its frame rots.

### The shapes

```ts
interface FieldShellProps {
  id: string;
  label?: ReactNode;
  labelAs?: "label" | "legend";           // an option group is fieldset/legend, not label/for
  labelPosition?: "before" | "after";     // "after" may wrap the control — see §5
  surface?: "frame" | "custom";           // an InputFrame inside, or the widget's own surface?
  orientation?: "vertical" | "horizontal";
  required?: boolean;
  disabled?: boolean;                     // MUI greys its own label and helper text from this
  helpText?: ReactNode;
  error?: ReactNode;                      // resolved by the boundary, never by the impl
  children: ReactNode;
  className?: ClassValue;
  labelClassName?: ClassValue;
  labelTextClassName?: ClassValue;        // merged with labelClassName when the label is one element
}

interface InputFrameProps {
  id: string;
  describedBy?: string;
  render: (p: ControlSlotProps, s: FrameState) => ReactNode;
  start?: ReactNode | ((s: FrameState) => ReactNode);
  end?: ReactNode | ((s: FrameState) => ReactNode);
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  multiline?: boolean;                    // alignment; Paper v6 passes exactly this
  filled?: boolean;                       // the frame never sees a value, so it is told
  className?: ClassValue;
}

interface ControlSlotProps {
  id: string;
  ref: Ref<any>;
  className?: string;
  style?: CSSProperties;                  // Ant's chrome is runtime tokens, not class names
  onFocus?: FocusEventHandler;
  onBlur?: FocusEventHandler;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

interface FrameState {
  focused: boolean; filled: boolean;
  invalid: boolean; disabled: boolean; readOnly: boolean; multiline: boolean;
}
```

`labelAs` and `orientation` are on the shell because Chakra and shadcn each ship a separate
fieldset/legend part and an `orientation` prop, and the POC's `RadioRenderer` already needs the
first.

A select was the fourth widget shape put through this machinery and needed nothing added to it:
the html one reuses the shell and puts a `<select>` in the frame's control slot, MUI's draws its
own outlined input and takes the label a second time for the notch — directly from props, since
here the widget *is* the control — and Ant's and Mantine's draw their own surface under
`surface: "custom"`.

**Six of those props exist for exactly one reason each (built):**

1. **`filled`** — MUI's shrink-and-notch and Mantine's sizing both need it, no frame in the
   survey ever sees a value, and the caller always knows, so the frame is *told*. `forms-mui`
   then feeds `InputBase` a placeholder value purely to drive that state: private, contained,
   and the honest price of family 2.
2. **`id` / `describedBy` on the frame** — `ControlSlotProps` already carried both, which
   only works if the frame is told them. MUI's `OutlinedInput` takes `id` and passes it down itself.
3. **`disabled` on the shell** — MUI's `FormControl` greys its own label and helper text from
   it, and nothing else tells it.
4. **`surface`** — MUI has two label components, `InputLabel` (floats over a framed input) and
   `FormLabel` (sits above a radio group), and cannot tell from its children which it needs.
   This is a *different axis* from `labelAs`: a stars widget wants a `legend` and a static
   label; a textfield wants a `label` and a floating one. Defaults to `"custom"`, so a
   third-party widget that never thinks about it gets the harmless half.
5. **`style` on the slot** — the slot had `className` only, which assumes an implementation's
   chrome exists as class names. Ant's is `theme.useToken()`, computed per render, so its
   frame has nothing to put in a class. MUI is fine (emotion generates one), as is the HTML
   default.
6. **`labelPosition`** — see §5. Ant is the one library whose checkbox wants the label as its
   own child, and a sibling `<label htmlFor>` comes out visually identical anyway, because the
   label is only text at the body font; the shell maps `disabled` to `colorTextDisabled` by
   hand to recover the greying Ant applies through its own wrapper.

**The control slot must reach the frame as a stable component identity.** MUI takes
`inputComponent`, Mantine takes `component`; both want a *component type*, and an inline one
changes identity every render, so the input unmounts and remounts on every keystroke and focus
is lost. Both implementations pass a module-level bridge and send the render function through
as data beside it. Nothing in the contract changes — it is a constraint on implementing the
render prop in family 2, and it is invisible until someone types in the box.

**A reactive read inside the render prop is lost.** The callback runs in the *frame's* render
pass, after the calling implementation has already reconciled, so a read through the caller's
`rc` subscribes to nothing and silently never updates — the same shape as the bug the compat
package shipped in `RenderArrayElements`. Capture before the call, read nothing inside it;
`FrameState` is handed in for precisely this reason.

**What survey point 6 costs, priced.** "An implementation builds its own built-ins on its own
primitives" is right — otherwise built-ins and third parties take different visual paths — but
Ant is where the bill lands. Its `Input` renders its own `<input>` and hosts no arbitrary
child, so an Ant frame that honours the render prop *cannot be* `<Input>`: it restates the
affix wrapper from theme tokens and gives up `allowClear`, `count`, `Space.Compact`, size
context and addons. Family 1 and family 3 pay nothing. Worth knowing before promising an
implementation for a given library.

**The eight collapse to three families**, which is the practical output: *children-hosting /
class-driven* (Bootstrap, shadcn, Chakra), *self-rendering / prop-configured* (MUI, Ant, Paper,
Mantine), and *headless + render props* (Base UI) — the third being the generalisation of the
other two. So the primitives are modelled on Base UI's shape and validated against **MUI** (the
hardest of family 2 — the notch) and **Bootstrap** (the hardest of family 1 — the border is on
the input, so its frame degrades to addons outside the border, which `FORMS-V2-GOALS.md` already
sanctions as normal). One representative per family is enough to *read*; a fourth library's
published API adds nothing.

**Building** against a second and third member of family 2 was not redundant, though. Ant
produced the sharpest finding in the section (its frame cannot be `<Input>`) and Mantine the
one that is invisible on paper (the control slot has to arrive as a stable component type).
Reading one library per family, building more than one per family.

### The HTML default

A move, not a rename. Today the border and every state variant sit **on the `<input>`**
(`defaultTheme.ts`'s single `INPUT` string, with `aria-invalid:` / `disabled:` / `read-only:`
variants) so a host setting `inputClass: "form-control"` owns the whole look. With a frame:
border, padding and background migrate to the box; the input keeps typography and sizing; the
state variants become data attributes on the box, since `aria-invalid` is now on an element
inside it; the focus ring moves to the frame via `has-[:focus-visible]`, or focus outlines the
input while the border outlines the box. `inputClass` splits into `inputFrame` + `inputClass`.

Paid once, and it is what puts `startIcon` **inside** the border — which legacy's `controlStart`
could never do, being a flat sibling of the input in `DefaultLayout`.

The box renders unconditionally, even with no slots. Two code paths means two appearances that
drift.

```ts
interface StackProps {
  direction?: FormProp<"column" | "row">;        // Row is sugar
  gap?: FormProp<string | number>;
  justify?: FormProp<Justify>;
  align?: FormProp<Align>;
  wrap?: FormProp<boolean>;
  className?: FormProp<ClassValue>;
  children: ReactNode;
}
```

Its neutral props are **exactly what `FlexRenderOptions` carries in JSON** — bounded by the
format rather than by taste, so it cannot drift into a UI kit and the translator always has
somewhere to put what it reads.

**From JSON:** `Icon` adornments at `AdornmentPlacement.ControlStart` / `ControlEnd` become
`start` / `end` on the frame — the placement enum survives translation as a slot choice and
nothing else. `LabelStart` / `LabelEnd` are the shell's business. Legacy put all four in one
flat fragment beside the input (`layoutKeyForPlacement` → `controlStart`/`controlEnd` in
`DefaultLayout`), so a JSON form that read as "icon next to the field" will now read as "icon
inside the field": intended, and the one visible difference this section causes.

`Stack` is also exported as a component over the `stack` slot, for code that cannot call the
hook — the loader's translators, which build elements rather than render them (README finding 64).

## 8. Collections

A collection is a `fieldRenderer` that happens to take a render prop for its rows — not a
component of its own kind.

```ts
interface CollectionProps<T> extends FieldProps<T[]> {
  children: (item: Control<T>, index: number, actions: ArrayActions) => ReactNode;
  empty?: ReactNode;
  /** The JSX spelling of a `Length` validator; the boundary registers it and derives the bounds. */
  minLength?: number;
  maxLength?: number;
}

/** One element as the implementation sees it — enough to put chrome *on* the row. */
interface CollectionElement<T> {
  key: number;             // the element control's uniqueId
  index: number;
  field: Control<T>;       // the element's control
  node: ReactNode;         // the author's row, rendered in its own scope
}

/** What the implementation gets. The hard parts are already done. */
interface CollectionRenderProps<T> extends FieldRenderProps<T[]> {
  elements: CollectionElement<T>[];
  actions: ArrayActions;   // add / remove / move / edit, the boundary's locks folded in
  empty?: ReactNode;
}
```

The boundary renders the rows rather than handing the implementation controls to iterate,
because the three things that must not be got wrong are not obvious — but it hands them over
**structured** (built): a third-party collection that draws per-row chrome (a card's Edit, a
grid's remove column) has to know each row's index and field, and an opaque `ReactNode[]`
carried neither.

**Staged edit is an array action, and the boundary gates it (built).** `ArrayActions` carries
`canEdit` and `edit(index)` beside add / remove / move. The boundary builds its actions with its
own scope, so under a lock every `can*` is false — an author's row buttons get them as the
callback's third argument, an implementation's from `actions`, and neither can start a session
in a locked region. `edit` stages a draft through the external-edit controller (cached on the
array control, so the sibling that hosts the dialog shares the session) and stamps it with the
boundary's token; an effect on the boundary cancels a session carrying its token when the
boundary locks or hides. That is what closes the dialog if the lock arrives mid-edit, and what
leaves alone a session begun from a *different* boundary over the same array. It has to be the
boundary's render that judges this, not a core `effect` over the scope's resolvers: a lock that
arrives as a React prop is delivered by rebuilding the scope object, which an effect holding
the old one never sees (build finding 19).

- subscribe to the array's **structure** only, so adding an element re-renders the list while
  editing one re-renders one field;
- give each element **its own tracking scope** — a callback run inline in the caller's render
  subscribes to nothing, which is a bug the compat package shipped;
- key by the element control's `uniqueId`, never the index, so insert / remove / reorder do
  not land one row's state on another.

A null array is treated as empty and never materialised to `[]`, which would leave the field
and every ancestor permanently dirty.

Mutation is not the renderer's job: `arrayActions(rc, update, field, bounds)` yields
add/remove/move plus `canAdd`/`canRemove` from the `minLength`/`maxLength` bounds, so the
buttons can live outside the list and a read-only list costs nothing. It takes an `rc` and returns values, so it is not spelled
`use…` — the same rule as `getProp` in §1.

### Hiding a region

**Hiding a region is a chrome-less group with a `hidden` prop — `<Contents hidden={…}>` — whose
children stay mounted and each clear their own binding (built).** The mounted requirement is
§4's — `silent` needs live effects — and `hidden` inherits it. What it buys `hidden` is the
**trigger**: the clear is a `useEffect` on a presence transition, never an unmount cleanup,
which fires for StrictMode, HMR, a re-keyed parent and a route change — none of which mean
"drop this value". Each boundary clears its own binding because in JSX children bind wherever
they like, so nothing else knows what to clear; the JSON form tree runs parallel to the data
tree, which is why "clear the subtree" *looked* like one operation there. Mounted is also what
an exit transition needs (§9's `visibility` slot). Because the wrapper is a boundary rather than
a special case, it gets the scope and design mode for free.

**A hidden group hides with CSS, in one unchanging structure (built).** The group implementation
receives `hidden: boolean` in its render props and applies it as `display: none` on the element
it was already rendering. Two things force this. Changing the element at that position — bare
`{children}` when hidden, chrome when shown — **remounts the whole subtree**. And the children
include **plain JSX** — a button, a paragraph, anything that is not a boundary — which nothing
suppresses, because self-suppression is a thing only a boundary knows how to do; a hidden
region would otherwise leak its own "Add" button, operating on data nobody can see. For
arbitrary non-form JSX, `{cond && …}` still works — it just gets no animation and no scope
narrowing, which is the right trade for a paragraph of text.

**A repeated region is a collection boundary — `<Elements>`, the array analogue of
`<Contents>` (built).** It binds the array, so a `Length` validator has somewhere to register,
`clearHidden` reaches the array and not only its elements' fields, and `hidden`, the locks,
design mode and the array-level error message all apply. In the build `Length 1–3` publishes
*At least 1 required* on the array itself, and hiding the region clears the array.

**From JSON:** a collection control resolves one child per element; that must produce the same
per-element boundaries rather than a second mechanism.

## 9. The two registries

```ts
/** Closed and exhaustive. An implementation supplies every key or an explicit stub. */
interface FormRenderers {
  textfield: ComponentType<…>; number: …; date: …; select: …; checkbox: …; radio: …;
  displayOnly: ComponentType<DisplayOnlyRenderProps>;
  contents: …; elements: …; stack: …; grid: …;
  tabs: …; accordion: …; dialog: …; wizard: …;
  action: …; text: …; html: …; icon: …;
  fieldShell: ComponentType<FieldShellProps>;
  inputFrame: ComponentType<InputFrameProps>;
  visibility: ComponentType<{ visible: boolean; children: ReactNode }>;
  root?: ComponentType<{ children: ReactNode }>;  // the implementation's own provider
}

/** Open. Consumed by the loader only. */
interface Translator {
  match: (def: ControlDefinition, schema?: SchemaField) => boolean;
  options?: SchemaField[];                        // renderOptions — scripting + editor panel
  /** `props` are author-facing and already built — a translator never binds. */
  render: (a: { def: ControlDefinition; props: FieldProps<unknown>;
                children: ReactNode[] }) => ReactNode;
}
```

|  | keyed by | provided by | consumed by |
|---|---|---|---|
| `FormRenderers` | a built-in kind, an internal literal | `forms-html` / `forms-mui` / `forms-native` | boundaries |
| translators | a JSON render-type string | apps and extensions | the loader |

Neither key appears in user code. A JSON `renderType: "Textfield"` goes translator →
`<TextField>` → `FormRenderers` → `<input>`: the loader lands on the JSX surface and dispatch
happens below it.

`root` is the build's (**built**): Mantine *requires* `MantineProvider`, Ant wants
`ConfigProvider`, MUI wants `CssBaseline`. An implementation is not just a bag of components,
and an app should not have to learn which library needs what — `<FormProvider renderers>`
mounts it.

`visibility` **owns the mount lifetime** of whatever a boundary would render, and it is a
registry slot because a hard `visible ? children : null` cannot animate an exit — the subtree
has to stay mounted while it leaves. The POC already works this way (`DefaultVisibility` is
the no-op; `@rx-controls/forms-motion` swaps in `<AnimatePresence>`-backed fade and slide
versions). It is also why a boundary keeps its children mounted while hidden: something that
unmounts them has nothing to hand this slot.

For a **field** the semantics do not linger with the pixels — a boundary whose presence has
gone `hidden` has already stopped validating and cleared its field, and the `visibility`
component is only still drawing its last frames. That is what keeps `Presence` at three states
rather than needing a fourth for "on screen but not validating".

For a **region** the group hides itself (§8) rather than going through this slot, since it has
to keep its children mounted and its structure unchanged — and it animates anyway. Built and
measured: the collapsing region fires `transitionstart`/`transitionend` on
`grid-template-rows` and `opacity` over 220ms, and for the whole of that the field inside is
still on screen, because *its* `visibility` component is holding its last frame.

The two exits compose, and that is why `Presence` needs no fourth cell. "Renders but does not
validate" is precisely what the `visibility` slot already does, for the length of one
transition, without anyone having to name it as a state. A non-animating `visibility` — the
default — drops its children at once and the region collapses over an empty box, which is the
right answer there: nothing was animating to begin with.

`options` is declared once and pays twice — it is what makes a custom render option
*scriptable*, and the designer edits it off the same declaration. An extension shipping its own
editor panel would be additional work, not a substitute.

**Unsupported render type:** render a visible placeholder naming it — the loader's
`onUnsupported`, whose default is exactly that — and report it in the loader's returned
`warnings` (§10). A platform with no implementation for a key fails the same visible way.

## 10. Starting a form

```tsx
function PersonForm({ data, view }: { data: Control<Person>; view: boolean }) {
  const f = data.fields;
  return (
    <Form clearHidden readOnly={view}>
      <Stack>
        <TextField field={f.firstName} label="First name" />
        <Contents hidden={(rc) => !rc.getValue(f.hasPets)}>
          <Elements field={f.pets} minLength={1}>
            {(pet) => <TextField field={pet.fields.name} required />}
          </Elements>
        </Contents>
      </Stack>
    </Form>
  );
}
```

`<Form>` is the per-form root, and it carries what is genuinely per-form rather than per-app:
`clearHidden`, `schemaInterface`, `onUnsupported`. It also makes the scope **root** explicit,
so locking a whole form is `<Form readOnly>` rather than a separate provider — which leaves
`FormEditProvider` with exactly one job, the republication in §6.

It exists because `clearHidden` is per-form, not per-app — an edit form and a search form over
the same schema disagree about it — so it needs a per-form home.

`<FormProvider renderers={…}>` still sits at the app root and is about implementation, not
about any one form. Root validity needs no scope — the root data control already aggregates.

**From JSON (built):** `<JsonForm controls={…} schema={…} data={…}/>` translates a
`ControlDefinition[]` into exactly the JSX above — the same boundaries, the same scope, the
same registry. Its output composes with hand-written form source in one tree: in the build the
JSON form is a third tab beside two hand-written ones, bound to the same data control, and
nothing below the loader can tell which is which.

**What it could not carry is returned, not logged (built).** `translateForm` yields
`{ tree, warnings }`; `<JsonForm renderWarnings>` is one thing a host may do with the list, and
logging it, asserting on it in a fixture or failing a build over a corpus are the others. The
gaps worth reporting are mostly not unknown control types — those already render a visible
placeholder. They are features on a control that translated *fine*: an adornment nobody
claimed, a dynamic property nobody reads, a `renderOptions` that silently fell back to the
default widget, a validator that is not enforced, a jsonata expression that does not compile.
Each renders something plausible and drops what the JSON asked for. Whether such a control
should render at all is open decision 2 in the goals doc; the list is what makes the question
answerable.

**Translation allocates, and that is the loader's defining hazard.** Every scripted prop costs
a control and a subscription, where a hand-written form allocates nothing per render. Building
them during render worked until the component remounted, at which point the build ran 84,000
jsonata evaluations without a single warning. So results are cached on the data control's meta,
keyed by the expression — allocation is once per (control, expression) however many times the
tree remounts. Memoising the translated tree is not enough on its own, because remounting
defeats a memo.

---

## Still open

- **Whether `forms-html` and `forms-native` share renderer source** — decidable when the second
  package exists, and it changes nothing above.
- **Base UI** (family 3, the shape the primitives are modelled on) has not been built against.

Every boundary kind has now been written from outside the package — `Stars` (field), `PetCards`
(collection), `FancyAdd` (action, through the override map, which receives the same
`ActionRenderProps` as the registry slot) and `Collapsible` (group). Two small residues, neither
asked for yet: `FancyAdd` reads only `disabled`, `onClick` and `text`, so `busy`, `icon` and
`style` from outside are unexercised; and `GroupRenderProps` carries `invalid` but not
`pending`, so a group header cannot show "checking…" for an async validator beneath it.

The §7 primitives themselves are no longer paper: `poc/forms-v2` builds them four times over,
and both shapes flagged there as most likely to move were the right two — the MUI shell→frame
private channel held exactly as predicted, and `filled` turned out to need telling. The group
trial added one thing to them: a group needs no primitive of its own, because the
implementation's `contents` slot is its shell (README finding 55) — with the caveat that the
POC's four implementations share one `Contents`, so that reuse is proved as plumbing, not yet
as per-library chrome.
