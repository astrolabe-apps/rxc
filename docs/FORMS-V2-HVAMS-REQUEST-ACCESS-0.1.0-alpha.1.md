# Forms v2 — HVAMS Request Access trial, `0.1.0-alpha.1`

The second adopter trial: the HVAMS **Request Access** form (RMI, `/requestAccess`, a guest
route) converted to Forms v2 against `@rx-controls/forms-react@0.1.0-alpha.1`, drawn with
`forms-html@0.1.0-alpha.1`, then mounted unchanged under `forms-antd@0.1.0-alpha.1`. A cold
read: the conversion was written from the contract docs and package sources before the previous
run's report ([`FORMS-V2-HVAMS-REQUEST-ACCESS.md`](./FORMS-V2-HVAMS-REQUEST-ACCESS.md)) was
opened. §6 is the only part written after reading it. Brief:
[`FORMS-V2-HVAMS-TRIAL-BRIEF.md`](./FORMS-V2-HVAMS-TRIAL-BRIEF.md).

Source line numbers are against rxc `025f60a` (the published alpha.1 `src` is byte-identical to
`packages/*/src` there). The HVAMS branch is throwaway: `trial/forms-v2-request-access-alpha1`,
a worktree off `develop` `5f618101b`, uncommitted.

**Verdict.** The form converts cleanly. It needs no widget, no cast, and no form-logic
effect. Every behaviour the original got from an effect or a disabled button is now a prop:
`defaultValue`, `clearTo`, `restrictToOptions`, `maxLength`, `hidden`, `required`,
`<Form onSubmit>`, `<Action submit>`. The form source is 288 lines, against 344 before. What the
trial found is mostly at the **accessibility edges** and in **focus/touch semantics**, not in
the authoring surface. One finding breaks a real HVAMS flow: the check list's `onBlur` touches
the field on every focus move between its own checkboxes. Inside a centred dialog the
appearing error moves the page under the pointer and the click is lost. That fails 3 of 9
tests in the modify-access spec.

---

## What was built

| | |
|---|---|
| `common/…/RequestAccessForm.tsx` | the form; compat `useControl<AccessRequestEdit \| null>()` and its fields, passed straight into v2 fields |
| `common/…/AccessDetailsSection.tsx` | the shared section: `CheckListField`, the reason and description with counters |
| `common/…/ModifyAccessForm.tsx` | the second host: a legacy `@astrolabe/ui` dialog that now renders the v2 section inside a bare `<Form clearHidden>` |
| `rmi/app/requestAccess/page.tsx` | `<FormProvider renderers={htmlRenderers}>`, the one place the implementation is chosen |
| `rmi/app/userProfile/page.tsx` | the same, around the modify dialog |
| `rmi/app/requestAccessAnt`, `…Compare` | scaffolding: the unchanged form under `antdRenderers`, and the original (restored from git) beside v2-under-Ant |
| `rmi/playwright/e2e/forms-v2-trial.spec.ts` | the brief's checks, parametrised over html and Ant, failing on any console warning or error |

The form files import only `@rx-controls/forms-react`, `@react-typed-forms/core`,
`@rx-controls/core` (for the `ReadContext` type, see 1.7) and HVAMS non-UI code. Nothing from
`@astrolabe/ui`, no implementation package, and no class names except layout. The submit-error
link's `underline font-medium` is visual styling of content inside a `TextDisplay`. It is the
only class that is not layout, and it was carried over verbatim.

**Results.** `rush build` succeeds for all 8 workspace projects. Under both implementations
these pass: `request-access.spec` (2), `guest-routes.spec` (3), and `forms-v2-trial.spec` (5
checks × 2 implementations), with no console warnings. `modify-access-request-submission.spec`
fails 3 of 9 tests because of 1.1. With 1.1 patched locally those tests move on to a 409 from
in-flight requests left in the shared dev database. The original code fails that step
identically, so the 409 comes from the environment, not the conversion.

### Where each requirement landed

