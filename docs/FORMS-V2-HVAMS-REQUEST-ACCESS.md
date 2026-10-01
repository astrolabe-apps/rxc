# Forms v2 — the HVAMS Request Access conversion

Status: **findings from a real adopter, against `0.1.0-alpha.0`.** The first form outside this
repo written against the contract: HVAMS's public *Request Access* form, converted from
`@astrolabe/ui` compat widgets to `@rx-controls/forms-react`, drawn by `forms-html`, then mounted
unchanged under `forms-antd`. The goal was to find where the abstraction does not reach, not to
ship a page. What the contract promises is in [`FORMS-V2-GOALS.md`](./FORMS-V2-GOALS.md); its
design in [`FORMS-V2-INTERFACES.md`](./FORMS-V2-INTERFACES.md).

## The form

A compat-engine app (`@react-typed-forms/core`, the SWC tracking plugin, one root
`ControlContextProvider`) — exactly the situation `apps/dev/src/app/(dev)/v2/compat/CompatFixture.tsx`
models. The form:

- four text fields (first / last name, email, phone), with `autoComplete` and `required`;
- a state select whose options come from a server call, and an agency select shown only once a
  state is chosen, reset to the state's first agency when the state changes;
- a *set of reasons* — `AccessRequestReason[]` — as checkboxes;
- a reason text (≤ 300) and, when "Other" is among the reasons, a description (≤ 250), each with an
  "n / max characters" counter; the description is cleared when it hides;
- Submit, which posts and maps the server's 400 (per-field validation), 409 (a vague refusal with a
  support link) and 429 (retry-after) responses, and a success view.

The data layer stayed as it was: compat `useControl<AccessRequestEdit | null>()` and its fields,
passed straight into v2 bindings. The form files import only `forms-react`, `@rx-controls/react` /
`@react-typed-forms/core` and HVAMS's non-UI code; the page puts
`<FormProvider renderers={htmlRenderers}>` around it and nothing else names an implementation.
The rule held everywhere except the places listed under §1.

**Verified:** the e2e specs (rewritten only where the markup forced it — §4), a manual walk
(refused submit, server 400, switching state after picking an agency, "Other" on / off / on), a
clean console, and `getCompatPatchInfo()` reporting `engineCopies: 1`.

## 1. Gaps in the contract

**No `maxLength` on `TextField`.** The original inputs stopped the user at 300 / 250 characters.
In v2 the limit is only a `validate` rule, so typing continues past it and an error appears. HTML's
`maxlength` and React Native's `TextInput.maxLength` are the same concept on both platforms — the
test `TextFieldExtra` already applies to `inputMode` and `autoComplete`. Suggested: a
`maxLength` contract prop that the boundary also registers as a rule, the way `CollectionProps`
does for arrays, so the cap and the message cannot disagree.

**A select keeps a value that is not among its options.** When the state changes, the agency
still holds the previous state's agency; `useSelectController`
(`packages/forms-react/src/controllers.ts:168`) resolves the options but never reconciles the
value against them. HVAMS needed a `useControlEffect` to clear it. Every derived option list has
this problem — it is what "a derivation re-filters them as the data moves" (the `options` doc)
leads to. Suggested: a boundary option on the options widgets (`restrictToOptions`, or making it
the default under `clearHidden`-style form policy) that clears a value no option names, once the
options are decided.

**No "reset when X changes".** The original wrote the new state's first agency on every state
change. v2 gets there by composition: the effect above clears the stale agency, and
`defaultValue={(rc) => stateAgencies(rc)[0]}` refills the now-`undefined` field. Neat, but not the
same rule — an agency whose name exists in both states is *kept* rather than reset. No agency name
repeats today, so it is latent. If the stale-value option above existed, this pairing would be the
idiomatic answer and worth documenting as such.

**`clearHidden` writes `undefined`, whatever the field's type** (`field.tsx:243`). The original
cleared the description to `""`; the DTO types it `string | null`. It type-checks only because a
compat field under a nullable parent is `Control<X | undefined>` — with a non-nullable parent the
write is a lie the types cannot see. A server contract that wants `null` has no way to say so.
Suggested: let `<Form>` (or a field) name the cleared value, or at least document that
`clearHidden` fields must admit `undefined`.

