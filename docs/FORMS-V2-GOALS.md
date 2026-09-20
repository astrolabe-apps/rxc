# Forms v2 — goals

The goal statement. Get this right first; the shape follows.

**Vocabulary.** *Legacy* = the `@react-typed-forms/schemas` + `-html` stack real forms run on
in production, and the parity reference wherever this doc says "identical semantics". *The
POC* = `@rx-controls/forms` and siblings in this repo — a proof of concept that v2 replaces,
owed nothing. Neither is "v1".

Key interfaces: [`FORMS-V2-INTERFACES.md`](./FORMS-V2-INTERFACES.md). *The build* =
`poc/forms-v2`, the throwaway that put the interfaces in front of four UI libraries; anything
marked **(built)** below is something it settled, and its README has the long form.

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
   `FormProp<T> = T | ((rc) => T) | Control<T>`: a literal, a reactive derivation, or a
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

   **The primitives now have prop shapes**, derived from a survey of eight UI libraries (MUI,
   Mantine, Chakra v3, Base UI, shadcn, Ant, Bootstrap, RN Paper —
   [`FORMS-V2-INTERFACES.md`](./FORMS-V2-INTERFACES.md) §7). The test above survives contact:
   all eight have a shell and seven have a frame, so neither is our invention. Two things the
   survey changed — the control reaches the frame through a **render prop**, not children
   (four of the eight frames render their own input and accept no arbitrary child), and
   `focused`/`filled` are frame state rather than field state. Derived from published APIs
   and then built four times over (built); what stayed open is listed there.

   The two are what legacy's single `Layout` slot splits into: the label/help/error chrome is
   `FieldShell`, and the editable surface is `InputFrame` — a piece legacy never had, because
   the border sat on the `<input>` and `controlStart`/`controlEnd` were flat siblings beside
   it, so nothing owned the box. Both land in `forms-html` as that package's API, versioned
   with it.

   `required` must be a flag, never baked into the label string: MUI renders its own asterisk
   from `<FormControl required>`, so a pre-asterisked label doubles up. Chakra and Mantine
   each ship a dedicated required indicator too — it is the universal shape, not an MUI quirk.

   **The third-party path is tested for a field and a collection (built).** The built-in
   group, collection, action and display renderers exist in four implementations, and two
   renderers written from *outside* the package — `Stars`, a field, and `PetCards`, a
   collection with per-row chrome and a staged edit — reuse each implementation's chrome
   without importing it. The collection did bend the contract once, as predicted: an
   implementation cannot put a button on a row it receives as an opaque node, so elements
   arrive as `{ key, index, field, node }`. A third-party group or action renderer has not
   been written.

   **The named-prop set is the minimum, decided:** `field, id, label, required, helpText,
   startIcon, endIcon` + the four class slots. `optional` is out — the survey found it in no
   real form, so it is a wrapper until something asks. Every implementation handles every
   named prop and adding one is a contract change, so the set starts small and grows only on
   evidence.

   **`tooltip` is decided, and it is not a field prop.** Reading the three real uses settled
   it: all are on `Display` controls in `MastRegistrationsSummary` whose `displayData` is a
   bare icon — a `fa-regular person` / `fa-regular building` pair switched by Jsonata `Visible`
   expressions, plus one more — with the tooltip supplying the meaning the glyph does not
   carry. None is on a data field. (The fourth use the survey counted is the `AllControls`
   demo, which exists to exercise the renderer.) So the corpus is not asking for tooltips on
   fields; it is asking for an **accessible name on a display**, and that is where it goes:
   `DisplayProps.accessibleName`, with the loader converting a `Tooltip` adornment on a display
   to it. Whether an implementation also surfaces it visibly — MUI's `Tooltip`, a `title`
   attribute, nothing — is the implementation's call, which reproduces the Mast rendering
   without putting a portal-based tooltip, or its provider, in the contract. Details in
   [`FORMS-V2-INTERFACES.md`](./FORMS-V2-INTERFACES.md) §6.