| requirement | how | effect? |
|---|---|---|
| email prefilled from `?email=` | `defaultValue={initialEmail}` (`field.tsx:102`) | **no** (was `useEffect`) |
| agency hidden until a state is chosen | `hidden={(rc) => !rc.getValue(state)}` | no |
| agency resets to the state's first agency | `defaultValue={(rc) => agenciesFor(rc)[0]}` + the default `restrictToOptions` (`widgets.ts:97-109`) | **no** (was `useControlEffect`); see 1.4 |
| agency no longer in the options is cleared | `restrictToOptions`, on by default (`fieldValidation.ts:348-386`) | **no** (was `useControlEffect`) |
| description shown only with "Other", cleared when hidden | `<Contents hidden>` + `<Form clearHidden>` + `clearTo={null}` (`field.tsx:94`) | **no** (was two `useControlEffect`s, one per file) |
| …to what the DTO expects | `clearTo` is `null` for `AccessRequestEdit`, and `""` for the modify dialog's local model; it became a prop of the section | no |
| 300 / 250 limit, error if longer arrives | `maxLength` on `TextField` (`widgets.ts:31-38`, rule at `builtins.ts:50-58`) | no |
| "n / max" counter, red past the limit | `TextDisplay` with `text` and `tone` as `(rc) => …` (`display.tsx:47-50`) | no, and no widget |
| two to a row on wide screens | `className="grid grid-cols-1 gap-4 md:grid-cols-2"` on the `Section` | no |
| submit only once valid; Enter submits | `<Form onSubmit>` + `<Action submit>` (`scope.tsx:175`, `action.tsx:67`) | no; `isSubmitting` and `submissionDisabled` are gone |
| 400 / 409 / 429 handling | unchanged, inside `onSubmit`; 400 still goes through `applyValidationErrors` | no |
| submit error announced | `TextDisplay announce tone="error"` (`display.tsx:51-58`) | no; see 1.3 |
| agency list fetch | `useEffect`, as before | yes, but it is data loading, not form logic |

The original grid was `grid-cols-2` at every width. The brief's "as the original did" was not
accurate: the responsive layout is new.

---

## 1. Gaps in the contract

### 1.1 A set-of-choices control is touched when focus moves *inside* it — and a dialog eats the click (contract + both implementations)

`useMultiSelectController` hands out `onBlur` (`controllers.ts:251`) with no word on *where*
to call it. Both implementations put it on the group `div` as React `onBlur`
(`forms-html/html.tsx:414`, `forms-antd/antd.tsx:372`). React `onBlur` is `focusout`, which
fires when focus moves from one checkbox to its sibling. So the field turns touched while the
user is still inside it. If the set is empty, the required error appears at that moment.

On the request page that is only early. In the user-profile **modify dialog** (a centred
Radix dialog) it is a lost click. The user unticks "View" (the set is now empty) and presses on
"Other". Mousedown moves focus, `focusout` touches the field, the error line renders, and the
dialog grows and re-centres 10px up. Mouseup then lands on the error paragraph and the click
goes to the `fieldset`. An event probe showed this directly: `mousedown INPUT Other @485`,
`mouseup P`, `click FIELDSET`. Three tests in `modify-access-request-submission.spec` fail on
`locator.check: Clicking the checkbox did not change its state`. A local patch to forms-html
(`if (!e.currentTarget.contains(e.relatedTarget)) ctl.onBlur()`) gets all three past that
step. The radio has
the same shape per input (`html.tsx:371`).

*What I did instead:* nothing in the form. The bug is below the contract.
*What the library should offer:* the controller should own "left the widget". For example, a
`groupProps` / `onFocusOut(e)` that checks `relatedTarget`, or a documented rule on
`FieldController.onBlur` that a multi-element widget calls it only when focus leaves the whole
widget. The conformance suite should tab and click *between* options of a check list and a
radio, and assert the field is not touched until focus leaves.

**Fixed (after the trial):** `onFocusLeave` in `forms-html/shared` runs the controller's
`onBlur` only when `relatedTarget` is outside the widget. The check lists and radios of html,
MUI and Ant all use it; html's radio now blurs on its `radiogroup` instead of on each input.
`MultiSelectController.onBlur` and `SelectController.onBlur` document the rule. The
conformance suite moves focus from one option to the next (not touched) and then out
(touched), for a check list and a radio, under every implementation.

### 1.2 `required` never reaches assistive technology, and the marker pollutes the name (contract + both implementations)

