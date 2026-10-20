# Forms v2 — the HVAMS Request Access trial on `alpha.9`, as a brief

The prompt for rerunning the Request Access trial against `0.1.0-alpha.9`. Paste everything below
the line into a fresh Claude Code session in a new HVAMS worktree. It is a **cold read**, as every
HVAMS run has been: the conversion is redone from scratch, so the contract is judged without
knowing the last run's workarounds. The last run's findings are in
[`FORMS-V2-HVAMS-REQUEST-ACCESS-0.1.0-alpha.4.md`](./FORMS-V2-HVAMS-REQUEST-ACCESS-0.1.0-alpha.4.md);
the runs before it are the [alpha.3](./FORMS-V2-HVAMS-REQUEST-ACCESS-0.1.0-alpha.3.md),
[alpha.1](./FORMS-V2-HVAMS-REQUEST-ACCESS-0.1.0-alpha.1.md) and
[alpha.0](./FORMS-V2-HVAMS-REQUEST-ACCESS.md) reports. The previous brief, which this one replaces,
is [`FORMS-V2-HVAMS-TRIAL-BRIEF.md`](./FORMS-V2-HVAMS-TRIAL-BRIEF.md).

**Why the brief changed.** Five alphas have shipped since alpha.4, most of them driven by the
ServiceTas MAST trial and the React Native work, and alpha.9 is a breaking release for exactly
the part of the contract HVAMS leaned on hardest:

- **Looks replaced the class slots** (`docs/FORMS-V2-LOOKS.md`; PLAN phase 11). `className`,
  `shellClassName`, `textClassName`, `labelClassName`, `labelTextClassName` and `variant` are gone.
  The old brief's rule, "layout is the exception: it is classes", no longer has anything to point
  at: **layout is now a look** (`FORMS-V2-INTERFACES.md` §7, "Layout is a look"), a name the form
  gives and the app's theme defines, with `style` / `shellStyle` (portable CSS) for a one-off.
  alpha.4's form put Tailwind grid classes straight on a `Section`; this run cannot.
- **That makes the swap a real test of layout, not just behaviour.** A name defined only in the
  HVAMS html theme is an unknown look under Ant: drawn as the base look, with a development warning,
  which fails the clean-console check. So the run has to find out what it costs to make a form's
  layout hold under a second implementation: an `AntdLooksProvider` entry per name, a portable
  look (a function of `LookState.width` for the breakpoint), or something the library does not
  offer yet. That is the new headline question.
- **alpha.4's "After the trial" list shipped** (alpha.5): display colours by precedence
  (`displayShell.color`), per-widget shells (`HtmlTheme.shellFor`, `data-widget`), and
  `TextFieldExtra.showCount`. alpha.4's look needed two `FormRenderers` overrides, both for the
  per-widget shell; **the aim now is a theme alone, zero overrides**.
- Smaller things the form may meet: a select's empty choice has words (`SelectExtra.placeholder`);
  rich text (`RichText`, the `html` template) is a candidate for the 409 message's link, which
  alpha.4 styled with classes; icons are names (`IconSpec`, `FormIconsProvider`); help can sit at
  the label's end (`helpPlacement: "labelEnd"`, `helpLabel`); a refused submit's focus waits for a
  global lock to lift.
- **The engine moved**: alpha.9 needs `@rx-controls/core@^1.1.4` / `@rx-controls/react@^1.1.5`,
  i.e. compat `@react-typed-forms/core@5.1.5`. HVAMS `develop` declares `^5.1.2` (and
  `@astrolabe/ui` a direct `@rx-controls/react ^1.1.2`), so this run has a bump to do; alpha.4's
  did not.

What is **not** retested here, deliberately: React Native (HVAMS is web only; MAST covers it), the
JSON path, MUI and Fluent. Add a Fluent swap if the Ant layout finding needs a second data point.

Check `npm view @rx-controls/forms-react dist-tags` before starting: `alpha` should be
`0.1.0-alpha.9`. Update the versions and the rxc paths below if they have moved.

When the report lands, it replaces the alpha.4 report at the top of `docs/`: `git mv` that report
and its screenshot folder into `docs/archive/`, fix the relative links, and update `docs/README.md`.

---

Convert the HVAMS **Request Access** form to Forms v2, against `@rx-controls/forms-*@0.1.0-alpha.9`
(the `alpha` tag), and make the converted page **look like the original, within reason**. There are
three goals, in this order:

1. **Find gaps in the Forms v2 abstraction**: whether this real form can be written cleanly against
   the contract, and everything you learn about where it can't.
2. **Visual parity with the original page**, achieved the way an adopting app would do it: by
   styling the implementation, never the form. Every place parity can't be reached that way, or
   needed something awkward, is a finding just as a contract gap is.
