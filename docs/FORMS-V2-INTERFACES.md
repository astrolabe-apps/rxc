# Forms v2 — key interfaces

Status: **proposal**. Goals, and the reasoning behind everything here, are in
[`FORMS-V2-GOALS.md`](./FORMS-V2-GOALS.md).

Nothing in `packages/` implements this. One throwaway build does — `poc/forms-v2`, a Rush
project so it can link the workspace's own core: the field, options, collection, group, action
and display boundaries, a tab container, a wizard, a staged-edit modal and a JSON loader, each
in four implementations (plain HTML, MUI, Ant, Mantine), plus a third-party widget that reuses
each one's chrome without importing it. Everything below marked **(built)** is a
change that build forced, and its README carries the long form of each. What it never touched
— real group renderers, actions, display, the loader — is listed under *Still open*.
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

There used to be a second category — *framework components*, for structure with nothing to
swap. Both candidates turned out to be boundary-shaped and neither survived the build:
`<Show>` became a group with a `hidden` prop (§4, §8) and `<Each>` became a collection
boundary (§8). What they had in common is instructive — each governed a region of a form
without *binding* to it, so validators, `clearHidden` and the locks all went missing at
exactly the place an author would expect them.

---

## 1. Reactive props

```ts
type FormProp<T> = T | ((rc: ReadContext) => T) | Control<T>;

/** Resolve in the *consuming* component's tracking window, never the dispatcher's. */
function getProp<T>(rc: ReadContext, p: FormProp<T> | undefined): T | undefined;
```

Read-only by construction — a value the renderer *writes* is a `FormField`, never a
`FormProp`. Discrimination checks `Control` first, then `typeof === "function"`, so
`FormProp<SomeFn>` is unsupported; nothing needs it.

`getProp`, not `use…`: it takes an `rc` and returns a value, with no React involved. Both it
and `FormProp` belong in the **non-React** layer alongside `FormField` — React only ever
supplies the `rc`. The repo has paid for this naming before: `useLabelText` was a non-hook
whose prefix made `react-hooks/rules-of-hooks` report a false positive, and is now
`resolveLabelText`.

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

**From JSON:** four slots, four props — `styleClass` → `className` (the control), `textClass`
→ `textClassName`, `layoutClass` → `shellClassName`, `labelClass` → `labelClassName`. The
legacy `"@ "` prefix, which means *replace rather than merge* and accounts for about a third of
class usage in the corpus, becomes `{ replace }`.

## 3. The two handles

```ts
interface FormField<T> {
  readonly control: Control<T>;
  state(rc: ReadContext): FieldState;
  /** Typed navigation into a compound value; arrays go through a collection. */
  readonly $: FormFields<T>;
}

interface FieldState {
  disabled: boolean;
  readOnly: boolean;
  touched: boolean;
  dirty: boolean;
  errors: string[];
}
```

Presence is **not** on `FieldState`: by the time an implementation runs, presence is always
`rendered` — the boundary handled the other two. Design mode showing a hidden field is
`useDesignMode()`, not a value that is constant in production.

`state(rc)` cannot be answered from the `Control` alone (**built**): `readOnly` has no home
there, and `disabled` has to fold in the enclosing scope's. So **the field an implementation
receives is not the one the author wrote** — the boundary re-binds it to the scope and hands
that down, and `$` carries the binding, so a child field is scoped too. Same move the loader
already makes, for the same reason: whoever creates the binding decides what it means.

**Why this is a handle at all, rather than a `Control` plus a hook (built).** Everything above
could be `useFieldState(rc, control)` reading the scope from context — and for a field rendered
where it was bound, the two are identical. They part company the moment an implementation
renders a bound node somewhere else, which is exactly what the staged-edit flow does: a draft
row belongs to the array's scope, and the modal that edits it is hosted by a sibling, outside
that region. **A handle captures the scope at bind time; context reads it at render time.**
Built and measured: with the array's region locked and the modal rendering outside it, the
draft field reports `readOnly: true` while the scope at the modal's own position reports
`false`. Under a context-only design that draft is editable, and applying it writes through a
lock the user can see on screen.

