# Forms v2 — the ServiceTas MAST EOI trial, as a brief

The prompt for rerunning the MAST licence EOI trial against `0.1.0-alpha.5`. Paste everything
below the line into a fresh Claude Code session in a new ServiceTas worktree.

**Not a cold read**, unlike the [HVAMS brief](./FORMS-V2-HVAMS-TRIAL-BRIEF.md). The alpha.4 run
([`FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.4.md`](./FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.4.md))
ended with a list of workarounds, and alpha.5 (phase 8 of
[`FORMS-V2-PLAN.md`](./FORMS-V2-PLAN.md)) was built against that list. This run starts from that
run's branch and is judged on whether each workaround can go. The report is the worklist, so it is
read first.

Update the version, the commit and the paths if they have moved. Check
`npm view @rx-controls/forms-react dist-tags` before starting; `alpha` should be `0.1.0-alpha.5`.

---

Rerun the ServiceTas **MAST licence EOI wizard** trial against `@rx-controls/forms-*@0.1.0-alpha.5`.
The previous run converted the JSON wizard to code against `0.1.0-alpha.4` and recorded every place
it needed a workaround. alpha.5 was built to remove them. There are three goals, in this order:

1. **The worklist**: remove each alpha.4 workaround using what alpha.5 added, and record, for each,
   whether the new API fits the real form, fits awkwardly, or does not fit.
2. **Use the new features in anger**, and find what is wrong with them that the rxc tests could
   not: the tests are synthetic, and this form is not.
3. **Find what is still missing**, and hold visual parity with the JSON version while doing it.

The branch is throwaway: nothing needs to be production ready.

**Read the alpha.4 report first** — `~/astrolabe/rxc/docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.4.md`.
It explains every workaround below, and its gap numbers (G1–G7, T1–T5) are the ones used here.

## Where things are
- Repository `~/astrolabe/ServiceTas`; the trial branch `trial/codefirst-mast-eoi` at `7c9979d9`
  ("Trial: MAST EOI wizard in code against Forms v2 0.1.0-alpha.4"). Make a worktree from it on a new
  branch. The main checkout is on unrelated work; leave it alone.
- Paths below are relative to `ServiceTasAPI/NewClientApp`. The workspace is Rush: edit
  `package.json`, then `rush update`.
- The v2 wizard: `client-common/components/mast/eoi-v2/` — `EoiWizardV2.tsx`, `useEoiWizard.ts`
  (the data layer, compat controls), `steps/*.tsx`.
- The look and the component layer: `client-common/forms-v2/serviceTasTheme.tsx` (the
  `PartialHtmlTheme`), `ServiceTasFormProvider.tsx` (the provider and the two slot overrides),
  `components.tsx` (`PageHeading`, `Subheading`, `BulletValue`, `Disclosure`, …).
- The JSON version, for comparison: `client-common/components/mast/EOIRegistrationWizard.tsx`, at
  `?path=mast-eoi`; the v2 one is at `?path=mast-eoi-v2`. Both take a dev-only `&step=N`.
- rxc, for the library source, the design docs and the stories: `~/astrolabe/rxc`
  (`packages/forms-react`, `packages/forms-html`, `docs/FORMS-V2-INTERFACES.md`,
  `apps/forms-storybook/src/stories/` — `Wizard.stories.tsx` "HostDriven" and
  `Disclosure.stories.tsx` show the new APIs).

## First: versions and one engine copy
- Bump `@rx-controls/forms-react` and `@rx-controls/forms-html` to `0.1.0-alpha.5` (pinned
  exactly, as before). alpha.5 needs `@rx-controls/core` / `@rx-controls/react` `^1.1.3`; take the
  current releases, which also carry the lazy-child flags fix: `@react-typed-forms/core` (compat)
  goes to `^5.1.4` and the direct `@rx-controls/react` to `^1.1.4`, **everywhere each is
  declared**.
- Confirm the lockfile holds exactly one `@rx-controls/core` and one `@rx-controls/react`.
- The portal's `next.config.js` already lists the engine packages in `transpilePackages` (§3 of
  the alpha.4 report). Keep it. Then check, once, whether it is still needed: take it out, run
  `next dev`, and see whether the duplicate-engine warning comes back during SSR. Record the
  result, and whether the warning's new text (it now names `transpilePackages`) would have led you
  to the fix. Put it back either way.

## The rules (unchanged)
- Pages import only from `@rx-controls/forms-react`, `@rx-controls/react` /
  `@react-typed-forms/core`, the ServiceTas component layer and ServiceTas's non-UI code.
  Layout is classes; looks are the theme's.
- The look lives in the theme and the component layer, chosen once at the app root. **The target
  is no slot overrides at all.** Each one that remains is a finding.
- Do not weaken the component layer to make a workaround go: if a component still needs plain JSX,
  that is the finding.

## The worklist
For each item: remove the workaround, use the alpha.5 replacement, and record how it went.