2. **What does the loader do with JSON it cannot translate? Decided: it renders anyway, and
   returns the gaps (built).** A control no translator matched renders a visible placeholder;
   a feature no translator claimed — an adornment, a dynamic property, a `renderOptions`
   discriminator, a validator, an expression that does not compile — renders the default and
   is reported. `translateForm` returns `{ tree, warnings }`; `<JsonForm renderWarnings>` is
   one thing a host does with the list, and logging it, asserting on it in a fixture or
   failing a build over a corpus are the others. Rendering anyway is what the designer's
   preview needs — a form with one unknown widget is still worth looking at — and returning
   rather than logging is what makes every other policy possible: a `console.warn` is
   invisible in production, unavailable to a test, and impossible to put beside the control
   it is about.

   **The target the list exists to serve: the existing forms corpus translates with zero
   warnings.** That is goal 6's "identical semantics to legacy" made checkable — a run of
   `translateForm` over every production form definition, asserting an empty list, is the
   acceptance test for the loader and the burndown for building it. Until it is empty, the
   warnings are the work list; once it is, they are the regression guard. A `strict` option
   that throws on any warning is how that check runs in CI, and is the only other policy the
   library itself ships.

   **The baseline exists (built):** `poc/forms-v2/scripts/extract-corpus.ts` pulls each legacy
   app's forms *and* the schemas it renders them against (evaluating its generated
   `schemas.ts`) into `corpus/`, and `scripts/burndown.ts` runs the loader over it, reporting
   by kind and shape. 80 forms, 3,972 controls, 9 clean, **1,450 warnings** — every one of them
   loader work. Top of the list: `DisplayOnly` 375, `Inline` 205, `a/b` field-path refs 105,
   `HelpText` 69, `dynamic Display` 67, `Group` 66, `ActionData` 61, `Radio` 55. README
   findings 44–45.

   The gaps that matter are mostly not unknown *control types* — those were always visible.
   They are features on a control that translated fine and then silently lost behaviour the
   JSON asked for, which is the failure mode that is easy to ship. A jsonata compile failure
   is reportable only because building the prop is what compiles it, so the loader builds
   props at translate time rather than inside its read closures.

   The corpus will **not** be narrowed by dropping unused parts of the format. A usage survey
   across 80 forms (see *Format-usage survey* in `CLAUDE.md`) found exactly seven unused
   members across the four format enums — `SetField`, `Optional`, `UUID`, `Not`,
   `DefaultValue`, `Readonly`, `Style` — and all seven are already implemented, so dropping
   them saves nothing. A loader aimed at the legacy corpus carries essentially the whole
   format, Jsonata included (418 uses across 40 of 80 forms).
3. **Design mode and portals. Decided.** A dialog renderer's content escapes the selection wrapper —
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

   **Layers 1 and 2 are built.** Presence is pinned before dispatch, and the dialog boundary
   passes `inline: true` in design mode so the implementation renders its content in place —
   the `Dialog → Contents` substitution with zero renderer cooperation, verified in four
   implementations (interfaces §6). Layer 3 is not a build question: a third-party portal
   renderer's content escapes the canvas and the designer selects it from the tree. That is a
   designer policy, and the cost is small — a designer already needs the tree for anything
   fiddly. Closed on that basis.
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
5. **Does the JSX path need the deferred async queue? Decided: no.** The JSON path's jsonata
   resolution needs `runAsync` deferred to a commit effect or SSR and first hydration disagree
   (the POC hit this with a `Display`-typed script). A JSX form has no async expressions, and
   embedding a JSON section in a JSX form is a stated non-goal, so the loader owns the queue
   and hand-written forms never touch it.
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
  system can all be expressed. The survey in `FORMS-V2-INTERFACES.md` §7 checks that claim
  against eight of them, and finds the same two compositions in all of them.

**Goal 5 forces semantic, and the price is that "write each renderer once" is gone.** Worth
stating plainly, because it is the largest cost any goal in this document imposes.

It also makes a **third implementation the only real test of the contract.** Building
`forms-html` and `forms-native` alone produces something accidentally shaped like "DOM, plus
RN"; building `forms-mui` early is what finds the leaks — which is why the build did MUI first.

Reading eight libraries' published APIs was the cheap half of it (§7). It found two leaks — a
frame that takes `children` cannot express half the field, and MUI needs the label text a
second time to cut the notch in its own border. The build then compiled the contract against
MUI, Ant and Mantine (built), and the two shapes the survey flagged as likeliest to move were
exactly the two that did: the MUI shell→frame private channel held as predicted, and `filled`
turned out to need telling. §7 carries what changed.

Legacy reached the same conclusion from the other direction: `HtmlComponents` grew unwieldy
and is now marked *"@deprecated: Just use normal html / react-native tags"*
(`schemas/src/controlRender.tsx`), in favour of platform-specific higher-level
implementations. Its own list had already sprung a leak — `CheckButtons` sits among the nine
and is not an element, because a radio/checkbox group could not be expressed as div-plus-class.
So element-level did not hold even for goal 4 alone.