Where the two meet, they combine **restriction-only in both directions** — a bind-time lock and
a render-location lock can each add, neither can re-enable. The same rule as everywhere else in
§4, applied to a second axis.

`focused` and `filled` are not here either, though several UI libraries publish them alongside
the rest. They are the frame's business, not the form's — see `FrameState` in §7.

```ts
interface FormNode extends FormField<unknown> {
  readonly definition: ControlDefinition;
  children(rc: ReadContext): FormNode[];
  /** Checked narrowing. Throws naming the path and both types — never a bare cast. */
  at<T>(path: string): FormField<T>;
}
```

**No `schema` on the binding (built).** It carried one, and the build measured what read it:
across every implementation and both data boundaries, exactly one expression — `label ??
schema.displayName`. Everything else was the schema carrying *itself* along, so that default
stayed reachable through `$` and through per-element wrappers. Options would have been the
second reader, and the goals doc already rules out the third: `SchemaField.required` and
`.validators` are never read, because validators are declared at the usage.

A label is a prop. The author writes one; the loader passes `displayName` as one. Options are a
prop too, and belong to the widgets that have them rather than to every binding.

**Options, built.** The contract declares its own `FieldOption`, and its shape is constrained by
the format it will be fed from — `{ name, value: string | number }`, not `{ label, id }` — or
the loader would re-map every option it passes through, for nothing. The value type is the part
that needs care: `<select>` and every library built on one speak **strings**, so the controller
restores the original by looking the string back up in the option list rather than guessing with
`Number()`, which would turn a legitimate `"3"` into `3`. Verified both ways: a numeric option
stores a number, a string option stores a string. So
`SchemaField` becomes loader-only, exactly as `ControlDefinition` already is — and the typed
`$` needs none of it, because `T` comes from the `Control`, which is where TypeScript was
getting it from all along. `buildSchema` leaves the JSX path with it.

What is lost is free labels over a large hand-written form. That is host code — a helper that
emits pre-labelled components — not contract surface.

**From JSON:** the loader produces `FormNode`s and hands renderers a `FormField`. It **creates
the binding itself** — a translator never binds one, or field semantics could register below
the renderer and be dropped. `at<T>` is the untyped seam every translator crosses.

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

**`silent` is real, and a tab strip is what proves it (built).** An inactive tab shows an error
marker for content that is rendering nothing, and the marker *updates live* — fix the offending
field inside the inactive tab and it clears while that tab is still off screen. Three things the
build had to get right for that, each a constraint on any container that sets `silent`:

- **Every panel is mounted, always.** A panel that never mounted registers nothing and validates
  nothing, so this forces each library's keep-mounted escape hatch on: Ant's `forceRender`,
  Mantine's `keepMounted`, and MUI, which leaves panel rendering to the caller anyway. A
  container that mounts lazily is not implementing `silent`.
- **Nothing may tear down the effects.** Mantine hides kept-mounted panels with React's
  `<Activity>` by default, which preserves the DOM and **destroys effects** — and `silent` lives
  in effects: validator registration, validation-scope attachment, `clearHidden`. The symptom is
  an inactive tab that quietly stops reporting its errors while looking perfectly healthy
  (`keepMountedMode="display-none"` fixes it). The general point is sharper than §6's rule about
  conditional wrappers: React is standardising an API whose purpose is to hide UI *by*
  unmounting its effects, and a form's semantics cannot live anywhere it can reach.
- **The panel hides itself.** Boundaries suppress themselves under `silent`; plain JSX among
  them does not — the same leak as a hidden group in §8, and the same fix.

`silent` exists because *unmounted is not hidden* — if it were, switching tabs would run
`clearHidden` and wipe what you typed.

