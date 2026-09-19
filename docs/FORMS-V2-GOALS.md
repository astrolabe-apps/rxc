# Forms v2 — goals

The goal statement. Get this right first; the shape follows.

**Vocabulary.** *Legacy* = the `@react-typed-forms/schemas` + `-html` stack real forms run on
in production, and the parity reference wherever this doc says "identical semantics". *The
POC* = `@rx-controls/forms` and siblings in this repo — a proof of concept that v2 replaces,
owed nothing. Neither is "v1".

Key interfaces: [`FORMS-V2-INTERFACES.md`](./FORMS-V2-INTERFACES.md).

**JSX first.** A form is React. JSON is an input format that loads onto the same surface —
downstream of the design, not alongside it. No renderer knows JSON exists. This is the
inversion of how forms work today, and the goals below are ordered by it: 1–3 say what a form
*is*,
4–5 what it is independent of, 6–7 what JSON gets.

## Goals

1. **JSX authoring.** A form is ordinary, type-safe React. Not a JSON literal in disguise,
   not a builder DSL. **The JSX surface defines the renderer contract** — props are designed
   for an author writing them by hand, not to be a superset of `ControlDefinition`.

2. **Props are reactive by default.** Every prop a form component takes is a
   `FormProp<T> = T | ((rc, ctx) => T) | Control<T>`: a literal, a reactive derivation, or a
   control to bind to. Making one prop dynamic never means restructuring the component tree
   around it, and it is the same mechanism for `label`, `disabled`, `options` and
   `className`. See *Settled structure*, below.

3. **Form semantics are a property of the form, not of what is on screen.** Three
   commitments:
   - validators are declared **at the usage**, on the component (`<Stars required/>`,
     `<TextField validate={…}/>`) — **never inherited from the `SchemaField`**;
   - **every field semantic registers above the renderer boundary** — validators, defaults,
     disabled→data, computed writes — so no renderer implementation can drop one, and a
     third-party renderer set gets them right by construction;
   - content that is live but not currently rendered — an inactive tab, a wizard page not yet
     reached, rows off the current grid page — **still validates, and still computes**.
     Content that is *hidden* does not, and gets `clearHidden`. Those are different states and
     the framework carries both. Mechanism: *Settled structure*, below.

4. **Platform independence.** The same form source renders on HTML and React Native, for the
   **built-in renderer set**. A host's custom renderer may be platform-specific.

5. **Implementation independence.** No renderer implementation is baked into form source;
   Tailwind HTML, MUI, RN Paper, or a host's own design system are swapped at the root.

6. **JSON loads onto the JSX surface.** Existing `ControlDefinition` / `SchemaField` JSON, as
   emitted by `Astrolabe.Schemas`, renders with **identical semantics to legacy** — the
   `@react-typed-forms/schemas` stack those forms run on in production. But it does so
   through a *loader*: the loader is the only code that reads a `ControlDefinition`, and what
   it produces is what a JSX author would have written by hand. "Second class" means
   architecturally downstream, **not** lower quality or best-effort.

7. **Visual designer.** A designer edits the JSON format and previews forms live, against
   **any web implementation**. It is **reimplemented** against the new renderers, not carried
   over. Web-only: it consumes goals 1/5/6 but not goal 4. What it actually requires of the
   forms library is only **editing mode** and **preview** — see *What the editor needs from
   the forms library is small* below.


## Open decisions — pick up here

Nothing below is settled. In rough order of how much else depends on it:

1. **The renderer-facing API surface — what is left of it.** The level is settled (semantic,
   not element-level — see *The contract is semantic* below) and so is the shape: a renderer
   owns the **whole field**, and gets

   1. the binding — `FormField<T>`, `state(rc)`;
   2. the controllers — `useTextInput`, `useNumberInput`, `useSelectController`, … (already
      extracted in the POC);
   3. flat POJO props — `field`, `id`, `label`, `required`, `helpText`,
      `startIcon`/`endIcon`, and the four class slots (below), plus renderer-specific. Flat
      because an extension composes with `<Shell {...p}>`;
   4. **structural primitives resolved from the active implementation** —
      `useFieldShell()`, `useInputFrame()`, a layout box. This is what lets a third-party
      `Stars` renderer reuse MUI's `FormControl` chrome without importing MUI.

   A primitive earns its place only when **both the JSON and JSX paths need it and it cannot
   be expressed as a renderer** — which admits `FieldShell`, `InputFrame` and a layout box,
   and excludes `Text` / `Pressable` / `View` (goal 4 scopes portability to the built-in set).

   `Layout` does **not** survive. With the renderer owning the field, the framework wraps only
   presence and design-mode chrome, so `Layout` becomes `forms-html`'s own `FieldShell` under
   its current name — that package's API, versioned with it. The compare app already replaces
   `HtmlLayout` wholesale, which is evidence it was never framework-shaped.

   `required` must be a flag, never baked into the label string: MUI renders its own asterisk
   from `<FormControl required>`, so a pre-asterisked label doubles up.

   **Only tested against a data renderer.** The contract above was checked end to end against
   a custom field widget. A group renderer (children resolution), a collection renderer (array
   actions, and how a custom one would reach the staged-edit controller) and an action renderer
   have not been walked, and the collection case is the likeliest to force a change.

   Still open: **which named props are in the set.** Proposed minimum —
   `field, id, label, required, helpText, startIcon, endIcon` + the four class slots. `tooltip`
   and `optional` are the next candidates and are left out for now: the survey found `Tooltip`
   in one real form and `Optional` in none, so both can be wrappers until something asks. Every
   implementation handles every named prop and adding one is a contract change, so the set
   starts small.

2. **What does the loader do with JSON it cannot translate?** Goal 6 makes this a policy
   question rather than an architectural one — fail loudly, render a placeholder, or refuse
   to load. It also bounds what the designer (goal 7) can offer.

   It will **not** be narrowed by dropping unused parts of the format. A usage survey across
   80 forms (see *Format-usage survey* in `CLAUDE.md`) found exactly seven unused members
   across the four format enums — `SetField`, `Optional`, `UUID`, `Not`, `DefaultValue`,
   `Readonly`, `Style` — and all seven are already implemented, so dropping them saves
   nothing. A loader aimed at the legacy corpus carries essentially the whole format,
   Jsonata included (418 uses across 40 of 80 forms).
3. **Design mode and portals.** A dialog renderer's content escapes the selection wrapper —
   and legacy does not solve this. Its editor **forks the render pipeline**:
   `FormControlPreview` re-implements `renderControlLayout`, renders adornments itself, injects
   sample data and forces `hidden: false` / `clearHidden: false`; there is no `createPortal`
   anywhere, and where a renderer must know, legacy just tells it (`showInline || designMode`).
   v2 can do neither — a fork means a third-party MUI set does not work in the designer, which
   is goal 7's whole point.

   Proposed, all in dispatch, in three layers:

   1. **Hidden → shown.** Design mode pins presence to `rendered`. Already dispatch-level.
   2. **Conditional containers flatten by substitution.** In design mode the dispatcher
      resolves a render type to a flattening equivalent — `Dialog → Contents`,
      `Tabs → all panels stacked`, `AccordionGroup → all expanded`, `Wizard → all pages`. The
      renderer never knows; the dispatcher picked a different one. This is the `silent`
      machinery inverted — "render everything" rather than "render nothing, still validate" —
      and it covers every built-in with zero renderer cooperation.
   3. **Unknown third-party portal renderers stay opaque.** A custom MUI `Dialog`-based
      renderer cannot be flattened by a table that has never heard of it. The canvas shows the
      trigger and its contents are selected from the **tree panel** instead. A renderer may
      opt in by declaring a flattened variant — progressive enhancement, never a requirement.

   The cost is layer 3, and it is small: a designer already needs the tree for anything fiddly.