There is no `required` or `aria-required` on any control under either implementation. The
original `Textfield` set `required` on the `<input>`. The contract hands `required` to the
shell for the **marker** only (`primitives.tsx:313-314`). `ControlSlotProps`
(`primitives.tsx:337-358`) has `aria-invalid` and `aria-describedby` but no `aria-required`,
so a frame has nothing to pass on. At the same time the marker text sits inside the label, so
it becomes part of the accessible name. Under html the name is `First Name*` (theme
`required.text: "*"`, `theme.tsx:308`, not `aria-hidden`). Under Ant it is `* First Name`. The
two implementations disagree on the field's *name*, and neither says the field is required.

*What I did instead:* the page object matches labels with `/^(\*\s*)?Label\s*\*?$/`.
*What the library should offer:* `aria-required` (or `required`) on `ControlSlotProps`, and on
every self-drawn widget (select, check list group, radio group). The marker should be
`aria-hidden`. The conformance suite should assert the exact accessible name, not just that one
exists.

**Fixed (after the trial):** `InputFrameProps.required` becomes the control's `aria-required`
through `ControlSlotProps`, and the select, radio group and checkbox set it themselves, under
html, MUI and Ant. `aria-required` and not the native attribute, which would add the browser's
own bubble. Every implementation's marker is `aria-hidden`. Ant's is now drawn by the shell,
since `Form.Item`'s `required` draws it as a CSS `::before`, which browsers read into the
name. Conformance asserts the exact name and `aria-required`. One exception: ARIA allows neither
`aria-required` nor `aria-invalid` on `role="group"`, so a check list says it is required only
through its error description.

### 1.3 `announce` and `hidden` don't compose (contract)

The submit error has to be a live region that is empty until a submit fails. The contract says
a live region must be "an element that stays mounted" (`display.tsx:84-88`). But a
`TextDisplay` with `hidden` renders nothing, because the display boundary goes through
`visibility` (`display.tsx:185`). So the obvious spelling,
`<TextDisplay hidden={(rc) => !rc.getValue(submitError)} announce …/>`, inserts a fresh
`role="alert"` element with its content already in it. Whether that is announced depends on
the screen reader. The author has to know to leave the display **always shown**, with empty
text, and a constant `tone="error"`. That means an empty `role="alert"` box sits in the page
all the time, and a themed implementation may draw an empty error box (forms-html unstyled
doesn't).

*What I did instead:* always shown, `text={submitError}`, so the content changes inside a
stable region.
*What the library should offer:* either have `announce` keep the live-region element mounted
under `hidden` (hide its content, not the element), or have `TextDisplay` draw nothing visible
when its text is empty. The second is what an author expects of an error message.

**Fixed (after the trial), both ways:** an `announce`d display is never unmounted. Under
`hidden` the boundary hands the implementation `regionOnly`, and it draws only the live-region
element: empty, out of the layout (not a grid item), and the same node once the content
arrives. An announced text or html display with empty content draws the same way. So
`<TextDisplay hidden={(rc) => !rc.getValue(submitError)} text={submitError} tone="error" announce />`
is now correct, and so is the trial's always-shown spelling, which no longer draws an empty
box. It skips the `visibility` slot, so there is no exit transition. Conformance and the
`DisplayAnnouncedError` story cover it.

### 1.4 "Reset to the first choice" holds only when the old value leaves the list (contract semantics)

`restrictToOptions` + `defaultValue` (`widgets.ts:97-109`) clears the agency only when the
state change *moves the list away* from it, and then refills it with the first agency. The
original reset to the first agency on **every** state change. The two agree only because no
agency name appears in two states (checked against the live data: QLD 100, TAS 31, no overlap).
If one did, v2 would keep the shared agency. That is arguably better, but it is different, and
the docs present the pairing as "reset to the first choice when the list changes".
*What the library should offer:* a sentence in `restrictToOptions`' doc saying it is
"move-away", not "on change". An author who needs reset-on-change still writes the effect.

### 1.5 A keyed `default` validator silently swallows the server's 400 (contract hazard)

Server errors arrive under `"default"` (`applyValidationErrors`). The boundary copies any
error key no rule claims into its verdict (`fieldValidation.ts:190-231`), and a **bare**
`validate` is keyed `default@<id>` (`fieldValidation.ts:73-75`), so it doesn't collide. I
checked: with `validate={() => null}` on Phone Number, the server message still shows, is the
field's accessible description, and clears on edit, under html and Ant. With
`validate={{ default: () => null }}`, the boundary claims `default` and the server message
**never shows**. `applyValidationErrors` returns the applied list, so the form's "please check
the form" fallback doesn't fire either, and the user sees nothing at all.
*What the library should offer:* a dev warning when an author key equals a key that already
holds an unclaimed error, or reserve `default` the way `required@` is reserved.

**Fixed (after the trial):** `default` is reserved. A record's `default` validator is published
under `default@<id>`, the same as a bare function, so `{ default: fn }` and `fn` mean the same
and neither claims the key server errors arrive under. A warning would not have covered it:
the server error usually arrives after the field has mounted, and a write to a claimed key
can't be told apart from the author's own rule. The HVAMS repro test runs with both spellings.

### 1.6 Clearing a server error on edit is the core's, not the form's (observation)

The server message goes away on edit because **core clears every error on every value write**
unless the control has `keepErrors` (`core/src/types.ts:20-33`). It is correct here, but
nothing in the forms contract states it, and a host that sets `keepErrors` on a form's data
for another reason would leave the user stuck: the unclaimed error stays in the verdict, and
`check()` refuses every later submit. Worth one line in `FieldRenderProps.error`'s doc.

**Fixed (after the trial):** `FieldRenderProps.error` now says so, including the `keepErrors`
consequence.

### 1.7 `ReadContext` is not re-exported (minor)

Writing a derivation once and using it in several props (`otherChosen(rc)`, `agenciesFor(rc)`,
`length(rc)`) needs the `ReadContext` type, which forms-react doesn't export. Neither does the
compat package. So `hvams-common` gained a direct `@rx-controls/core` dependency only for a
type. `FormProp` is exported, and the type its function arm takes should be too.

**Fixed (after the trial):** forms-react exports `ReadContext`, an alias of core's (the same
type, in the reference under Authoring).

