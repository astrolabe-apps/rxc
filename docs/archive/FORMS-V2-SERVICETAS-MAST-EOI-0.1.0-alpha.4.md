# Forms v2 — the ServiceTas MAST EOI trial, `0.1.0-alpha.4`

A second adopter trial, after HVAMS: ServiceTas's **MAST licence expression-of-interest wizard**,
a 2,746-line JSON form definition, rewritten as code against
`@rx-controls/forms-react@0.1.0-alpha.4` (the `alpha` tag on 2026-10-07) and drawn with
`forms-html@0.1.0-alpha.4`. Unlike HVAMS this was not a cold read, and not a hand-written form:
the original is a schema-driven `@react-typed-forms/schemas` wizard with JSONata expressions, so
the trial also asks how a JSON form translates into contract code.

ServiceTas is on `@react-typed-forms/core@5.1.2` (compat), which depends on `@rx-controls/core`
and `@rx-controls/react` `^1.1.2`, the same range the alpha asks for. ServiceTas paths are
relative to `ServiceTasAPI/NewClientApp`. Branch `trial/codefirst-mast-eoi` (throwaway), on
ServiceTas `1b707b11` plus the uncommitted trial. Every finding below was re-checked against rxc
`6f621c3`; each gap (G, T) carries an "At HEAD" line saying whether it is still open there.

**Verdict.** The wizard converts, and the second goal was met: the look lives in a theme and a
small component layer, not in the pages. All nine pages render and behave like the JSON version.
Of the 2,746 JSON lines, the pages became 814 lines of step components with no class strings
except five one-off layouts on the start page. The look is a 127-line theme, 2 slot overrides and
a 372-line ServiceTas component module that any later v2 form reuses. The JSON's JSONata
`Visible`/`Disabled`/`Label` expressions became `(rc) => …` props with no effects. What hurt is
mostly **missing chrome rather than missing behaviour**: no heading or text-style level on a
display, no icon slot on a button, `startIcon` ignored by display-only, no help placement beside
the label, a wizard that always draws its own navigation, and no disclosure. Two integration
traps cost the most time: app-wide element CSS outranking theme classes, and Next.js loading the
engine twice during SSR.

## What was built

| file (`client-common/…`) | what |
|---|---|
| `forms-v2/serviceTasTheme.tsx` | the `PartialHtmlTheme`: formStyles' `newStyle` renderer options and `newStyle.css`, as theme slots (127 lines) |
| `forms-v2/ServiceTasFormProvider.tsx` | `HtmlThemeProvider` + `FormProvider` with two slot overrides (69) |
| `forms-v2/components.tsx` | ServiceTas building blocks from contract displays and groups (372) |
| `components/mast/eoi-v2/useEoiWizard.ts` | the wizard's data layer: compat controls, step logic, API calls (439; the original hook is 443) |
| `components/mast/eoi-v2/EoiWizardV2.tsx` | `<Form>` + `<Wizard page={step}>`, nine pages (119) |
| `components/mast/eoi-v2/steps/*.tsx` | one component per page, plus the shared `CallbackRequest` (814 in total) |
| `sites/portal/src/app/layout.tsx` | `ServiceTasFormProvider` at the app root, inside `ControlContextProvider` |
| scaffolding | route `?path=mast-eoi-v2` beside the original's `?path=mast-eoi`; a dev-only `&step=N` jump in both |

**The component layer.** `Page`, `PageHeader`, `PageHeading`, `Lead` (text or HTML),
`Subheading` (with `tone`), `Stack` (fixed gap scale, `narrow`), `Wrap`, `StepPill`, `Stat`,
`Tag`, `Chip`, `TaskCard`, `IconNote` (optional card), `BulletValue`, `ActionRow`, `Disclosure`,
`PageBackdrop`, `faIcon`, `yesNoOptions` / `matchOptions`, `cardClass`. Every one is composed
from `Contents`, `TextDisplay`, `HtmlDisplay`, `IconDisplay` or `DisplayOnlyField`, except
`Disclosure` and `PageBackdrop` (plain JSX, see G6) and `faIcon`.