Two consequences: **NativeWind stops being a prerequisite** (see open decision 6 — it is now an
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
| `Tooltip` | `accessibleName` on the display it sits on — every real use is on an icon display; see open decision 1 |
| `Optional` | an `optional` prop |
| `Accordion` | a `<Accordion>` wrapper the loader emits |
| `SetField` | a computed-write registration — see *Settled structure* |

This is what makes the MUI implementation come out clean: there is no opaque array to split
between shell and input, only ordinary props the renderer routes — `helpText` to the shell,
`startIcon` to the `InputFrame`.

Once the renderer owns the whole field, "label adornment vs control adornment" means
nothing — the framework no longer decides where in the nesting anything lands. What remains
is loader-internal: does this translate to a prop, or to a wrapper?

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

**Two kinds of extension, and they are not the same thing:**

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
not a boolean. Hiding a region is an ordinary chrome-less group with a `hidden` prop whose
children stay **mounted** and each clear their own binding (built) — in JSX, children bind
wherever they like, so the boundary that bound the data is the only thing that knows what to
clear, and it has to be there to do it. Interfaces §8.

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

- **Two handles.** `FormField<T>` = `{ control, state(rc), $ }` — a scoped control handle
  that knows nothing of `ControlDefinition` **or `SchemaField`** (built: the only thing this
  layer ever read off a schema was a default label, and a label is a prop). `FormNode extends
  FormField<unknown>` adds `definition`, `children(rc)` and `at<T>(path)`; only the loader
  produces these.
- **Two trees, not three** — definition and data — plus a thin residual (below); there is no
  `FormStateNode`. Children resolution goes to the loader's recursion, data-node
  resolution to the cursor, scripted overrides to `FormProp`s resolved at translation.
- **The cascade is React context**, holding rc-resolvers rather than plain values, so a facet
  driven by form data reaches the leaves that read it as an ordinary control write with no
  provider re-rendering. Every boundary with a `hidden` / `disabled` / `readOnly` prop
  provides a scope narrowed from its parent's (built — interfaces §4, §8).
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
- **Containers keep every panel mounted and hide with `display:none` — never `<Activity>`.**
  `silent` lives in effects and `<Activity mode="hidden">` destroys them, so the two are
  incompatible by construction: a form region under `<Activity>` stops validating, and that is
  unsupported rather than a bug. A dev-mode guard is feasible — in a boundary's effect cleanup
  a genuine unmount has already removed the DOM node, an `<Activity>` hide leaves it connected
  — and is an implementation follow-up, not a contract question.
- **Field semantics register above the renderer boundary** — validators, `defaultValue`,
  disabled→data, computed writes. Never inside an implementation, or `silent` drops them and a
  third-party renderer could too. `clearHidden` is the exception: it belongs to the `<Show>`
  that owns the subtree, which is the only reason that needs to name one.
- **Validity needs a thin residual tree.** The data tree is not enough — non-data groups,
  per-control validators, per-node gating, array-level errors. The residual is *a control, a
  parent link, and its validators*, opt-in per group as `{ scope: true }`, built on core's
  `createDerivedGroup` / `detachFields` (built). Derived rather than a plain group because a
  scope always holds both a control and a descendant of it, so a group that wrote values
  back down would write stale data.
- **`FormProp<T> = T | ((rc) => T) | Control<T>`.** Read-only: the value binding stays a
  `FormField`. Resolve with one helper in the *consuming* renderer's tracking window. Check
  `Control` first, then `typeof === "function"`; `FormProp<SomeFn>` is unsupported.
- **Two structural primitives, plus a layout box.** `FieldShell` (label / required / help /
  error) and `InputFrame` (the editable surface, with its slots *inside* the border), both
  resolved from the active implementation. The control reaches the frame through a render
  prop, never children. An implementation builds its own built-ins on its own primitives, or
  they become a second-class path that drifts away from what it ships. Shapes, and the
  eight-library survey they come from: interfaces §7.
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

## Decided boundaries

Confirmed, not assumed. Two limits on what v2 is, two things it does not owe.

- **JSX forms need no round-trip to JSON.** They are not editable in the designer. The
  alternative — compiling a restricted JSX subset back to JSON — is a much larger project and
  nothing in the goals asks for it.
- **The designer stays on JSON.** Goal 1 making JSX primary does not make the designer
  produce JSX; it produces the same JSON it always did, and goal 6 is what makes that render.
- **No migration path from `@rx-controls/forms`.** The existing renderer set is a **proof of
  concept** — built to find out what a schema-driven renderer set needs, not to be shipped.
  v2 is a clean break that replaces it, and nothing is owed to its API, its feature coverage
  or its behaviour. Where this doc cites the current implementation, it is as **evidence about
  what a form needs**, never as a contract to preserve.
- **No legacy `@react-typed-forms/schemas` compatibility.** Handled by the compat engine
  (`packages/compat-controls`); out of scope here.
