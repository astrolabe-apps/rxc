# forms-v2 POC — the v2 contract, four implementations

Throwaway. A Vite app, and a Rush project — it started outside Rush on plain npm
and moved in once it needed the workspace's own `@rx-controls/core` rather than
the published one (finding 37). It exists to put
`docs/FORMS-V2-INTERFACES.md` in front of real UI libraries and find out where
the interfaces bend.

```bash
rush update
rushx dev          # http://localhost:5183, from this directory
rushx typecheck
rushx extract-corpus <name> <src-dir>   # a legacy app's forms + schemas → corpus/<name>/
rushx burndown [<dir-or-file>...]       # the loader over ./corpus (default); --json, --strict
```

`corpus/` is gitignored — derived from other repositories. To rebuild it, point
the extractor at each legacy app's source directory (the one holding
`schemas.ts` and its pairing file). On the machine this was built on:

```bash
rushx extract-corpus servicetas   ~/astrolabe/ServiceTas/ServiceTasAPI/NewClientApp/client-common
rushx extract-corpus forms-app    ~/astrolabe/astrolabe-common/forms-app/src
rushx extract-corpus testtemplate ~/astrolabe/astrolabe-common/Astrolabe.TestTemplate/ClientApp/sites/formServer/src
rushx burndown
```

Both scripts typecheck the whole POC first, so they need a **built** `@rx-controls/core`
— `rush build --to @rx-controls/core` after a fresh clone, or the `tsc` pass fails on
`createDerivedGroup` against a stale `lib/`.

83 forms, 4,283 controls, **1,734 warnings**. Re-extracted 2026-09-24: the legacy
sources move under us, and that run picked up three ServiceTas forms added upstream
(`MastEoiRegistrationWizard`, `SeniorsCardApplicationForm`, `RenderTestForm`), which
carry 130 warnings over 284 controls between them and took the count 1,674 → 1,822
with no loader change. Finding 56 (Radio, and `dynamic Display` on displays) took it
1,822 → 1,734. Kind totals: `unread` 524, `action` 489, `renderOptions` 409,
`adornment` 129, `dynamic` 80, `schema` 55, `control` 37, `validator` 11.

## What it builds

All six boundaries — `fieldRenderer`, `collectionRenderer`, `groupRenderer`
(with and without `{ scope: true }`), `actionRenderer`, `displayRenderer` and
the options widgets — over the contract: `FormProp`/`getProp`,
`ClassValue`/`mergeClass`, `Control<T>` bindings with `FieldState`/`useFieldState`, derived `Presence` with
the `hidden`/`disabled`/`readOnly` props, `<Form>`, `<Contents>`, `<Elements>`,
the validation scope on core's `createDerivedGroup`, keyed validators,
per-boundary `clearHidden`, `arrayActions`, `<Action>` for every button + `StandardActionIds`,
the two structural primitives, the `visibility` slot, and the registry. On top
of that: a tab container, a wizard, the staged-edit modal, and a JSON loader
that returns what it could not translate.

| | |
|---|---|
| `src/framework/` | the contract (§1–§10 of the doc) |
| `src/loader/` | the JSON loader — translators, expressions, `translateForm`, `<JsonForm>` |
| `src/loader/CorpusDemo.tsx` | the **Legacy form** tab: any extracted `corpus/servicetas/*.json` through `<JsonForm>` under the active implementation, with the loader's warnings on a toggle. A presentation aid; renders a note when no corpus is extracted |
| `src/impls/html.tsx` | family 1 — children-hosting, class-driven (Bootstrap / shadcn shaped) |
| `src/impls/mui.tsx` | family 2, hardest case — self-rendering input, notched outline |
| `src/impls/antd.tsx` | family 2 — `Form.Item` standalone, runtime theme tokens |
| `src/impls/mantine.tsx` | family 2 — `Input.Wrapper` wired by `id`, polymorphic `Input` |
| `src/widgets/Stars.tsx` | a **third-party** widget: no UI library, own surface, `fieldRenderer(MyImpl)` |
| `src/widgets/PetCards.tsx` | a **third-party collection**: per-row chrome from the implementation's buttons, staged edit, a callback prop |
| `src/widgets/Collapsible.tsx` | a **third-party group**: a disclosure section over the implementation's `contents`, invalid badge from `{ scope: true }`, forced open in design mode |
| `src/widgets/SelectChild.tsx` | a **third-party `silent` container**: legacy's SelectChild, the active branch chosen by data; no registry slot, no translator (zero corpus uses) |
| `src/App.tsx` (`FancyAdd`) | a **third-party action**, installed for one id through `ActionOverrideProvider` |
| `src/PersonForm.tsx` | the form source — identical under all four |

Not built, and not pretended: Base UI; the loader's `Dialog` group translator.

## What held up

- **The form source is implementation-independent.** `PersonForm.tsx` names no
  library; the switcher swaps all four at runtime.
- **The primitives carry a third party.** `Stars` imports nothing from MUI, Ant
  or Mantine and gets each one's label, required marker, help text and error
  chrome. This is §7's central claim and it survives contact. Every boundary
  kind has now been written from outside the package — a field, a collection,
  an action and a group — and the group was the one that bent something
  (finding 55). A `silent`-producing container can be written outside too,
  with nothing exported for it (finding 57).
- **MUI's notch works through a private context**, exactly as §7 predicted:
  `forms-mui` passes the label shell→frame itself, and the contract stays clean.
- **Presence is real, and derived.** A `hidden` prop narrows it; a container —
  the demo's `Panel`, standing in for a tab panel — is the only thing that sets
  `silent`. `silent` leaves the screen and keeps publishing errors; `hidden`
  clears them and, under `<Form clearHidden>`, clears the value too.
- **Validators cannot be dropped by an implementation** because they are
  registered before dispatch and no implementation ever sees them.
- **`Resolved<P>` is expressible** — but not the obvious way; see finding 6.

## Findings

Numbered; each is cited at the matching line of code.

1. **`FormRenderers` needs a root slot.** Mantine *requires* `MantineProvider`,
   Ant wants `ConfigProvider`, MUI wants `CssBaseline`/a theme. An
   implementation is not a bag of components. `<FormProvider>` mounts
   `renderers.root` so the app never learns which library needs what.

2. **`FieldRenderProps` needs `error`.** §5 omits it, §7 says the shell's
   `error` is "resolved by the boundary, never by the impl" — but the *impl*
   renders the shell, so it has nowhere to get it from. Carrying it on the
   render props is also what makes the documented `<Shell {...p}>` spread work,
   since the two types then line up slot for slot. Whether the error is shown
   *at all* (here: only once touched) stays boundary policy.