**`clearHidden` is a form-wide option**, set on `<Form>` (§10), with `dontClearHidden` on a
control as the only per-control knob. Its *effect* is per-node: each boundary clears the field
it bound, gated by the global and its own opt-out — which is what legacy and the POC already
do (`impl.globals.clearHidden && !def.dontClearHidden`), and in a JSX form is the only thing
that can work. §8 has the reason.

Two things the build pinned down:

- **The scope carries rc-resolvers, not resolved values** — `presence: (rc) => Presence`, not
  `presence: Presence`. A facet driven by form data — `hidden` off a jsonata expression, which
  is what those 599 `Visible` uses are — then reaches the fields that read it as an ordinary
  control write, with no provider component re-rendering at all. Resolved values in a context
  can only be delivered by re-rendering the subtree. Narrowing is function composition.
- **`hidden` is an input to validation, not a wrapper around it.** The table reads as though
  the boundary skips registration when hidden. It cannot: hooks are not conditional and
  presence changes after mount. The boundary registers unconditionally and feeds the resolved
  presence to the validators through a control they read via their own `rc`, so a field that
  becomes `hidden` clears its errors by re-running rather than by unregistering.

## 5. Contract props

Two types per kind: what the **author** writes, and what the **implementation** receives after
the boundary has resolved every `FormProp` and consumed what it owns.

```ts
type Validator<T> = (value: T, rc: ReadContext) => string | null | Promise<string | null>;

interface FieldProps<T> {
  field: FormField<T>;
  id?: string;                                   // generated if absent
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  dontClearHidden?: boolean;                     // static, like the JSON flag it mirrors
  label?: FormProp<ReactNode>;
  required?: FormProp<boolean>;
  requiredMessage?: FormProp<string>;
  validate?: Validator<T> | Record<string, Validator<T>>;
  helpText?: FormProp<ReactNode>;
  startIcon?: FormProp<ReactNode>;
  endIcon?: FormProp<ReactNode>;
  className?: FormProp<ClassValue>;
  labelClassName?: FormProp<ClassValue>;
  shellClassName?: FormProp<ClassValue>;
  textClassName?: FormProp<ClassValue>;
}

/** What an implementation sees. Flat and resolved, so `<Shell {...p}>` composes. */
interface FieldRenderProps<T> {
  field: FormField<T>;
  id: string;
  label?: ReactNode;
  required: boolean;
  error?: ReactNode;                             // resolved by the boundary (built)
  helpText?: ReactNode;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  className?: ClassValue;
  labelClassName?: ClassValue;
  shellClassName?: ClassValue;
  textClassName?: ClassValue;
}
```

`validate`, `requiredMessage`, `hidden`, `disabled`, `readOnly` and `dontClearHidden` are
absent from the render props — the boundary consumed them. A renderer cannot see, and
therefore cannot drop, a validator; the two locks arrive folded into `field.state(rc)` instead,
already combined with everything inherited.

**The three flags are props because the format has them per control** — `hidden`, `disabled`
and `readonly` are plain booleans on every `ControlDefinition`. An *inherited* lock is a
different thing and stays in the scope (§4), so the boundary holds both and folds them
restriction-only: a prop or an ancestor can add a lock, neither can re-enable a control that
disabled itself.

`error` runs the other way (**built**). §7 says the shell's error is resolved by the boundary
and never by the implementation — but the *implementation* is what renders the shell, so it has
to be handed one. It is also what makes `<Shell {...p}>` line up slot for slot, which is the
whole point of that spread. Whether an error is shown *at all* — in the build, only once
touched — stays boundary policy; the implementation draws what it is given.

`required` is a flag, never baked into `label`: MUI renders its own asterisk from
`<FormControl required>`.

