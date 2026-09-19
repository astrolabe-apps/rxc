# Forms v2 — key interfaces

Status: **proposal**. Nothing implemented. Goals, and the reasoning behind everything here,
are in [`FORMS-V2-GOALS.md`](./FORMS-V2-GOALS.md).

The shape is JSX-first: these are the types a hand-written form is built from. JSON is
downstream — each section ends with **From JSON**, saying what the loader's translator produces
for it. No type here mentions `ControlDefinition` except `FormNode`, which only the loader
makes.

**One rule throughout:** every prop is a `FormProp`, except the three that cannot be — `field`
(the binding), `id` (stable by construction) and `children`.

## What a boundary is

The organising idea, used throughout. Every component an author writes in a form is either a
**boundary** or a **framework component**.

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

A **framework component** — `<Show>`, `<Each>` — has no implementation and nothing to swap. It
renders structure, never chrome, and is identical on every platform.

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

**From JSON:** this is where the expression engine terminates. A literal `renderOptions.x`
becomes `T`; a scripted one becomes `(rc) => …` closing over the evaluator. `$scripts`,
`dynamic`, `EntityExpression` and jsonata never reach a renderer.

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
  readonly schema: SchemaField;
  state(rc: ReadContext): FieldState;
  /** Typed navigation into a compound value; arrays go through <Each>. */
  readonly $: FormFields<T>;
}

interface FieldState {
  disabled: boolean;
  readonly: boolean;
  touched: boolean;
  dirty: boolean;
  errors: string[];
}
```

Presence is **not** on `FieldState`: by the time an implementation runs, presence is always
`rendered` — the boundary handled the other two. Design mode showing a hidden field is
`useDesignMode()`, not a value that is constant in production.

```ts
interface FormNode extends FormField<unknown> {
  readonly definition: ControlDefinition;
  children(rc: ReadContext): FormNode[];
  /** Checked narrowing. Throws naming the path and both types — never a bare cast. */
  at<T>(path: string): FormField<T>;
}
```

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

Presence travels in the scope context, and a component narrows it — never widens it, so a
child cannot be more visible than its parent. Two ways to narrow:

- **A boundary** takes `presence?: FormProp<Presence>` for itself and its subtree. `<Tab
  active>` passes `rendered` / `silent`, so an inactive panel still validates; same for a
  wizard page and an off-page grid row.
- **`<Show>`**, a framework component, exists only to narrow it — `rendered` / `hidden` — plus
  own `clearHidden` for the subtree.

That is the whole mechanism; there is no separate visibility system.

`silent` exists because *unmounted is not hidden* — if it were, switching tabs would run
`clearHidden` and wipe what you typed.

## 5. Contract props

Two types per kind: what the **author** writes, and what the **implementation** receives after
the boundary has resolved every `FormProp` and consumed what it owns.

```ts
type Validator<T> = (value: T, rc: ReadContext) => string | null | Promise<string | null>;

interface FieldProps<T> {
  field: FormField<T>;
  id?: string;                                   // generated if absent
  presence?: FormProp<Presence>;
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
  helpText?: ReactNode;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  className?: ClassValue;
  labelClassName?: ClassValue;
  shellClassName?: ClassValue;
  textClassName?: ClassValue;
}
```

`validate`, `requiredMessage` and `presence` are absent from the render props — the boundary
consumed them. A renderer cannot see, and therefore cannot drop, a validator.

`required` is a flag, never baked into `label`: MUI renders its own asterisk from
`<FormControl required>`.

```ts
interface GroupProps  { presence?; title?; className?; children: ReactNode }
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
```

**From JSON:** adornments do not survive translation — `HelpText` → `helpText`, `Icon` →
`startIcon`/`endIcon`, `Tooltip` → `tooltip`, `Accordion` → a wrapper the loader emits,
`SetField` → `useControlEffect`. `AdornmentKind`, priority ordering and `wrapAdornments` have
nothing left to be about once the renderer owns the whole field. `def.required` →
`required`; `def.requiredErrorText` → `requiredMessage`; `def.validators[]` → the keyed
`validate` record, one key per entry so each clears independently; a `Jsonata` validator
returns a promise and routes through the debounce/abort path.

## 6. The four boundaries

```ts
function fieldRenderer<T, P = {}>(impl: ComponentType<FieldRenderProps<T> & Resolved<P>>)
  : ComponentType<FieldProps<T> & P>;
function fieldRenderer<T, P = {}>(builtIn: { key: keyof FormRenderers })
  : ComponentType<FieldProps<T> & P>;

function groupRenderer(impl, opts?: { scope?: boolean; designAs?: keyof FormRenderers });
function actionRenderer(impl);
function displayRenderer(impl);
```

These are the four boundary factories (see *What a boundary is*). One kind of component, two
ways of resolving the implementation: **fixed** — a custom renderer, imported directly and
type-safe for free — or **from the registry**, a built-in that `<FormProvider renderers>` can
swap. They differ in what framework work each kind needs:

| boundary | binds data | under `silent` | distinctive work |
|---|---|---|---|
| `fieldRenderer` | yes | `null` | register validators, attach to the nearest scope |
| `groupRenderer` | no | `<>{children}</>` | derive the scope context, optional validation scope, design substitution |
| `actionRenderer` | no | `null` | async/busy, disabler acquisition, handler stubbing in design mode |
| `displayRenderer` | no | `null` | content and presence only |

All four also resolve `FormProp`s, apply presence, route class slots, and wrap design-mode
chrome.

### Validation scopes

A group can be invalid because its descendants are, and the data tree cannot express that —
non-data groups, per-control validators, per-node gating, array-level errors. React cannot walk
its own children, so it works in reverse: **a field's boundary attaches its validity-bearing
control to the nearest ancestor scope from context**, and a scope-bearing group attaches its
scope to *its* parent. Scopes nest, validity bubbles, and it all still happens under `silent`
because the boundary runs even when nothing renders.

`{ scope: true }` is opt-in — only containers that get asked "is my content invalid" need one
(a tab header, a step marker). `<Each>` needs none: array elements are already children of the
array control, so element validity bubbles natively. That is the one case where the data tree
really is enough.

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
function useInputFrame(): ComponentType<InputFrameProps>;   // the bordered box, start/end slots
```