3. **The form's layout survives an implementation swap.** Styling is now *looks*: names the form
   gives, which each implementation's theme defines. Find out what it costs to make the same form,
   unchanged, lay out correctly under a second implementation.

The branch is throwaway: nothing needs to be production ready, and temporary scaffolding (a
side-by-side page, extra dev dependencies) is fine. **Don't push the HVAMS branch without asking.**

**Do not read any `~/astrolabe/rxc/docs/FORMS-V2-HVAMS-REQUEST-ACCESS*.md` (top level or
`archive/`) until your own findings are written.** They are the previous runs' reports; reading them
first defeats the point. Don't read `docs/archive/FORMS-V2-HVAMS-*BRIEF*.md` either.

## Where things are
- Repository `~/astrolabe/hvams`. Make a worktree from `develop` on a new branch. The main checkout
  is on unrelated work; leave it alone.
- The form: `HVAMS.RoadManager.Server/ClientApp/common/src/hvams/accessRequests/RequestAccessForm.tsx`
  and `AccessDetailsSection.tsx` (the `hvams-common` package). **`AccessDetailsSection` is also
  rendered by `ModifyAccessForm.tsx`** (the user-profile dialog); decide what to do about the
  second host and record it.
- The page: `ClientApp/sites/rmi/src/app/requestAccess/page.tsx` (`/requestAccess`, a guest route).
- E2E: `sites/rmi/playwright/e2e/request-access.spec.ts`, `guest-routes.spec.ts`,
  `modify-access-request-submission.spec.ts`, and the page object
  `sites/rmi/playwright/pages/request-access.page.ts`.
- Server 400s are applied by `applyValidationErrors` (`common/src/utils/index.ts`), which sets
  each message on its control under the error key `"default"`.
- The workspace is Rush (`HVAMS.RoadManager.Server/rush.json`): edit `package.json`, then
  `rush update`; build with `rush build --to roadmanager`.

## The library
Ask npm for the `alpha` tag explicitly.
- `@rx-controls/forms-react@alpha`: **the contract.**
- `@rx-controls/forms-html@alpha`: the implementation to draw with, styled to match the original
  (see "Visual parity" below).
- `@rx-controls/forms-antd@alpha` (peer `antd` 6): for the swap.

Source and design docs are in `~/astrolabe/rxc`:
- `docs/FORMS-V2-LOOKS.md` — **styling, the source of truth.** Read it before writing any look:
  `look` / `style` / `shellStyle`, the portable subset, the theme's `looks` table and its parts,
  `LookState`, `FormLooksProvider`, typing names through `FormLooks`, and "One look table, five
  implementations".