**A trailing label is still the shell's business (built).** A checkbox's label sits after the
control, and every library attaches it differently: an html `<label>` wrapping the input, MUI's
`FormControlLabel` wrapping both, Mantine a `label` prop on the control, Ant the checkbox's own
*child*. The first attempt let the renderer keep `label` and draw it — legacy's `hidesLabel`,
expressed by omission — and the build showed the bill: the html checkbox hand-rolled the label
markup *and* a copy of the required asterisk, duplicating the shell and guaranteeing drift for
any third-party toggle or switch. So `FieldShellProps` takes `labelPosition` (§7), where
`"after"` also licenses the shell to **wrap** the control, and each implementation maps it to
its own idiom.

A standalone `Label` primitive would not have worked: in three of the four the trailing label is
not a sibling at all, so nothing you render *next to* the control can express it.

```ts
interface GroupProps  { hidden?; disabled?; readOnly?; title?; className?; children: ReactNode }

/** A container needing per-child metadata takes it structured, not as children. */
interface TabsProps  { items: { key: string; title: ReactNode; children: ReactNode }[]; … }
interface ActionProps {
  actionId: string;
  text?: FormProp<ReactNode>;
  icon?: FormProp<ReactNode>;
  onClick?: () => void | Promise<void>;
  disabled?: FormProp<boolean>;
  disableType?: "self" | "global";
  style?: FormProp<ActionStyle>;
  iconPlacement?: FormProp<IconPlacement>;
  children?: ReactNode;                          // any style, not just Group
}
interface ActionRenderProps { /* resolved, plus: */ busy: boolean; onClick: () => void }

/** Per-id appearance, provided by the app rather than the implementation. */
type ActionOverrides = Record<string, ComponentType<ActionRenderProps>>;
function useAction(actionId: string): ComponentType<ActionRenderProps>;
```

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

**From JSON:** adornments do not survive translation — `HelpText` → `helpText`, `Icon` →
`startIcon`/`endIcon`, `Tooltip` → `tooltip`, `Accordion` → a wrapper the loader emits,
`SetField` → `useControlEffect`. `AdornmentKind`, priority ordering and `wrapAdornments` have
nothing left to be about once the renderer owns the whole field. `def.hidden` /
`def.disabled` / `def.readonly` → the three flags, and a `Visible` / `Disabled` dynamic
property → the same prop as a `(rc) => …` — the spelling shifts to `readOnly` to match
`@rx-controls/react`, which the boundary folds with; `def.dontClearHidden` →
`dontClearHidden`; `def.required` → `required`; `def.requiredErrorText` → `requiredMessage`;
`def.validators[]` → the keyed `validate` record, one key per entry so each clears
independently; a `Jsonata` validator returns a promise and routes through the debounce/abort
path.

## 6. The four boundaries

```ts
/** Generic in the value type, not fixed to the one the boundary was built for. */
type FieldComponent<T, P> = <V extends T>(props: FieldProps<V> & P) => Rendered;

function fieldRenderer<T, P = {}>(impl: ComponentType<FieldRenderProps<T> & Resolved<P>>)
  : FieldComponent<T, P>;
function fieldRenderer<T, P = {}>(builtIn: { key: keyof FormRenderers })
  : FieldComponent<T, P>;

function collectionRenderer<T, P = {}>(impl: ComponentType<CollectionRenderProps<T> & Resolved<P>>)
  : <V extends T>(props: CollectionProps<V> & P) => Rendered;

function groupRenderer(impl, opts?: { scope?: boolean; designAs?: keyof FormRenderers });
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
| `groupRenderer` | no | `<>{children}</>` | derive the scope context, optional validation scope, design substitution |
| `actionRenderer` | no | `null` | async/busy, disabler acquisition, handler stubbing in design mode |
| `displayRenderer` | no | `null` | content and presence only |

**A display is a boundary with the data half removed (built), and nothing else had to change.**
With no binding there is no field to validate, nothing to clear when hidden, no locks to fold
and no `state(rc)`; what survives is presence, the class slots, the `visibility` slot and design
chrome. That the guarantees come apart along exactly that line — and that the remaining half
needed no special casing — is the best evidence so far that the boundary is factored correctly.

One consequence for the loader: prop-building is **field-shaped**, so it has to branch on the
control's *type* rather than hand every translator the same props. A display takes `hidden` and
the class slots, and there is nothing else it could take.

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
`display: contents` when off. Adding them only when needed looks free and is a **remount**: the
element at that position changes the instant a lock or design mode toggles, so React discards
the implementation and builds a new one. Toggling `readOnly` replayed MUI's floating-label
animation and dropped focus and selection mid-edit. This is the same failure as the hidden
group in §8 and it has now appeared three times in one build, which is enough to state as a
rule: **in a form library, a wrapper whose presence depends on state must not be conditional.**

**The produced component has to stay generic in the value type (built).** A boundary is built
for one concrete `T`, but a schema legitimately yields `string`, `string | undefined` or
`string | null` for the same widget, and `FormField<string>` is not a
`FormField<string | undefined | null>`. Fixed to one `T`, every schema has to spell out the
widget's exact union instead.

**`Resolved<P>` only works written backwards (built).** `X extends FormProp<infer T>` infers
`T` as the entire union, because `FormProp`'s bare `T` member is a naked type parameter that
absorbs everything. Test the reactive shapes first and fall through:

```ts
type Resolved<P> = { [K in keyof P]: UnwrapProp<P[K]> };
type UnwrapProp<X> = X extends (rc: ReadContext) => infer T ? T
  : X extends Control<infer T> ? T : X;
