# Forms v2 — the HVAMS adopter trial, as a brief

The prompt for rerunning the Request Access trial against a new Forms v2 alpha. Paste everything
below the line into a fresh Claude Code session in a new HVAMS worktree. It is a **cold read**:
the conversion is redone from scratch each time, so the contract is judged without knowing the
last run's workarounds. The last run's findings are in
[`FORMS-V2-HVAMS-REQUEST-ACCESS.md`](./FORMS-V2-HVAMS-REQUEST-ACCESS.md) (`0.1.0-alpha.0`); the
brief keeps them out of reach until the new findings are written.

Update the version and the rxc paths in the brief if they have moved.

---

Convert the HVAMS **Request Access** form to Forms v2, against the current `alpha` of the
`@rx-controls/forms-*` packages. **The goal is to find gaps in the Forms v2 abstraction, not to
produce a finished-looking page.** How it looks is irrelevant. What matters is whether this real
form can be written cleanly against the contract, and everything you learn about where it can't.
The branch is throwaway: nothing needs to be production ready, and temporary scaffolding (a
side-by-side page, extra dev dependencies) is fine.

**Do not read `~/astrolabe/rxc/docs/FORMS-V2-HVAMS-REQUEST-ACCESS.md` until your own findings
are written.** It is the previous run's report; reading it first defeats the point.

## Where things are
- The form: `HVAMS.RoadManager.Server/ClientApp/common/src/hvams/accessRequests/RequestAccessForm.tsx`
  and `AccessDetailsSection.tsx` (the `hvams-common` package). **`AccessDetailsSection` is also
  rendered by `ModifyAccessForm.tsx`** (the user-profile dialog); decide what to do about the
  second host and record it.
- The page: `ClientApp/sites/rmi/src/app/requestAccess/page.tsx` (`/requestAccess`, a guest route).
- E2E: `sites/rmi/playwright/e2e/request-access.spec.ts`, `guest-routes.spec.ts`, and the page
  object `sites/rmi/playwright/pages/request-access.page.ts`.
- Server 400s are applied by `applyValidationErrors` (`common/src/utils/index.ts`), which sets
  each message on its control under the error key `"default"`.
- The workspace is Rush (`HVAMS.RoadManager.Server/rush.json`): edit `package.json`, then
  `rush update`; build with `rush build --to roadmanager`.

## The library
Ask npm for the `alpha` tag explicitly.
- `@rx-controls/forms-react@alpha`: **the contract.**
- `@rx-controls/forms-html@alpha`: the implementation to draw with. Leave it unstyled.
- `@rx-controls/forms-antd@alpha` (peer `antd`): only for the swap check.

Source and design docs are in `~/astrolabe/rxc`: `docs/FORMS-V2-INTERFACES.md`,
`docs/FORMS-V2-GOALS.md`, `apps/dev/src/app/(dev)/v2/PersonForm.tsx`,
`apps/dev/src/app/(dev)/v2/compat/CompatFixture.tsx` (HVAMS's exact situation: compat controls in a
v2 form), `tools/forms-conformance/src/widgets/Stars.tsx` (a field written from outside), and the
package sources under `packages/`.

## First: one engine copy
Find which `@react-typed-forms/core` (compat) version depends on the `@rx-controls/core` the alpha
needs, and bump compat to it **everywhere it is declared**. Also check for direct declarations of
`@rx-controls/react` / `@rx-controls/core` (one workspace project has one). Then confirm the
lockfile has exactly one `@rx-controls/core` and one `@rx-controls/react`, nothing on a deprecated
compat, and at runtime `getCompatPatchInfo()` reports `engineCopies: 1` (log it from the page
temporarily). Build every workspace project, not just rmi, since the bump touches all of them.

## The rule: the form is written against the contract only
- The form files and any widget you write import only from `@rx-controls/forms-react`,
  `@rx-controls/react` / `@react-typed-forms/core`, and HVAMS's non-UI code. Nothing from an
  implementation package or `@astrolabe/ui`, and no DOM or class names for anything the contract
  has a boundary for.
- The implementation is chosen in exactly one place: the page puts
  `<FormProvider renderers={htmlRenderers}>` around the form.
- Wherever the rule can't be kept, that's a finding. Plain JSX for page chrome is fine.

## How to convert
- Keep the data layer: compat `useControl` for `form` (`AccessRequestEdit`) and its fields, passed
  straight into v2 fields.
- Text fields keep `autoComplete` and `required`. State and Agency are `SelectField`s; Agency is
  hidden until a state is chosen (the `hidden` prop, not conditional rendering). The 300 / 250
  limits are `validate` rules and the counters are `TextDisplay`s with a derived `text`. The
  description shows only when "Other" is among the reasons and is cleared when hidden. The
  sections are `Section` / `Contents` with a `title`.
- The reasons checkboxes bind `AccessRequestReason[]`. If there is still no built-in multi-select,
  write one with `fieldRenderer` + `useFieldShell`, plain DOM checkboxes inside the shell.
- Submit is an `<Action>` whose handler awaits `useFormValidation().check()` before posting. Keep
  the success view and the 400 / 409 / 429 handling exactly.
- Keep: agency resets to the chosen state's first agency when the state changes; an agency no
  longer in the options is cleared; the email is prefilled from `?email=`. Note for each whether
  it still needs an effect.

## Checks that found real bugs last time — run them again
- **Server errors vs. validators.** With a server 400 on a field, confirm the message shows under
  that field and clears when the field is edited. Then give that field a bare-function
  `validate={() => null}` (no key) and repeat: does the server message still show?
- **Accessible errors under each implementation.** Assert errors through the accessibility tree —
  `toHaveAccessibleDescription` on the control — not just visible text, under html *and* Ant.
- **Visibility inside containers.** Does anything in the form (or the contract) need a container
  to know which of its children are hidden — a column layout, a tab, a wizard page?

## The implementation swap
Mount the **unchanged** form under `antdRenderers`. Fill it in, submit a refused form, trigger a
server 400, submit a valid one. For each difference, say whether it is a contract gap or an
implementation bug. Then put up a **side-by-side page for visual comparison: the original form
(restored from git, next to the v2 form) against v2 under Ant**, and leave it running for the
user to look at.

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
- `next dev` writes `AGENTS.md` / `CLAUDE.md` into `sites/rmi`; delete them before committing
  anything.

## Verify
- Build the rmi site and every other workspace project.
- Run the request-access and guest-routes specs, updating the page object for the new markup.
  Don't weaken what they assert: if Submit is no longer disabled, assert instead that an empty
  submit is refused with an error on each required field and no success view.
- Walk the form by hand: a refused submit, a server 400, switching state after picking an agency,
  "Other" on / off / on. The console must be clean: no React key, act or render-phase warnings.

## Report back
Write the report as a new file in `~/astrolabe/rxc/docs/` named for the alpha (for example
`FORMS-V2-HVAMS-REQUEST-ACCESS-<version>.md`), in the style of the other Forms v2 docs, citing
rxc source lines for each finding:
1. **Gaps in the contract**, each with what you did instead and what the library should offer.
2. **The custom multi-select**: what came free, what was awkward, what you'd want built in.
3. **Validation and submit**: whether `check()`, `required`, `validate` and server errors covered
   the real form.
4. **The swap**: everything that behaved differently under Ant, and whether each is a contract gap
   or an implementation bug.
5. **Compat interop and the engine bump.**
6. **Against the previous run** — only now read `FORMS-V2-HVAMS-REQUEST-ACCESS.md`: for each of its
   findings, fixed, changed or still open, and anything new this run found that it missed.