**The data layer stayed compat.** The form data is the same compat `useControl` as the JSON
version, passed straight into v2 fields. The JSON form's metadata fields (`$meta.*` via
`getMetaFields`) became a second plain compat control. v2 components read only through `rc`
(`useReactive` / `FormProp` functions); the hook keeps legacy `.value` writes. Nothing needed a
cast.

## 1. Gaps in the contract

### G1. A display has no heading semantics or text level

Every page starts with a heading, and the JSON form drew it as a `Display` with a text class.
`TextDisplay` renders a `<p>`, so the page heading (`PageHeading`) and every card title
(`Subheading`) are paragraphs. The only heading in the contract is a group's `title`
(`role="heading"` + `aria-level`), and it is drawn *before* the group's content, so a page whose
header is "pill, heading, intro" can't use it without reordering.

The visual side was solved by components (`PageHeading` 40px, `Subheading` 24px, `Lead`), which
is fine. The semantic side isn't: each page's own title ("Confirm your personal details") is
not a heading, so the page's outline jumps from the site banner to the group titles.

- **Suggest:** a `heading` (or `level`) prop on `TextDisplay`, drawn as `role="heading"` /
  `aria-level` like a group title, with a theme slot per level (`text.heading[1..6]`) so the
  sizes move into the theme too.
- **At HEAD:** open.

### G2. A wizard always draws its own navigation

This wizard is driven entirely from page actions: "Link my account", "Verify licence", "Submit a
case", with server calls deciding the next page. `<Wizard page={step}>` binds the index, which is
right, but `HtmlWizard` always draws the step strip and Back / Next (`html.tsx:765`), and no prop
or theme slot turns them off. Hiding them with theme classes would make behaviour hang on a
theme class, which the theme doc forbids. The trial overrides the `wizard` slot with a
pages-only renderer (`PagesWizard`, 13 lines).

Consequence: the wizard's own `next()` (page `check()`) is never used. Pages gate their actions
with `useValidation().check()` instead, which worked well (see G8).

- **Suggest:** `WizardProps.navigation?: "builtin" | "none"` (or `steps` / `nav` booleans)
  passed through `WizardRenderProps`, so a host-driven wizard is a prop rather than an override.
- **At HEAD:** open.

### G3. `clearHidden` is only on `<Form>`

The linking page shows five identifier switches, each revealing a required text field. Only the
identifiers switched on should be sent, so their values should clear when hidden. The rest of the
wizard must *not* clear: the callback block (`needACallback`, `alternativeNumber`) is mounted on
three pages, bound to the same controls, and hidden on two of them at any time.
`ScopeNarrowing.clearHidden` exists, but `GroupProps` doesn't expose it, so the trial nests a
second `<Form clearHidden>` around the identifiers. That works (the outer page's `check()`
reaches it), but a form inside a form only to switch one flag is a workaround.

- **Suggest:** `clearHidden?: boolean` on `GroupProps` (it is already a narrowing).
- **At HEAD:** open.

### G4. A field can't be named without a visible label

The identifier text fields sit under their switch, which already shows the words; the JSON form
used `hideTitle: true`. In v2 a field without `label` has no accessible name. The trial passes
`label` plus `labelClassName={{ replace: "sr-only" }}`, which works and is accessible, but it is
a class carrying meaning.

- **The JSON path has it worse.** The loader turns `hideTitle` into `label: undefined`
  (`forms-json/src/translate.tsx:808`), so every JSON field with `hideTitle` has no accessible
  name at all. A `hideLabel` would let the loader keep `def.title` as the name.
- **Suggest:** `hideLabel?: boolean` (label kept for assistive technology, not drawn) or
  `accessibleName` on `FieldProps`, as `DisplayProps` already has.
- **At HEAD:** open.

### G5. Help text has one placement

The UVI switch's help ("A Unique Vessel Identifier is issued by AMSA.") was a `HelpText`
adornment with `placement: "LabelEnd"`, an info icon beside the label with the text as a tooltip.
The wizard's other help (page 2's MAST account question) was the usual line under the
control. v2's `helpText` has one placement (under), so the UVI help moved under its switch. Acceptable, but it is the JSON format's
own vocabulary that has no v2 equivalent.