```

The cost is at runtime rather than in the types. Resolving props whose names the boundary does
not know means calling `getProp` on each, so **any function-valued renderer prop is invoked
with an `rc`** — and `ActionProps.onClick` is already a plain function in §5, so this bites the
moment a field renderer wants a callback. Either extras stay unresolved and the implementation
resolves them in its own window (which §1 prefers on every other count), or the contract needs
a way to mark a prop pass-through. Listed under *Still open*.

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

**Built, and the shortcut was tried and rejected (built).** A scope keeps a set of member
controls plus a version control so membership changes re-trigger; `isValid(rc)` reads every
member *without* early-exiting, so all of them stay subscribed; registration runs upward, so
validity reaches every enclosing scope. `{ scope: true }` is a boundary option, not a renderer
one — `<Contents>` and `<Section>` in the build are the same implementation with and without it,
and the implementation sees the result as `invalid` in its render props.

The scope **is** a real `Control` — which is what makes validity an ordinary tracked read,
`touchAll` a `setTouched` cascade, and nesting just another member — but it took a change in
core to be safe. Built on the existing `attachFields` it corrupts data: a scope always holds
both a control and a descendant of it (a collection registers its array, its rows register
fields inside it), the group's value then carries that datum under two keys, and the downward
sync writes the pre-write copy back. The symptom was a collection row that silently refused
input. `@react-typed-forms/core@4.6` does the same, so it is long-standing.

So core gained `createDerivedGroup` — a group whose value is composed from its children and
never written back down — and `detachFields`, the counterpart `attachFields` never had. The
composed value stays correct under the aliasing, because both keys update through their own
upward routes; only the downward half was ever broken. See `CONTROL-SEMANTICS.md` § O.

**A stateful container offers two homes for its state, and the author picks (built).** A tab
strip keeps its active key in component state, which is right. A wizard's page index usually
must not: it wants to survive a remount, a deep link, or save-and-resume. So `WizardProps` takes
an optional `page?: FormField<number>` — bound, the index lives in the data and shows up in the
payload; omitted, it is component state. A container that only offers the second is unusable for
half its cases, and one that only offers the first pollutes the schema for the other half.

**Gating is what a validation scope is actually for.** The wizard refuses Next while the current
page's scope reports invalid, and a refusal `touchAll()`s that page so the errors it already had
become visible. That needs one method beyond `isValid`, and it only works because an unreached
page is `silent` — validating without rendering, so the step marker can show a page invalid
before the user has ever seen it. Everything else the wizard needed already existed: presence,
the scope, actions, structured `items`. The two buttons it draws use the documented ids `next`
and `back`, so a host restyles them the same way as any other.

**A container that needs per-child metadata cannot take `children`.** A tab strip needs titles,
and `children: ReactNode` is opaque — React cannot inspect it. So tabs take `items` (§5), which
is what the surveyed libraries do too: Ant an `items` array, Mantine and Base UI compound
components with context, MUI the caller pairing a `Tab` with a panel. The generic group boundary
stays for containers that need nothing but a box.

Needed in core: a **structural parent link** that aggregates validity/touched/dirty *without*
value flow. `createControlGroup` composes values through the group, which a validity scope
never wants.

**From JSON:** `designAs` is not per-implementation — `Dialog → Contents`, `Tabs → all
stacked`, `Wizard → all pages` holds for every implementation, so it is a framework constant
that an implementation may extend.

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

- **Dispatched** — a boundary picks it on the author's behalf (`textfield`, `tabs`, an authored
  `<Action>`). It arrives with everything the framework guarantees: validators, presence, the
  lock cascade, `clearHidden`, design-mode stubbing.
- **Composed** — another renderer draws it (`fieldShell`, `inputFrame`, a collection reaching
  for `action` to draw its Add button). It gets **appearance and nothing else**.

So the test for adding a registry entry is simply: **does anything other than this component
need to draw it?** The shell and frame pass, because a third-party widget needs the chrome;
`visibility` passes, because every boundary needs it; `action` passes twice over, being both
dispatched and composed. `Text`, `Pressable` and `View` fail — nothing composes them, and goal
4 scopes portability to the built-in set.

The line that matters in practice is the second bullet: a composed button has no busy state and
no design-mode stub, because those live in the boundary. A button that needs them is an
`<Action>`, not a `useAction(id)`.

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

**Five of those props are the build's, and each has exactly one reason:**

1. **`filled`** — left open above as *whether `filled` can be reported without the frame
   owning the value*. It cannot. MUI's shrink-and-notch and Mantine's sizing both need it, no
   frame in the survey ever sees a value, and the caller always knows. `forms-mui` then feeds
   `InputBase` a placeholder value purely to drive that state: private, contained, and the
   honest price of family 2.
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
6. **`labelPosition`** — see §5. The one predicted to suffer was Ant, since its checkbox wants
   the label as its own child and a shell cannot reach in there. It barely suffers: a sibling
   `<label htmlFor>` comes out identical to the native control — same 14px/22px, same
   `rgba(0,0,0,.88)`, same 16px box and 8px gap — because the label is only text at the body
   font. What it does lose is the greying Ant applies through a class on its own wrapper, so
   the shell maps `disabled` to `colorTextDisabled` by hand. A smaller bill than the frame.

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

## 8. Collections

A collection is a `fieldRenderer` that happens to take a render prop for its rows — not a
component of its own kind.

```ts
interface CollectionProps<T> extends FieldProps<T[]> {
  children: (item: FormField<T>, index: number) => ReactNode;
  empty?: ReactNode;
}