### 1.8 Things that are not gaps

- **Compat controls in, no cast.** `Control<AccessRequestReason[] | undefined>`,
  `Control<JurisdictionType>` and `Control<string | null | undefined>` fit `CheckListField`,
  `SelectField` and `TextField` as written. `tsc` is clean.
- **A `Control` as a `FormProp`.** `text={submitError}` (a compat `Control<ReactNode>`) works
  through `getProp`'s duck typing (`props.ts`).
- **Heading structure.** `Section title` becomes `role="heading" aria-level=2` under the page's
  `h1` (`scope.tsx:110-115`, `group.tsx:186-196`), under both implementations.
- **Visibility inside containers.** Nothing in this form needs a container to know which of
  its children are hidden. With Last Name temporarily hidden, Email moved into its cell under
  html and Ant. A hidden field boundary leaves no box (`transitions={false}`), and the grid's
  auto-placement does the rest. With transitions on, html's `FadeVisibility` wraps each field
  in one `div`, which is still one grid item, so `transitions={false}` turned out to be
  optional for layout. It only removes the 200ms hold on hide.

---

## 2. The multi-select

**Nothing had to be written.** alpha.1's `CheckListField` (`builtins.ts:117`) binds
`AccessRequestReason[]` directly, and `required` refuses the empty array (`isEmpty`,
`fieldValidation.ts:55-60`). So the brief's fallback, `fieldRenderer` + `useFieldShell`, was
never needed.

**Free:** label, required marker, `requiredMessage` ("Select at least one reason for access",
matching the server), the error as the group's accessible description under both
implementations, touch on a refused submit, locks, and the shell's ids.

**Awkward:**
- HVAMS keeps options as `[value, label]` tuples (`reasons.ts`); `FieldOption` is
  `{ name, value }`. A one-line map, kept at module level so it is stable.
- **html draws two nested groups with the same name.** The shell renders a `fieldset` +
  `legend` for `labelAs="legend"` (`html.tsx` `HtmlFieldShell`), and the widget renders an
  inner `role="group"` labelled by the same legend (`html.tsx:410`). The comment above it
  (`html.tsx:384-387`) says "the one `role="group"` carries both", but there are two, and only
  the inner one is described. The accessibility tree shows `group "What do you need…*"`
  containing `group "What do you need…*"`. The page object has to pick `.last()`. Ant (no
  `fieldset`) has one group.