- **Suggest:** `helpPlacement?: "below" | "labelEnd"` on `FieldProps`, the implementation
  choosing how `labelEnd` is drawn (html: an icon button with a popover or a native tooltip).
- **At HEAD:** open.

### G6. No disclosure

"How to find this" (the licence-card diagram) was a `Display` with an `Accordion` adornment.
The contract has no disclosure, collapsible or accordion, so it is a plain-JSX
`<details>` in the component layer. It works, but it isn't themed by the implementation and an
Ant or MUI swap wouldn't change it.

- **Suggest:** a `Disclosure` container (title, `defaultOpen`, an optional bound `open`
  control), with a theme slot and Ant / MUI renderings. The JSON loader already has a reason to
  want it.
- **At HEAD:** open.

### G7. `Action.onClick` rejects a handler that resolves to a value

`onClick?: () => void | Promise<void>` (`action.tsx:59`). A handler written
`() => errorService.runSafe(() => Promise.all([…]))` resolves to `[void, void] | undefined`, and
TypeScript refuses it, so the trial wrapped it in `async () => { await …; }`. The boundary only
needs to know when it settles.

- **Suggest:** `() => unknown` (or `void | PromiseLike<unknown>`).
- **At HEAD:** open.

### G8. What worked without a workaround

Recorded because these were the JSON form's hardest parts, and none needed an effect or a widget:

- **Every JSONata expression became a `FormProp` function.** The start page's
  missing-details check appeared four times in the JSON (box visible, count text, three chips,
  Start disabled); it is one `missing(rc)` function used by six props. Derived labels
  (`"Is <b>" & $meta.firstName & "</b> …"`) became `label={(rc) => <>Is <b>{…}</b> …</>}`.
- **`<Wizard page={step}>` with a compat control** drove nine pages from the hook's `step.value`
  writes, and pages not yet reached stayed silent.
- **Page-scoped validation.** `useValidation()` inside a page plus `await page.check()` before a
  server call replaced the hand-written "touch each shown field, validate, AND the results" code
  in the original hook (about 40 lines), and covers only the fields that are shown.
- **Hiding is mounting-safe.** The callback block mounted on three pages and bound to the same
  controls behaves, because a hidden region keeps its children mounted and stops their rules.
- **Inline prose with a link** ("Please go to your *profile page* to add your date of birth.")
  is an `InlineGroup` of two `TextDisplay`s and a `link` action, as in the JSON.

## 2. The html implementation and theme

### T1. The theme loses to app-wide element CSS