| alpha.4 workaround | alpha.5 replacement | gap |
|---|---|---|
| `PagesWizard` slot override (a wizard with no strip or Back / Next) | `<Wizard navigation="none">` | G2 |
| Pages gating their actions with `useValidation().check()` and writing `step` | `useWizard()`: `next()` (the page's check, resolves to whether it passed), `back()`, `goTo(key)` for a server-decided outcome | G2 |
| A nested `<Form clearHidden>` around the five identifiers | `clearHidden` on the identifiers' group | G3 |
| `label` + `labelClassName={{ replace: "sr-only" }}` | `hideLabel` | G4 |
| `PageHeading` / `Subheading` drawn as `<p>` | `TextDisplay heading`, sized per level by the theme's `text.heading` slot | G1 |
| UVI help moved under its switch | `helpPlacement="labelEnd"` | G5 |
| The plain-JSX `<details>` for "How to find this" | `<Disclosure>` | G6 |
| `async () => { await …; }` around a handler resolving to a value | return the handler's promise directly | G7 |
| `[&>i]:…` selectors for button icon size | `action.iconClassName` / `variants[v].iconClassName` | T2 |
| `BulletValue`'s `before:` bullet | `DisplayOnlyField startIcon` | T3 |
| `QuestionRadio` slot override (the card around each yes/no) | `shellFor: { radio: … }` | T4 |
| `!`-prefixed radio and checkbox utilities | none — still expected (documented in `HtmlTheme` now) | T1 |

Points to decide and record as you go:
- **Wizard navigation.** For each page action, is `useWizard()` cleaner than writing the hook's
  `step` control, or does the data layer want to keep owning the step? Can `useEoiWizard.ts`'s step
  logic shrink? A page should still be refused with its errors shown, as before.
- **Heading levels.** With headings that take their level from where they sit, is the page's
  outline right: the page title, then card titles, then group titles? Is there any heading you
  wanted at a level the outline would not give it?
- **`labelEnd` help.** The UVI switch's help was a tooltip on an info icon in the JSON form. Does the
  html toggle (a button that reveals the text) read right, and can the theme make it look like the
  original? Record what the theme slots (`shell.labelRow`, `shell.helpButton`) could and could not
  say.
- **The disclosure** holds the licence-card diagram. Does the theme's `disclosure` slot reach
  everything the JSON version's accordion looked like?

## New behaviour to exercise in the real form
- **A closed disclosure validates.** Put a required field in a disclosure temporarily: a refused
  page action must be refused, and — where the form focuses errors — the disclosure must open. Note
  whether a page action's `next()` focuses the first error at all (a `<Form onSubmit>` does; a page
  check may not), and whether it should.
- **`clearHidden` per group.** Switching an identifier off clears its value; the callback block,
  bound to the same controls on three pages, keeps its values.
- **Names.** Every identifier input is named by its hidden label, and the switch above it by its
  own (check through the accessibility tree, not visible text). The UVI switch's name is exactly its
  label, with no "Help" in it.
- **Keyboard.** The `labelEnd` help button and the disclosure toggle are reachable and work by
  keyboard.

## Visual parity
As in the alpha.4 run: page by page at 1440×1000 against the JSON version, using `&step=N`. Then
cover what it did not check:
- **Narrow widths** (375px) for every page.
- **The start page's missing-details box.** Use a profile with details missing, or fake it
  temporarily in the data layer.

Screenshots of both versions per page and width go in the report. Record the size of the theme,
the provider and the component layer before and after.

## Environment
- `next dev` for the portal on `:3000`, served through the API on `https://localhost:5001`, signed
  in through B2C dev. **The user signs in**: ask them to, and do not enter credentials yourself.
- **Never press an action that calls MAST or creates a case.** Reach later pages with `&step=N`.
- The page-shell warning "Cannot update `PageContent` while rendering `Reactive`" is ServiceTas's
  and appears in both versions; any other console output is a finding.

## Verify
- `client-common` and `sites/portal` type-check with no errors; the portal builds.
- Walk every page by hand in both versions: the refused actions, the identifier switches, the
  callback branch, the disclosure. The console is clean apart from the known page-shell warning.

## Report back
Write `~/astrolabe/rxc/docs/FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.5.md`, in the style of the
alpha.4 report, citing rxc source lines for each finding:
1. **The worklist**, as a table: each workaround gone, changed or still needed, and why. Then the
   slot overrides that remain (the target is none), and the theme / provider / component-layer
   sizes before and after.
2. **The new APIs in a real form**: what fitted, what was awkward, what is wrong with them.
3. **New gaps** this run found, numbered fresh, each with what you did instead and what the
   library should offer.
4. **Visual parity**, with the screenshots, including the narrow widths and the missing-details
   box.
5. **Compat and the engine**: the version bump, the lockfile, and the `transpilePackages` check.
6. **Against alpha.4**: each of its "Suggested changes" — fixed, changed or still open — and
   anything it got wrong.