A widget that draws its own surface — stars, a map, a signature pad — uses the shell and skips
the frame.

A primitive earns its place only when **both paths need it and it cannot be expressed as a
renderer**. That admits the shell, the frame, and one layout box; it excludes `Text`,
`Pressable` and `View`, since goal 4 scopes portability to the built-in set.

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

## 8. Framework components

No implementation, nothing to swap, identical on every platform.

```ts
interface ShowProps {
  when: FormProp<boolean>;
  for?: FormField<unknown>;     // subtree that gets clearHidden; see below
  children: ReactNode;
}

interface EachProps<T> {
  of: FormField<T[]>;
  children: (item: FormField<T>, index: number) => ReactNode;
  empty?: ReactNode;
}
```

`<Show>` is a presence override plus `clearHidden` ownership. Validation suppression needs no
gate in JSX: unrendered children register nothing, which *is* suppression. `for` exists only
because `clearHidden` must reach a subtree that never mounts.

`<Each>`:

- subscribes to the array's **structure**, so adding an element re-renders the list and editing
  one re-renders one field;
- gives each element **its own tracking scope** — a callback run inline in the helper's render
  subscribes to nothing, which is a bug the compat package shipped;
- keys by the element control's `uniqueId`, never the index, so insert/remove/reorder do not
  land one row's state on another;
- treats a null array as empty and never materialises `[]`, which would leave the field and
  every ancestor permanently dirty.

Mutation is not its job — `useArrayActions(field)` yields add/remove/move plus the
`Length`-derived bounds, so the buttons can live outside the list and a read-only list costs
nothing.

**From JSON:** a collection control resolves one child per element; that must produce the same
per-element boundaries rather than a second mechanism.

## 9. The two registries

```ts
/** Closed and exhaustive. An implementation supplies every key or an explicit stub. */
interface FormRenderers {
  textfield: ComponentType<…>; number: …; date: …; select: …; checkbox: …; radio: …;
  stack: …; grid: …; tabs: …; accordion: …; dialog: …; wizard: …;
  action: …; text: …; html: …; icon: …;
  fieldShell: ComponentType<FieldShellProps>;
  inputFrame: ComponentType<InputFrameProps>;
}

/** Open. Consumed by the loader only. */
interface Translator {
  match: (def: ControlDefinition) => boolean;
  options?: SchemaField[];                        // renderOptions — scripting + editor panel
  render: (node: FormNode, p: FieldRenderProps<unknown>) => ReactNode;
}
```

|  | keyed by | provided by | consumed by |
|---|---|---|---|
| `FormRenderers` | a built-in kind, an internal literal | `forms-html` / `forms-mui` / `forms-native` | boundaries |
| translators | a JSON render-type string | apps and extensions | the loader |

Neither key appears in user code. A JSON `renderType: "Textfield"` goes translator →
`<TextField>` → `FormRenderers` → `<input>`: the loader lands on the JSX surface and dispatch
happens below it.

`options` is declared once and pays twice — it is what makes a custom render option
*scriptable*, and the designer edits it off the same declaration. An extension shipping its own
editor panel would be additional work, not a substitute.

**Unsupported render type:** render a visible placeholder naming it, and report through a
form-level `onUnsupported` whose default is exactly that. Same path covers a platform with no
implementation for a key.

## 10. Starting a form

```tsx
const personSchema = buildSchema<Person>({ … });

function PersonForm({ data }: { data: Control<Person> }) {
  const f = useFormField(personSchema, data);
  return (
    <Stack>
      <TextField field={f.$.firstName} />
      <Show when={f.$.hasPets} for={f.$.pets}>
        <Each of={f.$.pets}>{(pet) => <TextField field={pet.$.name} />}</Each>
      </Show>
    </Stack>
  );
}
```

No `<Form>` wrapper: the scope context defaults to rendered / enabled / editable, so a form is
just components. `<FormProvider renderers={…}>` sits at the app root and is about
implementation, not about any one form; `<FormEdit readonly>` is an ordinary scope provider for
locking a whole tree. Root validity needs no scope — the root data control already aggregates.

**From JSON:** `useJsonForm(definition, schema, data)` returns a `FormNode`; rendering it is
one dispatch into the translator registry. Same scope context, same boundaries, same
implementation registry underneath.

---

## Still open

- **Which named props beyond the minimum.** `tooltip` and `optional` are the next candidates,
  left out on survey evidence (`Tooltip` in one real form, `Optional` in none). Every
  implementation handles every named prop, so adding one is a contract change.
- **Only walked against a data renderer.** A group, a collection (array actions, reaching the
  staged-edit controller) and an action have not been carried end to end; the collection case
  is the likeliest to force a change here.
- **Whether `forms-html` and `forms-native` share renderer source** — decidable when the second
  package exists, and it changes nothing above.