- The internal-focus touch (1.1).

**Would want built in:** "focus left the widget" in the controller (1.1), and a conformance
check that a set-of-choices widget is exactly one named, described group.

**Fixed (after the trial):** a `labelAs="legend"` shell is now a caption that the widget's own
group names by id, with no `fieldset`. html and MUI drew one before. Conformance asserts exactly one
group for a radio and a check list under every implementation.

---

## 3. Validation and submit

`required`, `maxLength`, `check()` (through `<Form onSubmit>`) and the server-error mirror
covered the whole form. No `validate` was needed: the only client rules are required-ness and
length, and the phone pattern stays server-side, as before.

- **Refused submit.** Clicking Submit on an empty form gives every required field's control
  (`First Name`, `Last Name`, `Email`, `State / Territory`, `Reason for access`) the accessible
  description "Please enter a value", and the reasons group gets "Select at least one reason
  for access". Nothing is posted and there is no success view. Same under html and Ant.
- **Enter.** In a real browser (Playwright), Enter in an empty First Name is refused with
  every error shown and no POST. Enter in Reason for access on a valid form posts **once**
  and shows the success view. Same under html and Ant: both use `FormElement`
  (`html.tsx:809`, `antd.tsx:765`). The desktop app's browser pane sends a synthetic Return
  that does not trigger implicit submission, which is a tool limitation and not a v2 bug.
- **Busy.** The submit action is busy while `onSubmit`'s promise runs (`action.tsx:242-259`),
  which replaced the original's `isSubmitting` control.
- **Server 400.** The email and phone messages show under their fields as the controls'
  accessible descriptions, under both implementations, and clear when the field is edited
  (1.6). After that, a resubmit goes through.
- **Bare `validate`.** The server message still shows (1.5).
- **409 / 429.** Unchanged in `onSubmit`. The 409 message (with its link) appears in the
  `role="alert"` display under both implementations. The counter has no live-region ancestor.
- **A field revealed after a refused submit shows its error at once.** `check()` touched the
  hidden description too, so ticking "Other" after a refused submit shows "Please enter a value"
  before the user has typed. That is defensible ("you already tried to submit"), but it is a
  choice the docs don't state.
- **Select has an empty choice.** The required agency, defaulted to the first agency, can still
  be set back to "" (html's empty `<option>`, `html.tsx` `HtmlSelect`; Ant's `allowClear`,
  `antd.tsx:585`). The original `NSelect` behaved the same. A `required` select could reasonably
  drop the empty option once it has a value.

---

## 4. The swap

The unchanged form under `antdRenderers`. Filling it in, a refused submit, a server 400, a
valid submit and Enter all pass under Ant, with a clean console.

| difference under Ant | contract gap or implementation bug |
|---|---|
| accessible name `* First Name` (html: `First Name*`) | both: **contract gap** 1.2 (no `aria-required` in the slot; marker in the name) plus each implementation's marker |
| the select has no `aria-invalid` while in error; `status="error"` is visual only (`antd.tsx:578-591`) | **implementation bug** (forms-antd); html's select gets it through the frame slot |
| check list `onBlur` on the group (`antd.tsx:372`) | the same as html, 1.1 |
| one check-list group (html: two nested) | **implementation bug** in forms-html, §2 |
| section titles are plain text, not Ant typography: `contents` is html's shared `Contents` (`antd.tsx:758`) | **implementation gap** (forms-antd draws no group chrome of its own); headings are still correct |
| required select clearable through `allowClear` | implementation choice; same effect as html's empty option |
| `Form.Item` spacing; errors animate in | implementation look; the first screenshot after a refused submit caught the animation mid-way |
| the select is Ant's virtual list, not a native `<select>` | not a contract matter, but the page object needed an implementation branch to choose an option |
| one cold-start timeout on the Ant 409 check (passes 3/3 on repeat) | test timing under `next dev` compilation, not v2 |

**Fixed (after the trial):** Ant's select carries `aria-invalid`. So do the radio group and the
checkbox under all three implementations, which conformance now asserts.

**The side-by-side page** is `/requestAccessCompare`: the original form, restored from git,
on the left, and v2 under Ant on the right.

---

## 5. Compat interop and the engine bump