3. **Three props the primitives cannot do without.**
   - `FieldShellProps.disabled` — MUI's `FormControl` greys its own label and
     helper text from it, and nothing else tells it.
   - `InputFrameProps.id` + `describedBy` — `ControlSlotProps` already carries
     both in §7, which only works if the frame is told them. MUI's
     `OutlinedInput` takes `id` and passes it down itself.
   - `InputFrameProps.filled` — §7 lists this as open ("whether `filled` can be
     reported without the frame owning the value"). **It cannot.** MUI's shrink
     and notch and Mantine's sizing both need it, and no frame in the survey
     ever sees a value. The caller knows; the caller tells it. The MUI frame
     then feeds `InputBase` a placeholder `value` purely to drive that state —
     ugly, private, and contained.

4. **Field state is control plus scope, not a property of the control.**
   `FieldState.readOnly` has no home on a `Control`, and `disabled` folds in
   the enclosing scope's, so the boundary computes it from both
   (`fieldState(rc, control, scope)`) and publishes its scope around the
   implementation so a `useFieldState` there agrees with it. An earlier cut
   carried the scope on the binding instead — finding 19 is where that was
   undone.

5. **The scope holds rc-resolvers, not values.** The win is narrower than it
   first looks — every boundary reads every facet, so a flip re-renders them
   all either way. What it buys is that a facet driven by *form data* (a
   `hidden` expression, which is what 599 `Visible` uses are) arrives as an
   ordinary control write, with no provider component re-rendering a subtree to
   deliver it. Narrowing is then function composition.

6. **`Resolved<P>` works, but only written backwards.** `X extends
   FormProp<infer T>` infers `T` as the whole union, because `FormProp`'s bare
   `T` member is a naked type parameter that absorbs everything. Testing the
   *reactive* shapes first and falling through (`X extends (rc) => infer T ? T :
   X extends Control<infer T> ? T : X`, distributing) gives the right answer.
   The cost is runtime, not types: the boundary resolves unknown extra props by
   calling `getProp` on each, so **any function-valued renderer prop is invoked
   with an `rc`**. `ActionProps.onClick` is already typed as a plain function in
   §5, so this bites the moment a field renderer wants a callback. Either extras
   stay unresolved (and the implementation calls `getProp` in its own window,
   which is what §1 prefers anyway) or the contract needs a way to mark
   pass-through props.

7. **Controllers can own the render boundary.** `useTextInput(field)` returns
   `rc` and `rendered` along with the value and handlers. An implementation is
   one component with one tracking window, so this removes the `useReactive()`
   ceremony from every renderer and with it a way to get the boundary wrong.

8. **The frame's render prop runs in the frame's window, not the caller's.**
   By the time `render(slot, state)` is called the calling implementation has
   already reconciled, so a reactive read inside that callback subscribes to
   nothing and silently never updates — the same bug shape the compat package
   hit with `RenderArrayElements`. Capture values before, read nothing inside.
   If §7 keeps the render prop (and finding 10 says it must), this needs saying
   in the doc.

9. **The shell must be told whether a frame is inside it.** MUI has two label
   components — `InputLabel` floats over an input, `FormLabel` sits above a
   radio group — and cannot tell from its children which it is. §7 has
   `labelAs: "label" | "legend"`, which is a different axis: `Stars` wants a
   `legend` *and* a static label, a framed textfield wants `label` *and* a
   floating one. Added `surface?: "frame" | "custom"`, defaulting to `"custom"`
   so a third-party widget that forgets it gets the harmless half.

10. **The control slot must reach the frame as a stable component identity.**
    MUI takes `inputComponent`, Mantine takes `component` — both want a
    *component type*, and an inline one changes identity every render, so the
    input remounts on every keystroke and focus is lost. Both implementations
    use a module-level bridge and pass the render function as data through
    props. This is a constraint on how §7's render prop can be implemented in
    family 2, and it is invisible until you type in the box.

11. **`ControlSlotProps` needs `style`.** §7 gives the slot a `className` only,
    which assumes the implementation's styles exist as class names. Ant's are
    runtime theme tokens (`theme.useToken()`), so its frame has nothing to put
    in a class. MUI is fine (emotion generates one), html is fine.

12. **Ant is what §7 finding 6 costs.** "An implementation builds its own
    built-ins on its own primitives" is right — otherwise built-ins and third
    parties drift apart visually. But Ant's `Input` renders its own `<input>`
    and hosts no arbitrary child, so an Ant frame that honours the render prop
    **cannot be `<Input>`**: it restates the affix wrapper from theme tokens and
    loses `allowClear`, `count`, `Space.Compact`, size context and addons. The
    demo renders a real `<Input>` underneath for comparison. Family 2 pays this;
    families 1 and 3 do not.

13. **Built-ins must be generic in the value type.** `fieldRenderer` produces a
    component for one concrete `T`, but a schema legitimately yields `string`,
    `string | undefined` or `string | null` for the same widget, and
    `Control<string>` is not `Control<string | undefined | null>`. `TextField`
    is declared with a generic call signature over one cast. §6's signature
    should say so.

14. **Where validators publish from interacts with when components subscribe.**
    Errors are published from a layout effect (as `@rx-controls/react`'s own
    `useValidator` does), while `useReactive` subscribes during *render*.
    Swapping the whole implementation therefore fires React's "state update on a
    component that hasn't mounted yet": the outgoing tree's cleanup clears its
    errors during the same commit in which the incoming tree has rendered but
    not yet mounted. Only reproducible by swapping implementations — no ordinary
    interaction triggers it — so it is a demo artifact, but it is pointing at a
    real seam.

15. **`hidden` needed an explicit channel into the validators.** Hooks cannot be
    conditional, so "register these validators but only while presence is not
    `hidden`" is not expressible by skipping the call. The boundary mirrors its
    resolved config onto a control (`useMirror`, a render-body write) and the
    validators read it through their own `rc`. It works and it is small, but it
    means presence is an *input to validation*, not a wrapper around it — the
    doc's §4 table reads like the latter.

16. **`clearHidden` has to be per-boundary, and that decides how hiding works.**
    The boundary that bound the data is the only thing that knows what to clear,
    so a hidden field clears itself — which means it must still be **mounted**
    while hidden. That is what killed `<Show>`: an unmounted subtree clears
    nothing, and its `for` prop could not fix it, because JSX children bind
    wherever they like and nothing ties them to the one field `for` names.
    Legacy dodges all of this because its semantics live in the `FormStateNode`
    tree rather than in React mounting; in a JSX-first design, mounting *is* the
    semantics. Verified in the demo: hide the region, the value is cleared.

17. **A hidden group has to hide with CSS, and finding that out cost a broken
    demo.** `<Contents hidden>` first rendered its children bare and its chrome
    only when visible. That is wrong twice. Changing the element at that
    position **remounts the subtree**, so no exit animation could start. And the
    children left behind include **plain JSX** — the demo's `Add pet` button —
    which nothing suppresses, because self-suppression is something only a
    boundary knows how to do. The result was a hidden region that still showed
    its Add button, and clicking it appended elements to an array the user could
    not see. Fix: the group implementation receives `hidden` and applies it to
    the element it was already rendering, so the structure never changes.

    With that settled, the region animates — and the thing I expected to block
    it does not. The collapsing region fires `transitionstart`/`transitionend`
    on `grid-template-rows` and `opacity` over 220ms, and throughout those
    220ms the field inside is still drawn, because its own `visibility`
    component is holding its last frame. The two exits compose. So `Presence`
    does **not** need a fourth cell: "renders but does not validate" is what the
    `visibility` slot already does for the length of a transition. I had this
    listed as the one unresolved conflict in the design; it was a property of
    the non-animating default visibility, not of the model.

18. **A collection is a boundary, and the bill for `<Each>` not being one was
    bigger than the bill for `<Show>`.** As a framework component it had no
    binding, so four separate things silently went missing: a `Length` validator
    on the array had nowhere to register, `clearHidden` reached the elements'
    fields but never the array, and `hidden`, the locks, design mode and the
    array-level error message did not apply at all. `<Elements>` — the
    chrome-less collection — fixes all four, and the demo shows each: `Length
    1–3` publishes *At least 1 required* on the array itself, `Add pet` greys
    out at three, and hiding the region clears the array rather than leaving a
    stale one behind.

    The three things that must not be got wrong stay in the boundary, not the
    implementation: structure-only subscription, a tracking scope per element,
    and keying by the element control's `uniqueId`. The implementation receives
    finished `ReactNode`s. `arrayActions` is a plain function taking an `rc`
    rather than a hook, so add/remove buttons can live outside the list — which
    is where the demo puts them.

19. **The staged-edit case does not justify `FormField` existing — tested,
    then removed.** Once the schema was out of it (finding 20) the handle was
    `{ control, state(rc), $ }`: a `Control` plus a `useFieldState` hook
    reading the scope from context, with one difference — it captured the
    scope at *bind* time, so a staged-edit draft rendered by a host outside
    the array's region still reported that region's lock. The build showed
    exactly that: region locked, modal outside it, the draft `readOnly: true`
    while the scope at the modal said `false`.

    The demonstration was propped up. Both Edit buttons were hardcoded
    `disabled={false}`; a collection that honours the cascade disables Edit
    under a lock, the session never begins, and the readout is unreachable.
    What is left is the region locking or hiding *while* a session is open —
    and the right answer there is not a draft turning read-only inside a
    dialog the user is looking at, it is the dialog closing. For `silent` the
    handle was actively wrong: an edit begun in a tab would have blanked its
    dialog the moment the user switched tabs.

    So: the binding is a bare `Control<T>`. `$` — a typed mirror of
    `control.fields` that existed only to keep the scope attached through
    navigation — is gone, with `bindScope`, `combineScopes`, `elementField`
    and `scopeOf`. `state` is `fieldState(rc, control, scope)`, and the
    boundary publishes its scope around the implementation so `useFieldState`
    there agrees with it (which also means a collection's rows now read the
    collection's scope rather than the one outside it). The dialog reads the
    scope where it renders, like everything else.

    The lock reaches the session through the **collection boundary**, not
    the binding. `ArrayActions` gained `canEdit` and `edit(index)`; the
    boundary builds its actions with its own scope, so every `can*` is false
    under a lock, and `edit` stamps the session with a per-instance token; an
    effect on the boundary cancels a session carrying its token when it locks
    or hides. The row callback receives those actions as a third argument so
    an author's own buttons are gated the same way, and `PetCards` no longer
    touches the controller at all. Verified in the browser: Edit and Remove
    grey out under the lock; an open edit closes the instant the lock arrives;
    an edit begun from the Cards tab — a different boundary, not inside the
    locked section — is left alone while that lock toggles.

    One more thing this found, about finding 5. The first version put the
    cancel in the controller, as a core `effect` over the origin scope's
    resolvers — and it never fired. A lock that arrives as a **React prop** is
    delivered by the boundary rebuilding its scope object on re-render; the
    effect held the old object, whose `readOnly` closed over `false`.
    rc-resolvers carry a data-driven facet for free and a prop-driven one not
    at all. The boundary's own render is the only place that sees both, which
    is why the judgement lives there.

20. **`SchemaField` is not needed at this layer.** The build settled it by
    measurement: across four implementations and both data boundaries, the only
    expression that read one was `label ?? schema.displayName`. Every other
    reference was the schema carrying itself through `$`, through element
    wrappers and through scope re-binding, so that one default stayed reachable.
    Options would have been the second reader; validators are already ruled out,
    since they are declared at the usage and never inherited from the field.

    So the binding carries no schema — and, since finding 19, no handle either:
    it is a bare `Control<T>`. `buildSchema` left the JSX path with the
    schema, because typed navigation (`control.fields`) was typed from `T`
    all along, not from the metadata. Labels are props
    now; the demo passes them, a loader would pass `displayName`. Removing it
    deleted the child-schema lookup, the element clone and the re-bind copy, and
    cost six `label=` attributes.

21. **A trailing label belongs to the shell, and a `Label` primitive would not
    have worked.** A checkbox labels itself — and the first cut let the renderer
    draw that label, which is legacy's `hidesLabel` expressed by omission and
    needs no contract support. It also had the html checkbox hand-rolling the
    label markup and a copy of the required asterisk: the shell's job,
    duplicated in a renderer, which is exactly the drift survey point 6 warns
    about. A third-party switch would have had to guess.

    A standalone `useLabel()` does not fix it, because in three of the four the
    trailing label is not a sibling: MUI's `FormControlLabel` wraps control and
    label together, Mantine takes it as a prop on the control, Ant as the
    checkbox's own child. Nothing rendered *next to* the control expresses any
    of those. What does generalise is `labelPosition: "before" | "after"` on
    `FieldShellProps`, where `"after"` also licenses the shell to wrap the
    control — one prop, no new primitive, and the renderer goes back to passing
    `label` through like everything else.

    Ant was the one expected to pay, and the measurement says it barely does: a
    sibling `<label htmlFor>` renders identically to the native `<Checkbox>Has
    pets</Checkbox>` — 14px/22px, `rgba(0,0,0,.88)`, 16px box, 8px gap — because
    the label is only text at the body font. The demo shows both, one above the
    other. The single real loss is that Ant greys its label from a class on its
    own wrapper, which a sibling never receives, so the shell maps `disabled` to
    `colorTextDisabled` itself (verified: `rgba(0,0,0,.25)` under
    `<Form disabled>`).

22. **A conditional wrapper is a remount, and I wrote three of them.** The
    boundary added its `FormEditProvider` only when something was actually
    locked, and its design chrome only in design mode — both of which look like
    free optimisations. Toggling `readOnly` therefore changed the element at
    that position, React threw away the implementation and rebuilt it, and MUI's
    floating label replayed its shrink animation while the input lost focus and
    selection mid-edit. The hidden group (finding 17) was the same bug in a
    different place.

    Both wrappers are now unconditional; the design chrome sits at
    `display: contents` when off, so it costs no layout. Verified across all
    four implementations: the input's DOM node survives a `readOnly` toggle,
    keeps focus, and survives toggling back — and design mode no longer
    remounts either.

    Worth stating as a rule rather than three bug fixes: **in a form library, a
    wrapper whose presence depends on state must not be conditional.** Forms
    make this expensive in a way most React code never notices, because the
    thing being remounted holds focus, selection, scroll position and animation
    state that the user is looking at.

23. **`silent` holds up — proved by a tab strip, which is what it was invented
    for.** An inactive tab shows an error marker for content rendering nothing,
    and the marker updates live: fix the field inside the inactive tab and it
    clears while the tab is still off screen. Measured in all four
    implementations.

    The validation scope behind it was hand-rolled at this point — a set of
    member controls, a version control so membership changes re-trigger,
    registration running upward from each field to every enclosing scope, and
    no early exit in the aggregate so every member stays subscribed — because
    core had no primitive for "is anything under me invalid", and
    `createControlGroup` composes *values* through the parent, which a validity
    scope never wants. Superseded by finding 37, which put it on a core
    primitive.

24. **A container with per-child metadata cannot take `children`.** Tabs need
    titles and `ReactNode` is opaque, so `TabsProps` takes
    `items: { key, title, children }[]`. Every surveyed library agrees in its
    own way — Ant an `items` array, Mantine compound components with context,
    MUI the caller pairing tab and panel. The generic group boundary is still
    right for containers that need nothing but a box.

25. **React's `<Activity>` destroys effects, and `silent` lives in effects.**
    The sharpest failure of the session. Mantine's `keepMounted` hides inactive
    panels with `<Activity>` by default: DOM preserved, effects torn down. So
    the inactive Pets tab kept its markup and *silently stopped reporting its
    errors* — the marker cleared, the Length validator vanished from the state
    table, and nothing anywhere warned. Three implementations were correct and
    the fourth looked correct.

    `keepMountedMode="display-none"` fixes it in Mantine. The general lesson is
    bigger than one prop: React is standardising an API whose entire purpose is
    to hide offscreen UI by unmounting its effects, and this design puts
    validator registration, scope attachment and `clearHidden` in effects. Any
    form library taking this shape has to decide what happens when a host wraps
    part of it in `<Activity>`, and "nothing warns" is not an acceptable answer.

26. **Plain JSX inside a `silent` panel renders, same as inside a hidden
    group.** Boundaries suppress themselves; a `<p>` does not. The panel has to
    hide its own content — mounted, CSS-hidden — exactly as finding 17 concluded
    for regions. The demo now keeps a plain paragraph in the Pets tab so the
    leak has something to show up in.

27. **Actions need no primitive — they need a second caller, and a documented
    id set.** The §7 test ("cannot be expressed as a renderer") never applied:
    an action *is* a registry entry already. What was missing is that renderers
    other than the action boundary have to draw buttons — a collection's Add,
    a modal's Apply — and in this build they were plain `<button>` elements,
    rendering as raw HTML next to properly-themed controls under MUI and
    Mantine. The same drift as the checkbox's hand-rolled label.

    The first cut gave those renderers `useAction(id)`, a hook returning the
    implementation's button for composition — "appearance only", on the
    theory that a composed button must not get the boundary's behaviour.
    Removed: every one of its sixteen call sites repeated the id the hook had
    just been given and filled in `busy={false}` by hand, and every composed
    button turned out to want exactly what the boundary provides — Apply
    wants busy state, Add and Remove want the design-mode stub, Next wants
    the lock folded in, and all of them want the override map, which the
    boundary consults anyway. So every button anyone draws is an `<Action>`;
    the registry's `action` slot is what it dispatches to, and nothing
    composes it directly. `fieldShell` and `inputFrame` remain the composed
    primitives.

    Per-id overrides are app-side context rather than a registry slot, since
    the registry is the implementation and the override is the app's opinion
    about one button. Verified: turning the override on swaps `Add pet` from
    `ff-btn--primary` to a custom pill while `Edit` and `Remove` keep the
    implementation's default, and all four libraries draw their native button
    otherwise (`MuiButton-contained`, `ant-btn`, Mantine's, `ff-btn--primary`).

    The ids are the part that is easy to skip and fatal to skip: an override
    map is useless if the ids are private strings. `StandardActionIds` fixes
    `add`, `remove`, `edit`, `apply`, `cancel`, with the rules written down —
    every framework-drawn button uses one, a definition may rename it, and ids
    name the deed rather than the look.

28. **Translation allocates — the loader's defining hazard, and it fails
    silently.** Every scripted prop costs a control plus a subscription. Built
    during render, that survived until the component remounted; the demo then
    ran **84,000 jsonata evaluations** and hung the page, with nothing warning
    that anything was wrong. Memoising the translated tree is not enough,
    because a remount defeats a memo. The fix is to cache results on the data
    control's meta keyed by the expression (`ensureMetaValue`), so allocation
    happens once per (control, expression) no matter how often the tree
    remounts.

    Worth stating as a difference in kind: a hand-written form allocates
    nothing per render and *cannot* fail this way. A loader can, so it has to
    be built so it cannot.

29. **The `Control<T>` arm of `FormProp` is what makes async expressions
    expressible.** `(rc) => T` must return now, and jsonata cannot — it
    evaluates into a control, and the prop *is* that control. Without that arm
    the JSON path needs a second mechanism for 418 of its expression uses.
    Composition works over both arms unchanged, so turning a `Visible`
    expression into a `hidden` prop is `(rc) => !getProp(rc, expr)` and never
    learns which kind it wrapped. Verified: an async `hasPets = true` reveals a
    field, a synchronous `DataMatch` disables one, and neither renderer knows
    an expression exists.

30. **The loader's output is ordinary JSX, and it composes.** The JSON form is
    a third tab beside two hand-written ones, bound to the same `Person`
    control — same boundaries, same scope, same registry, no renderer aware
    that JSON exists. Labels come from `displayName`, required and the flags
    from the definition, `Length` from validators, and an unsupported control
    renders a visible placeholder naming it. The `SchemaField` removal (finding
    20) cost the loader a props pass and nothing else, which is what it was
    argued would happen.

31. **A display is a boundary with the data half removed, and nothing else
    needed changing.** No binding means no validators, nothing to clear when
    hidden, no locks to fold, no `state(rc)`. What survives — presence, the
    class slots, the `visibility` slot, design chrome — is exactly the part of
    a boundary that was never about data. The guarantees came apart along that
    line without any special-casing, which is the best evidence yet that the
    boundary is factored where it should be.

32. **Not every registry entry is equally earned.** `text` genuinely varies: a
    `<p>`, MUI's `Typography` (`<p class="MuiTypography-body2">`), Ant's
    `Typography.Text` (a `<span>`), Mantine's `Text`. `html` is
    `dangerouslySetInnerHTML` in all four and varies only in the typography
    wrapper around it — it earns a slot for the font, not for the content.
    A refinement of the test in finding 27: not "does something else need to
    draw it" alone, but "would the implementation draw it differently".

    The loader also showed that prop-building is **field-shaped**: it branches
    on the control type rather than handing every translator the same props,
    because a display can take `hidden` and the class slots and nothing else.

33. **`options` works as a prop, and the contract has to declare its own
    option type.** Its shape is constrained by the format it gets fed from —
    `{ name, value }`, not `{ label, id }` — because the loader passes
    `schema.options` straight through, and an invented shape would mean
    re-mapping every option for no gain. That is the residue of finding 20: the
    schema left the contract, but the format still shapes one type in it.

34. **Options carry a value type the DOM erases.** `<select>` and every library
    built on one speak strings, while option values are `string | number`. The
    controller restores the original by looking the string back up in the
    option list — `options.find(o => String(o.value) === s)?.value` — rather
    than guessing with `Number()`, which would turn a legitimate `"3"` into
    `3`. Verified both ways: picking "High" (value `3`) stores the number,
    picking "Active" stores the string.

    The select was also the fourth widget shape through the shell/frame
    machinery and needed nothing added: html puts a `<select>` in the frame's
    control slot, MUI's draws its own outlined input and takes the label a
    second time for the notch (directly from props — here the widget *is* the
    control), Ant's and Mantine's draw their own surface under
    `surface: "custom"`.

35. **A stateful container needs two homes for its state, and the author
    picks.** Tabs keep the active key in component state, which is right for a
    tab strip. A wizard's page index usually must not — it wants to survive a
    remount, a deep link, or save-and-resume — so `WizardProps` takes an
    optional `page?: Control<number>`. The demo binds it, and `wizardPage: 1`
    duly appears in the state table alongside the form's real data. Offer only
    component state and half the cases are unbuildable; offer only the bound
    form and the other half pollute their schema with UI state.

36. **Gating is what the validation scope was actually for.** Next is refused
    while the current page is invalid, and refusing `touchAll()`s that page so
    the errors it already had become visible — one method beyond `isValid`, and
    the only thing the wizard needed that did not already exist. It works
    because an unreached page is `silent`: validating without rendering, so a
    step can be marked invalid before the user has ever seen it. Verified: Next
    on an empty first page does not advance and turns the page's fields
    touched-and-red; filling them lets it through and `wizardPage` becomes 1.

    Everything else was reuse — presence, the scope, actions, structured
    `items`, design-mode stacking — and the two buttons it draws use the
    documented ids `next` and `back`, exactly as finding 27 intends. All four
    libraries drew their own stepper (`MuiStepper`, `ant-steps`, Mantine's,
    and the html one) with no contract change.

    Revisited for async validators: Next now awaits the page's `settled()`
    before it decides, and because `next()` returns that promise the
    `<Action>` drawing it shows busy for the wait — finding 51.

37. **The validation scope needed a change in core — the first thing this whole
    exercise has asked of it.** The scope wants to be a real `Control`: then
    validity is an ordinary tracked read, `touchAll` is a `setTouched` cascade,
    and a nested scope is just another member. Built on the existing
    `attachFields` it corrupts data instead.

    The shape is unavoidable, not exotic: a scope always holds both a control
    and a descendant of it, because a collection registers its array while its
    rows register fields inside it. The group's value then carries that datum
    under two keys; a write arrives up one route, the group recomposes only
    that key, and the downward sync writes the other key's pre-write copy back
    into the child. The symptom was a collection row that silently refused
    typing. It took three attempts to describe correctly — the first two
    explanations were wrong, and the minimal repro (a compound plus one of its
    own fields) is what settled it. `@react-typed-forms/core@4.6` behaves
    identically, so it is long-standing rather than an rxc regression.

    Core gained `createDerivedGroup` — a group whose value is composed from its
    children and never written back down — and `detachFields`, the counterpart
    `attachFields` never had. The composed value stays *correct* under the
    aliasing, since both keys update through their own upward routes; only the
    downward half was ever broken. Writing detach turned up a second bug: the
    `ChildInvalid` cache short-circuits `isValid()`, so a detached invalid
    member kept the group invalid forever unless the flag is cleared first.

    What it deleted from here: a version counter, a fan-out that had to avoid
    early-exiting so every member stayed subscribed, a hand-written `touchAll`,
    and a throwaway-control hack standing in for detach. It also made nesting
    real — a parent scope now holds one child aggregate instead of a flattened
    copy of its members.

38. **`{ scope: true }` is a property of the boundary, not of the renderer.**
    `<Contents>` and `<Section>` are the same implementation, produced by the
    same `groupRenderer` call shape, differing only in whether they aggregate
    their content's validity; the implementation sees the answer as `invalid`
    in its render props and can draw it however it likes (the demo shows a red
    bar on the pets section, which clears the moment the row inside is named).

39. **The loader's silence was worse than its gaps, and the gaps were mostly
    not unknown control types.** The obvious failure — a control nothing
    translates — was already visible on screen as a placeholder. The four that
    were not are features *on a control that translated fine*: an adornment
    nobody claimed, a dynamic property nobody reads, a
    `renderOptions`/`groupOptions` discriminator that silently falls back to
    the default widget, and a validator that is simply not enforced. Each of
    those renders something plausible and quietly drops what the JSON asked
    for. A `Radio` render option becoming a `<select>` is the shape of it: the
    form works, and nothing anywhere says the author did not get what they
    wrote.

    They are **returned, not logged** — `translateForm` hands back
    `{ tree, warnings }`. Open decision 2 calls this a policy question, so the
    loader's job is to find the gaps and the host's is to decide what they
    mean; a `console.warn` forecloses that (invisible in production,
    unavailable to a test, impossible for a designer to render beside the
    control it is about).

    One thing had to change for the fifth kind to be reportable at all. A
    jsonata expression is compiled by *building the prop*, and the loader built
    `Visible` and `Label` props inside the read closure — so a compile failure
    happened at first render, after the warning list had been handed over, and
    on a jsonata arm the `ensureMetaValue` cache meant it happened exactly
    once, wherever that first read landed. Hoisting the prop out of the closure
    puts the failure at translate time, and is what a sync expression wanted
    anyway: one stable closure instead of a fresh one per read.

40. **`accessibleName` costs each implementation one line, and the "is it also
    visible" clause is where they differ — which is the point.** An icon
    display in all four: every one puts `role="img"` + `aria-label` on the
    glyph, and the name reaches the accessibility tree identically. What
    differs is the visible half. html uses `title` — a native tooltip, no
    library, no provider; MUI, Ant and Mantine each wrap the glyph in their
    own `Tooltip`, and MUI's is what the Mast form's users would see. None
    of that is in the contract, and none of it needed to be: the contract
    said "a name arrives", and four implementations made four defensible
    calls about showing it.

    The loader side is one translator and one line of suppression: a
    `Display/Icon` control takes the `Tooltip` adornment's text as its
    `accessibleName`, and `warnUnhandled` skips that adornment on a display
    because the translator consumed it. A `Tooltip` on a data field — the
    `AllControls` demo's shape, and nothing else in the corpus — has no
    meaning and stays reported. The demo's warning list lost one entry and
    gained one, which is the decision made visible.

    Icon *names* arrive as the JSON spells them (FontAwesome's); the POC
    draws them as text glyphs from a four-entry map so its dependency list
    stays honest. A real implementation maps to its icon set. The contract
    only says a name arrives.

41. **A collection implementation cannot put chrome on a row it cannot see.**
    The first third-party collection — cards with their own Edit / Remove,
    the shape a DataGrid's remove column has — did not compile against
    `elements: ReactNode[]`: there was nothing to attach a button *to*, and no
    index or field to hand the staged-edit controller. `elements` is now
    `CollectionElement<T>[]` — `{ key, index, field, node }` — and the
    built-in `ElementsList` just maps `e.node`. The boundary's three
    guarantees (structure-only subscription, a scope per element, keyed by
    `uniqueId`) are untouched; the implementation simply gets to know what
    the rows *are*. `field` is the element's control, and Edit on a card goes
    through `p.actions.edit(e.index)` — the boundary's scope-aware actions,
    so a locked region disables it (finding 19) — and opens the same draft
    the Pets tab's host shows, because the controller is cached on the array
    control and both hosts read it. The card never meets the controller.

    Smaller, and worth knowing: a **non-field** implementation has no
    controller to hand it `rc` and `rendered`. `Stars` got its window from
    `useNumberInput`; a collection or a display has to call `useReactive()`
    itself. That is the same one line every `@rx-controls/react` component
    writes, so not a gap — but it is the first place a renderer author meets
    the render boundary directly rather than through a controller.

42. **Renderer-specific props reach the implementation unresolved — decided,
    and the deciding renderer was a callback.** `PetCards` takes
    `onCardClick?: (index) => void`. Forwarded through the boundary's
    `getProps`, the callback was *invoked with the `rc`* during render —
    `card {tracked: Map(1), tracking: true}` four times on load — and the
    implementation received `undefined`. The boundary cannot tell
    `(rc) => T` from `(index) => void`; both are one-argument functions.

    So the boundary now spreads renderer-specific props through as the author
    wrote them, and the implementation resolves each with `getProp` in its
    own window — the rule §1 already states for every other `FormProp`, now
    with no exception. `Resolved<P>` is gone from the contract, and so is
    `getProps`. Measured cost of the change, which is what this trial was
    for: seven read sites per implementation (placeholder, inputType,
    multiline, options, text, html, icon), `useSelectController` taking the
    `FormProp` and resolving it itself, and the three display
    implementations each opening a tracking window they previously did not
    need. TypeScript found every site — `FormProp<string>` is not assignable
    to `string` — so forgetting one is a compile error, not a silent render
    of a function's source. Verified after: nothing fires at render, a click
    delivers the index, and the `Ada` placeholder still resolves.

    One thing this moves rather than removes: a change to a
    renderer-specific `FormProp` now re-renders the implementation only,
    where before it re-rendered the boundary and everything under it. That
    is the direction §1 wanted anyway.

43. **A dialog is a tab strip with one panel and a portal, and `silent` is
    what makes it work.** The boundary is `tabsRenderer` with the item list
    collapsed to one: content presence is `open || designMode ? "rendered" :
    "silent"`, wrapped in its own validation scope, handed to the
    implementation already scoped and always mounted. Verified on load: a
    required field inside a dialog that has never been opened reports
    *Please enter a value* in the state table, and a display beside the
    trigger reads it — the closed dialog validates exactly as an inactive tab
    does. Type in it, close it, and the value is there: the field the modal
    shows *is* the field, not a copy.

    Each library keeps closed content mounted its own way, and every one had
    to be told: the native `<dialog>` is driven by `showModal()`/`close()`
    from an effect with the content always its child; MUI `keepMounted`; Ant
    `forceRender` + `destroyOnHidden={false}`; Mantine `keepMounted` **with
    `keepMountedMode="display-none"`** — its default is `activity`, so the
    Tabs trap of finding 25 is a Modal trap too, and the morning's rule
    ("never `<Activity>`") paid for itself within the day.

    **Design mode's layer 2 is real and costs the boundary one boolean.** In
    design mode the boundary passes `inline: true` and the implementation
    renders the content in place, no portal, no chrome — the `Dialog →
    Contents` substitution from the goals doc, done above the renderer so no
    implementation knows design mode exists. Verified: toggle design mode and
    the dialog body appears inline, dashed, with the wizard's pages stacked
    beside it.

    One honest cost. Switching `inline` **moves the content between
    parents** — from a portal to an in-place `<div>` — which remounts it,
    exactly the thing findings 17 and 22 forbid for a state toggle. It is
    tolerable here because design mode is an authoring-mode switch, not
    something a form user does mid-edit; but a library that wanted it seamless
    would have to render the inline chrome *inside* the same parent and
    un-portal it, which none of the four offer.

    Layer 3 — a third-party portal renderer the substitution table has never
    heard of — is not a build question. Its content escapes the canvas and
    the designer selects it from the tree; that is a designer policy, and the
    dialog trial has nothing to add to it.

44. **The corpus burndown: 80 forms, 3,972 controls, 7 clean, 2,227
    warnings — and the number is now a number.** `scripts/burndown.ts` runs
    `translateForm` over every form file it is pointed at (`{ controls,
    fields }` as the editor writes them, or a bare array) and reports by kind
    and by *shape* — the quoted discriminator in each warning — so the output
    reads as a work list rather than a log. `--strict` exits non-zero on any
    warning, which is what a CI gate over the corpus will be; `--json` is for
    tracking it. The first run against the 68 ServiceTas forms, the 8
    `forms-app` forms and the 4 TestTemplate forms:

    | kind | count | what it is |
    |---|---|---|
    | `schema` | 934 | 806 plain names the supplied schema does not have — **input, not loader**: ServiceTas keeps its schemas in generated `schemas.ts`, and the form JSON's `fields` carries only form-local extensions (`MrsLicenceDetails` ships one field). 105 `a/b` paths, 21 `../x` parent refs and 2 `.` self refs are reference syntax the loader does not resolve yet — those are loader work. |
    | `renderOptions` | 892 | `DisplayOnly` 375 · `Inline` 205 · `Group` 66 · `Radio` 55 · `Flex` 37 · `Array` 29 · `Dropdown` 26 · then a long tail (`Dialog` 8, `DataGrid` 7, `Switch` 9, payment widgets 10, …) |
    | `dynamic` | 187 | `Display` 67 · `ActionData` 61 · `AllowedOptions` 42 · `LayoutStyle` 15 · `GridColumns` 2 |
    | `adornment` | 119 | `HelpText` 69 · `ColumnOptions` 26 · `Accordion` 19 · `Spotlight` 2 · `Icon` 2 · `Tooltip` 1 (the data-field one) |
    | `validator` | 59 | `Jsonata` 45 · `Date` 11 · `Length` on a non-string 3 |
    | `control` | 36 | `Display / Custom` — the host-supplied display, in 16 forms |

    Two things the first run taught, one about the script and one about the
    loader. The **schema misses had to be their own kind** — reported as
    `control` they were 970 of 2,280 and keyed by field name, which buried
    the loader's real list under `firstName` × 21; split out and bucketed by
    reference syntax they separate "supply the schema" from "resolve `../x`"
    in one line. And **translators now declare the render types they
    consume** (`Translator.renderTypes`) instead of the loader keeping a
    static list: `Textfield` — legacy's name for the standard text renderer
    — was 53 false warnings until the text translator said it handles it.
    `Array`, `Dropdown` and `Checkbox` still appear, correctly: those
    translators match on the schema, and with no schema a data control
    *does* render as a text field.

    The next step the number points at is not loader work: a schema
    extractor that evaluates ServiceTas's `schemas.ts` and writes the
    `SchemaField[]` beside each form, so the 806 become 0 and the 128
    reference-syntax misses stand alone. After that the list reads top-down:
    `DisplayOnly`, `Inline`, `HelpText`, `Display` and `ActionData`
    dynamics, `Group` render options, `Radio`.

45. **With the schemas supplied, the burndown is 1,450 — and the schema
    column is now all loader work.** `scripts/extract-corpus.ts` compiles a
    legacy app's generated `schemas.ts` to CommonJS with the app's *own*
    `tsc`, into its own `node_modules/.cache` so `./client` and
    `@react-typed-forms/schemas` resolve from there, `require`s it, and reads
    the form→schema pairing out of `formDefs.ts` textually (`schema:
    XSchema` beside `controls: YJson.controls`). `buildSchema` already
    returns `SchemaField[]`, so the exported constants *are* the arrays. It
    writes `corpus/<name>/<Form>.json` as `{ controls, fields }`, appending
    the form's own `fields` the way the app does. Three apps, one script:
    ServiceTas (`formDefs.ts`), `forms-app` (`formdefs.ts`), TestTemplate
    (`forms.ts`) — 77 of 80 forms paired with a schema; the three unpaired
    are TestTemplate demo forms with no schema anywhere.

    What the schemas changed, 2,227 → 1,450: the `schema` kind fell 934 →
    208, and what remains is 105 `a/b` path refs, 21 `../x` parent refs, 2
    `.` self refs — reference syntax the loader does not resolve yet — plus
    80 plain misses, 55 of them the three unpaired demo forms and 25 genuine
    (a control naming a field its schema does not have; those forms are
    probably broken in production too). `Array` fell 29 → 3, `Dropdown` 26 →
    17, `Checkbox` 14 → 0: with a schema the collection, options and Bool
    translators match, as predicted. And `Standard` on a non-text field
    surfaced (23) and went — those translators now claim it, since
    `Standard` means "the default widget for this field type".

    The corpus is gitignored: it is derived from other repositories, and a
    re-run refreshes it. A CI gate would extract then run `--strict`.

    The list, top-down, is now the loader's alone: `DisplayOnly` 375,
    `Inline` 205, path refs 105, `HelpText` 69, `Display` 67, `Group` 66,
    `ActionData` 61, `Radio` 55, `Jsonata` validators 45, `AllowedOptions`
    42, `Flex` 37, `Display / Custom` 36.

46. **The burndown had a blind spot the size of the format, and closing it
    took the number from 1,450 to 8,169.** A warning was only ever raised for
    a feature the loader *knew* it dropped; a property nothing reads was
    silent, because nothing had looked. So the definition handed to
    `buildProps`, `warnUnhandled` and the matched translator is now a
    recording proxy — one level down into `renderOptions`, `groupOptions`
    and `displayData` — and every meaningful property nobody touched is
    reported as `unread`. (`null`, `false`, `""`, `{}` and `[]` are skipped:
    the editor writes `defaultValue: null` and `fieldDef: {}` on every
    control.)

    6,719 unread properties on 3,972 controls, and one form clean instead of
    nine. The top of the list is the class slots — `styleClass` 1,550,
    `textClass` 1,481, `layoutClass` 636, `labelTextClass` 248, `labelClass`
    39 — which the goals doc already calls the most-used thing in the format
    after `Visible` and which the loader never mapped; then `hideTitle` on
    groups (1,030) and controls (370), `actionStyle` 361, `sampleText` 126,
    `icon` 112, `noSelection` 110, `actionData` 81, `iconPlacement` 65,
    `emptyText` 48, `disableType` 39, `customId` 36, `placeholder` 32 and
    the array `noAdd`/`noRemove`/`noReorder` trio at ~31 each.

    Two things to read carefully. `groupOptions.hideTitle` at 1,030 is
    honoured *by accident* — the group translator renders no title at all —
    and its falsy twin, "show this group's title", is invisible to the audit
    because a `false` is skipped; the audit finds dropped *data*, not dropped
    *defaults*. And the demo's own JSON reports no unread properties at all,
    because it was written against what the loader knows; the corpus was
    written against legacy. That gap between the two is exactly what this
    number measures now and did not before.

    The five-line version of the list: map the four class slots to the four
    `className` props (§2 already says how), pass `hideTitle`, wire
    `actionStyle`/`icon`/`iconPlacement`/`disableType`/`actionData` into
    `ActionProps` — which is the actions decision — and read the array
    options. That is most of 6,719.

47. **`actionData` never crosses into JSX, and that is what made the actions
    question small.** JSON gives a button an id and a payload because it
    cannot write a closure; a JSX author writes `onClick={() => approve(id)}`
    and the payload *is* the closure. So — by the same argument the goals doc
    makes for adornments — the loader owns all of it: `<JsonForm
    actionHandler>` takes legacy's resolver shape (`(actionId, actionData) =>
    onClick | undefined`, i.e. `ControlRenderOptions.actionHandler`, which
    every host already has), the translator resolves `actionData` (static, or
    the `dynamic: ActionData` expression read untracked at click time) and
    builds the `onClick`. `ActionProps` gains only what a JSX author would
    write by hand: `iconPlacement` and `disableType`.

    **The resolver shape is what makes an inert button reportable.** Asked at
    translate time, `undefined` means "nobody claims this id", and the loader
    warns (`kind: "action"`) instead of shipping a button that does nothing —
    legacy renders exactly that button, silently. The burndown now shows 442
    of them across the corpus, which is the count of buttons a host handler
    has to claim before the forms work.

    **`disableType: "global"` needed one thing from the contract.** `<Form>`
    holds a lock counter on the scope; a running global action increments it,
    and the root scope reads it as `disabled` for every boundary. Verified:
    Submit greys the whole form for the length of its promise.

    **Legacy's Dialog group is a loader component, not a contract change.**
    Children with `placement: "trigger"` render in place, the rest inside the
    `<Dialog>` from finding 43; the translator owns the `open` control and
    claims `openDialog` / `closeDialog` for its subtree, falling through to the
    host's handler for anything else — the same nesting legacy's
    `DefaultDialogRenderer` gets by passing a child `actionHandler`. Two
    things that took a `Translator` addition: `retranslate`, so a container
    can build its children under its own options, and `ownsChildren`, so the
    loader skips its eager pass — without it every Dialog child was translated
    twice and warned twice, which the corpus numbers had been quietly
    carrying.

    Burndown 7,887 → 7,743: `dynamic` 187 → 123 (`ActionData` handled),
    `renderOptions` 844 → 824 (`Dialog`), `unread` 6,719 → 5,935
    (`actionStyle`, `icon`, `iconPlacement`, `disableType`, `actionData`).

48. **The four class slots were half the remaining burndown, and mapping them
    was fifteen lines.** `styleClass` → `className`, `textClass` →
    `textClassName`, `layoutClass` → `shellClassName`, `labelClass` →
    `labelClassName`, in `buildProps`, with the `"@ "` prefix becoming
    `{ replace }` — exactly as goals decision 4 and interfaces §2 said.
    Verified in the DOM: `styleClass: "demo-accent"` merges onto the frame
    (`div.ff-frame.demo-accent`), `labelClass` onto the label
    (`label.ff-label.demo-label`), and `layoutClass: "@ demo-shell"` replaces
    the shell's class outright (`div.demo-shell`, no `ff-shell`). The field
    boundaries already carried the slots and every translator that spreads
    `props` got them for free; the group, tabs, dialog, display and action
    translators had to pass them through by hand.

    Actions were the one boundary without the slots. A button has a control
    class and a text class like everything else — `textClass` on "a button's
    text" is in the goals doc's own table — so `ActionProps` gained
    `className` and `textClassName`, and each implementation merges the first
    onto its button and wraps `text` in a span for the second.

    7,743 → **4,102**. One slot is left over: **`labelTextClass`, 248 uses in
    30 forms**, which legacy applies to the label's *text* as distinct from
    the label container. It is not one of the decided four, so it stays
    unread — a fifth slot is a decision, not a translation.

49. **`labelTextClassName` is the fifth slot, and it was already in the
    contract in disguise.** The format has both `styleClass` and `textClass`
    on a control for one reason: on React Native text styles do not cascade
    from a `View`, so the container's class and the text's class have to be
    two props. v2 kept that pair as `className` / `textClassName` — the
    View/Text split was in the contract from the start — and the label was
    the one place it had collapsed to a single `labelClassName`. The corpus
    felt it: `labelTextClass` 248 uses against `labelClass` 39, because on
    RN the text one is the only one that styles the words.

    So `FieldProps`, `FieldRenderProps` and `FieldShellProps` gain
    `labelTextClassName`, defined the way the rest of the contract is: *the
    label's text; an implementation whose label is a single text element may
    apply it together with `labelClassName`.* That sentence is what keeps web
    free — in all four implementations the label is one element, so each
    shell merges the two with `combineClass` and adds no markup. Only
    `forms-native` will ever separate them, exactly as it must for
    `textClassName`. The loader maps `labelClass` and `labelTextClass`
    one-to-one. Verified in the DOM: `label.ff-label.demo-label.demo-label-text`.

    4,102 → **3,854**. The alternative — one slot, with `forms-native`
    partitioning the class string into text utilities and the rest — would
    have to classify arbitrary class names, and the corpus styles labels with
    component classes like `title1` that carry text styling under no
    recognisable prefix. Two slots is honest about what the platform needs.

50. **`hideTitle` was a third of what remained, and the interesting half was
    the falsy one.** On a control the flag means "render no label", and the
    loader now passes `label: undefined` when it is set — one line. On a
    group it lives under `groupOptions.hideTitle`, and the 1,005 `true`s
    were being honoured by accident, because the group translator rendered
    no title at all; the `false`s and absences — "show this group's title" —
    were being dropped silently, and the unread audit could not see them
    because it skips falsy values. So the fix is not the flag, it is the
    title: `GroupProps` gains `title` (INTERFACES §5 had it all along), the
    group boundary resolves it, the shared `Contents` implementation renders
    it as a heading, and the translator passes `props.label` — which
    `buildProps` has already emptied when either flag is set. Verified: a
    `Standard` group with `hideTitle: false` shows "Contact"; a control with
    `hideTitle: true` shows no label.

    3,854 → **2,483**, three forms clean. The unread column is down to 675,
    and for the first time the largest kind is `renderOptions` — unhandled
    *shapes*, not dropped *data*. What is left of unread is render-option
    sub-fields (`sampleText` 123, `noSelection` 110, `emptyText` 45,
    `renderOptions.groupOptions` 45), each of which belongs to a translator
    that does not exist yet and will go when it does.

51. **Async validators, and the "settled" primitive the wizard gate needed.**
    `Validator<T>` promised a `Promise` return in the doc and the build never
    delivered it; the legacy `Jsonata` validator (45 uses in 9 forms) needs
    it, and legacy's own wizard gate papered over the same gap with a 100 ms
    sleep. Built: a validator's run keeps its tracking window only until the
    function returns — reads before the first `await` are the dependencies —
    and publishes on resolve unless a newer run has superseded it. The
    previous message stays until the answer lands. No debounce in the
    contract; a validator that is expensive wraps itself.

    The new piece is on the validation scope: `beginPending()` counts an
    outstanding promise here and in every enclosing scope, `pending(rc)`
    reads it, `settled()` resolves at zero. `isValid` stays optimistic while
    pending, deliberately — a step marker that flashed invalid on every
    keystroke would be worse than one that is briefly wrong — so a gate
    awaits `settled()` and then reads validity. The wizard does exactly
    that, and because `next()` now returns the promise, the `<Action>`
    drawing Next shows busy for the wait with no wizard code involved: the
    first payoff of finding 27's "every button is an Action".

    Verified: an 800 ms name check on the wizard's first page holds Next
    busy and refuses when it answers with an error; the JSON tab's `Jsonata`
    validator on notes reports when the text contains `TODO`, evaluated
    against the parent data as legacy does. Not built: a field-level
    `pending` on `FieldState` for a spinner in the frame — nothing needed it
    yet.

    Burndown 2,483 → **2,448** over a freshly extracted corpus: the
    `validator` kind goes 56 → 11, which is `validator:Jsonata` 45 → 0 with
    the 11 `Date` validators left; the rest of the delta is the corpus
    having moved by four controls since finding 50.

52. **Field references need a cursor — and it belongs to the loader, not the
    contract.** Finding 19 left the binding a bare `Control`, and the open
    question was whether the JSON path could live with that. It cannot, for
    two reasons the corpus makes concrete: `../x` (43 uses) needs a parent a
    `Control` does not have, and a jsonata expression inside an array row (50
    of 418) needs the path from the root, because legacy evaluates it as
    `pets#$i[2].(expr)` against the whole form — so `$$` is the root and `$i`
    the row index, and 15 expressions read one or the other. The first cut
    evaluated against the parent value with no prefix: `$$` meant the parent
    and `$i` nothing, silently.

    Built: a `DataScope` — control, schema fields, parent, path — threaded
    through `translate` beside the control. `resolveRef` is legacy's
    `dataRef` (`a/b`, `..`, `.`); rows get legacy's two-level chain, array
    then element, which is what makes `../../selectedMessages` mean the root.
    Expressions compile with the prefix and evaluate against the root through
    a tracked proxy (`getTrackedValue` + a reconciler, legacy's shape), so
    exactly what an expression touches re-runs it — `$$.other` included,
    which whole-parent subscription could never see. A jsonata *validator*
    reads the root eagerly instead, because a validator's window closes when
    it returns (finding 51): coarse, correct, and 45 of them. Nothing here
    reaches a boundary. That is the answer to "does v2 need a cursor": yes,
    entirely on the JSON side, ~120 lines.

    Two things the eager walk got wrong on the way. A collection's children
    were translated against the *array* control for the warning pass, so
    `..` from a row counted one level short; they now walk a representative
    row scope over a detached control. And the loader preferred the schema's
    `displayName` to the definition's `title`, backwards from legacy — fixed.
    Verified: `address/city` writes into the compound, `../firstName` reads
    back out of it, and two rows label themselves "Pet 1 of 2" / "Pet 2 of
    2" from `$i` and `$count($$.pets)`.

53. **DisplayOnly is a field boundary over a read-only widget.** 372 uses in
    52 forms — the largest thing the loader did not translate — plus its
    `sampleText` (143) and `emptyText` (60). The contract question was which
    boundary kind: it binds data, so `hidden` must clear it and it must sit in
    the shell with a label, which makes it a `fieldRenderer` with a widget
    that never writes; a `displayRenderer` has no binding and would have
    needed one bolted on. `DisplayOnlyExtra` is `options`, `emptyText`,
    `sampleText`, `format`, `noSelection`; the controller `useDisplayValue`
    does value → text (option name, else `format`, arrays mapped and joined)
    and the empty-state choice, where `sampleText` wins in design mode —
    legacy's `FormControlPreview` behaviour, and the one place design mode
    enters a widget's data. Type formatting (dates, Yes/No) is built by the
    loader from the schema into `format`, since the schema is loader-only;
    `required` is dropped, as legacy ignores it here. Four implementations,
    each a `Typography`/`Text`/`div` inside the shell. A non-collection
    `Compound` data control also got its translator — a chrome-less group,
    the region finding 52's `../x` climbs out of.

    `noSelection` turned out to be a top-level definition flag in the corpus
    (98 on displays, 7 on groups, 5 on DisplayOnly), not the render option
    legacy types it as. The widget honours either spelling; the 105 on
    displays and groups stay unread, since the display contract has no slot
    for a selectability style and this was not the moment to add one.

    Burndown 2,448 → **1,674**: `renderOptions` 824 → 382 (DisplayOnly 372 →
    0, Group 66 → 0), `schema` 208 → 59 (path refs 105 → 3, parent refs 21 →
    0, self refs 2 → 0; the 3 left name fields the schema lacks), `unread`
    675 → 502 (`sampleText` 123 and `emptyText` 45 gone), `expression` 10 →
    0. Sixty-two of the remaining schema warnings are forms that shipped no
    schema at all.

54. **DisplayOnly is write-free — a deliberate divergence from legacy.** The
    check was prompted by the name: a display-only control should not be
    editing anything. Legacy's does. Its `clearHidden` cycle
    (`formStateNode.ts`, both the old core and the settled rxc port) has no
    display-only exception, so a hidden display-only control gets
    `value = undefined` like any other, and its `defaultValue` cycle writes a
    default into one just the same. The display-only special cases are
    elsewhere — `required` skipped, `hideDisplayOnly` for an empty value
    with no `emptyText`, a `Display` dynamic property as `overrideText`. The
    name describes the widget, not the node.

    That matters because a display-only control almost always shows a value
    *another* field owns: 76 of the corpus's 375 are hidden by a `Visible`
    expression, and under a `clearHidden` host each of those wipes the value
    it was summarising the moment it hides. So `fieldRenderer` gained a
    boundary option, `{ writes: false }`, and `DisplayOnlyField` is built
    with it: no `clearHidden`, and no default should one ever be built, no
    matter what the form or the definition says. A property of the boundary
    rather than a prop, so no caller can forget it. Recorded in the
    interfaces doc (§6) as the divergence it is. Not built, and noted there:
    `hideDisplayOnly` and `overrideText`, both pure reads.

55. **A third-party group renderer: one type bend, one rule the contract
    cannot enforce.** `Collapsible` — a disclosure section with a header the
    user toggles, an invalid badge on it while the content is off screen, and
    a live summary of what is inside — is the last boundary kind written from
    outside the package, after `Stars` (field), `PetCards` (collection) and
    `FancyAdd` (action, through the override map). Imports no UI library.
    Verified in all four implementations: collapsing keeps the input inside
    mounted (same DOM node before and after), the badge tracks `invalid` live
    while collapsed and clears when the name inside is filled, the summary
    re-renders from `pets`, `readOnly` locks the field inside without locking
    the toggle, design mode forces it open and ignores clicks, and the
    boundary's `hidden` takes the whole section out (`display: none`, `inert`)
    while the fields inside clear themselves.

    **The type bend.** `groupRenderer` had no renderer-specific-props generic —
    `fieldRenderer<T, P>` and `collectionRenderer<T, P>` did, and finding 42
    settled how `P` reaches the implementation — so `defaultOpen` and `summary`
    did not compile. It has one now, with the same pass-through: anything that
    is not a group contract key (`hidden`, `disabled`, `readOnly`, `title`,
    `className`, `children`) reaches the implementation unresolved. Ten lines
    in the boundary; nothing else moved. The doc had also promised a
    `designAs` option on `groupRenderer` that was never built — layer 2's
    built-in substitution went through `inline` on the dialog boundary
    (finding 43) instead, and for a third party the answer is below — so the
    signature now says what exists.

    **What a group reuses.** A group has no structural primitive and turns out
    not to need one: the implementation's `contents` slot *is* the group shell.
    `Collapsible` renders its body through `useRenderers().contents` and gets
    the implementation's collapse treatment — the grid-rows transition,
    `inert` — without importing it, the way `Stars` gets a shell. Honest
    caveat: this POC's four implementations share one `Contents`
    (`impls/shared.tsx`), so the reuse proved the plumbing, not per-library
    chrome; a real MUI implementation putting `Paper` there is what would
    prove the claim the way `Stars` did. Whether the slot deserves a named
    hook beside `useFieldShell` is a naming question, left.

    **The rule.** A collapsed section is `rendered`, not `hidden`: it keeps
    validating and nothing clears — legacy's Accordion semantics, and what
    lets the badge mean anything. So the implementation must keep collapsed
    content mounted and hide it with CSS, and nothing but a doc comment makes
    it. For a *field*, validators register above the boundary and an
    implementation cannot drop them; for a *group*, the children **are** the
    boundaries, so an implementation that writes `{open && children}`
    unregisters every validator beneath it and clears nothing — finding 25's
    `<Activity>` state by another route, and a guard cannot tell that unmount
    from a legitimate one. Same class of rule as "a tabs implementation may
    not lazily mount panels" (finding 23), and the group case is worse only
    because it is the *obvious* way to write a disclosure. Recorded in
    interfaces §6.

    **Navigation chrome is the widget's own.** The header is a plain
    `<button>`, not an `<Action>`: the action boundary folds the lock cascade
    and stubs its handler in design mode, and a disclosure toggle must do
    neither — a read-only section still opens to be read, and the designer
    still wants to toggle it. The tab strip draws its own buttons for the same
    reason. So there is no themed primitive for a navigation button and the
    widget draws its own, as `Stars` draws its stars; the trade-off finding 27
    named (raw HTML beside themed controls) is accepted here on purpose.

    **Design mode's layer 3 costs a third party one line** — `open ||
    designMode` — and the opt-in is the renderer's, not a dispatcher table's,
    exactly as the goals doc described it. Verified: the section opens and
    the header ignores clicks while design mode is on.

    **One trap, hit while building it.** Hiding the group clears the whole
    `pets` array, not just the names: the collection inside is a field
    boundary bound to the array and runs its own `clearHidden` (finding 16).
    Correct and legacy-shaped — but the group's `summary` prop reads that
    array, and the implementation evaluates it whether or not it is shown,
    so `.length` of `undefined` took the demo down (no error boundary).
    A `FormProp` on a group can read data that hiding the *same* group
    clears; `?.` is the fix, and worth knowing before writing one.

    Small residue: `GroupRenderProps` has `invalid` but not `pending`, so a
    header badge cannot say "checking…" while an async validator under it is
    outstanding. Not asked for yet.

56. **Radio is the select with the list drawn open — plus the one thing legacy
    asks of it that a select never needs.** One controller
    (`useSelectController`) serves both widgets; the radio adds a `radio`
    registry slot, four implementations, and `RadioExtra`: `options`,
    legacy's three `CheckEntryClasses` (the wrapper around each option and
    its selected / not-selected state — Fire's card-style radios use all
    three), and **per-option content**. Legacy expands a radio's children
    once per option with `formData.option` and `formData.optionSelected` in
    scope; 6 of the corpus's 69 radios use it — a description under every
    choice (ShortTermPermit), a detail group under the chosen one (TUP,
    Fire, Burn). In JSX that is a render prop, `(option, selected) =>
    ReactNode`, called for **every** option; content gates itself with
    `<Contents hidden={!selected}>`, never `selected && …`, or the field
    under the unchosen option unmounts and stops validating — finding 55's
    rule, met a second time within the day. Verified in all four
    implementations: the notes field under Inactive is mounted and hidden
    while Active is chosen, the entry classes switch, `readOnly` locks every
    radio, and the select above it moves with it — same field.

    **The loader needed bindings, and the expression cache needed a key.**
    The translator claims `Radio` when the schema has options and, when the
    definition has children, translates them once per option against the
    *parent* scope — legacy binds `parentData`, which is what lets TUP's
    `classification = $formData.option.value` read a sibling — with
    `$formData` bound. So `DataScope` gained `variables`, a function of the
    evaluator's `rc` (a binding that reads the field re-runs the expression
    when it changes, which is what `optionSelected` is), and jsonata's
    second argument carries them. It also gained `cacheKey`: two options'
    children share a control *and* an expression and differ only in
    bindings, and the per-control expression cache (finding 28) would have
    handed option two option one's result. Caught building the fixture.
    Warnings are collected on the first option's pass only; the others are
    the same definitions again. Verified on the JSON tab: a description per
    option via `$lookup($formData.option.value)`, and a notes group that
    appears under whichever option `$formData.optionSelected` says.

    Along the way, `dynamic Display` on a Text or Html display translates —
    its `text` / `html` becomes the value prop — since ShortTermPermit's
    per-option description is exactly that. A translator now declares the
    `dynamics` it reads, as it declares `renderTypes`, so the audit stops
    reporting what it consumed. One audit lesson: `dyn ?? def.displayData.text`
    left the static text *unread* whenever the dynamic existed, and the
    burndown said so — a fallback is consumed whether or not it is used, so
    it is read first.

    Burndown 1,822 → **1,734**. `Radio` 69 → 46, and the 46 are the point:
    every one has **no schema options** — the options come from an
    `AllowedOptions` expression (48 uses), which legacy evaluates to either
    the allowed *values* (a filter over the schema's) or whole
    `{ name, value }` objects (TUP builds its options from another field).
    `options` is already a `FormProp`, so that is loader work with no
    contract question in it, and it now gates the rest of Radio.
    `dynamic Display` 64 → 15, the 15 being DisplayOnly's `overrideText`.

57. **A `silent` container can be written from outside the package, and it
    is the fourth of its kind.** Legacy's `SelectChild` — a group whose
    active child is chosen by a data expression — has **zero uses in the
    83-form corpus**, so by the evidence rule it is not a built-in and has
    no translator. It went in as a third party to answer one question: every
    `silent` producer so far is a framework boundary (`Tabs`, `Wizard`,
    `Dialog`), so can one be written outside at all? It can, with what the
    demo's `Panel` already used — `useBoundScope`, `narrowScope`,
    `FormScopeProvider` — and nothing was exported for it. It is also the
    first container with **no implementation surface**: no chrome, no
    registry slot, which is exactly why it needed no boundary factory.

    It keeps the container rules: every branch stays mounted and validating
    (`silent`, not absent), each hides itself on an unchanging wrapper
    (findings 17, 22, 26 — plain JSX in a branch needs hiding too), and
    design mode shows every branch. Verified: both branches hidden until
    `status` is set, the branch follows the radio and the select, and a
    field required only inside the unchosen branch reports in the state
    table while nothing renders — once finding 58 was fixed.

    The structural observation: `Tabs`, `Wizard`, `Dialog` and now
    `SelectChild` each re-implement *items × presence* — a list of children,
    an active key from UI state / a `Control` / a `FormProp`, optional
    per-item validation scope, design-mode stacking. A `useSwitch(items,
    active)` in the framework would carry all four. Noted for v2; not
    refactored here.

58. **Errors are keyed per control, validators per boundary — and legacy
    knew.** Finding 57's demo binds `email` twice: the Details panel shows
    it, the SelectChild branch *requires* it. The required error never
    appeared. Instrumenting `publish` showed why: the branch's boundary
    published "Please enter a value" under `required`, and the panel's
    boundary — `required: false` — published `null` under the **same key**
    a moment later. Last writer wins, on a timing nothing controls; the
    dialog's `lastName` (finding 43 — "the field the modal shows *is* the
    field") only ever worked because its boundary happened to run after the
    Details one. Two boundaries over one control was a celebrated shape
    with a latent race in it.

    Legacy did not have the race. The settled `forms-core` port publishes a
    node's sync verdict under `uniqueId + "default"` — scoped to the
    FormStateNode, i.e. to the definition instance. The POC's shared
    `required` key was a regression against legacy, not an inheritance.
    Fixed the legacy way: the framework's key is `required@<boundary id>`,
    so a boundary clears only what it set, and a `required` survives a
    `required: false` or a hidden sibling on the same control. Author keys
    stay as written — `jsonata` is still `jsonata`, which is also how
    legacy keyed it, so that one shared-key hazard is inherited and recorded
    rather than fixed. Consequence: two *required* boundaries on one control
    publish two identical messages; `fieldState.errors` is now a set, so
    the same verdict twice reads as one. Verified: `email` reports while
    its branch is silent, keeps reporting with the panel's copy hidden,
    clears on input and returns when cleared.

## Where to pick up

The burndown (`rushx burndown`) is the work list, top-down. At the last run
(1,734): `Inline` 213 is probably a `Stack direction="row"` group;
`noSelection` 108 is a top-level flag on displays and groups with no contract
slot (the DisplayOnly widget honours it, nothing else does); `HelpText` 72 is
a prop the contract already has; then `AllowedOptions` 48 — which is now
also the gate on the remaining `Radio` 46, every one of which has no schema
options because the expression supplies them (finding 56); `renderOptions.groupOptions` 46,
`placeholder` 40, `Display / Custom` 37, `Flex` 36, the array options
`noAdd`/`noRemove`/`noReorder` ~31 each, and `dynamic Display` 15, all of
them DisplayOnly's `overrideText`. `action` 489 stays until the
burndown runs with a host `actionHandler` — `docLink` alone is 47 across
three forms. Of the 55 `schema` warnings, most are `plain name — schema not
supplied` in seven forms that shipped no schema, so the real schema gap is
three. Every loader change is a translator or a prop, then `rushx burndown`
again; a fixture form in `src/loader/demoForm.ts` and a line in the
`From JSON` tab is how each was verified so far.

`SeniorsCardApplicationForm`, one of the three new forms, brought two shapes
the corpus had not asked for: `MessageBox` (10 uses) and `LicenceValidation`.
The rest of the singleton tail — `HtmlEditor`, `Synchronised`
(+ `fieldToSync`/`syncType`), `IconList` (+ `iconMappings`), `GroupElement` —
is all `AllControls`, the testtemplate demo that exists to exercise every
render type, and weighs accordingly.

**What the number does not prove.** The burndown measures *shape coverage*
— did something claim this discriminator, did something read this property.
It cannot see a translation that is *wrong*. Two of the three places to
expect one are closed by finding 52 — jsonata inside a row now carries
legacy's path prefix and `$$`/`$i`, and `a/b` / `../x` bind the right control
*and* scope — but the `defaultValue`-on-becoming-visible cycle is still not
built (`FieldProps` has no `defaultValue`; it surfaces in the burndown as
`unread:defaultValue`, 15 uses in 9 forms), and nothing checks that a
translated expression *computes* what legacy's did. Goal 6's acceptance test
therefore needs a second instrument: render each corpus form in legacy and in
v2 over fixture data and diff visibility, validity and values per field — the
compare-app workstream generalised from one Fire form to the corpus. Also
unbuilt: `LayoutStyle` (15 uses; a dynamic inline style, no contract slot), a
loader hook for host adornments (`Spotlight`) alongside the open
`Translator[]`.

## Things the POC deliberately does not answer

Whether Base UI (family 3, the shape the primitives are modelled on) confirms
or embarrasses them; and design mode's layer 3 for a *portal* renderer — a
third-party dialog selected from the tree rather than the canvas — which is a
designer policy, not something this build can test (the non-portal case is
finding 55's one line).