**No form-level message.** The submit error became `<TextDisplay text={submitError} hidden={…}>` —
the `Control` arm of `FormProp` binding the display straight to a control is exactly right. What is
missing is meaning: there is no error tone and no `role="alert"`, and the 409 message's support
link is a raw `<a>` inside `text`, because there is no link display. A `tone` (or a dedicated
message display) would cover the first two.

**No column layout — and, under it, containers cannot see which children are hidden.** The
original laid the four personal fields out two to a row. v2 has nothing that does that: a group's
`layout` is `StackLayout` (flex only), §9 of the interfaces doc lists a `grid` slot in
`FormRenderers` that no package implements, and `forms-json` translates Standard, Group, Contents,
Inline, Flex, Tabs and Dialog groups but not legacy's `Grid`. Legacy's `GridRenderer` chunks the
*visible* children into rows of `columns` (default 2), with per-column `cellClass` and a
`rowClass`; hidden children are filtered before chunking, so a hidden field never leaves a hole
(`legacy/RENDERER-CATALOG.md`).

Legacy's grid is the **same on both platforms**: `schemas-html` and `schemas-rn` ship an identical
`GridRenderer` — filter to visible children, chunk into rows, wrap each cell in a `Div` with its
`cellClass` or `flex-1`. Neither is a CSS grid, so both lose cross-row alignment equally.
`FORMS-V2-GOALS.md` (the "platform-specific degradation" paragraph) presents the RN renderer's
chunking as RN degrading relative to the web; the web renderer does exactly the same. That
paragraph now says so — `Grid` is not evidence of platform divergence.

The filtering is the part v2 cannot do as written, on either platform. A group receives
`children: ReactNode`, which is opaque, and presence is resolved inside each child's boundary, so
the group has no way to ask "which of my children are hidden" — which is what chunking into rows
needs. Two ways out:

- **CSS grid on the web.** A group body with `display: grid; grid-template-columns: repeat(n, 1fr)`
  skips hidden children by itself: a hidden field renders nothing through its `visibility` slot and
  a hidden region carries the `hidden` attribute, so neither takes a cell. It also keeps columns
  aligned across rows, which legacy did not. But it is a web-only mechanism: React Native has no CSS
  grid, and an RN implementation wrapping each opaque child in a `1/n`-width `View` leaves a hole
  for every hidden field — a divergence legacy did not have.
- **Tell the group what is visible.** Boundaries already publish upward — a field attaches its
  verdict to the nearest validation scope — so a group could collect its children's presence the
  same way. The catch is mapping a report back to a position in opaque `children`: a boundary knows
  its own presence, not which child slot of its parent it sits in. So this probably means a grid
  that takes structured `items` (as Tabs and Wizard do) or wraps each child in a cell boundary of
  its own, whose presence it can read.

For this form a `columns` option on `StackLayout` (or a `Grid` group over the planned `grid` slot)
drawn as a CSS grid would do on the web. Parity with legacy on both platforms needs the second.

**Resolved for the grid (after the trial):** no grid boundary and no `columns` option. Layout is
classes on the group's body — which is how the ServiceTas corpus already lays forms out, its
responsive layouts being Tailwind classes on Standard groups rather than `Grid` groups — and
`<Contents transitions={false}>` makes each child exactly one element with no transition
wrapper, so a hidden child produces no box and CSS grid's auto-placement *is* legacy's
filter-then-chunk. Per-breakpoint columns are breakpoint classes. The conformance suite now
holds every implementation to one element per boundary, with `shellClassName` on it. See
`FORMS-V2-INTERFACES.md` §7, "Layout is classes". The Tabs and Wizard cases below are not
layout and stay open.

The same question comes up in two containers v2 has already built, and there it is not cosmetic:

- **Tabs.** Legacy's `TabsRenderer` filters hidden children out of the strip. v2's `TabItem` is
  `{ key, title, children }` — no `hidden` — so a tab whose content is hidden stays in the strip
  with an empty panel. `forms-json`'s Tabs translator maps each child definition to an item
  without looking at its visibility (`packages/forms-json/src/translate.tsx`), so a JSON form with
  a `Visible` expression on a tab should render an empty tab where legacy removed it. Found by
  reading the translator; not run against the corpus.
- **Wizard.** Legacy's wizard state has a visible-only `page` and `totalPages` beside the raw
  index (`legacy/ACTIONS-AND-WIZARD.md`), so hidden pages are skipped by Next / Back and left out of
  the step count. v2's `WizardPage` has no `hidden` either, so a conditional page cannot be
  skipped.