/** What the implementation gets. The hard parts are already done. */
interface CollectionRenderProps<T> extends FieldRenderProps<T[]> {
  elements: ReactNode[];   // one per element, each in its own scope, keyed by uniqueId
  actions: ArrayActions;   // add / remove / move + the Length-derived bounds
  empty?: ReactNode;
}
```

The boundary resolves the elements rather than handing the implementation an array to iterate,
because the three things that must not be got wrong are not obvious:

- subscribe to the array's **structure** only, so adding an element re-renders the list while
  editing one re-renders one field;
- give each element **its own tracking scope** — a callback run inline in the caller's render
  subscribes to nothing, which is a bug the compat package shipped;
- key by the element control's `uniqueId`, never the index, so insert / remove / reorder do
  not land one row's state on another.

A null array is treated as empty and never materialised to `[]`, which would leave the field
and every ancestor permanently dirty.

Mutation is not the renderer's job: `arrayActions(rc, update, field, bounds)` yields
add/remove/move plus the `Length`-derived bounds, so the buttons can live outside the list and
a read-only list costs nothing. It takes an `rc` and returns values, so it is not spelled
`use…` — the same rule as `getProp` in §1.

### Why neither `<Show>` nor `<Each>` is here

**There is no `<Show>` (built).** An earlier draft had one: a component that narrowed presence
to `hidden`, did not mount its children — unrendered children register nothing, which *is*
validation suppression — and took a `for` field so `clearHidden` could still reach them. Both
halves fail in JSX.

- **`for` is unsound.** It names *one* field, but children bind wherever they like; nothing
  ties a component inside the wrapper to the data under `for`. Anything bound elsewhere is
  silently never cleared, and the symptom is stale data in a submitted payload. Making it a
  list only moves the problem — the list is a hand-maintained copy of the children's bindings.
  In JSON this reads as sound because the form tree runs parallel to the data tree, so
  "clear the subtree" and "clear each node's own field" coincide; JSX breaks that parallelism,
  and only the second one survives. The boundary that bound the data is the only thing that
  knows what to clear.
- **Unmounting cannot animate.** An exit transition needs the subtree mounted while it leaves,
  which is what §9's `visibility` slot is for.

So hiding a region is an ordinary chrome-less group — `<Contents hidden={…}>` — whose children
stay mounted and each clear their own binding. Nothing is lost at the call site; what changes
is that the wrapper is a boundary rather than a special case, so it gets the scope and design
mode for free.

**A hidden group hides with CSS, in one unchanging structure (built).** Two things force this,
and the build found the second one the hard way — by shipping a visibly broken demo. Rendering
`{children}` bare when hidden, and the chrome only when rendered, changes the element at that
position, so React **remounts the whole subtree**. Worse, the children that stay behind include
**plain JSX** — a button, a paragraph, anything that is not a boundary — and nothing suppresses
those, because self-suppression is a thing only a boundary knows how to do. A hidden region
therefore leaked its own "Add" button, which then operated on data nobody could see. So the
group implementation receives `hidden: boolean` in its render props and applies it as
`display: none` on the element it was already rendering. For arbitrary non-form JSX, `{cond && …}` still
works — it just gets no animation and no scope narrowing, which is the right trade for a
paragraph of text.

**And there is no `<Each>` (built).** It went the same way, for the same reason and with a
sharper bill, since a collection has more to lose than a region does. As a framework component
it had no binding of its own, so: a `Length` validator on the array had nowhere to register;
`clearHidden` never reached the array (only its elements' fields); and `hidden`, the locks,
design mode and the array-level error message all went missing. `<Elements>` — the chrome-less
collection, the array analogue of `<Contents>` — replaces it, and the build exercises all
four: `Length 1–3` publishes *At least 1 required* on the array itself, and hiding the region
clears the array rather than leaving a stale one behind.

**From JSON:** a collection control resolves one child per element; that must produce the same
per-element boundaries rather than a second mechanism.

## 9. The two registries

```ts
/** Closed and exhaustive. An implementation supplies every key or an explicit stub. */
interface FormRenderers {
  textfield: ComponentType<…>; number: …; date: …; select: …; checkbox: …; radio: …;
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
versions), and it is why `<Show>` could not survive: a framework component that unmounts its
children has nothing to hand this slot.