- **The bump was already done.** `develop` declares `@react-typed-forms/core ^5.1.2` in all 8
  projects that use it, and 5.1.2 depends on `@rx-controls/core ^1.1.2` /
  `@rx-controls/react ^1.1.2`, which is what alpha.1 needs (`forms-react` deps). The one
  direct declaration is `astrolabe-ui`'s `@rx-controls/react ^1.1.2`, already in line. This
  trial added `@rx-controls/core` (1.7) and `@rx-controls/react` to `hvams-common`. The
  `react` dependency turned out to be unused, since the form needs no `useReactive`.
- **Lockfile:** exactly one `@rx-controls/core@1.1.2`, one `@rx-controls/react@1.1.2`, and
  `@react-typed-forms/core@5.1.2`. No deprecated compat. At runtime, `getCompatPatchInfo()` on
  the page logged `{"packageCopies":1,"engineCopies":1,"duplicatePackage":false,"duplicateEngine":false}`.
- **A dist-tag trap.** `npm view @rx-controls/core dist-tags` gives `alpha: 0.1.1`, and
  `@rx-controls/react` gives `alpha: 0.2.4`, both against `latest: 1.1.2`. Anyone following
  "ask npm for the alpha tag" for the engine packages gets a pre-1.0 engine and a second copy.
  The `alpha` tag should be removed from those two, or moved.
  **Fixed (after the trial):** removed. Both packages now carry only `latest: 1.1.2`.
- **Interop held.** The form is a legacy SWC-tracked component that reads `isSubmitted.value`
  ambiently and writes `submitError.value` / `agenciesByState.value` with legacy mutators, and
  it renders v2 boundaries bound to its own compat controls. Writes in both directions showed
  immediately, with no ambient-read staleness and no warnings.
- **The second host.** `AccessDetailsSection` is also rendered by `ModifyAccessForm`, a legacy
  dialog that gates its own Submit with a computed `submissionDisabled`. I moved it onto the v2
  section rather than keeping a legacy copy. That gave a v2 region inside a legacy form, with a
  bare `<Form clearHidden>` (no `onSubmit`) for scope and `clearHidden`, and the dialog's own
  Submit unchanged. Two things followed. `clearTo` had to become a section prop, because the two
  hosts' models disagree about an empty description. And the page hosting the dialog needs its
  own `FormProvider`: the implementation is chosen once per page, so twice in the app. The
  section behaves correctly in the dialog except for 1.1, which only surfaces there.

---

## 6. Against the previous run

Written after §1–5. **How cold the read was:** I did not open the previous report until this
section. But the design docs refer to it in a few places. `FORMS-V2-GOALS.md`'s grid paragraph
cites its §1, and `FORMS-V2-INTERFACES.md` marks some decisions "decided after the HVAMS trial"
(shell ids, `<Form onSubmit>`). So I knew those areas had been looked at before. I did not know
what the earlier findings were.