For those two the structured-`items` rule the contract already follows is the answer — "a
container that needs per-child metadata takes it structured, not as children" — and visibility is
per-child metadata: a `hidden?: FormProp<boolean | undefined>` on `TabItem` and `WizardPage`,
narrowing that panel's presence to `hidden` (so `clearHidden` still applies to it) and removing it
from the strip or the step sequence. The same mechanism — per-child `hidden` on a structured item,
or a cell boundary per child — is what a grid needs for parity, so all three are one design
question, not three.

**Resolved for Tabs and Wizard (after the trial):** `hidden` is on `TabItem` and `WizardPage`, as
proposed — off the strip or out of the step sequence, the panel mounted and `hidden`, a hidden
current tab or page handing over — and `forms-json` carries a Tabs child's `Visible` onto its
tab. The conformance suite holds all three implementations to it.

**Smaller ones:**

- **Section titles are not headings.** `Contents title` draws a `<div>` in `forms-html` (and in Ant,
  which shares `Contents`); a form with sections has no heading structure.
- **A display with a state.** The counter turned red past the limit. That needs a class, which the
  "contract only" rule forbids; a tone would cover it too.

**Migration cost, not a contract gap:** `AccessDetailsSection` is also rendered by a second,
unconverted form (`ModifyAccessForm`). A converted section needs a `FormProvider` and a `<Form>`
above it, so converting one host means converting every host or keeping a legacy copy. HVAMS
kept a copy.

**What the contract expressed directly, with no effect:** the agency's `hidden` prop; clearing the
description (`<Form clearHidden>` + `<Contents hidden>`); the counters (`TextDisplay` with a derived
`text`); the email prefilled from the URL (`defaultValue={initialEmail}` replaced a `useEffect`);
and an `<Action>` in the success view, outside any `<Form>`.

## 2. A multi-select written from outside

There is no built-in field for a set of values, so HVAMS wrote `CheckListField`: `fieldRenderer`,
`useFieldShell` with `labelAs="legend"`, and plain DOM checkboxes inside the shell.

**What came free** — the question `Stars` was built to answer, confirmed on a second widget: the
label, the required marker, the error, show-after-touch, the locks (through `useFieldState`), and
`required` on an empty array (`isEmpty` already handles arrays). Under `forms-antd` it picked up
Ant's shell — asterisk, error colour, spacing — with no change.

**What was awkward:**

- **No controller.** `useTextInput`, `useNumberInput`, `useCheckbox` and `useSelectController`
  exist; nothing for an array. The widget hand-writes `useReactive`, the toggle through
  `wc.updateValue`, touched-on-blur, and resolving `options` with `getProp`.
- **`FieldOption.value` includes `boolean`**, which a set of checkbox values does not want; the
  widget casts it.
- **The generic cast.** `fieldRenderer` returns a component fixed to one `T`, so a generic widget
  casts — `Stars` with `as unknown as` (`tools/forms-conformance/src/widgets/Stars.tsx:64`), the
  built-ins with `as never`. In practice both compat and core `Control<AccessRequestReason[] |
  undefined>` were accepted by the *uncast* component, so the cast buys only a typed `validate` and
  `defaultValue`. Worth either a generic-returning overload or a note in the extension docs that the
  cast is cosmetic.
- **No label id from the shell.** The shell puts the name on a `fieldset` / `legend`; the widget's
  inner `role="group"` carries `aria-describedby` but cannot point `aria-labelledby` at a legend it
  was never told the id of. So no single element has both the name and the description.

**Wanted built in:** a `CheckListField` (or multi-select) registry slot over `FieldOption[]`, so
Ant and MUI draw their own checkbox group; failing that, a `useMultiSelectController` alongside the
others.

## 3. Validation and submit

**The contract covered the real form.** `required` on every mandatory field, the length limits as
keyed `validate` rules, and a Submit `<Action>` whose handler awaits `useFormValidation().check()`
before posting. A refused submit touches everything and shows every error; hidden fields — the
agency before a state is chosen, the description without "Other" — do not block. The async
handler's `self` lock replaced the form's hand-rolled `isSubmitting`.

