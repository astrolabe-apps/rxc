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
```

## What it builds

All six boundaries — `fieldRenderer`, `collectionRenderer`, `groupRenderer`
(with and without `{ scope: true }`), `actionRenderer`, `displayRenderer` and
the options widgets — over the contract: `FormProp`/`getProp`,
`ClassValue`/`mergeClass`, `FormField`/`FieldState`, derived `Presence` with
the `hidden`/`disabled`/`readOnly` props, `<Form>`, `<Contents>`, `<Elements>`,
the validation scope on core's `createDerivedGroup`, keyed validators,
per-boundary `clearHidden`, `arrayActions`, `useAction` + `StandardActionIds`,
the two structural primitives, the `visibility` slot, and the registry. On top
of that: a tab container, a wizard, the staged-edit modal, and a JSON loader
that returns what it could not translate.

| | |
|---|---|
| `src/framework/` | the contract (§1–§10 of the doc) |
| `src/loader/` | the JSON loader — translators, expressions, `translateForm`, `<JsonForm>` |
| `src/impls/html.tsx` | family 1 — children-hosting, class-driven (Bootstrap / shadcn shaped) |
| `src/impls/mui.tsx` | family 2, hardest case — self-rendering input, notched outline |
| `src/impls/antd.tsx` | family 2 — `Form.Item` standalone, runtime theme tokens |
| `src/impls/mantine.tsx` | family 2 — `Input.Wrapper` wired by `id`, polymorphic `Input` |
| `src/widgets/Stars.tsx` | a **third-party** widget: no UI library, own surface, `fieldRenderer(MyImpl)` |
| `src/PersonForm.tsx` | the form source — identical under all four |

Not built, and not pretended: a portal container (dialog), design-mode
substitution, Base UI, and a third-party renderer of any kind but a field.

## What held up

- **The form source is implementation-independent.** `PersonForm.tsx` names no
  library; the switcher swaps all four at runtime.
- **The primitives carry a third party.** `Stars` imports nothing from MUI, Ant
  or Mantine and gets each one's label, required marker, help text and error
  chrome. This is §7's central claim and it survives contact.
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

4. **The field an implementation receives is not the one the author wrote.**
   `FieldState.readonly` has no home on a `Control`, so `state(rc)` cannot be
   computed from the control alone. The boundary re-binds the field to the
   scope (`bindScope`) and hands *that* down — the same move the doc already
   makes for the loader ("a translator never binds one").

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
    `FormField<string>` is not `FormField<string | undefined | null>`. `TextField`
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

19. **The staged-edit case is what justifies `FormField` existing.** Once the
    schema is out of it (see below), the handle is `{ control, state(rc), $ }`
    — which looks like `Control` plus a `useFieldState` hook reading the scope
    from context. For a field rendered where it was bound the two are
    indistinguishable. They diverge exactly where the doc said it had not
    walked: a staged-edit draft belongs to the array's scope, while the modal
    editing it is hosted by a sibling outside that region.

    Built it: `getExternalEdit` caches a controller on the array control's meta
    (so the collection and the host share a session without being near each
    other in the tree), `beginEdit(index, rowField)` captures the scope from the
    row's own field, and the host renders outside the locked region. Measured
    with the region locked: the draft reports `readOnly: true` while the scope
    at the modal's position reports `false`. Context alone gets this wrong and
    hands the user an editable draft that applies through a visible lock.

    Two consequences. `bindScope` had to **combine** rather than replace — a
    bind-time scope and a render-location scope are both restriction-only, and
    replacing was silently throwing the first one away. And the controller has
    to take the *row's* field, not the array field a host holds: the array field
    outside the boundary carries no scope at all, which the first version of
    this got wrong and the readout caught.

20. **`SchemaField` is not needed at this layer.** The build settled it by
    measurement: across four implementations and both data boundaries, the only
    expression that read one was `label ?? schema.displayName`. Every other
    reference was the schema carrying itself through `$`, through element
    wrappers and through scope re-binding, so that one default stayed reachable.
    Options would have been the second reader; validators are already ruled out,
    since they are declared at the usage and never inherited from the field.

    So `FormField<T>` is `{ control, state(rc), $ }` — a scoped control handle,
    nothing more — and `buildSchema` left the JSX path with the schema, because
    `$` was typed from `T` all along, not from the metadata. Labels are props
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

    `useAction(id)` resolves the implementation's button for composition,
    mirroring `useFieldShell()`. The distinction that matters is not the name
    but what each caller gets: **dispatched** components (a boundary picked
    them) arrive with validators, presence, locks, `clearHidden` and
    design-mode stubbing; **composed** ones get appearance only. A button
    needing busy state goes through `<Action>`, not `useAction`.

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
    optional `page?: FormField<number>`. The demo binds it, and `wizardPage: 1`
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

## Things the POC deliberately does not answer

A portal container — the one §6 shape never built, and the one design mode's
layer 3 is about; design-mode substitution (`Dialog → Contents`, `Tabs → all
stacked`); whether Base UI (family 3, the shape the primitives are modelled on)
confirms or embarrasses them; and whether a *third-party* group, collection or
action renderer can be written against the contract the way `Stars` was for a
field — the collection case, reaching `arrayActions` and the staged-edit
controller from outside the package, is the likeliest to force a change.