| previous finding | status now | holds up in the real form? |
|---|---|---|
| no `maxLength` on `TextField` | **fixed** | **Yes.** Typing 310 characters leaves 300 under html and Ant; the rule and the cap come from one prop. |
| a select keeps a value not among its options | **fixed** (`restrictToOptions`, move-away) | **Yes.** QLD → Brisbane City → TAS gives Break O Day Council, and back to QLD gives Aurukun Shire, with no effect. |
| no "reset when X changes" | **fixed by composition**, as documented | **Yes, with the same caveat.** An agency name shared by two states would be kept rather than reset (none is today). The `restrictToOptions` doc still frames the pairing as "reset … when the list changes" without that caveat (1.4). |
| `clearHidden` writes `undefined` | **fixed** (`clearTo`) | **Yes.** The posted description is `null` after Other on → off. *New:* with two hosts whose models disagree, `clearTo` becomes a prop of the shared section (§5). |
| no form-level message | **fixed** (`tone`, `announce`) | **Partly.** `role="alert"` works under both implementations and the counter is not live. But the previous run's own spelling, `hidden={…}` on the message, is the case `announce` doesn't handle: the live region has to stay mounted (1.3). The resolution never tried it with `hidden`. |
| no column layout; containers can't see hidden children | **resolved as "layout is classes"** | **Yes.** `md:grid-cols-2` on the `Section`; hiding Last Name moved Email into its cell under html and Ant. `transitions={false}` isn't needed for the layout (html's fade wrapper is still one grid item), only to drop the 200ms hold. |
| Tabs / Wizard have no `hidden` | fixed (by the docs) | **Not exercised.** This form has neither. |
| section titles are not headings | **fixed** | **Yes.** `heading level=2` under the page's `h1`, under both implementations. |
| the counter needs a class to turn red | **fixed** (`tone`) | **Yes.** `tone={(rc) => … ? "error" : undefined}`, no class. |
| converting one host means converting all, or keeping a copy | migration cost, not a gap | **Converted both this time.** It works: a v2 section inside a legacy dialog, a bare `<Form clearHidden>`, and a `FormProvider` on each hosting page. But only the dialog exposed 1.1, so the previous run's decision to keep a copy is also why it missed that bug. |
| no multi-select: HVAMS wrote `CheckListField` | **fixed** (built in, `useMultiSelectController`) | **Mostly.** No widget was written, and it binds `AccessRequestReason[]` with no cast. But the built-ins inherited the hand-written widget's `onBlur` placement, which touches on internal focus moves (1.1). And html now draws **two** nested groups with the same name (§2), although its own comment says one. |
| no label id from the shell | **fixed** (`fieldLabelId`) | **Yes.** Every group and control is named under both implementations, except that html's name is duplicated (§2). |
| server errors clear by core, undocumented | **still open** | Still true and still undocumented (1.6). It is now verified rather than read from the code: the message clears on edit and the resubmit goes through. |
| bare `validate` hides server errors | **fixed** (`default@<id>`) | **Yes.** `validate={() => null}` on Phone keeps the server message, as its description, under html and Ant. *New:* `validate={{ default: … }}` still swallows it, and does so silently (1.5). |
| no native submission | **fixed** (`<Form onSubmit>`, `<Action submit>`, `form` slot) | **Yes.** Enter in a field is refused with every error on an empty form, and posts once on a valid one, under html and Ant. |
| Ant errors lose their accessible link | **fixed** (shell owns the ids) | **Yes.** Every Ant control and the group have their error as accessible description. *New:* Ant's select still has no `aria-invalid` (§4). |
| Ant's select is not a `<select>` | unchanged (not a gap) | Same. The page object branches on the implementation to pick an option. |
| engine bump, one copy | done on `develop` before this run | **Yes**, `engineCopies: 1`. *New:* the `alpha` dist-tags on `@rx-controls/core` / `react` point at pre-1.0 versions (§5). |
| fields under a nullable parent must admit `undefined` | made moot by `clearTo` | Yes. |
| SWC plugin and `useReactive` coexist | — | No custom widget this time; a legacy SWC-tracked component hosting v2 boundaries showed no warnings. |

**New in this run, which the previous one did not find:**

1. Check list / radio touched on focus moves *within* the widget; in a centred dialog it eats
   the click (1.1). This is the only finding that breaks an existing HVAMS spec.
2. `required` never reaches assistive technology, and the marker is part of the accessible name,
   differently under each implementation (1.2).
3. `announce` and `hidden` don't compose (1.3).
4. A keyed `default` validator silently swallows server errors, and no submit message shows
   either (1.5).
5. html's check list is two nested groups with the same name (§2).
6. Ant's select has no `aria-invalid` (§4).
7. Ant has no group chrome of its own; section titles are html's (§4).
8. A field revealed after a refused submit shows its error at once (§3).
9. `ReadContext` isn't exported (1.7), and the `alpha` dist-tags on the engine packages are
   stale (§5).

## Suggested changes, in order

1. Touched-on-leave for multi-element widgets, in the controller, with a conformance check (1.1).
   It breaks a real flow.
2. `aria-required` on `ControlSlotProps` and the self-drawn widgets; an `aria-hidden` marker;
   assert exact names in conformance (1.2).
3. Have forms-html's check list draw one group (§2), and give forms-antd's select `aria-invalid`
   (§4).
4. Make `announce` survive `hidden`, or have an empty `TextDisplay` draw nothing (1.3).
5. Warn on, or reserve, an author `validate` key that collides with an unclaimed error (1.5);
   document that server errors clear because core clears on write (1.6).
6. Export `ReadContext`; fix the engine packages' `alpha` tags.