**Server errors land where they should.** HVAMS's `applyValidationErrors` sets each 400 message on
its control under the key `"default"`. Those keys are unclaimed, so every boundary on the control
mirrors them into its verdict and shows them — verified under the email and phone fields. Being in
the verdict, they also count against the scope, so `check()` refuses until the user edits the field
(read from the code, not exercised on its own). The clearing is core's, not v2's: any `setValue`
clears the control's errors (`packages/core/src/controlImpl.ts:182`), and the validators republish.
That makes the server-error lifecycle correct with no code, but it is nowhere in the v2 validation
story and should be.

**Bug: a bare-function `validate` hides server errors.** A bare validator is keyed `default`
(`fieldValidation.ts:103`) — the same key HVAMS, and very likely other hosts, use for server
errors. The boundary claims `default`, so the server's message is treated as its own rule's and
never mirrored into the verdict: it is on the data, but the field shows nothing and `check()` passes.
Reproduced by adding `validate={() => null}` to Email: the server's email error vanished while
Phone's still showed. Keyed validators (`validate={{ maxLength }}`) are unaffected. Suggested:
key a bare validator per boundary, as `required` already is (`default@<boundary id>`), which also
fixes two boundaries on one control sharing a bare validator's key.

**No native submission.** `forms-html`'s action is `type="button"` and `<Form>` renders no
`<form>`, so Enter in a field submits nothing. Whether `<Form>` should own a submit action (an
`onSubmit` that is the root's `check()` plus the handler) is a question the first real form raises
immediately.

## 4. The implementation swap

The unchanged form mounted under `antdRenderers` behaved identically: required errors on a refused
submit, the agency hidden then defaulted, `clearHidden`, server 400s under the right fields, a valid
submit, the success view's action, and a clean console. Two differences.

**Errors lose their accessible link under Ant — a `forms-antd` bug, rooted in the contract.**
`describedBy()` (`packages/forms-react/src/primitives.tsx:231`) points every control at
`${id}-error` / `${id}-help`. `forms-html`'s shell renders elements with those ids; Ant's shell is
`Form.Item` with `help=` (`packages/forms-antd/src/antd.tsx:64`), which renders the message under
ids of its own. So under Ant each input's `aria-describedby` names an element that does not exist:
the error is visible and invisible to assistive technology. The e2e spec's
`toHaveAccessibleDescription` found it at once. The convention is not in `FieldShellProps`, so an
implementation cannot know it has to honour it. Suggested: make the ids the shell's — either
`FieldShellProps` takes `errorId` / `helpId` and every shell must render them, or the shell reports
them back — and add the check to the conformance suite.

**Ant's select is a combobox, not a `<select>`.** Playwright's `selectOption` fails. That is test
portability, not a gap: e2e tests written against one implementation's native controls do not carry
over. The ones that assert through the accessibility tree (label, description) did, apart from the
bug above.

## 5. Compat interop and the engine bump

- **One engine copy, as required.** Forms v2 needs `@rx-controls/core` 1.1.0, which only compat
  5.1.0 depends on. HVAMS bumped `@react-typed-forms/core` to `^5.1.0` in all eight workspace
  projects — and one project also declared `@rx-controls/react ^1.0.0` directly, which needed the
  same bump. The lockfile then resolves one `@rx-controls/core` 1.1.0 and one `@rx-controls/react`
  1.1.0, nothing on compat 5.0.0, and `getCompatPatchInfo()` reports `packageCopies: 1,
  engineCopies: 1`. Every HVAMS site built without change.
- **No casts.** Compat controls went into v2 fields as they were, and `rc.getValue` on compat
  controls works inside derived props, next to ambient `.value` reads in the same component.
- **Fields under a nullable parent are `Control<X | undefined>`**, so a custom widget's value type
  has to admit `undefined` — which `clearHidden` needs anyway (§1).
- **The SWC tracking plugin and `useReactive` coexist** in the custom widget with no warnings.

## Suggested changes, in order

1. Key bare validators per boundary (§3) — a silent loss of server errors.
2. Put the error / help ids in the shell contract and fix `forms-antd` (§4) — an accessibility
   regression on every Ant field.
3. `maxLength` on `TextField` (§1).
4. Reconcile an options widget's value against its options (§1).
5. `hidden` on `TabItem` and `WizardPage`, and a column layout (§1) — the first is a legacy parity
   gap in `forms-json`, not just a JSX one.
6. A multi-select slot, or at least its controller (§2).
7. Decide whether `<Form>` owns submission (§3), a message display with a tone (§1), and the value
   `clearHidden` writes (§1).