ServiceTas's `globals.css` styles every `input[type=radio]` and `input[type=checkbox]` in
`@layer components`, and Tailwind's `important: "#app"` turns that into `#app
input[type=radio]` (specificity 1,1,1). A theme utility is `#app .w-\[13px\]` (1,1,0), so the
global rule wins: the v2 radios came out 20px with a 2px green ring instead of 13px with a 1px
dark border. The JSON form only escapes it through `newStyle.css`'s `#app .new-style
input[type=radio]` (1,2,1). The trial's fix is `!`-prefixed utilities on the radio and checkbox
slots.

This will be common: most apps adopting v2 have global element CSS. It isn't a contract gap, but
the theme doc should say so.

- **Suggest:** document it in the `HtmlTheme` doc ("an app's element selectors outrank a
  single class; use `!` or a wrapper class on the slot"). Optionally give each native control a
  stable class (`rxf-radio-input`) so an app can write one higher-specificity reset.

### T2. No slot for a button's icon

The original renderer gave an action's icon the same classes as its text (24px on primary and
secondary, 18px on links, `px-2`). `HtmlTheme.action` has `className` / `textClassName` and
per-variant versions of both, but nothing reaches the icon, which renders at the inherited 16px.
The trial targets it from each variant with `[&>i]:text-[24px] [&>i]:px-[8px]`, which depends on
the icon being a direct `<i>` child.

- **Suggest:** `action.iconClassName` and `variants[v].iconClassName`, applied to a wrapper
  `span` around `p.icon` (or around the busy spinner).
- **At HEAD:** open.

### T3. Display-only ignores `startIcon` / `endIcon`

The address summary's bullets were `Icon` adornments at `ControlStart`. `DisplayOnlyField`
accepts `startIcon` (it is in `FieldProps`), but `HtmlDisplayOnly` never draws it
(`html.tsx:299`), and nothing warns. The trial draws the bullet with a `before:` pseudo-element in
a `BulletValue` component.

- **The JSON path hits it too, silently.** The loader turns a `ControlStart` / `ControlEnd`
  `Icon` adornment into `startIcon` / `endIcon` on every Data control, display-only included
  (`forms-json/src/translate.tsx:787`), and the icon is lost. The audit's "built prop never
  passed on" check stays quiet, since the prop *is* passed on; the renderer drops it. Parity
  compares values and errors, so `rushx gates` cannot see it either.
- **Suggest:** draw `startIcon` / `endIcon` in display-only (a `slot` either side of the
  value), or reject them in its types and have the loader report the adornment.
- **At HEAD:** open.

### T4. A per-widget shell needed a slot override (fixed on HEAD)

Every yes/no question sits in a grey card. That class belongs on the radio group's shell, but
`HtmlTheme.shell` is shared by every widget, so the trial wraps the `radio` slot
(`QuestionRadio`, adding `cardClass` to `shellClassName`).

- **At HEAD:** fixed by `HtmlTheme.shellFor` (`4df8c88`). With the next alpha this override
  becomes `shellFor: { radio: { vertical: "…card…" } }`, leaving `PagesWizard` (G2) as the only
  override.

### T5. Required marker and error icon: worked as designed

Two parity details were theme data with no workaround: `shell.required.text: ""` (the newStyle
forms draw no marker; fields keep `aria-required`) and `shell.renderError` for the original's
warning triangle before the message.

## 3. Compat interop and the engine

- **One copy in the lockfile, two at runtime.** After the bump the lockfile held exactly one
  `@rx-controls/core@1.1.2` and one `@rx-controls/react@1.1.2`, shared by compat and the alpha.
  Next.js's dev server still logged compat's "More than one copy of the @rx-controls/core engine
  is loaded (2 distinct ControlImpl classes)" during SSR. The portal transpiles `client-common`
  (`transpilePackages`), so code there is bundled into the server build, while
  `@react-typed-forms/core` was loaded natively from `node_modules`: two module instances of one
  file. Adding `@react-typed-forms/core` and every `@rx-controls/*` package to
  `transpilePackages` fixed it. The warning's own advice (pin versions with `pnpm.overrides`)
  can't help here, because there is only one version.
  - **Suggest:** a "Next.js" note in the compat README and in the warning text: with
    `transpilePackages`, list the engine packages too. Not checked: whether the duplicate
    already existed in ServiceTas before v2 imports were added to `client-common`.
- **`useReactive` isn't re-exported by compat.** A v2 component in a compat app needs a direct
  `@rx-controls/react` dependency. Minor, but the CompatFixture imports it the same way, so it
  should be in the migration doc's dependency list.
- **The SWC tracking plugin coexisted.** `@astroapps/swc-controls-plugin` compiles
  `client-common`, including the v2 files. No problems were seen; the provider component is
  marked `@noTrackControls` as the README says.
- **A compat control under a nullable parent is `T | null | undefined`.**
  `formData.fields.mastLinkingDetails.fields.mastUserId` is `Control<string | null | undefined>`
  because `mastLinkingDetails` is nullable. A component typed `Control<string | null>` refuses
  it. Expected, but worth an example in the docs, since every server DTO with an optional child
  hits it.

## 4. Visual parity

Compared page by page at 1440×1000, the JSON version and v2 side by side, with a dev-only
`&step=N` jump so later pages could be reached without calling MAST.

| page | result |
|---|---|
| 1 Before you start | matches (heading 40px vs 32px: one page-heading size by choice) |
| 2 Personal details | matches after T1, T2 and the option labels |
| 3 Linking details, 4 Address, 5 Proof of identity, 6–9 outcomes | equivalent; restyled from the JSON's older `title1`/`body` look to the new style on purpose |

Differences found and fixed during the comparison, all in the theme or component layer: radio
and switch overrides (T1), button icon size (T2), group title gap (`contents.wrapper` as a
20px-gap column, since the JSON layout held title and body together), error icon (T5), required
marker, bullets (T3), switch label size, option labels. The option labels were a translation
slip: they came from the JSON's schema section (`fields[].options`), not from the controls, and
a code-first form has to state them where the field is drawn.

The page-shell warning "Cannot update `PageContent` while rendering `Reactive`" appears in both
versions, and the JSON version logs two more from its renderer. It is ServiceTas's, not v2's.

## 5. Translating a JSON form to code

Notes for the JSON loader and for anyone doing this by hand:

- **The JSON format has words the contract doesn't:** `HelpText` placement (G5), `Accordion`
  adornment (G6), `ControlStart` icon on display-only (T3), `hideTitle` on a field (G4),
  `Switch` render type (drawn as a checkbox styled as a switch; semantically the same as the
  original, which was also a native checkbox).
- **Field options live in the schema, not the control.** A loader resolves them; code has to
  carry them (`matchOptions`).
- **`styleClass` / `layoutClass` / `textClass` mostly disappear** into the theme and component
  layer. What is left in pages is layout, as `FORMS-V2-INTERFACES.md` §7 intends.
- **Dead expressions surface.** A `Disabled` on `../status/primary` (a field that doesn't
  exist) and a `Visible` with an empty expression were both silently inert in JSON, and simply
  dropped in code.

## Suggested changes, in order

1. Display-only draws `startIcon` / `endIcon` (T3) — a silent loss on the JSON path today, not
   only chrome.
2. `hideLabel` / `accessibleName` on `FieldProps` (G4) — which the loader also needs, so a
   `hideTitle` field keeps a name.
3. `WizardProps.navigation: "none"` for host-driven wizards (G2): the only remaining slot
   override once `shellFor` ships.
4. A heading level on `TextDisplay`, drawn as a heading, with theme slots per level (G1).
5. `clearHidden` on `GroupProps` (G3).
6. Icon class slots on actions (T2).
7. A `Disclosure` container (G6); `helpPlacement: "labelEnd"` (G5).
8. `onClick: () => unknown` (G7).
9. Docs: theme classes vs app element CSS (T1); Next.js `transpilePackages` for the engine
   packages, in the compat README and the duplicate-engine warning (§3); `@rx-controls/react` as
   a direct dependency of a compat app writing v2 components (§3).

## Environment and verification

- ServiceTas branch `trial/codefirst-mast-eoi` at `1b707b11` (main merged in for compat v5),
  uncommitted trial. Rush; `client-common` and `sites/portal` type-check with no errors. The
  portal ran under `next dev` on `:3000`, served through the API on `https://localhost:5001`,
  signed in through B2C dev.
- Lockfile: one `@rx-controls/core@1.1.2`, one `@rx-controls/react@1.1.2`; no duplicate-engine
  warning in the browser, and none in SSR after the `transpilePackages` change.
- Checked by hand in both versions: every page renders; page 2's "No" path; page 3's switch
  reveal and its refused Continue on an empty identifier; page 4's "No"; page 5's refused Verify
  (both required fields flagged), the disclosure, and the no-licence callback branch with a
  refused Submit on an empty alternative number. No action that calls MAST or creates a case was
  pressed.
- Not checked: the missing-details box on page 1 (the signed-in profile had nothing missing),
  narrow widths, and the end-to-end server paths.

**ServiceTas bugs found in passing** (in the JSON version, not carried into v2):
`createClient`'s success and failure pages are swapped; a callback case sends
`alternativeNumber` even when the user chose their mobile; the address page's intro says "to
register for Plates Plus".