- `docs/FORMS-V2-INTERFACES.md` (§7, "Layout is a look"), `docs/FORMS-V2-GOALS.md`.
- `apps/dev/src/app/(dev)/v2/PersonForm.tsx` (a JSX form), `apps/dev/src/app/(dev)/v2/compat/CompatFixture.tsx`
  (HVAMS's exact situation: compat controls in a v2 form), `tools/forms-conformance/src/widgets/Stars.tsx`
  (a field written from outside), `tools/forms-conformance/src/portable.ts*` (one look table drawn
  under every implementation), and the package sources under `packages/` — `forms-html/src/theme.tsx`
  for html's theme, `forms-antd/src/looks.tsx` for Ant's looks.
- The API reference: `rush docs` in rxc (needs a built tree) writes it to `api-docs/`.

## First: one engine copy
alpha.9 needs `@rx-controls/core` / `@rx-controls/react` at the versions its `package.json`s ask for
(check them). Find the compat `@react-typed-forms/core` release that depends on those, and bump
compat to it **everywhere it is declared**. Also bump the direct declarations of
`@rx-controls/react` / `@rx-controls/core` (one workspace project has one). Then confirm the
lockfile has exactly one `@rx-controls/core` and one `@rx-controls/react`, nothing on a deprecated
compat, and at runtime `getCompatPatchInfo()` reports `engineCopies: 1` (log it from the page
temporarily). Build every workspace project, not just rmi, since the bump touches all of them.
Record anything the compat bump changed in HVAMS code that has nothing to do with Forms v2.

## The rule: the form is written against the contract only
- The form files and any widget you write import only from `@rx-controls/forms-react`,
  `@rx-controls/react` / `@react-typed-forms/core`, and HVAMS's non-UI code. Nothing from an
  implementation package or `@astrolabe/ui`, and **no class names**: the class props are gone from
  the contract, and the form should not reach for them another way.
- **Layout is a look.** A grid, a row, columns per breakpoint: the form names a look on the group
  (`look="…"`), and the app defines it. `style` / `shellStyle` (portable CSS) are the escape hatch
  for a one-off. Declare HVAMS's look names on `FormLooks` so a typo is a compile error. Visual
  styling of a widget is never the form's.
- The implementation is chosen in exactly one place: **the rmi site's root layout**
  (`sites/rmi/src/app/layout.tsx`) puts `<FormProvider renderers={htmlRenderers}>` around the app.
  **The look is chosen there too**: one HVAMS module (a theme with its `looks`, plus any slot
  overrides) wrapped around the app inside the provider. Every v2 piece, the second host's included,
  then needs nothing around it. A scaffolding page that wants another implementation (the Ant swap)
  nests its own provider, and whatever HVAMS module that implementation needs.
- Wherever the rule can't be kept, that's a finding. Plain JSX for page chrome is fine.

## How to convert
- Keep the data layer: compat `useControl` for `form` (`AccessRequestEdit`) and its fields, passed
  straight into v2 fields.
- Text fields keep `autoComplete` and `required`. State and Agency are `SelectField`s; Agency is
  hidden until a state is chosen (the `hidden` prop, not conditional rendering). The four personal
  fields sit **two to a row** on wide screens and one per row on narrow ones. That is a deliberate
  change: the original is two to a row at every width.
- The reason and description stop the user at 300 / 250 characters, with an error if a longer value
  arrives anyway, and each has an "n / max characters" counter that turns red past its limit. Look
  for what the contract offers for a counter before writing one. The description shows only when
  "Other" is among the reasons and is cleared when hidden — to the value the DTO expects for an
  empty answer, not just whatever clearing writes by default. The sections are `Section` /
  `Contents` with a `title`.
- The reasons checkboxes bind `AccessRequestReason[]`. Use what the contract provides for a set
  of choices; write one with `fieldRenderer` + `useFieldShell` only if it provides nothing.
- Submit posts only once the form validates, and **Enter in a field submits** as a native form
  would. Keep the success view and the 400 / 409 / 429 handling exactly, including the 409
  message's link. The submit error is a message assistive technology announces; the counters are
  not.
- Keep: agency resets to the chosen state's first agency when the state changes; an agency no
  longer in the options is cleared; the email is prefilled from `?email=`. Note for each whether
  it still needs an effect.
- For every requirement above, look for what the contract offers before writing an effect, a
  widget or a look, and record which needed one.

## Visual parity
Make `/requestAccess` under v2 look like the original page. Bring the look in at the
implementation's level, in the HVAMS module the root layout wraps around the app:
- **A theme first.** forms-html is styled by its theme: `HtmlThemeProvider` with a partial theme
  over `tailwindHtmlTheme` (`packages/forms-html/src/theme.tsx`) — the implementation's own slots,
  per-widget shells, and the `looks` table that defines every name the form uses. Take the classes
  from what the original renders: read `@astrolabe/ui`'s components for them, but don't import those
  components into the form.
- **Aim for a theme alone: no `FormRenderers` overrides.** Every slot override is a finding: record
  what the theme could not say.
- **A slot override where a theme can't reach.** `FormRenderers` (forms-react) overrides slots
  for part of an app over the active implementation; its function form receives the enclosing slots
  to wrap. Writing a slot renderer of your own, even one drawn with `@astrolabe/ui` components, is
  allowed, but record each one and why the theme was not enough.
- **Within reason** means: the same layout and breakpoints, spacing, type sizes and weights,
  colours, input and select look (border, radius, height, focus ring), checkbox look, button look,
  section titles, and where and how help, errors, counters and the required marker appear. It does
  not mean pixel-perfect, the same DOM, or the same class names. Stop at "a user would not notice",
  and list what still differs.
- Compare at desktop width and at a phone width (375px), in four states: empty, a refused submit
  (every error showing), a state and agency chosen, and "Other" ticked with the description shown.
  Take screenshots of both pages in each state for the report.
- Visual parity is only for html. Ant keeps Ant's look for its widgets in the swap below — but the
  form's **layout** must hold there too (goal 3).

## Checks that found real bugs before — run them again
- **Server errors vs. validators.** With a server 400 on a field, confirm the message shows under
  that field and clears when the field is edited. Then give that field a bare-function
  `validate={() => null}` (no key) and repeat: does the server message still show?
- **Accessible errors under each implementation.** Assert errors through the accessibility tree —
  `toHaveAccessibleDescription` on the control — not just visible text, under html *and* Ant. The
  counters: are they in the description, and in what order with help and error?
- **Visibility inside containers.** With the personal fields two to a row, hide one of them
  (temporarily) and confirm the next field moves up into its cell rather than leaving a hole —
  under html *and* Ant, now that the grid is a look.
- **Names as well as descriptions.** Every control — the checkboxes' group and the selects
  included — has an accessible **name** and description (`toHaveAccessibleName` /
  `toHaveAccessibleDescription`), under html and Ant. Section titles are headings
  (`getByRole("heading")`).
- **Enter.** In a real browser, Enter in a text field submits — refused with every error shown on
  an empty form, posting on a valid one, once.
- **Announcements.** The submit error is a live region (`role="alert"`); a counter is not, so
  typing is not read out key by key.
- **Colour.** The counter turns red past its limit, and the submit error's box has the original's
  colour, under html — read the computed colour, don't trust the class list.

## The implementation swap
Mount the **unchanged** form under `antdRenderers`, in a nested `<FormProvider>` on its
scaffolding page: it replaces the root's html implementation, and the HVAMS html theme does not
reach it. First mount it with nothing else and record what happens to the form's look names
(console, layout). Then make the layout hold — two to a row on wide, one on narrow, the hidden cell
closing — with the least you can, and record exactly what that took and whether a third
implementation would need it all again. Then fill it in, submit a refused form, trigger a server
400, submit a valid one. For each difference, say whether it is a contract gap, a looks gap, or an
implementation bug. The console must be clean in the end state.

## Side by side
Put up a **side-by-side page: the original form (restored from git, next to the v2 form) against
v2 under html with the HVAMS module**, plus v2 under Ant as a third column or a second page. Leave
it running for the user to look at.

## Environment
- Run the **develop** backend from this worktree — never the `release-candidate` checkout, which is
  not compatible. Copy the gitignored `HVAMS.RoadManager.Server/appsettings.Development.json` from
  the main checkout, and start it with the Autotest profile's test settings:
  `AppEnv__IsTestMode=true PublicFormRateLimit__PermitLimit=60 PublicFormRateLimit__WindowMinutes=1 dotnet run --launch-profile RoadManager`.
  Without the raised limit, the spec's own API call gets a 429.
- The backend proxies the RMI site (`https://localhost:5003`) to `http://localhost:3001`,
  hardcoded. Run this worktree's rmi there with `rushx dev`. If the user's own dev servers or
  backend hold those ports, ask them to stop them rather than working around it.
- Playwright: `NODE_ENV=development npx playwright test …` with a `.env.development` copied from
  `.env.test` (the config loads `.env.$NODE_ENV`; the dev URL is `https://localhost:5003`).
- The host's Tailwind `content` must scan `node_modules/@rx-controls/forms-html/lib/**/*.js`, or
  html's own classes are silently missing.
- `next dev` writes `AGENTS.md` / `CLAUDE.md` into `sites/rmi`; delete them before committing
  anything.

## Verify
- Build the rmi site and every other workspace project.
- Run the request-access, guest-routes and modify-access-request-submission specs, updating the
  page object for the new markup. Don't weaken what they assert: if Submit is no longer disabled,
  assert instead that an empty submit is refused with an error on each required field and no
  success view. (The modify spec's submitting tests have got 409s from requests already in flight
  in the shared dev DB; check whether that still holds on `develop` before blaming the trial.)
- Walk the form by hand: a refused submit, a server 400, switching state after picking an agency,
  "Other" on / off / on. The console must be clean: no React key, act, render-phase or
  unknown-look warnings.

## Report back
Write the report as `~/astrolabe/rxc/docs/FORMS-V2-HVAMS-REQUEST-ACCESS-0.1.0-alpha.9.md`, in the
style of the other Forms v2 docs, citing rxc source lines (at the commit the alpha was released
from) for each finding:
1. **Gaps in the contract**, each with what you did instead and what the library should offer.
2. **The multi-select**: what came free, what was awkward, what you'd want built in.
3. **Validation and submit**: whether `check()`, `required`, `validate` and server errors covered
   the real form.
4. **Visual parity**: the screenshots side by side, per state and width; what the theme alone
   matched; each slot override and why the theme could not do it; what still differs and whether
   that is a theme gap, a contract gap, or "within reason"; how big the HVAMS module came out; and
   whether another HVAMS form could reuse it as it stands.
5. **Looks and layout across implementations**: the look names the form uses and why each exists;
   which are html classes and which portable; what each cost under Ant; whether looks are the
   right abstraction for an app's layout, and what you would change.
6. **The swap**: everything else that behaved differently under Ant, and whether each is a contract
   gap or an implementation bug.
7. **Compat interop and the engine bump.**
8. **Against the previous runs** — only now read `FORMS-V2-HVAMS-REQUEST-ACCESS-0.1.0-alpha.4.md`,
   the direct predecessor, including its "After the trial" table (and, for history, the alpha.3,
   alpha.1 and alpha.0 reports in `docs/archive/`): for each of its findings and suggested changes,
   fixed, changed or still open, and anything new this run found that it missed. Say whether each
   fix holds up in a real form, and where it does not, why. alpha.4 wrote its layout as classes,
   which alpha.9 removed: compare what the same layout cost then and now.
