# Forms v2 — shape sketch

Status: **exploratory**. Small examples only, to argue about before anything is built.
Nothing here is implemented; nothing in `packages/forms*` is affected yet.

## Goals

1. **Stay compatible with the existing JSON format.** `ControlDefinition` / `SchemaField`
   as emitted by `Astrolabe.Schemas` must load unchanged. The visual designer keeps working.
2. **Support writing form rendering directly in React JSX.** A hand-written form should be
   ordinary, type-safe JSX — not a JSON literal in disguise — while still getting the
   reactive control tree, validation, and cascades.
3. **A renderer abstraction that serves both HTML and React Native — with the *same* JSX.**
   One form source renders on either platform, for the **built-in renderer set**; a host's
   custom renderer may be platform-specific.
4. **Implementation independence.** No renderer implementation is hardcoded in form source —
   Tailwind HTML, MUI, RN Paper, or a host's own design system swap at the root.
5. **A visual designer**, reimplemented against the new renderers, editing the same JSON
   and previewing against any **web** implementation. Web-only.
6. **JSON and JSX interoperate** — either can embed the other.

Full goal statement, including what is assumed rather than stated:
[`FORMS-V2-GOALS.md`](./FORMS-V2-GOALS.md). The goals pull against each other in a few
specific places; those are collected in [Where the goals collide](#where-the-goals-collide)
rather than glossed over.

---

## Two structural ideas

### 1. Split the binding from the definition

Today a renderer takes a `FormStateNode` — a definition-bearing node. That couples every
renderer to `ControlDefinition`, which is why a hand-written form has to fabricate JSON:

```tsx
// today — the only way to render a text field
const def = dataControl("firstName", "First name", textfieldOptions({}));
```

Split the node in two:

```ts
/** The binding. Everything a renderer needs. Knows nothing about ControlDefinition. */
interface FormField<T> {
  readonly control: Control<T>;              // the data control
  readonly schema: SchemaField;              // type, options, collection, required
  state(rc: ReadContext): FieldState;        // visible / disabled / readonly / touched / errors
}

/** The definition-bearing node. Only the JSON path produces these. */
interface FormNode extends FormField<unknown> {
  readonly definition: ControlDefinition;
  children(rc: ReadContext): FormNode[];
}
```

Renderers take `FormField<T>`. Everything definition-shaped — `renderOptions`,
`styleClass`, adornments, `title` — arrives as ordinary props. That is what lets JSX
authoring and JSON authoring produce the same input to the same renderer.

### 2. The components you write are dispatch requests, not implementations

This is the one that makes goal 3 work. `<TextField>` must **not** be a component that
renders an `<input>`, or the same JSX cannot run on native. It resolves an implementation
from the ambient registry:

```tsx
// @rx-controls/forms-react — platform-neutral. This is what forms import.
export function TextField(props: TextFieldProps) {
  const Impl = useRenderer("textfield");
  return <Impl {...props} />;
}
```

The app chooses the implementation once, at the root:

```tsx
<FormProvider renderers={htmlTailwind}>   {/* or nativeTailwind, or mui, or yours */}
  <PersonForm data={data} />
</FormProvider>
```

Swap that one prop and every form in the tree re-renders against a different design
system, or a different platform, with no change to any form source.

The payoff is that **this is the same registry the JSON path already needs**. One
abstraction serves all three goals: JSON dispatch resolves a definition to a registry key,
JSX dispatch resolves a component name to a registry key, and platform/design-system swap
is a different registry.

---

## Sketch A — writing a form in JSX

```tsx
const personSchema = buildSchema<Person>({
  firstName: stringField("First name"),
  lastName:  stringField("Last name"),
  dob:       dateField("Date of birth"),
  hasPets:   boolField("Do you have pets?"),
  pets:      compoundField("Pets", petSchema, { collection: true }),
});

function PersonForm({ data }: { data: Control<Person> }) {
  const f = useFormField(personSchema, data);   // FormField<Person>
  return (
    <Stack>
      <TextField field={f.$.firstName} />       {/* label comes from the schema */}
      <TextField field={f.$.lastName} label="Surname" />   {/* prop overrides it */}
      <DateField field={f.$.dob} />
      <Checkbox  field={f.$.hasPets} />
    </Stack>
  );
}
```

Every component here — `Stack`, `TextField`, `DateField`, `Checkbox` — comes from
`@rx-controls/forms-react` and is a dispatch request. This file renders on web and on
native unchanged.

`f.$.firstName` is a typed cursor: `FormField<string>`. It carries the schema field, so
label, required-ness, option lists, and validation come along without restating them.

### Reactivity: only the leaves need `rc`

`PersonForm` has no `useReactive()` — its JSX is static structure, and each leaf subscribes
to its own control. Structure that *does* depend on data uses helpers rather than hoisting
`rc` into the parent:

```tsx
<Show when={f.$.hasPets}>
  <Each of={f.$.pets}>
    {(pet, i) => (
      <Row key={i}>
        <TextField field={pet.$.name} />
        <Action onPress={() => remove(f.$.pets, i)} label="Remove" />
      </Row>
    )}
  </Each>
</Show>
```

`<Show>` / `<Each>` each open their own render boundary, so adding a pet re-renders the
list and nothing above it. `<Show>` also takes a predicate:
`<Show when={(rc) => rc.getValue(f.$.age.control) >= 18}>`.

**`<Show>` is not just conditional rendering.** JSX forms get the same engine (goal 2), and
in the JSON path a hidden node also gets `validationEnabled = false` and `clearHidden`. If
`<Show>` merely declines to render its children, a required field inside a collapsed branch
keeps the form invalid with nothing on screen to fix. The likely resolution is that `<Show>`
names the subtree it governs, so the existing cascade still runs:

```tsx
<Show when={f.$.hasPets} for={f.$.pets}>   {/* writes `visible` onto the subtree */}
```

See `FORMS-V2-GOALS.md` for the alternatives.

### What the JSX path does *not* need

`$scripts`, `dynamic`, `EntityExpression`, jsonata — all of it exists because JSON can't
express computation. In JSX you write the computation:

```tsx
<Show when={(rc) => rc.getValue(f.$.country.control) === "AU"}>
  <TextField field={f.$.abn} />
</Show>
```

The expression engine stays, but only the JSON path depends on it — a large chunk of
`forms-core` that hand-written forms stop paying for, **until they embed a JSON section**
(goal 6), at which point it comes back for that subtree.

---

## Sketch B — the JSON path, through the same registry

```tsx
const form = useJsonForm(fireFormJson, personSchema, data);  // FormNode
return <RenderNode node={form} />;
```

`<RenderNode>` is the *only* thing in the system that reads `ControlDefinition`. A matcher
translates a definition into a registry key plus neutral props — exactly the props a JSX
author would have written by hand:

```tsx
const textfield = dataMatcher(
  matchRenderType(DataRenderType.Textfield),
  ({ node, field }) => ({
    renderer: "textfield",
    props: {
      field,
      placeholder: node.definition.renderOptions?.placeholder,
      className:   node.definition.styleClass,
    },
  }),
);
```

So a JSON form and a JSX form reach the same implementation, and both follow the
`FormProvider` swap. Custom render types are the same shape — no separate "custom
renderer" concept:

```tsx
const stars = dataMatcher(matchRenderType("Stars"), ({ node, field }) => ({
  renderer: "stars",
  props: { field, max: node.definition.renderOptions.maxStars },
}));
```

### Interop, both directions (goal 6)

**JSON inside JSX** — a JSX form embedding a designer-built section:

```tsx
<Stack>
  <TextField field={f.$.firstName} />
  <JsonSection definition={addressBlockJson} field={f.$.address} />
</Stack>
```

This is the expensive direction, and the cost is not in the markup. It must be **one
cascade tree**, not two forms side by side: a hidden JSX ancestor hides the JSON subtree,
and an error inside the JSON subtree makes the JSX form invalid. Two requirements fall out:

- `FormNode` construction must be rootable at an **arbitrary `FormField`**, not only at a
  form root — the JSON subtree's `field: "a/b"` paths resolve relative to wherever it was
  embedded.
- The seam is **untyped**. `f.$.address` is `FormField<Address>`, but the JSON's paths are
  strings; nothing checks they agree until runtime. Accepted, but it should fail loudly.

**JSX inside JSON** — the `stars` matcher above, plus a `stars` entry in the registries that
support it. Cheap; it is the mechanism the design already has. One addition it forces: a
hand-written renderer handed a `FormNode` needs typed `FormField`s for its children, so the
cursor has to accept string paths alongside typed navigation:

```tsx
const stars = dataMatcher(matchRenderType("AddressBlock"), ({ node }) => ({
  renderer: "addressBlock",
  props: { street: node.at<string>("street"), postcode: node.at<string>("postcode") },
}));
```

---

## Sketch C — renderer implementations

An implementation is a plain object. It is the only place DOM or RN appears.

```ts
// @rx-controls/forms-react — the contract, platform-neutral, defined once
interface FormRenderers {
  textfield: ComponentType<TextFieldProps>;
  number:    ComponentType<NumberFieldProps>;
  date:      ComponentType<DateFieldProps>;
  select:    ComponentType<SelectProps>;
  checkbox:  ComponentType<CheckboxProps>;
  stack:     ComponentType<StackProps>;
  row:       ComponentType<RowProps>;
  action:    ComponentType<ActionProps>;
  fieldShell: ComponentType<FieldShellProps>;   // label + control + error composition
  // …
}
```

Because the designer (goal 5) previews against *any* web implementation, **design mode must
not appear in this contract at all** — a third-party MUI set will not have implemented it.
It belongs in the dispatch layer instead; see collision 4.

```tsx
// @rx-controls/forms-html
export const htmlTailwind: FormRenderers = {
  textfield: ({ field, label, placeholder, className }) => {
    const { rc, rendered } = useReactive();
    const c = useTextInput(rc, field);          // shared controller, see below
    return rendered(
      <FieldShell field={field} label={label}>
        <input value={c.value} onChange={(e) => c.onChangeText(e.target.value)}
               onBlur={c.onBlur} disabled={c.disabled} readOnly={c.readonly}
               placeholder={placeholder} className={cx("border rounded px-2", className)} />
      </FieldShell>
    );
  },
  …
};
```

```tsx
// @rx-controls/forms-native
export const nativeTailwind: FormRenderers = {
  textfield: ({ field, label, placeholder, className }) => {
    const { rc, rendered } = useReactive();
    const c = useTextInput(rc, field);          // the same controller
    return rendered(
      <FieldShell field={field} label={label}>
        <RNTextInput value={c.value} onChangeText={c.onChangeText} onBlur={c.onBlur}
                     editable={!c.disabled && !c.readonly} placeholder={placeholder}
                     className={cx("border rounded px-2", className)} />
      </FieldShell>
    );
  },
  …
};
```

### The registry entry is the *whole field*, not just the input

`fieldShell` composes label + control + error, and most entries delegate to it. But an
implementation may ignore it entirely — which is the point. MUI's `<TextField>` owns its
own label and helper text:

```tsx
export const mui: FormRenderers = {
  textfield: ({ field, label, placeholder }) => {
    const { rc, rendered } = useReactive();
    const c = useTextInput(rc, field);
    return rendered(
      <MuiTextField label={label ?? field.schema.displayName} value={c.value}
                    onChange={(e) => c.onChangeText(e.target.value)} onBlur={c.onBlur}
                    error={c.hasError} helperText={c.errorText} disabled={c.disabled}
                    placeholder={placeholder} />
    );
  },
  …
};
```

If the framework hardcoded "label above, error below" and only let an implementation fill
an input slot, MUI and RN Paper could not be implemented properly. Owning the whole field
is what makes the abstraction genuinely swappable.

### What is shared across every implementation: controllers

```ts
// @rx-controls/forms-react — no DOM, no class strings, no element choice
export function useTextInput(rc: ReadContext, field: FormField<string>) {
  const ctx = useControlContext();
  const { disabled, readonly, touched, errors } = field.state(rc);
  const raw = rc.getValue(field.control);
  return {
    value: raw == null ? "" : String(raw),
    disabled, readonly,
    hasError: touched && errors.length > 0,
    errorText: touched ? errors[0] : undefined,
    onChangeText: (next: string) => ctx.update((wc) => wc.setValue(field.control, next)),
    onBlur: () => ctx.update((wc) => wc.setTouched(field.control, true, true)),
  };
}
```

The state machines — text buffering, number parse-on-blur, autocomplete open/query, tabs,
disclosure, array add/remove/editExternal — live here and are written once. An
implementation is then ~15 lines of markup per entry. The repo has already validated this
split (`docs/RENDERER-HOOK-EXTRACTION.md`, phases 1–2 shipped).

### Custom renderers

A custom renderer is just a concrete component, and **need not be portable** — goal 3 is
scoped to the built-in set. So the default is to write it directly against the platform:
`<input>` and `<div>` on web, RN components on native, whatever the host needs.

`forms-react` may still expose a minimal neutral vocabulary — `View`, `Text`, `Pressable` —
for a host that *wants* one renderer to serve both. It is a convenience with no
architectural weight, and a candidate to cut if nothing asks for it:

```tsx
export function StarRating({ field, max = 5 }: StarRatingProps) {
  const { rc, rendered } = useReactive();
  const c = useNumberInput(rc, field);
  return rendered(
    <Row>
      {range(max).map((i) => (
        <Pressable key={i} onPress={() => c.setValue(i + 1)}>
          <Text className={i < c.value ? "text-amber-500" : "text-zinc-300"}>★</Text>
        </Pressable>
      ))}
    </Row>
  );
}
```

---

## Neutral props are the real design work

The `FormRenderers` prop types are the contract every implementation must satisfy, so they
have to be neutral in *semantics*, not just in name:

```ts
interface TextFieldProps {
  field: FormField<string>;
  label?: ReactNode;          // not `string` — implementations may render rich labels
  placeholder?: string;
  className?: string;         // advisory; non-class-based implementations ignore it
  autoFocus?: boolean;
}
```

Rules that fall out:

- **No platform event types.** `onChangeText: (s: string) => void`, never
  `onChange: (e: React.ChangeEvent) => void`.
- **No DOM-only concepts in required props.** `type="date"`, `<optgroup>`, `inputMode`,
  `autocomplete` are implementation details of the HTML entry, not contract.
- **`className` stays, for JSON compatibility.** `styleClass` has to land somewhere.
  Documented as advisory — an MUI or Paper implementation ignores it.
- **Implementation-specific extras do not widen the contract.** Because custom renderers
  may be platform- and implementation-specific, a host needing MUI `variant` or
  `<input type="tel">` registers its own renderer rather than pushing the prop into the
  shared type. This is the main thing goal 3's narrowed scope buys: the contract stays
  small, and the pressure that would otherwise deform it has somewhere else to go.

---

## Styling

With swappable implementations, styling is mostly an *implementation* concern — an MUI
registry has no theme slots and wants no class strings. The cross-platform styling
question only bites if you want **one Tailwind implementation to serve both platforms**,
which is the least-work option and worth pricing. NativeWind makes it viable; three
things verified against the docs constrain it:

- **Tailwind version alignment.** NativeWind **stable (4.2.7) is on Tailwind 3**; this repo
  is on Tailwind **4.1** (`@import "tailwindcss"` + `@source` in `globals.css`). A shared
  class vocabulary needs **NativeWind v5**, which aligns with Tailwind v4 and its CSS-first
  `@theme` config — but v5 is an RC (`nativewind@5.0.0-rc.0` + `react-native-css@3.1.0-rc.0`)
  and explicitly not recommended for production. **Shipping separate `forms-html` and
  `forms-native` implementations sidesteps this entirely** — which is the main practical
  argument for doing so, now that the JSX no longer forces the choice.
- **Platform variants let one class string branch.** NativeWind accepts all Tailwind
  classes and applies the subset RN's style engine supports, with `web:` / `native:`
  variants: `"web:grid web:grid-cols-3 native:flex-col"`. Unsupported utilities are
  filtered at runtime rather than erroring, so a web-first theme degrades on native.
- **State variants are narrower than today's theme assumes.** The repo's centralized
  `inputClass` bakes in `aria-invalid:` / `disabled:` / `read-only:`. NativeWind documents
  `disabled:`, `empty:`, `hover:`/`focus:`/`active:`, `placeholder:`, `data-[…]`, and
  `aria-*` via RN's public prop syntax (`aria-selected:` is the worked example).
  `read-only:` and `invalid:` are **not** listed. The portable spelling is a data
  attribute — `data-[invalid=true]:border-red-500`.

Interactive variants also require the component to implement the matching event props —
`Pressable` supports hover/active/focus, bare `View` does not.

---

## Where the goals collide

**1. Runtime class strings vs build-time CSS scanning (goal 1 × goal 3).**
JSON forms carry Tailwind strings in `styleClass` / `layoutClass` / `textClass`. Both
Tailwind and NativeWind compile by scanning source at build time, so a class string that
only exists inside a runtime-fetched form definition was never scanned. This is
**symmetric across platforms** — a designer-authored `styleClass` is equally missing from
the web bundle.

The repo already hits the build-time half and solves it with `@source`
(`apps/dev/src/app/globals.css` scans `packages/forms/src`). Under NativeWind v5 the same
directive works on native, because v5 runs Tailwind v4's own compiler:

```css
@source "../../forms/**/*.json";              /* designer output committed to the repo */
@source inline("text-{red,green}-{500,700}"); /* v4's safelist, for known-emittable sets */
```

Uncovered either way: definitions fetched from the server at runtime — the ServiceTas
model. Options, to decide explicitly: `@source inline(...)` the subset of utilities the
designer may emit; restrict the designer to named theme slots instead of free-text classes;
or ship a CSS payload alongside the form.

**2. JSX forms are invisible to the designer (goal 1 × goal 2).**
The visual editor round-trips `ControlDefinition`. A JSX form has no JSON to edit. Two
positions, to pick explicitly rather than drift into:
  - *Accept it* — JSX is for hand-built forms and custom sections; the designer owns JSON
    forms; they interop via `<JsonSection>` and custom render types.
  - *Compile a restricted JSX subset to JSON* — powerful, but constrains JSX to statically
    analysable structure, forfeiting most of what makes goal 2 attractive.

Currently leaning *accept it*.

**3. An implementation that can't satisfy a registry key (goal 1 × goal 3).**
`HtmlDisplay`, `Jsonata`-rendered HTML, `<dialog>`, `<details>`, `IntersectionObserver`
scroll lists. This gets *better* under a typed registry: `FormRenderers` with required keys
means an implementation cannot silently omit a **built-in** key — it must supply an entry or
an explicit stub, and TS says so at build time.

Host-registered keys are the looser case, since a custom renderer is allowed to be
platform-specific. A form using one is simply not portable, which is accepted — but
dispatch must then **fail visibly** on the other platform (a placeholder naming the missing
key) rather than render nothing. That is the cost of the narrowed goal 3, and the one place
it needs explicit handling.

**4. Designer needs vs a minimal contract (goal 5 × goal 4) — mostly resolved.**
The designer previews against any web implementation, so design mode cannot be a renderer
responsibility. It has to live in the **dispatch layer**, and all three behaviours do:

```tsx
// inside RenderNode, above the registry lookup
if (designMode) {
  visible = true;                                    // render hidden fields anyway
  props.onPress = noop;                              // stub actions
  return <SelectionWrapper node={node}><Impl {...props} /></SelectionWrapper>;
}
```

`SelectionWrapper` is a plain element with an absolutely-positioned outline overlay, so it
wraps arbitrary renderer output without cooperation. That works on **web** — it is the
strongest reason the web-only restriction earns its keep.

Two residuals:
- **Portals.** A dialog/modal renderer emits its content elsewhere in the tree; a wrapper
  around the dispatch site outlines nothing. Design mode needs a story for those (legacy's
  answer was `showInline` — render the modal body inline instead).
- **Reactive definitions.** The designer edits `ControlDefinition` in place, so definitions
  must be exposed as live reactive values. This is unavoidable work, not a contract issue.

---

## Proposed package layout

```
@rx-controls/core           unchanged, published
@rx-controls/react          unchanged, published
@rx-controls/forms-schema   SchemaField + ControlDefinition JSON types, builders. No React.
@rx-controls/forms-state    FormField/FormNode, cascades, validators, expressions. No React.
@rx-controls/forms-react    THE contract: dispatch components (TextField/Stack/Show/Each),
                            FormRenderers interface + neutral prop types, controllers,
                            registry, JSON matchers. No DOM, no class strings.
@rx-controls/forms-html     htmlTailwind implementation
@rx-controls/forms-native   nativeTailwind implementation
@rx-controls/forms-mui      mui implementation (proves the abstraction; a third
                            implementation is the only real test of it)
```

`forms-react` is now the centre of gravity — a form imports from it and nothing else.

## Open questions

- **How does a host extend `FormRenderers` with its own keys and keep type safety?**
  Module augmentation (`declare module`) vs a generic registry parameter threaded through
  `FormProvider` and every dispatch component. The generic is more honest and much noisier.
- **Does `fieldShell` belong in the registry, or is field composition a separate provider?**
  It is the piece MUI most wants to bypass, so it needs to be trivially bypassable.
- Does `FormStateNode` survive as-is under the `FormField` / `FormNode` split, or is the
  cascade rebuilt around the binding?
- ~~Does the cursor need to accept string paths as well as typed navigation?~~ **Yes** —
  goal 6 forces it (`node.at<string>("street")`), and the bridging renderers (`SetField`
  adornment, `searchField`, `pageIndexField`) need it anyway.
- Do adornments survive in the JSX path, or does composition replace them
  (`<HelpText><TextField …/></HelpText>` rather than an `adornments: []` entry)?
- SSR/hydration: the JSON path's async (jsonata) resolution needs the deferred `runAsync`
  queue. Does the JSX path avoid the problem entirely by having no async expressions?
- **A third implementation is the only real test.** Building `forms-html` and
  `forms-native` alone will produce a contract accidentally shaped like "DOM, plus RN".
  Sketching `forms-mui` early — even partially — is what will find the leaks.