4. **Class slots — four targets, two merge modes.** Not a build-time question: an
   implementation assumes its classes are defined somehow. The content is *where each lands*
   and *how it combines*, and the corpus (3,700 uses across 80 forms) shows all four in
   earnest:

   | JSON | lands on | uses |
   |---|---|---|
   | `styleClass` | the input / control | 1550 |
   | `textClass` | text content — a display value, a button's text | 1477 |
   | `layoutClass` | the shell | 636 |
   | `labelClass` | the label container | 39 |

   Each combines with the implementation's own class for that slot. **Two modes, both real:**
   *merge* (append to the implementation's class) and *replace*. Replace is spelled today as an
   `@ ` prefix inside the string (`getOverrideClass` / `rendererClass` in
   `packages/forms-react-core/src/className.ts`) and appears **1216 times** — roughly a third
   of all class usage. It is a first-class mode expressed as a sentinel, and v2 should type it:
   `ClassValue = string | { replace: string }`, with the loader converting `"@ foo"`.

   The merge itself has to happen **inside** the implementation, since only it knows its own
   class for the slot — so the contract ships a helper rather than a pre-merged string.
   Non-class implementations (MUI's `sx`) map or ignore these, as with `className` generally.

   Left open, and `forms-html`'s business rather than the contract's: whether to merge with
   `tailwind-merge` so an appended class actually wins. Authors currently force it with `!`
   prefixes — `!text-accent` alone appears 171 times.
5. **Does the JSX path need the deferred async queue?** The JSON path's jsonata resolution
   needs `runAsync` deferred to a commit effect or SSR and first hydration disagree (the POC
   hit this with a `Display`-typed script). A JSX form has no async expressions — so does it
   avoid the problem entirely, or does an embedded JSON section drag it back in?
6. **Do `forms-html` and `forms-native` share renderer source, or just a contract?** A
   semantic contract means each implementation writes its own renderers, so this is no longer
   an architectural fork — it is whether those two particular packages can share source by
   both being Tailwind-shaped, which is what NativeWind v5 (an RC) would gate. Sharing is an
   optimisation *inside* two packages; not sharing costs duplicated renderer source and
   nothing else. Either way NativeWind stops being a prerequisite for the design.

Settled, and no longer open here: *what carries the cascade in a JSX form*, *does
`FormStateNode` survive*, and *how adornments behave when a panel renders nothing* (they are
chrome, they are skipped, and that matches legacy). See *Settled structure*, below.

## Consequences worth deciding early

**From JSON being downstream (goal 6):** the renderer contract is no longer obliged to
express everything `ControlDefinition` can say. Anything JSON can express that JSX cannot is
the *loader's* problem — it translates or it fails — rather than a reason to widen the prop
contract for every renderer. That is the main thing the inversion buys, and it is why goal 6
is a commitment about semantics rather than about the contract's shape.

It also means JSON compatibility is a property of one package, which can be versioned,
tested and replaced on its own. The `ControlDefinition` type stops being an architectural
concept and becomes an input format.

**The contract is semantic, not element-level — and that is goal 5's price.** There are two
places the platform seam can sit, and legacy tried the other one:

- **Element-level.** Abstract `Div`, `Span`, `Input`, `Label`… and write each renderer *once*
  against them plus class strings. Legacy's `HtmlComponents` is exactly this — nine entries,
  with `schemas-rn` supplying NativeWind-backed React Native versions. It satisfies goal 4
  cheaply. It cannot satisfy goal 5: MUI's composition is not div-plus-className shaped, so an
  MUI implementation cannot be expressed at all.
- **Semantic.** Abstract `FieldShell`, `InputFrame`, a layout box — compositions, not
  elements. Every implementation writes its own renderers; MUI, RN Paper and a host design
  system can all be expressed.

**Goal 5 forces semantic, and the price is that "write each renderer once" is gone.** Worth
stating plainly, because it is the largest cost any goal in this document imposes.

It also makes a **third implementation the only real test of the contract.** Building
`forms-html` and `forms-native` alone produces something accidentally shaped like "DOM, plus
RN"; sketching `forms-mui` early is what finds the leaks. The walkthrough is a first pass at
exactly that.

Legacy reached the same conclusion from the other direction: `HtmlComponents` grew unwieldy
and is now marked *"@deprecated: Just use normal html / react-native tags"*
(`schemas/src/controlRender.tsx`), in favour of platform-specific higher-level
implementations. Its own list had already sprung a leak — `CheckButtons` sits among the nine
and is not an element, because a radio/checkbox group could not be expressed as div-plus-class.
So element-level did not hold even for goal 4 alone.

Two consequences: **NativeWind stops being a prerequisite** (see open decision 5 — it is now an
internal question for two packages, not an architectural fork), and **platform-specific
degradation is normal rather than exceptional**. `Grid` is the worked example: the RN renderer
chunks children into rows of N and gives each cell `flex-1` or a per-column class
(`schemas-rn/src/components/GridRenderer.tsx`), which renders correctly but loses cross-row
column alignment unless widths are fixed, and loses column spanning. That is a different
renderer, not a broken one.

**The schema describes the data; the form describes what it demands of that data.** So
`required` and every other validator is declared at the **usage** and never defaulted from the
`SchemaField`. A wizard page, a search form and a draft-save flow over one schema demand
different things of it, and a form may deliberately capture a partial value — so inheriting
requiredness from the field would make some legitimate forms unbuildable and silently change
validity in others.

That is already how the JSON path behaves: `DataControlDefinition.required` is per-control, two
controls on the same field can differ, and `createValidators` reads only `def.required` /
`def.validators`. The survey confirms `SchemaField.required` and `SchemaField.validators` are
never read by the client at all. Whatever they exist for on the server, v2 does not inherit
them.

The schema still supplies what the *data* is — type, collection, options, and `displayName` as
a label default. The split is: a label default is harmless and overridable; a validator default
silently changes whether the form can be submitted.

**Adornments do not exist at the JSX level.** "Adornment" is a *JSON format* concept. The
loader translates each one into whatever is natural in JSX, and the renderer contract never
sees the word:

| JSON adornment | becomes |
|---|---|
| `HelpText` | a `helpText` prop |
| `Icon` | a `startIcon` / `endIcon` prop |
| `Tooltip` | a `tooltip` prop |
| `Optional` | an `optional` prop |
| `Accordion` | a `<Accordion>` wrapper the loader emits |
| `SetField` | a computed-write registration — see *Settled structure* |

This is what makes the MUI walkthrough come out clean: there is no opaque array to split
between shell and input, only ordinary props the renderer routes — `helpText` to the shell,
`startIcon` to the `InputFrame`.

**A lot of machinery goes with it.** `AdornmentKind` (`label` / `control` / `field`),
priority-ordered `wrapAdornments`, `indexAdornments`, the whole wrap order — all of it exists
only because the framework owned composition and had to decide where in the nesting each
adornment landed. Once the renderer owns the whole field, "label adornment vs control
adornment" means nothing. What remains is loader-internal: does this translate to a prop, or
to a wrapper?

**What is lost** is adornments as an *open* extension mechanism — a custom decoration
applicable to any control. Two reasons that is acceptable: the survey found exactly one
genuinely custom adornment across 80 forms (`Spotlight`), against `HelpText` at 69 uses; and
the wrapping case survives as plain composition — `<Spotlight><TextField/></Spotlight>` is more
natural in JSX than a registration. Only the *inject-into-the-renderer's-internals* case needs
a named prop, and that case is inherently renderer-specific, which is why it could never have
been a wrapper.

**The tradeoff**: the named-prop set becomes a negotiation point — every implementation handles
every prop, and adding one is a contract change, where an open array absorbed new kinds for
free. It is the same bargain goal 4 already strikes: the set need only cover what *built-in*
renderers need, and anything past it is a platform-specific renderer.

**Two kinds of extension, and they are not the same thing.** Conflating them is what made
the registry question look hard:

1. **Renderers** — components that know the library's vocabulary (`FormProp`, the scope
   context, the field binding, the shared controllers). A renderer is an ordinary component:
   an application imports it, and type safety is free. If it wants to be swappable — a
   Tailwind and an RN variant of the same widget — **it declares its own React context and
   provider**. The framework supplies nothing for this and owes nothing; composing several
   providers is normal React, not an architectural problem. If it does not want to be
   swappable it is platform-specific, which goal 4 already permits.

2. **Translators** — JSON in, JSX out. They exist only because of goals 6 and 7, and they
   carry a half renderers do not: **`SchemaField`s describing their `renderOptions`**. Those
   are what make a custom render option *scriptable* (the POC wires them through
   `schemaExtensions` on plugin specs plus `collectExtraRenderOptionFields`), and the designer
   edits the option off the same declaration. So a translator's surface is *matcher +
   `renderOptions` schema fields*.

The pairing is clean: a JSX-only widget needs (1) alone; a widget that must also appear in
designer-built forms needs both, and they can ship separately — the component long before the
designer knows about it.

**One constraint this imposes, and it is easy to violate:** a translator may return opaque
JSX, which the dispatch layer cannot inspect. That is fine for design-mode chrome and for
`silent` — both wrap or suppress — but **not** if the returned component is what registers the
field's validators, since a third-party renderer could then drop them and break goal 3. So:
**the `FormField` is created by the library and handed to the renderer as a prop; a translator
never binds one.** Semantics register at binding time, above the element, and survive whatever
the translator returns.

**From goal 4 being scoped to the built-in set:** the neutral prop contract only has to be
neutral for built-in renderers. A host needing MUI `variant` or `<input type="tel">` writes
a platform-specific renderer instead of widening the contract for everyone — which
substantially relieves the pressure on the contract's design.

"Platform-specific" means *two implementations*, not *not portable*. A stars widget draws
`<div>`s on web and `Pressable`/`Text` on native — neither of which is in the structural set —
so its package ships both and the app registers the one for its platform, or the package
resolves it through `exports` conditions or React Native's `.native.tsx`. The form source is
unchanged; only the packaging differs. What is genuinely lost is a *single* implementation, and
dispatch must fail visibly when a platform has none rather than silently render nothing.

**What the editor needs from the forms library is small.** Two things, and they are the same
code path with a flag:

1. **Editing mode** — the form rendered for authoring: hidden fields shown anyway, actions
   stubbed, selection chrome around each control.
2. **Preview** — the same form rendered as an end user would see it.

Everything else the editor is — the definition tree, toolbars, undo, layout — is its own React
app and needs nothing from forms. Two things follow that *are* library concerns: **design mode
lives in the dispatch layer** (see the next consequence — it is the whole of requirement 1),
and **`ControlDefinition` / `SchemaField` must be live reactive values**, since the designer
edits them in place and both views re-render from them (the `trackedValue` adaptation listed
under "Open for redesign" in `CLAUDE.md`).

**The property panel stays metadata-driven, as it works today.** Preferred rather than
required, and cheaper than it looks:

- **An extension declares `SchemaField`s for its `renderOptions` regardless**, because that is
  what lets a custom render option be *scripted* — without the field, `createEvaluatedDefinition`
  cannot register it and no dynamic property can target it. The panel then comes free off
  metadata that has to exist anyway. An extension shipping its own panel component would be
  *additional* work, not a substitute.
- **The metadata is implementation-neutral.** An extension that declares fields is not tied to
  one editor's design system, which is the same instinct as goal 5.
- **It is generated, not maintained.** `schemaSchemas.ts` comes from the C# `CodeGen/Schemas`
  endpoint (`genschemas` in `forms/core/package.json`) off the same `Astrolabe.Schemas` types
  that define the JSON format, so it cannot drift from the contract. Its line count is build
  output, not a cost.
- **Metadata-driven does not mean generic.** Legacy already layers custom renderers onto
  specific fields of its own panel — field selection, class selection, script labels — using
  exactly the extension mechanism above.

So a translator's surface is **matcher + `renderOptions` schema fields**, as in *Two kinds of
extension* above. An extension supplying its **own** panel component for a genuinely rich case
— a colour picker, a query builder — is a plausible later addition and deliberately not
designed now.

One thing that does *not* follow from any of this: the panel is not obliged to be built the way
legacy builds it. Legacy renders `ControlDefinitionForm`, a 33KB `ControlDefinition.json`, over
the generated schema map — pointing the form engine at itself for the **core** of
`ControlDefinition` as well as for extensions. Under goal 1 that core could equally be
hand-written JSX with a metadata-driven slot for extension options. Both work; the choice is
the editor's, not the library's.

**From goal 7 previewing *any* web implementation:** design mode cannot be something a
renderer author has to implement — a third-party MUI set will not have thought about it.
So design mode has to live in the **dispatch layer**, above renderers, which looks
achievable for all three of its behaviours:

- *render hidden fields anyway* — presence is decided by the cascade before dispatch;
- *stub actions* — the handler is a prop, substituted before dispatch;
- *selection chrome* — a wrapper element with an absolutely-positioned overlay around
  whatever the renderer emitted. This is the one that genuinely needs web, and is the
  strongest reason the web-only restriction is worth keeping.

**This is the same argument goal 3 needs**, and it is not a coincidence: "renders nothing but
still validates" is also something no third-party renderer will have implemented, so it also
lives in dispatch. Two goals, one boundary — which is a good sign the boundary is in the
right place.

The residual cost is real but narrower: `ControlDefinition` / `SchemaField` must be exposed
as live reactive values, since the designer edits them in place (the `trackedValue`
adaptation listed under "Open for redesign" in `CLAUDE.md`).

**From goal 3's split between hidden and not-rendered:** the cascade carries three states,
not a boolean — and one of them falls out for free. In JSX, a `<Show>` that declines to
render its children means those children register no validators at all, which *is*
validation suppression. So `<Show>` needs to name its subtree only for `clearHidden` and the
disabled→data write, which is a much weaker justification for the prop than the JSON cascade
gave it. Worth re-testing before the prop is committed to.

**Embedding a JSON section inside a JSX form is not a goal.** It looks achievable and may well
happen, but nothing requires it, so nothing is designed for it. The cost it would carry is
worth recording so the decision is re-made deliberately rather than drifted into: an embedded
section is not two forms side by side — validity, presence, disabled and touched would have to
cascade across the seam in both directions, which means **the loader must be rootable at an
arbitrary `FormField`**, not only at a form root. That is the expensive requirement, and
dropping the goal drops it.

**The other direction was never part of it.** "A JSON form dispatches to a hand-written
component" is just a translator — so it is goal 6 plus the extension model, not an interop feature, and it is not optional.

One thing that survives regardless, because it belongs to translators rather than to embedding:
**the JSON↔TypeScript seam is untyped.** A `FormField` off a `FormNode` is
`FormField<unknown>`; a translator handing it to a typed renderer cannot prove the match. The
narrowing step is a **checked** cast that throws naming the path and both types — not a bare
`as`. One helper, used at every translator boundary.

And with embedding off the table, goal 1 gets a cleaner claim: **hand-written forms avoid the
expression engine outright.** `$scripts`, `dynamic`, `EntityExpression` and jsonata exist only
because JSON cannot compute; in JSX you write the computation, and no JSX form drags them back
in.

## Settled structure

Decided, and the input to the interfaces doc. Reasoning is in the conversation, not repeated
here.

- **Two handles.** `FormField<T>` = `{ control, schema, state(rc) }` — the binding, knows
  nothing of `ControlDefinition`. `FormNode extends FormField<unknown>` adds `definition`,
  `children(rc)` and `at<T>(path)`; only the loader produces these.
- **`FormStateNode` does not survive.** Three trees become two — definition and data — plus a
  thin residual (below). Children resolution goes to the loader's recursion, data-node
  resolution to the cursor, scripted overrides to `FormProp`s resolved at translation.
- **The cascade is React context**, holding `Control<Presence>` / `Control<boolean>` rather
  than plain values, so an ancestor toggle re-renders only the leaves that read it. Each
  `<Show>` / `<Disabled>` provides a scope derived from its parent's.
- **Three presence states**, not a boolean:

  | state | renders | validates | `clearHidden` |
  |---|---|---|---|
  | `rendered` | yes | yes | no |
  | `silent` | no | **yes** | no |
  | `hidden` | no | no | yes |

  `silent` exists because *unmounted is not hidden* — if it were, switching tabs would run
  `clearHidden` and wipe what you typed. It is produced by the containers that render a subset
  of their children: tabs, wizard pages, off-page grid rows. Everything else mounts.
- **`silent` lives in the dispatch layer**, so no renderer implements it: a leaf runs its
  hooks, registers, and returns `null`; a container returns `<>{children}</>` instead of
  calling the group implementation.
- **Field semantics register above the renderer boundary** — validators, `defaultValue`,
  disabled→data, computed writes. Never inside an implementation, or `silent` drops them and a
  third-party renderer could too. `clearHidden` is the exception: it belongs to the `<Show>`
  that owns the subtree, which is the only reason that needs to name one.
- **Validity needs a thin residual tree.** The data tree is not enough — non-data groups,
  per-control validators, per-node gating, array-level errors. The residual is *a control, a
  parent link, and its validators*; core's `createControlGroup` / `attachFields` already
  aggregate validity across independently-owned controls.
- **`FormProp<T> = T | ((rc, ctx) => T) | Control<T>`.** Read-only: the value binding stays a
  `FormField`. Resolve with one helper in the *consuming* renderer's tracking window. Check
  `Control` first, then `typeof === "function"`; `FormProp<SomeFn>` is unsupported.
- **Parent-needs-child-state is not element introspection.** "Is anything below me invalid" →
  the control tree, which already bubbles. "Are all my children hidden" → children register
  into a parent-provided control on mount. Reading a child's `FormProp` from the parent is an
  escaped read.

## Proposed package layout

```
@rx-controls/core           unchanged, published
@rx-controls/react          unchanged, published
@rx-controls/forms-schema   SchemaField + ControlDefinition JSON types, builders. No React.
@rx-controls/forms-state    FormField/FormNode, cascades, validators, expressions. No React.
@rx-controls/forms-react    THE contract: dispatch components, structural primitives,
                            controllers, prop types, the loader's registry. No DOM,
                            no class strings.
@rx-controls/forms-html     the HTML implementation
@rx-controls/forms-native   the React Native implementation
@rx-controls/forms-mui      an MUI implementation — the contract's real test
```

A form imports from `forms-react` and nothing else.

## Assumed, not stated — confirm or cut

- **JSX forms need no round-trip to JSON.** They are not editable in the designer. The
  alternative — compiling a restricted JSX subset back to JSON — is a much larger project.
- **The designer stays on JSON.** Goal 1 making JSX primary does not make the designer
  produce JSX; it produces the same JSON it always did, and goal 6 is what makes that render.

## Explicit non-goals — confirm

- **Migration path from `@rx-controls/forms`.** The existing renderer set is a **proof of
  concept** — built to find out what a schema-driven renderer set needs, not to be shipped.
  v2 is a clean break that replaces it, and nothing is owed to its API, its feature coverage
  or its behaviour. Where this doc cites the current implementation, it is as **evidence about
  what a form needs**, never as a contract to preserve.
- **Legacy `@react-typed-forms/schemas` compatibility.** Handled by the compat engine
  (`packages/compat-controls`); out of scope here.