For a **field** the semantics do not linger with the pixels — a boundary whose presence has
gone `hidden` has already stopped validating and cleared its field, and the `visibility`
component is only still drawing its last frames. That is what keeps `Presence` at three states
rather than needing a fourth for "on screen but not validating".

For a **region** the group hides itself (§8) rather than going through this slot, since it has
to keep its children mounted and its structure unchanged — and it animates anyway. Built and
measured: the collapsing region fires `transitionstart`/`transitionend` on
`grid-template-rows` and `opacity` over 220ms, and for the whole of that the field inside is
still on screen, because *its* `visibility` component is holding its last frame.

The two exits compose, and that is why `Presence` needs no fourth cell after all. "Renders but
does not validate" is precisely what the `visibility` slot already does, for the length of one
transition, without anyone having to name it as a state. A non-animating `visibility` — the
default — drops its children at once and the region collapses over an empty box, which is the
right answer there: nothing was animating to begin with.

`options` is declared once and pays twice — it is what makes a custom render option
*scriptable*, and the designer edits it off the same declaration. An extension shipping its own
editor panel would be additional work, not a substitute.

**Unsupported render type:** render a visible placeholder naming it, and report through a
form-level `onUnsupported` whose default is exactly that. Same path covers a platform with no
implementation for a key.

## 10. Starting a form

```tsx
function PersonForm({ data, view }: { data: Control<Person>; view: boolean }) {
  const f = useFormField(data);
  return (
    <Form clearHidden readOnly={view}>
      <Stack>
        <TextField field={f.$.firstName} label="First name" />
        <Contents hidden={(rc) => !rc.getValue(f.$.hasPets.control)}>
          <Elements field={f.$.pets} minLength={1}>
            {(pet) => <TextField field={pet.$.name} required />}
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

An earlier draft did without it, on the grounds that the scope defaults to rendered / enabled /
editable so a form is just components. That was aesthetics, and it left `clearHidden` homeless:
it is per-form, not per-app — an edit form and a search form over the same schema disagree
about it — so there was nowhere legitimate to put it.

`<FormProvider renderers={…}>` still sits at the app root and is about implementation, not
about any one form. Root validity needs no scope — the root data control already aggregates.

**From JSON (built):** `<JsonForm controls={…} schema={…} data={…}/>` translates a
`ControlDefinition[]` into exactly the JSX above — the same boundaries, the same scope, the
same registry. Its output composes with hand-written form source in one tree: in the build the
JSON form is a third tab beside two hand-written ones, bound to the same data control, and
nothing below the loader can tell which is which. An unsupported control renders a visible
placeholder naming it.

**Translation allocates, and that is the loader's defining hazard.** Every scripted prop costs
a control and a subscription, where a hand-written form allocates nothing per render. Building
them during render worked until the component remounted, at which point the build ran 84,000
jsonata evaluations without a single warning. So results are cached on the data control's meta,
keyed by the expression — allocation is once per (control, expression) however many times the
tree remounts. Memoising the translated tree is not enough on its own, because remounting
defeats a memo.

---

## Still open

- **Which named props beyond the minimum.** `tooltip` and `optional` are the next candidates,
  left out on survey evidence (`Tooltip` in one real form, `Optional` in none). Every
  implementation handles every named prop, so adding one is a contract change.
- **A portal container has not been built.** Everything else in §6's table has: a field, an
  options widget, a collection, a chrome-less group, tabs, a wizard, actions, displays, the
  staged-edit flow and the JSON loader, each in four implementations. A dialog is the one shape
  left, and it is the one design mode's layer 3 is about — a renderer whose content escapes the
  canvas and can only be selected from the tree. `{ scope: true }` now has
  a working hand-rolled implementation, which is enough to say what core is missing — a
  structural parent link aggregating validity without value flow — but not to say what its API
  should be.
- **Whether renderer-specific props are resolved by the boundary or by the implementation.**
  §6 has the boundary do it, which invokes any function-valued prop with an `rc`. Handing them
  through unresolved and letting the implementation call `getProp` in its own window is what
  §1 prefers on every other count. Unresolved because nothing in the build needed a callback
  prop; the first renderer that does decides it.
- **Whether `forms-html` and `forms-native` share renderer source** — decidable when the second
  package exists, and it changes nothing above.

The §7 primitives themselves are no longer paper: `poc/forms-v2` builds them four times over,
and both shapes flagged there as most likely to move were the right two — the MUI shell→frame
private channel held exactly as predicted, and `filled` turned out to need telling. But that
is evidence about a *field*, and only a field. Everything in the bullets above is still
untested by anything.
