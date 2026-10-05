# CLAUDE.md

## What is this?

RXC is a Rush monorepo for reactive controls and schema-driven forms. It unifies packages previously spread across `@astroapps/*` and `@react-typed-forms/*` under the `@rx-controls/*` npm scope: the control engine (`core`, `react`, stable at 1.0), the legacy-compat package, and **Forms v2** (`forms-*`, alpha) — see `docs/FORMS-V2-PLAN.md`.
## Packages

| Package | Dir | Purpose |
|---|---|---|
| `@rx-controls/core` | `packages/core` | Pure TypeScript control tree. No React, no globals. Zero dependencies. |
| `@rx-controls/react` | `packages/react` | React adapter: `useReactive()` hook (rc + the `rendered()` render boundary), `useControl`, `useComputed`, `useControlEffect`, `useValidator`/`useAsyncValidator`, `useControlGroup`, `useValueWithPrevious`, `useSelectableArray`/`selectableValues`, the binding layer (`useFormControlProps`, `ControlInput`/`ControlSelect`/`ControlCheckbox`, `FormEditState`/`FormEditProvider`/`useFormEdit`), `ControlContextProvider`, and the nested-scope render helpers (`RenderControl`, `RenderElements`, `RenderOptional`, `whenAllDefined`, `RenderArrayElements`, `NotDefinedContext`). Re-exports all of controls-core. |
| `@react-typed-forms/core` (v5) | `packages/compat-controls` | The legacy-compat package, **published under the legacy name as its v5 major** — legacy v4 consumers migrate with a plain semver bump plus one root provider line. **Complete (Phases A+B+C)**: compat `Control<V>` type, `ControlImpl.prototype` patch (zero overrides), ambient read collector + `withAmbient`, ambient write transactions (`groupedChanges`), singleton context, full function surface, `useComponentTracking`/`useTrackedComponent` (SWC-plugin contract), all legacy hooks, F-components, render helpers, `formControlProps`/`useFormControlProps`, `trackedValue`/`unsafeRestoreControl`/`unwrapTrackedControl`, `SubscriptionTracker`/`Effect`/`AsyncEffect` + factories. Migration = bump `@react-typed-forms/core` to `^5.0.0` + one root `<ControlContextProvider value={getCompatContext()}>` (imports unchanged, SWC plugin keeps working). The two legacy reference apps are that migration, done in-repo: they take the compat package as `workspace:^` and the published `@react-typed-forms/schemas@19` / `schemas-html@6` / `@astroapps/schemas-datagrid@9`, which peer on `@react-typed-forms/core@^5` and so resolve to the local build — one engine copy. Their `app/layout.tsx` carries the provider as its own `@noTrackControls` component (both traps from `packages/compat-controls/README.md`). Design: `docs/COMPAT-CONTROLS-DESIGN.md`. |
| `@rx-controls/forms-schema` | `packages/forms-schema` | **Forms v2.** The canonical `ControlDefinition` / `SchemaField` JSON types, builders and `schemaSchemas` — moved out of the POC's `forms-core` in phase 1 of `docs/FORMS-V2-PLAN.md`. No React. Must serialise to exactly the JSON the C# server writes (see Constraints). Exempt from TypeDoc's `notDocumented` for now. |
| `@rx-controls/forms-react` | `packages/forms-react` | **Forms v2 — the contract.** The contract: props, scope and presence, the validation scope tree (verdicts, claims, `check()`), field validation, the registry and primitive hooks, the field / group / display / action / collection boundaries with staged edit, tabs / wizard / dialog, the controllers and the built-ins. Grouped by audience (Authoring / Implementations / Extensions). A `./internal` subpath carries what sibling packages need (`useDefaultValue`, `hiddenPending`). |
| `@rx-controls/forms-json` | `packages/forms-json` | **Forms v2 — the loader.** `translateForm` / `JsonForm` over the canonical `forms-schema` types (read internally through one open "any definition" view, `src/defs.ts`), `defaultTranslators`, `CompoundCycle`, host extensions (translators, adornments, custom displays, icons, action handlers), the translate-time audit, `strict` + `LoaderStrictError`. Emits no markup of its own except the default icon's `<i>`. Tested through `@rx-controls/forms-html` (a dev dependency); Its fixture form lives in `rxc-forms-conformance`. |
| `@rx-controls/forms-html` | `packages/forms-html` | **Forms v2 — the HTML implementation.** A `./shared` subpath carries the generic DOM parts (region, inline group, chrome-less collection, display wrapper, no-transition visibility, duplicate-safe option keys) for the MUI and Ant implementations. `htmlRenderers` over plain DOM, `defaultHtmlTheme` (`rxf-` hooks only, works with no CSS) and `tailwindHtmlTheme` (Tailwind 3.4 + 4, no preflight assumed), nesting `HtmlThemeProvider`, `DefaultVisibility` / `FadeVisibility`. No stylesheet. |
| `@rx-controls/forms-mui` | `packages/forms-mui` | **Forms v2 — the MUI implementation**. `muiRenderers` over `@mui/material` (peer deps: MUI 9, emotion); `root` mounts `CssBaseline`. The label reaches the outlined frame privately for its notch, the control slot is a module-level `inputComponent`, a closed dialog is `keepMounted`. Generic DOM parts from `@rx-controls/forms-html/shared`. Tests: the conformance suite + the MUI failure modes. |
| `@rx-controls/forms-antd` | `packages/forms-antd` | **Forms v2 — the Ant Design implementation**. `antdRenderers` over `antd` 6; `root` mounts `ConfigProvider`; `reset.css` is the app's to load. Chrome from theme tokens through `style` (the frame is `border-box` itself), the checkbox's trailing label a sibling, tabs and modal kept mounted (`forceRender`, `destroyOnHidden={false}`). Tests: the conformance suite + the Ant failure modes, incl. no deprecated props. |
| `rxc-dev-app` | `apps/dev` | Next.js 16 playground with Tailwind CSS. Two root layouts, as route groups: `(dev)` holds every page below, on full Tailwind with preflight; `(servicetas)` holds `/v2/servicetas` — Forms v2 over the ServiceTas corpus under `forms-html`'s ServiceTas theme fixture and the corpus tools' stand-in host, on Bootstrap 3 + the portal css + Tailwind without preflight, for side-by-side with `legacy-compare`; it reads the gitignored corpus at request time and serves `legacy-compare/public`'s css and images through route handlers rather than copying them. Routes: `/` simple controls demo and index, `/controls` @rx-controls/react kitchen sink (legacy core surface ported — pair with legacy-demos `/controls`), `/v2` Forms v2 `PersonForm` from the real packages (forms-react + forms-html; the third-party widgets from `rxc-forms-conformance`), `/v2/compat` Forms v2 inside a compat-engine app — the HVAMS gate fixture, asserted by the app's `rushx test` (vitest + happy-dom; the only test suite in a Next app here), `/compat` `@react-typed-forms/core` v5 (compat) acceptance (the legacy kitchen-sink page, imports unchanged, one root provider added), plus one section the legacy page has no counterpart for: a **recursive `ControlSetup`** (`fields.children.elems = () => treeSetup`, legacy's `DelayedSetup` idiom for tree shapes). It went in because eager setup conversion made that shape blow the stack in a real app and nothing in-repo exercised it. |
| `rxc-forms-storybook` | `apps/forms-storybook` | **Forms v2 Storybook** (port 6006, `rushx dev`). A story per boundary kind — field, options, collection, group, display, action, tabs, wizard, dialog, staged edit — plus the third-party fixtures (`Stars`, `PetCards`, `Collapsible`, `SelectChild`, from `rxc-forms-conformance`). Written against the contract: the preview decorator (`src/support.tsx`) supplies the control context, the implementation (html, MUI, Ant) and html's theme from toolbar globals, and a `<Form>` whose presence / `disabled` / `readOnly` / `designMode` / `clearHidden` are args on every story. `rushx test` is the CI smoke test (`test/stories.test.tsx`): every story rendered under every implementation (html under each theme) via `composeStories`, failing on any console error or warning. Loads the packages from `lib/`, so it needs a built tree. |
| `rxc-legacy-demos` | `apps/legacy-demos` | Standalone Next.js app (port 3001) hosting legacy reference renderings via the published `@react-typed-forms/schemas@19` + `@react-typed-forms/schemas-html@6` (the releases that run on the compat engine) with `defaultTailwindTheme`. Routes: `/controls` (@react-typed-forms/core hooks/components kitchen sink — pair with dev `/controls`), and `/buttons` / `/externaledit`, legacy baselines whose POC pairs were removed with the POC. Add pages here when a v2 feature needs a side-by-side legacy comparison that doesn't fit the Fire-form-shaped `legacy-compare`. |
| `rxc-legacy-compare-demo` | `apps/legacy-compare` | Renders the canonical "Fire" form using the published legacy `@react-typed-forms/schemas@19` + `schemas-html@6` + `@astroapps/schemas-datagrid@9`, on the workspace compat engine (port 3002). Loads the same `Fire.json`, the same `bootstrap.min.css` + `theme.css` baseline as the legacy ServiceTas portal — the reference rendering the dev app's `/v2/servicetas` is compared against, and parity's baseline in spirit (parity itself runs legacy headless, in `tools/forms-corpus`). |
| `rxc-forms-conformance` | `tools/forms-conformance` | **Forms v2 conformance suite + outside-written fixtures** (private). `rxc-forms-conformance/suite` exports `describeConformance(impl)` — the same 28 contract assertions under every implementation, failing on any console output; the main entry exports the third-party widgets (`Stars`, `PetCards`, `Collapsible`, `SelectChild`, with `widgets.css`) and the JSON fixture form (`demoControls` / `demoSchema`), kept apart so an app never bundles vitest. html runs the suite from here (both themes) — `forms-html` depending on this package would cycle through `forms-json`, whose tests render through `forms-html`; MUI and Ant run it from their own packages. `forms-json`'s tests import the fixture form by path for the same reason. |
| `rxc-forms-corpus` | `tools/forms-corpus` | **Forms v2 corpus tooling**: `rushx extract-corpus` (a legacy app's forms + schemas → gitignored `corpus/`), `rushx burndown` (what the loader cannot carry across), `rushx parity` (every corpus form through legacy itself and through the v2 loader, values and errors diffed per path; anything v2 prints while rendering counts as a failure), and `rushx gates`, which runs both against `gates.json` (counts only) and fails on a regression — the burndown a ratchet, parity absolute. **Local, not CI**: the repo is public and the corpus is ServiceTas's forms. Its stand-in host (`src/host/standInHost.tsx`, one of each loader extension) is exported as `rxc-forms-corpus/host`. README has the extraction commands. |

## Commands

```bash
rush update          # Install/update all dependencies
rush build           # Build all packages
rush build --to X    # Build package X and its deps
rush test            # Run tests across all packages
rush docs            # TypeDoc over the Forms v2 packages → api-docs/ (needs a built tree; fails on any warning)

# Inside a package dir:
rushx test           # Run that package's tests
rushx test:watch     # Watch mode

# Pack for a trial install in an external project
rush publish --publish --pack --include-all --release-folder <dir>
node scripts/pack-compat.mjs --out <dir>   # the above + a compat overrides.json
```

**Consume packed tarballs through `pnpm.overrides`, never plain dependencies**
(in a Rush repo, `globalOverrides` in `common/config/rush/pnpm-config.json`).
A packed tarball's manifest asks for its siblings by *version*, so listing the
tarballs as ordinary `dependencies` makes the package manager resolve those
siblings from the registry — you get the published build instead of your local
one, or a 404 for a version that was never published. Overrides force every
reference, direct and transitive, onto the tarballs. This also keeps exactly
one `@rx-controls/core` in the process, which the compat prototype patch
requires. `pack-compat.mjs` writes a ready-made `overrides.json` next to the
tarballs for this reason.

**Next 15 apps need `eslint: { ignoreDuringBuilds: true }`.** `rush build` used to
exit 1 even though every project compiled: the two Next 15 apps (`rxc-legacy-demos`,
`rxc-legacy-compare-demo`) lint during `next build`, ESLint isn't in their devDeps
(it lives in the `lint` autoinstaller — see Linting below), Next reports that as a
build *warning*, and Rush escalates "succeeded with warnings" to a non-zero exit.
Both configs now disable build-time linting; `rush lint` runs `eslint packages apps`
over them anyway, so no coverage is lost. Next 16 dropped lint-during-build, so the
Next 16 app (`rxc-dev-app`) never had the problem. Any new
Next 15 app in this repo needs the same flag.
## Architecture

### Core design principles

1. **No globals** — all state is explicit. ControlContext instances are passed, not ambient.
2. **Explicit reactivity** — reading through `ReadContext` registers dependencies. Writing through `WriteContext` batches notifications.
3. **React is an adapter** — the core library (`controls-core`) has zero React dependency. `useReactive()` in `@rx-controls/react` hands a component its `ReadContext`; the component closes the render pass with `rendered(…)`, which reconciles tracked reads into subscriptions (see `docs/RENDER-BOUNDARY.md`).
4. **ESM only** — all packages use `"type": "module"`.

### Module resolution: `nodenext` for shippable packages

`tsconfig.base.json` sets `moduleResolution: "bundler"`, which lets source omit
extensions on relative imports (`from "./patch"`). That is fine for anything only
ever consumed through a bundler, but **`tsc` emits the specifier verbatim**, so the
built output is not loadable by Node's ESM resolver — `ERR_MODULE_NOT_FOUND` on the
first relative import. It fails in more places than you'd expect: vitest externalizes
`node_modules` and hands them to Node, as does a Next server bundle. The repo's own
tests never caught it because in-workspace source goes through vite.

Every package under `packages/` therefore overrides both `module` and
`moduleResolution` to `"nodenext"` and **writes `.js` on every relative import** in
`src`. TypeScript then enforces it. Any package that gets packed for an external
consumer needs the same treatment; do it before packing, not after.

Bundling would also solve this (relative imports collapse away), but is the wrong tool
here — see `packages/compat-controls/README.md` for why the compat stack must stay
three separate packages.
### Dependency graph

```
@rx-controls/core            (pure TS, no deps)
    ↑
@rx-controls/react           (+ react peer dep)
    ↑                             ↑
@react-typed-forms/core (v5)  @rx-controls/forms-react   (the contract; no DOM)
                                  ↑            ↑
  @rx-controls/forms-schema → @rx-controls/forms-json   @rx-controls/forms-html
       (canonical JSON types)     (the loader; jsonata)      ↑            ↑
                                              @rx-controls/forms-mui  @rx-controls/forms-antd
```

`forms-json` depends on `forms-schema` and `forms-react`; the implementations depend on
`forms-react`, and MUI and Ant also on `forms-html` for its generic DOM parts (the `./shared`
subpath). A future `@rx-controls/forms-native` sits beside `forms-html`, sharing the contract
and not its source.

### Internal subpath exports

For sibling packages only — not public API, no semver promise, not in the generated reference:

- `@rx-controls/core/internal` — `ControlImpl`, `toImpl`, `WriteContextImpl`, `TrackingReadContext`, `SubscriptionReconciler`, etc., for `@rx-controls/react` and the compat package.
- `@rx-controls/forms-react/internal` — `useDefaultValue`, `hiddenPending`, for the loader.
- `@rx-controls/forms-html/shared` — the generic DOM parts, for `forms-mui` and `forms-antd`.

## Design documents

All in `docs/`:

- **CONTROL-SEMANTICS.md** — The authoritative reference for control tree behavior: value propagation, error handling, dirty/touched/disabled cascading, element lifecycle, null materialization. **These semantics are settled and must be preserved.**
- **RENDER-BOUNDARY.md** — The authoritative reference for how a component gets reactive reads: the `useReactive()` / `rendered(…)` contract, why reconcile must stay synchronous with the render body, `Rendered` branded-type enforcement, the dev-mode guard, behaviour under throw/suspend, and **writing controls from a render body** (the render-phase-update split and the deferred-notification queue). **Settled semantics.**
- **FUTURE-API-DESIGN.md** — The three-package architecture, ReadContext/WriteContext design, React-adapter rationale.
- **COMPAT-CONTROLS-DESIGN.md** — Design for the legacy-compat package (`packages/compat-controls`, published as `@react-typed-forms/core@5`): three ambient bridges (collector → SubscriptionReconciler, ambient WriteContext, singleton ControlContext), `ControlImpl.prototype` patching, the `withAmbient(rc, fn)` rc-bridge trick, full legacy export inventory with dispositions, phasing A/B/C. Replicates the `@react-typed-forms/core@4.6.0` surface.
- **MIGRATION-FROM-LEGACY-CORE.md** — Rosetta stone for porting a host off `@react-typed-forms/core` (**either major**) onto `@rx-controls/react`: the three ambient bridges and their explicit replacements, read/write/rename mapping tables, what has no equivalent, and the incremental path. Version-agnostic by construction — v5 replicates the v4 surface, so every table reads the same on both; the handful of genuine v4/v5 differences (untracked snapshots `c.current.x` vs `c.xNow`, per-control `equals`, live vs stubbed metrics APIs, `runPendingChanges`, and the fact that **incremental migration requires v5**) are flagged inline.
- **FORMS-V2-GOALS.md** — What Forms v2 is for: JSX first, JSON downstream, identical semantics to legacy on the JSON path, library independence.
- **FORMS-V2-INTERFACES.md** — The contract's design and its reasons (the API reference itself is `rush docs`). "README finding N" cites the removed POC build's README: `git show a087d03:poc/forms-v2/README.md`.
- **FORMS-V2-PLAN.md** — The package layout, TypeDoc as the API reference, the Storybook, the two adopter tracks (HVAMS on the JSX path; ServiceTas on the JSON path, protected by the local corpus gates), and phases with exit criteria. **No dates, by design.**
- **FORM-SEMANTICS.md**, **TRAVERSAL-LEGACY.md** — Legacy `@astroapps/forms-core` form-state and traversal semantics: what parity holds the Forms v2 JSON path to.
- **IMPLEMENTATION-PLAN.md** — Original step-by-step migration plan from the controls-api prototype (historical).

## Constraints

### JSON format compatibility

`@rx-controls/forms-schema` must serialize ControlDefinition, SchemaField, and all their subtypes to the **exact same JSON** as the existing `@astroapps/forms-core`. These types use `type`-field discriminated unions. The C# server (`Astrolabe.Schemas`) generates this format — both ends must agree.

Reference for the canonical types: `astrolabe-common/forms/core/src/controlDefinition.ts` and `schemaField.ts`.

### Settled semantics (do not change)

Everything documented in `docs/CONTROL-SEMANTICS.md` is locked:
- Bidirectional value propagation with cycle prevention
- WriteContext notification batching with NotifyFn pattern (batched notification, not a transaction — writes apply immediately and nothing rolls back)
- Bitmask-based change detection (ControlChange enum)
- Lazy child creation (eager for validators)
- Value equality configured per `ControlContext` and applied to every control it creates

### Forms v2 is an alpha

The `forms-*` packages are published as prereleases on the npm `alpha` dist-tag (see "Publishing posture"). The contract can still move between alphas — renaming, reshaping, removing — and a rename just changes every call site (no aliases; see "No deprecations"). What must not move silently is behaviour: the conformance suite (`tools/forms-conformance`) holds every implementation to the contract, the story smoke test holds the stories, and on the JSON path `rushx gates` in `tools/forms-corpus` holds the loader to legacy — run it before a loader, translator or implementation change lands.

**The JSON path replicates legacy.** A render type, adornment or dynamic property means what legacy's does, and parity is the test. Divergences are deliberate, few, and classified in the parity run rather than hidden: a display-only field is write-free (legacy's `clearHidden` cleared it), and each Jsonata validator publishes under its own key (legacy shared one `jsonata` key, and lost a message). Add to that list only by decision, never by accident.

### Publishing posture

Gated by `shouldPublish` in `rush.json`:

| Package | Version | dist-tag |
|---|---|---|
| `@rx-controls/core` | 1.1.2 | `latest` |
| `@rx-controls/react` | 1.1.2 | `latest` |
| `@react-typed-forms/core` (the compat package) | 5.1.2 | `latest` |
| `@rx-controls/forms-schema`, `-react`, `-json`, `-html`, `-mui`, `-antd` | 0.1.0-alpha.1 | `alpha` |

The apps and `tools/` packages are never published. A consumer of Forms v2 asks for `@alpha`:
npm pointed each v2 package's `latest` at `0.1.0-alpha.0` too, since it always tags a
package's first-ever version `latest` whatever `--tag` says; later alphas move only `alpha`.
**React 19 only, without a major:** react
1.1.0 and compat 5.1.0 narrowed their peer range from `^18 || ^19` to `^19` in a minor, because
no consumer ever ran them on 18; the earlier releases that declared 18 (`@rx-controls/react@1.0.0`,
`@react-typed-forms/core@5.0.0`) are `npm deprecate`d in favour of them rather than kept alive.
**Publishing is two Rush commands, one per version policy** (`common/config/rush/version-policies.json`):

- `rush publish-latest` — policy `stable` (`core`, `react`, compat) → the `latest` dist-tag.
  Versioned from change files: `rush change`, then `rush version --bump`.
- `rush publish-alpha` — policy `forms-v2-alpha` (the six v2 packages) → the `alpha` dist-tag.
  A lock-step policy: `rush version --bump --version-policy forms-v2-alpha` moves all six to the
  next prerelease together. Exempt from change files while the contract is an alpha.
- `rush publish-check` — dry-runs both and prints what each would publish.

Each publishes only versions newer than the registry's, so running one never republishes the
other's packages, and neither can put an alpha on `latest`. Both pass `--set-access-level public`
(Rush otherwise passes `restricted` for a scoped package, which would make a new one private) and
preserve `XDG_CONFIG_HOME` so npm's browser authentication works. Each builds its own packages
and their dependencies first (`rush build --to version-policy:<policy>`), so a stale `lib/` is
never published, and a failed build publishes nothing. **The stable packages publish to
`latest`; the Forms v2 packages to `alpha`**, so a plain `npm install` never picks up a
prerelease and a consumer opts in with `@alpha`. Later alphas bump the `.N`.

**Intra-repo deps are `workspace:^`, never `workspace:*`.** pnpm rewrites the
spec at pack time, and `*` becomes an **exact pin** — `@rx-controls/react@1.0.0`
would hard-require `@rx-controls/core@1.0.0`. A later core patch then leaves a
consumer on `^1.0.0` resolving 1.0.1 while react still pins 1.0.0: **two copies
of the engine**, which silently breaks the compat prototype patch (it lands on
one copy; the app's other controls use the other). `workspace:^` publishes
`^1.0.0` and dedupes. `ensureConsistentVersions` is on, so this is repo-wide.

`rush publish --include-all` is all-or-nothing — `--version-policy` only
narrows within it, and `--prerelease-name` is silently ignored when it is
passed — and `--tag` is mandatory: npm publishes to `latest` unless told
otherwise, prerelease or not. So each publish is narrowed to one version policy
with `--version-policy`, and carries that policy's tag — the two commands above. `scripts/pack-compat.mjs` also reads the
flags, to derive its build/pack scope.

### No deprecations — break cleanly in a major

`@rx-controls/core` and `@rx-controls/react` are at 1.0 and the compat package at 5.0.0; the Forms v2 packages are alphas (see "Publishing posture" above). **The pre-release justification for this rule is gone — it now rests on semver instead:** a rename is a breaking change, so it waits for the next major rather than shipping behind an alias. Don't add `@deprecated` aliases, "legacy" re-exports, backwards-compat shims, or rename-with-pointer transitions when refactoring the public surface. Just change the name / shape and update every call site. The dedicated compat package (`packages/compat-controls`, published as `@react-typed-forms/core@5`) exists for legacy core consumers — that's the only place compat shims belong. (Legacy `@react-typed-forms/schemas` consumers can keep the legacy renderer set and swap only the engine — see "Legacy schemas on the compat engine" below. A schemas compat *package* was considered and rejected.)

## Completed

### Phase 1–2: @rx-controls/core + @rx-controls/react

Fully implemented. Core control tree, reactive ReadContext/WriteContext, computed/effect primitives, and the React `useReactive()` / `rendered()` boundary.

### `useControlEffect` is a bare `effect()`, not a computed control

The contract is: **when the computed value changes per `ControlContext.equals`,
`onChange` runs once, eventually, with the latest value, and does not run again
until another such change.** "Eventually" is deliberately loose — a change may
arrive inline with the write that caused it or from a commit effect.

That looseness is what lets the hook be a single core `effect` created *inside*
`useEffect`, with one piece of state: `last`, the value `onChange` was last told
about. Three situations that used to need separate machinery are now the same
comparison against that ledger:

- an ordinary dependency change,
- a write landing in the render→mount window (`last` is seeded at first render
  via `untrackedRead`, and the effect's first run compares against it),
- a write landing while the tracker is dead — **which the previous
  implementation did not handle at all**, since a released computed stops
  recomputing and nothing replayed it.

Gone with it: the `useComputed` control, a `ctx.update` write-and-flush on every
dependency change, the `lastSeen` identity-comparison catch-up, and
`retainTracker`/`releaseTracker` (nothing is created during render, so cleanup is
deterministic and an abandoned render allocates nothing).

**Per-render recompute is retained and load-bearing** — an inline `compute` gets
a new identity every render, which is what lets it close over props the reactive
graph cannot observe. It is triggered by a `useEffect` keyed on `compute`'s
identity, declared *before* the effect that creates the `effect`; React runs all
cleanups then all effects in hook order, so that ordering makes the mount and
`ctx`-change cases no-op without a flag. Memoizing `compute` with `useCallback`
is the documented opt-out. One behaviour change from the old design: that
re-run now delivers in the commit phase rather than from the render body.

Core gained one thing for this: `EffectHandle.rerun()`.

### Writing controls from a render body

`update` from `useReactive()` is callable while the render window is open — the "adjust derived state
while rendering" shape, the analogue of React's guarded render-phase `setState`. Full rationale in
`docs/RENDER-BOUNDARY.md` ("Writing from a render body"); the load-bearing parts:

- The write applies immediately. Only **notification** is policed, and it splits: the writer itself
  is notified at once (same fiber → React's render-phase update, output discarded and the component
  re-invoked with no intervening commit), while any component that has **already committed** is
  deferred out of the render phase. Without that split React reports "Cannot update a component while
  rendering a different component" and services the update as a separate scheduled pass.
- Such writes must **converge**, but ordinary derived writes do so with no guard: `setValueImpl`
  bails on `ControlContext.equals` before touching a subscription, and the default `deepEquals`
  settles even a freshly-allocated object or array literal on the second pass. An explicit
  `if (rc.getValue(d) !== next)` costs the same two passes and is optional. Only a value that
  genuinely differs every pass (a counter, `Date.now()`, a random — or any fresh literal under a
  reference-based `equals`) loops, and React trips "Too many re-renders", which is the correct
  diagnostic and the same one plain React gives. That failure is invisible at mount — `reconcile()`
  has not run, so the write notifies nobody — and only springs on the second render.
- `openRc` is therefore maintained in **production**, not just under `IS_DEV` for the wrong-rc guard.
- The deferred queue drains in the **commit phase** (from the layout effect `useReactive` already
  registers — before paint, and inside a synchronous `act()` so consumer tests don't emit "not
  wrapped in act(...)"), with a **microtask backstop** for a render that never commits. The layout
  effect goes through `useCommitEffect`, which falls back to `useEffect` on the server — React warns
  that layout effects no-op during SSR and anything on stderr fails `rush test`.
- `rendered(…)` drops its own tracker from the queue: it just read current values, so a queued
  re-render is waste. That covers ancestor-writes-then-descendant-renders for free.

### Dev-only code must use the literal `process.env.NODE_ENV`

Dev guards (`useReactive`'s missing-`rendered()` warning, `overrideProxy`'s escaped-read
warning, and the compat package's strict-ambient + trace report sites) gate on a module-scope
`IS_DEV`:

```ts
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
```

The **literal, non-optional** `process.env.NODE_ENV` is load-bearing. Bundlers (webpack/Next
`DefinePlugin`, esbuild, vite) statically replace exactly that member expression; optional chaining
(`process?.env?.NODE_ENV`) is **not** matched, and when it isn't, webpack injects a `process`
browser shim instead — which evaluated to `undefined?.env?.NODE_ENV !== "production"` → `true`, so
the guards ran in production bundles (a stack capture per mounted component, plus warnings with
minified names in consumers' consoles). Verified by grepping the built chunk: with the literal form
the warning string and the stack capture are gone from `apps/dev/.next/static/chunks/`.

No `try`/`catch` is needed — the `typeof` guard covers unbundled browser ESM (where `process` is an
undeclared identifier) without blocking the fold.

**One deliberate exception**, and only one: the compat package's duplicate-install detection
(`ensurePatched`, see Phase 5) reports in **every** build, not just dev. It is a single property
read at module load; the failure it names — two copies of the engine or of the compat package —
is silent staleness in production exactly as much as in development; and a duplicate normally
appears in the *production* dependency graph first, which a dev-only guard cannot catch by
construction. Anything else dev-only stays behind `IS_DEV`.

## React version support

**React 19 only.** Every package's peer range is `react: ^19` (decided 2026-09-30: every client
that uses these is on 19), and the repo develops on `~19.2.0` everywhere
(`ensureConsistentVersions` — one line, so a symlinked workspace package never resolves a second
React copy under Node, which the corpus tools' parity run needs). React-19-only APIs and
behaviour are fair game — `<X value>` providers, `use`, the `inert` attribute. Context providers
happen to be written `<X.Provider value>`; nothing depends on that.

## Linting

`rush lint` runs ESLint over `packages/` + `apps/` and is wired into CI (before
`rush rebuild`). Deliberately narrow — the point is **`react-hooks/rules-of-hooks` as an
error**; `exhaustive-deps` is a warning.

- eslint + plugins live in a Rush **autoinstaller** (`common/autoinstallers/lint`), not in
  every package's devDeps — `ensureConsistentVersions` is on, so 14 duplicated entries would
  be friction for zero benefit. Change versions there, then `rush update-autoinstaller --name lint`.
- The flat config is `eslint.config.mjs` at the repo root. It resolves the plugins through
  `createRequire` against the autoinstaller's `package.json`, because bare specifiers won't
  resolve from the root — and the config has to *stay* at the root, since flat-config
  `files`/`ignores` globs are relative to the config file's own directory.
- `reportUnusedDisableDirectives` is off: the repo carries `eslint-disable` comments aimed at
  a fuller rule set (`no-console`) that this config doesn't enable.
- This gate is only meaningful because renderers are now ordinary function components. Under
  the old `controls()` HOC every hook sat inside a callback argument, so the rule reported
  "cannot be called inside a callback" everywhere instead of finding real bugs. Turning it on
  immediately found three genuine conditional-hook violations (`Field.tsx` `useMemo`,
  `DataGrid.tsx` `useEffect`, and a false positive from `useLabelText` — a non-hook whose
  `use` prefix misled the rule, now `resolveLabelText`).

## Testing

- **Framework**: Vitest + fast-check (property-based testing)
- **Location**: `test/` dir in each package
- **Config**: `vitest.config.ts` per package
- **`rush test` skips projects with no `test` script** (`ignoreMissingScript: true` on
  the bulk command). A project without tests — currently `forms-schema`, the legacy
  apps and `tools/forms-corpus` — therefore declares **no** `test` script at all; add one
  when the first test lands. A
  `vitest run` in a package with zero test files exits 1, and `--passWithNoTests` still
  writes a banner to stderr that Rush escalates into a failing run.
- **Anything on stderr fails `rush test`.** Rush reports stderr output as a build
  warning and turns "succeeded with warnings" into a non-zero exit, so a test that
  deliberately provokes a `console.warn`/`console.error` breaks the command even
  though it passes. Spy on the console in the test that expects the message and assert on
  it, rather than blanket-stubbing — the Forms v2 suites go further and fail on any
  console output at all.
- Current counts:
  - `controls-core`: **98** (+4 `deepEquals` compares Maps by key and deep value and Sets by membership, as v4 did — without it a computed returning a fresh Map changed on every recompute and re-rendered forever; +4 `createDerivedGroup`/`detachFields`: a group whose value is
    *derived* — composed from its children and never written back down. Needed because an
    aggregate assembled over an arbitrary set of controls (a tab's fields, a wizard page's)
    routinely holds both a control and a descendant of it — a collection registers its array,
    its rows register fields inside it — and an ordinary group then holds that datum under two
    keys and writes the stale copy back down, silently reverting the write. `@react-typed-forms/core@4.6`
    behaves identically, so it is long-standing rather than an rxc regression. The tests assert
    both halves side by side, plus that a derived group never writes down, still aggregates
    validity and cascades `setTouched`, and that `detachFields` removes a member — which has to
    clear the `ChildInvalid` cache first, since `isValid()` short-circuits on it; +3 escaped-read hooks compose: every added hook runs in installation order, a disposer removes only its own, and `setEscapedReadHook` replaces only the slot it owns — the slot used to be singular, so the second installer silently disabled the first, and the two known installers are `@rx-controls/react`'s captured-`rc` warning and the compat strict-mode diagnostics, i.e. exactly the pair loaded at once while debugging a staleness bug; +2 `keepErrors`: an externally-published error survives value/field writes and stays explicitly clearable, and a `validator` still implies the flag; uniqueId determinism; +2 ReadContext tracking window: `untrackedRead` never accepts tracked reads, a tracking scope registers reads until `finalize()` and reopens on `reset()` — pins the *value*, not just the name, of the flag the escaped-read guard reads; +6 write batching: one notification per batch, partial writes published and rethrown when `cb` throws, listener throw during flush, nested `update` flushing inline vs a listener's handed-down `wc` joining the outer batch, `afterFlush` ordering; +9 `createControlGroup`/`attachFields`: value/initial composition, bidirectional sync, multi-parent sharing, validity aggregation, field swap/detach, no-op detection; +12 `setElementIncluded`: baseline restore on toggle-away-and-back incl. ancestor cleanliness, non-baseline orderings left alone, no-op toggles, null/undefined baseline round-trip vs an empty-array baseline, string + numeric members, `markClean` moving the baseline, element-control sync)
  - `controls`: **113** (+1 `FormEditProvider` hands out one context value per flag pair — it built a new object every render, so every `useFormEdit()` consumer below re-rendered whenever the provider's parent did, straight through `memo` (found by the Forms v2 render-count suite, where it defeated the field bailout inside every group); +2 an observer that has rendered but not yet committed is never told to re-render by anyone but itself: a layout-effect cleanup writing a control in React's deletion pass (an unmounting subtree clearing its published errors while its replacement has rendered but is not yet placed — what swapping a form's whole renderer set does) and a write after a render that never committed (a suspend) both used to call the fiber's state setter at once, which React reports as "Can't perform a React state update on a component that hasn't mounted yet"; both now wait for the tracker's own commit effect and the value still lands before paint — the assertions on the rendered value passed before the fix, only the warning did not; +1 `setWrongRcSeverity("throw")` turns the captured-`rc` warning into a throw so the stack reaches the offending read — `@react-typed-forms/core`'s `setStrictAmbient` forwards to it, keeping one switch over both halves of the same failure; +4 `useValidator` publishes at commit rather than during render: a render that never commits publishes nothing and leaves no orphan — it used to leave the error on a shared control with no cleanup to clear it and a live tracker to re-publish it on the next change, i.e. a field stuck invalid with nothing on screen responsible; re-pointing on a changed `key` and on a changed `control` both clear the old one (three of these four fail against the previous implementation, which documented `control`/`key` as fixed at mount); plus a pin that the error is settled by the time a sibling which rendered *before* the validator is on screen, which is what the commit effect rather than a passive one buys; +4 `useComputed` lifecycle: a render that never commits leaves nothing tracking (it used to leave a live subscription on every dependency, recomputing forever with no component to show the result to — the only one of the four that fails against the previous implementation), cleanup on unmount is deterministic rather than waiting on the sweep, a descendant's mount-time write to a dependency is still reflected now that tracking starts at commit, and a dependency that moves *without* moving the result costs no re-render — the filter is the only reason the hook allocates a control instead of calling `compute(rc)` inline; +4 `useControlEffect` without an intermediate control: change detection goes through the tree's `ControlContext.equals` (pinned with a case-insensitive custom equality) rather than riding on `setValue` deciding a write mattered; an inline `compute` re-runs per render so it sees moved props (behaviour consumers rely on that nothing covered before) while a stable one re-runs only per dependency change — the `useCallback` opt-out; and that prop-driven re-run lands in the commit phase, not the render body, which is the one behaviour the rewrite changed; +5 changes absorbed before the subscription exists: nothing is subscribed until the hook's effect mounts, so a write landing between the creating render and that effect is caught by comparing the effect's first run against a render-time baseline — covered for a descendant's mount-time effect (React runs effects child-first, so this is the ordinary case, not a corner) and a layout effect, plus the catch-up firing once rather than on every StrictMode resubscribe, staying silent when nothing moved, and not doubling up with an `initial` call; +11 render-body writes: the value is visible to the rest of the writer's body and to descendants yet to render; a guarded write converges in two invocations (React's render-phase update) while an already-committed observer catches up in the commit phase with no cross-component warning and no act() noise; a descendant that renders after the write costs no extra pass (the `rendered(…)` dedupe); the microtask backstop; StrictMode; and a write outside render still notifying synchronously; plus convergence — an **unguarded** write settles in the same two passes as a guarded one because `setValueImpl` bails on `ControlContext.equals` first, which under the default `deepEquals` covers freshly-allocated object and array literals too, while a genuinely non-converging write (`updateValue(c, n => n+1)`) mounts clean and only trips "Too many re-renders" on the second render; `useReactive` boundary: subscribe/unsubscribe, facet tracking, post-`rendered()` finalize, missing-`rendered()` dev guard, StrictMode convergence, `useComputed`, `update` is the ambient context's write batcher + tracks a swapped provider, stable `update` identity; +15 render helpers: per-element scope isolation, structure-only list subscription, `notDefined`/`empty`/`container` slots, and the wrong-`rc` dev guard incl. its two silent cases; +8 `useControl`: identity stability, once-only lazy init, StrictMode single-creation, `ControlOptions` passthrough, and the `use` escape hatch in both directions; +9 `useControlEffect`: change-only firing per tree equality, no component re-render, `initial` fn/true/absent variants, StrictMode once-only initial, latest-callback freshness, unmount teardown, writes from onChange; +11 validators: `useValidator` immediate publish/keyed errors/cross-field rc reads/re-publish on `validate()`/unmount clear/StrictMode, `useAsyncValidator` debounce/burst-collapse/stale-drop/abort-on-supersede; +10 selectable/group/previous: `useSelectableArray` default + `selectableValues` syncers, deselect→array rewrite, shared value controls, reset re-sync, StrictMode; `useControlGroup` stable identity + field swap; `useValueWithPrevious`; +14 binding layer: `ControlInput` value/write-back/blur-touch/disabled/custom-validity/self-subscribing isolation, `FormEditState` disabled lock + restriction-only + readonly (incl. select/checkbox fold to disabled), `ControlSelect` + `ControlCheckbox` incl. `notValue`/radio)
  - `forms-react` (Forms v2): **129** — `useMultiSelectController` (1): adds and removes by string comparison, appending, keeping a value the options do not list, no write when already in; `clearTo` (3): `clearHidden` writes it and `defaultValue` refills only a value the boundary itself cleared, not the same value typed by the user; a select whose options moved away clears to it and a default refills; a collection clears to `[]`; display tones (1): `tone` and `announce` resolved and handed over, a derived tone following the data; form submission (3): an `<Action submit>` submits only once `check()` passes (refused, the fields touched) and is busy until the handler settles; the form element drawn only around a submitting form and only the outermost, a `<Form>` without `onSubmit` submitting through the enclosing one, the element's own submit event submitting; a submit action outside any submitting form falling back to `onClick`; options follow the value (4): a derived list moving away from the value clears it and `defaultValue` refills the new first choice (HVAMS's state → agency); a value the first resolved list does not name, or a host writes outside it, is kept — only a move clears, so host effects and `clearHidden` reshaping a list during mount never cost data (legacy parity holds exactly); `restrictToOptions={false}` keeps it; string comparison (`1` vs `"1"`), locked and hidden fields left alone; heading levels (1): each titled group one level below its enclosing titled group, an untitled one no level, capped at 6, `<Form headingLevel>` setting the base; a widget's implied rule (1): `TextField`'s `maxLength` registered beside the author's bare validator, re-running when the limit moves; bare validators (2): a server error under `default` still shows and still counts on a field with a bare `validate` (HVAMS's repro; it fails against the old `default` key), and two boundaries' bare validators on one control publish and clear only their own; hidden items (6): a hidden tab off the strip, its panel the same node and its fields `hidden` (not validating, cleared under `clearHidden`), a hidden active tab handing over to the first shown one in the same render and staying handed over; a hidden wizard page skipped by Next and Back, the current page hiding moving on to the next shown page (the bound index written) or else the previous; transitions (4): on by default through the `visibility` slot, `transitions={false}` on a group making fields / displays / collections below skip it and leave at once, the group's own `transitions` render prop following its parent's scope while nesting turns them back on, and off for a whole `<Form>`; render counts (4): a value change re-renders only the fields bound to it, inside containers too, one row only, and an author re-render with unchanged props bails at every leaf boundary (field / display / action / collection are `memo`; containers re-render and their boundaries bail); `FormProp` resolution (3): a derived contract prop and a widget's own prop re-render only what shows them, and one resolved through a captured `rc` is reported by the escaped-read guard and goes stale; StrictMode (7): required published once, the `clearHidden` / `defaultValue` cycle, touch-on-leave not at mount, dialog touch only on close, async pending back to zero through Next, the global lock released, collection writes and staged edit applied once. containers, controllers and built-ins (20): every tab panel mounted and each widget the same node across switches, an inactive tab silent (not cleared) and validating; markers report `showingErrors` — nothing marked on an untouched form, leaving a tab touches it (marked, errors shown on return, up through the strip and the form), a touched field marks the current tab, no touch on leave while read-only; the tabs scope in the tree, design mode stacking; the wizard refusing Next and touching the page, waiting for async validators, a bound page index, an unreached page validating but marked only once left, a bound index moved by the data touching the page it left; a closed dialog mounted, validating and never cleared, its content touched when it closes however it closes, inline in design mode; `DisplayOnlyField` write-free, `Section` a tree scope; `useTextInput`, `useSelectController`'s numeric round-trip, `useDisplayValue`'s options / format / empty / design-mode sample. The boundaries (29): resolved and pass-through props, own-error display incl. unclaimed errors on every field of the value, hidden unmounts the widget while `silent` keeps the same node, `clearHidden` / `defaultValue` / `dontClearHidden` / `writes: false`, locks republished as `FormEditState` without remounting, design chrome, validation with an implementation that renders nothing; groups hiding without unmounting, `{ scope: true }` showing-errors marker + tree, layout, inline; displays; actions (busy, global lock, design-mode stub, overrides); collections (uniqueId keying, length bounds, locked can*, one row re-rendering alone, staged edit apply and end-on-lock, clearHidden on the array). Foundations (40): props helpers; presence narrowing and the restriction-only locks incl. the `FormEditState` fold; the validation engine (data + verdict publishing, per-boundary `required` keys, dependency re-runs, async pending / supersede, `check()`), a scope judging only its own rules incl. unclaimed (server) errors counting everywhere and only while validating, the tree (`children` / `child` / `find`, unmount detach, StrictMode single attach, `useValidation` inside and throwing outside), and the default-value cycle
  - `forms-json` (Forms v2): **41** — a test per translator (legacy's CheckList over a collection, ticking the option's own numeric value into the array; Tabs keyed by position, so two with one title do not collide, and a tab whose child is not `Visible` off the strip, through `childProps`; TextField, Select incl. numeric round-trip and AllowedOptions, Radio's per-option children with `$formData`, Checkbox, DisplayOnly, a compound as a group incl. `../x` and its clear/default cycle, a collection incl. `$i` / `$$` in a row's jsonata, noAdd/noRemove and Length bounds, Standard / Inline / Flex / Tabs groups, Text / Html / Icon / Custom displays, Action with static and dynamic payloads, the Dialog group's own ids), then expressions (sync kinds, pending jsonata never clearing, Disabled / Label / DefaultValue, a compile failure reported), validators, `LayoutStyle` (a toggle is `silent`, anything else reported), meta fields on a side control, adornments incl. host props/wrap and a declining host, host translators first, the audit (fallback render type, unread property, missing schema field, a built prop never passed on), `strict`; and the fixture form's exact gap list plus a clean render
  - `forms-html` (Forms v2): **44** — display tones (1): the theme's tone class and `data-tone` on the display's wrapper; form submission (2): a stray `<button>` with no `type` inside the `<form>` does not submit while a submitter-less submit event does, and Enter in an inline dialog's field is kept from pressing the form's default button; `transitions={false}` (2): a region hiding at once under the Tailwind theme (attribute + `display: none`, which wins over the wrapper's own `display` with no preflight) with no collapse classes or inner element, and `FadeVisibility` skipped, no wrapper; `Contents`' element tree per `hideWith` (2): `"collapse"` the only mode with an inner element, otherwise the title and body straight under the wrapper as legacy's layout had them (a `layoutClass` gap spaces them); the ServiceTas theme fixture (5): every renderer mounting under base + overlay + a `formStyles` overlay with a clean console, Bootstrap's `form-control` and the definition's class on the input, the variants' classes and its own error message, a per-form overlay winning, every overlay resolving; a repeated option value keyed without collision in select and radio; SSR (2): a kitchen-sink form of every renderer server-rendered in the `node` environment (no DOM; silent content present in the markup), then hydrated under StrictMode with no mismatch, the server's nodes kept and the form live after; the theme provider (default, nesting, replace-not-append, one resolution per theme object, node / function slots replaced whole), the hook rule (every default hook present in the same Tailwind slot; only `rxf-` tokens in the default's class slots), no Tailwind slot that is `w-full` with padding or a border without `box-border` (the theme assumes no preflight, and the input frame overflowed its container), and the renderers: TextField label / required / help-and-error `aria-describedby` / `aria-invalid`, typing, `inputMode` / `autoComplete` / placeholder, `classNameOn`, class merge and `{ replace }`, multiline; Select's numeric round-trip; Radio's legend and per-option content; Checkbox's trailing label; DisplayOnly block and inline; hiding with no CSS (the `hidden` attribute on regions, tab panels and wizard pages, a closed dialog's content mounted inside it, and its Close an `<Action>` restyled by id) and `hideWith: "class"` leaving it to the theme's class; Action variant classes, busy spinner, `replace`; a `layout` body's inline flex; TextDisplay's p / span; FadeVisibility's `data-leaving` hold and theme slot
  - `rxc-dev-app`: **5** — the Forms v2 compat fixture (`/v2/compat`, the HVAMS gate): one engine copy, v2 writes reaching legacy ambient readers, legacy `Finput` / mutator / array op reaching v2, v2 array writes reaching legacy, v2 validation published where legacy code reads it — all under `setStrictAmbient("throw")` with any console error or warning failing
  - `forms-mui` (Forms v2): **33** — the conformance suite (28) + MUI (5): a toned display coloured from the palette;: the outlined notch cut from the label, the input surviving a focus-driven frame re-render, a closed dialog `keepMounted` and hidden, variants onto MUI's button variants
  - `forms-antd` (Forms v2): **33** — the conformance suite (28) + Ant (5): a toned display coloured from theme tokens, Typography inheriting it;: token chrome through `style` incl. a `border-box` frame, the checkbox's sibling label with the required marker, tabs and modal mounted before first open and after close, no deprecated props (Ant 6's own warning fails it)
  - `rxc-forms-conformance`: **56** — the suite under html, default and Tailwind themes (28 each): typing with the same input node throughout, `maxLength` capping the input and a longer value reported, required once touched, every widget (text, select, radio, checkbox, check list) named by exactly its label (the required marker `aria-hidden`) and described by its help and then its error through the accessibility tree — the ids the shell renders (`fieldLabelId` / `fieldErrorId` / `fieldHelpId`) — with `aria-required` and, in error, `aria-invalid` wherever ARIA allows them (not on a check list's `role="group"`), and a set of choices exactly one group (a legend shell adds no `fieldset`); a check list and a radio not touched while focus moves between their options, touched once it leaves, a disabled form locking, checkbox, a check list ticking values into an array and refusing an empty one when required, radio with per-option content, select, hidden unmounting, group titles as headings one level deeper per titled group, a field and a region leaving at once with transitions off, each boundary one element under a body with its `shellClassName` on it (what a class layout places), tabs mounted and validating with the same node across a switch, a hidden tab off the strip with its panel kept mounted and no longer validating, a hidden wizard page skipped by Next and Back, a closed dialog mounted and validating and a programmatic close not reported as a dismissal, the wizard refusing and advancing, an async action locking while busy, `<Form onSubmit>` submitting through its `type="submit"` action inside a real `<form>` only once `check()` passes and through the element's own submit event, a collection's rows, displays, an `announce`d display as `role="alert"` (error) or `"status"` and a toned one without it not a live region, a third-party field and collection, and the JSON fixture form
  - `rxc-forms-storybook`: **152** — the story smoke test: every story (38) composed through the real preview decorator and rendered under html (both themes), MUI and Ant, and StrictMode, failing on any `console.error` / `console.warn`
  - **Total: 856** across the 11 projects that have tests (`compat-controls` included). Re-check with `rush test`, or
    per package with `rushx test`; update these numbers in the same commit as the tests.
    **CI runs `rush test`**, after `rush rebuild` — the suites resolve workspace packages
    through their `exports`, which point at `lib/`, so they need a built tree. (Until
    recently CI ran neither: its rebuild step passed a `--production` flag Rush 5.162.0
    does not accept, so it exited before building anything, and there was no test step at
    all.) The formerly-flaky `controls-core` `general > can set computation` property is
    fixed — it predicted a notification from whether its two generated arrays differed,
    when the subscribed control holds their *sum*.
  - `compat-controls`: **152** (+5 duplicate-install detection — the cardinal hazard of the compat design, and until now silent: the second copy found the prototype already patched, returned, and kept its own module-global `collectChange`, so reads reported by one copy never reached a tracker installed by the other. Strict ambient mode is blind to it by construction (from each copy's point of view the read was collected normally), which is why the check reports on its own and runs however the process is built. Covered: a clean install reports nothing, the owning instance re-patching is silent and idempotent, a foreign owner token is reported with the fix named, strict mode escalates it to a throw, and the prototype stays patched and usable afterwards (a diagnostic, not a bail-out); +19 strict ambient diagnostics — see "Strict ambient mode" below: off is byte-for-byte today's behaviour (silent, correct value) for the getters, `trackControlChange`, `trackedValue` and a dead tracker; throw/warn name the control and facet for all three shapes (no collector, a bridge onto a finalized `rc`, a collector owned by a cleaned-up `SubscriptionTracker`); `collectChanges`/`withAmbient`/an explicit `trackedValue` tracker stay silent; `control.current.*` is silent in every mode; warn dedupes per (call site, control) rather than per site, so a second stale control at the same site still gets named; +2 v4 parity for `useValueChangeEffect`: a pending debounced call fires after unmount (v4 debounced with `useDebounced`, which registers no cleanup — cancelling on unmount silently dropped a real app's validation POST), and a descendant's mount-time write is delivered rather than absorbed unobserved (see the `controls` entry); +14 chain convergence — asserting the **final state**, never when a subscriber ran, since no code should depend on notification timing: a chain of `useControlEffect`s feeding each other converges however the write is made (element count growing or shrinking, StrictMode, DOM handler, async continuation, inside `groupedChanges`, from inside another control's subscription listener), and separately `.elements` registers a `Structure` dependency only, so a **same-length** array replacement converges nowhere — it never re-runs, which is v4 parity (`ArrayLogic.updateFromValue` applied `Structure` only on a length change) and the one shape where "the effect was late" is really "the effect never ran"; +1 `RenderArrayElements` gives each element its own tracked scope — the callback ran inline in the helper's own render with no tracking window, so ambient reads inside it subscribed nothing and the element never re-rendered (legacy `HtmlCheckButtons` derives a radio's `checked` exactly this way); the test mirrors that shape and fails without the per-element `RenderControl`; +3 recursive `ControlSetup`: a self-referential setup (`fields: { children: { elems: () => self } }` — legacy's `DelayedSetup` idiom for tree shapes) converts without blowing the stack, still applies at every level, and descends only on demand; nested setups convert lazily because the engine reads a child's setup only when that child is created; +1 `useDebounced` keeps legacy's loose `(...args: any[]) => void` return — tightening it to `Parameters<T>` broke a real app on a version bump, since the debounced handler is normally passed to `useControlEffect`, whose `V` comes from `compute`; +2 `cleanup()` recurses into fields and elements, skipping controls shared with another parent — it only ran the root's own callbacks, so every array element `@astroapps/forms-core` detached leaked the effects registered on its descendants; +1 `getCurrentFields` aliases the live `_fields` record — it captured a detached snapshot when no field existed yet, which silently broke every nested scripted override in `@astroapps/forms-core`'s `createOverrideProxy`; +1 legacy `useFormEdit` reports the `readonly` key — rxc renamed it `readOnly`, so compat now owns the legacy spelling in a wrapper rather than re-exporting rxc's trio; +2 legacy `ControlChange` surface: every v4 member at its v4 value incl. `All = 127`, plus the numeric-enum reverse mapping — compat re-exports core's enum by object identity, so a core member rename silently changes this package's published API with nothing in-repo to catch it; plus a **type-only** pin outside the 109, `test/assignability.test-d.ts` — see the "Compat ↔ core `Control` assignability" note below; Phase A bridges: prototype-patch getters/setters + per-facet ambient collection, collector nesting, `groupedChanges` single-flush/reentrancy/throw-safety, array ops, group/object/meta/computed functions, interop both directions incl. `withAmbient` facet mapping; +22 Phase B React: `useComponentTracking` facet-selective re-render, `useTrackedComponent`, useControl/useComputed/effects/validators/group/previous adapters, `useValueChangeEffect` debounce, F-components under the compat provider, `useFormControlProps` FormEdit fold, render helpers with legacy callback signatures incl. `NotDefinedContext` + `renderOptionally` composition; +17 Phase C: `SubscriptionTracker` mask merge/reconcile/drop, `Effect` eager+conditional re-tracking+per-transaction coalescing+same-storm writes, `AsyncEffect` abort-and-supersede, scoped effects, `trackedValue` deep proxy per-step facet reporting + restore/unwrap round-trip + Effect/tracker integration)

## Reference

### Format-usage survey — adornments, expressions, dynamic properties (reference)

Second pass over the same corpus, widened to every part of the format and to the two
astrolabe demo apps. Read it as a description of **what the legacy corpus uses**, which is
input to the Forms v2 design: **80 forms** (68 ServiceTas + 8 `astrolabe-common/forms-app` + 4
`Astrolabe.TestTemplate/.../formServer/src/forms`). Counts are `uses / forms`.

**Adornments** (6 in `ControlAdornmentType`):

| type | uses / forms | rxc |
|---|---|---|
| `HelpText` | 69 / 17 | ✅ |
| `Accordion` | 19 / 7 | ✅ |
| `Tooltip` | 4 / 2 | ❌ **used, not implemented** (only real form: `MastRegistrationsSummary`; the other is the `AllControls` demo) |
| `Icon` | 2 / 1 | ✅ |
| `SetField` | **0** | ✅ implemented, unused |
| `Optional` | **0** | ✅ implemented, unused |

Plus two that are host extensions rather than enum members: `ColumnOptions` 26 / 7
(datagrid, ✅) and `Spotlight` 2 / 1 (host-provided).

**Expressions** (7 in `ExpressionType`):

| type | uses / forms | rxc |
|---|---|---|
| `Jsonata` | 373 / 40 (+45 / 9 as a validator) | ✅ |
| `DataMatch` — serialized `"FieldValue"` | 270 / 34 | ✅ |
| `NotEmpty` | 122 / 23 | ✅ |
| `Data` | 72 / 30 | ✅ |
| `UserMatch` | 2 / 1 | ❌ **used, not implemented** (`forms-app/AdminItemDashboard`) |
| `UUID` | **0** | ✅ implemented, unused |
| `Not` | **0** | ✅ implemented (via `createEvalExpr` unwrapping), unused |

**Dynamic properties** (11 in `DynamicPropertyType`, all handled by `buildLegacyScripts`):
`Visible` 599 / 43 · `Display` 67 / 23 · `ActionData` 61 / 24 · `Disabled` 46 / 9 ·
`AllowedOptions` 42 / 14 · `LayoutStyle` 15 / 6 · `Label` 14 / 10 · `GridColumns` 2 / 2.
**Unused: `DefaultValue`, `Readonly`, `Style`.**

**Validators** (3 in `ValidatorType`, all implemented, none unused): `Jsonata` 45 / 9 ·
`Date` 11 / 6 · `Length` 3 / 3.

Two conclusions worth keeping:

1. **The format is almost fully exercised.** Exactly seven members across the four enums go
   unused (`SetField`, `Optional`, `UUID`, `Not`, `DefaultValue`, `Readonly`, `Style`) — and
   all seven are already implemented, so dropping them saves nothing. There is no meaningful
   surface reduction available from usage data; a v2 loader that aims at the legacy corpus has
   to carry essentially the whole format.
2. **Jsonata is load-bearing, not a corner.** 418 uses across 40 of 80 forms — more than half
   of all expression uses, and `Visible` alone accounts for 599 dynamic properties in 43
   forms. Any plan that treats the expression engine as optional for the JSON path is wrong.

`Tooltip` and `UserMatch` are used in real forms and neither exists in the rxc renderer set.
**Not bugs** — the forms packages are a POC (see "Open for redesign"), and an absence in them
is data about what a real implementation must cover, not work to schedule. Recorded here so
the v2 loader's scope is decided from usage rather than from what the POC happens to have.

Re-run: `scripts/` has no runner for this — the scan was ad-hoc (walk every `ControlDefinition`
counting `adornments[].type`, `dynamic[].type` / `.expr.type`, `validators[].type`,
`renderOptions.type`). Cheap to redo if the corpus moves.

### Legacy compat (`@react-typed-forms/core` v5)

- Legacy core compat (`packages/compat-controls`, **published as `@react-typed-forms/core@5.0.0`**) — Design: `docs/COMPAT-CONTROLS-DESIGN.md`. **Complete — Phases A+B+C shipped** (79 tests + the dev-app `/compat` acceptance page, whose imports are byte-identical to the legacy page's). Phase A (engine bridge): `ControlImpl.prototype` patch via the internal subpath (zero overrides — core freed the legacy names: `elements` → `elementsNow`, internal `validate` → `validateImpl`); Bridge 1 ambient read collector (`collectChange`/`collectChanges` + `withAmbient(rc, fn)` mapping ambient reads onto rc facets); Bridge 2 ambient `WriteContextImpl` transactions (`groupedChanges` reentrancy); Bridge 3 swappable singleton context. Phase B (React): `useComponentTracking`/`useTrackedComponent` restore the SWC-plugin contract (per-component `Map` + `SubscriptionReconciler`, reconcile synchronous with render); legacy hooks are thin adapters over `@rx-controls/react` via `withAmbient`; F-components/render helpers re-typed or signature-adapted; **no no-provider fallback** — legacy apps mount `<ControlContextProvider value={getCompatContext()}>` once at the root. Phase C: `trackedValue` deep proxy + `SubscriptionTracker`/`Effect`/`AsyncEffect` ported near-verbatim over the public control surface + ambient bridges; `runInWc` keeps the ambient wc open through its own flush so listener-initiated writes/after-changes callbacks join the flushing transaction (legacy single-storm semantics — what coalesces an Effect to one run per batch).
- **Strict ambient mode (`setStrictAmbient`).** A legacy ambient read with no
  collector installed returns a correct current value and registers nothing,
  so the consumer goes stale forever with no warning — the "One trap" in
  `packages/compat-controls/README.md`. `setStrictAmbient(true | "warn" |
  "throw")` (default **`"off"` — no released behaviour changes**) makes it
  loud, with `RTF_STRICT_AMBIENT` (env) and `globalThis.RTF_STRICT_AMBIENT`
  as code-free escape hatches. Three shapes are reported, all of which look
  healthy today:
  1. **No collector at all** — the message says whether one has *ever* been
     installed, which separates "the SWC plugin isn't wired up" from "this
     read escaped its window".
  2. **Bridged onto a finalized `ReadContext`** — `ambientToRc` checks
     `rc.isTracking` before re-reading. A collector *is* installed, so shape 1
     stays silent; the rc it forwards to drops the read.
  3. **Collected by a disposed `SubscriptionTracker`** — `cleanup()` now sets
     a dev-only `dead` flag, because `collectUsage` will happily subscribe on
     behalf of a released tracker and the subscription notifies a listener
     attached to nothing. This is the only shape where the read looks fully
     tracked.

  **Cost when off is one module-scope boolean load** on an already-cold
  branch, inside the same `IS_DEV &&` guard the existing dev diagnostics use —
  so it folds out under Next/webpack exactly as they do, and is dead-but-inert
  under a minifier that only inlines literal constants (esbuild keeps the
  branch for `useReactive`'s guards too; checked side by side). No stack
  capture, no path walk, no allocation unless it fires. `strictAmbient` is
  exported as a live binding precisely so the report sites can guard without a
  function call or a string compare.

  Deliberately **opt-in, not a firehose**: most no-collector reads (event
  handlers, refs, effects, validators) are correct, which is core's stated
  reason for only *reporting* escaped reads rather than judging them
  (`EscapedReadHook` in `packages/core/src/readContextImpl.ts`).
  `control.current.*` is the documented opt-out and is silent in every mode.

  **`@rx-controls/react` already installs an escaped-read hook** at module
  scope (`useReactive.tsx`) for its captured-`rc` warning, so compat must not
  call `setEscapedReadHook` — that is a single slot and a second call would
  silently disable the very diagnostic it extends. Core therefore gained
  `addEscapedReadHook(hook): () => void` (a list; `setEscapedReadHook` kept and
  reimplemented over it, so an older `@rx-controls/react` resolved against a
  newer core still works). React gained `setWrongRcSeverity`, which
  `setStrictAmbient` forwards to. Compat adds one narrow hook of its own: a
  finalized-rc read while a *legacy* ambient window is open — the shape
  React's `openRc` rule cannot see, since `openRc` is null while a legacy
  tracked component renders.

- **Ambient trace (`setAmbientTrace`).** Strict mode answers *"was this read
  collected at all?"*. It cannot answer *"which collector got it"* — and a read
  collected by the **wrong** owner looks perfectly healthy: a collector is
  installed, its rc is live, a subscription is created, just not on the
  computation that needed it. Every strict-mode guard stays silent.

  `setAmbientTrace(fn)` fires on each ambient report with the installed
  collector's tag. Collectors are tagged where they are built — `rc` (the
  `withAmbient` bridge), `tracker` (`SubscriptionTracker.collectUsage`),
  `component` (`useComponentTracking`) — and one installed from outside the
  package is tagged `anon` on first sight together with the frame that
  installed it, so a third-party `collectChanges`/`setChangeCollector` caller
  stays identifiable instead of collapsing into an anonymous bucket.
  `updateComputedValue` additionally brackets each compute with
  `enterCompute`/`exitCompute`, recording the collector installed on entry: a
  read arriving with `computeDepth > 0` under a non-`rc` collector means the
  swap `withAmbient` performs did not hold for the compute's duration, which
  separates "the compute never ran" from "the compute ran while something else
  was collecting".

  Same cost model as strict mode — dev-only, off by default, one module-scope
  boolean (`ambientTracing`) at the report sites.

  **Not on the main entry point**, deliberately: it is a debugging aid for
  this library rather than part of the v4 surface, and the tag vocabulary /
  `anon` fallback / compute bracketing are not worth a semver commitment yet.
  It ships on a new `@react-typed-forms/core/internal` subpath, the same
  convention `@rx-controls/core/internal` uses; promote it to `.` if it earns
  that. Pinned by `test/ambientTrace.test.ts` (19 tests) so the tags are safe
  to read in a debugging session regardless.

  Writing those tests found two bugs in it, both of which made the `anon`
  tag name the wrong code:
  1. **The install frame was never captured.** `tagCollector(cb, "anon")` is
     only reached lazily from `describeCollector`, i.e. at *report* time, but
     it picked its frame by a hardcoded `slice(3, 4)` offset tuned for a
     direct call from the install site — so it named `traceAmbient` in
     `ambient.ts` every time, and the documented "the frame that installed
     it" never happened. Foreign collectors are now tagged eagerly in
     `setChangeCollector`/`collectChanges`, which is the only place that frame
     is on the stack. Own collectors are tagged at construction, so they never
     pay a stack capture, and a foreign one pays once (the tag sticks to the
     function object).
  2. **`OWN_FRAMES` was a bare substring match** on the whole stack line, so
     any consumer path containing `ambient`/`patch`/`trackedValue` was skipped
     as though it were ours — naming a frame further up the stack than the one
     that did the read. Now anchored on the file name. This also sharpened
     strict mode's `callSite()`, which shares the helper and uses it for
     warning dedup keys.

  `trackControlChange` — the manual "report a dependency" entry point — was
  also not traced at all, while the patched getters and `trackedValue` were. A
  trace that covers only some report sites is worse than none: the missing
  site reads as "that read never happened".

- **Duplicate-install detection (`getCompatPatchInfo`).** Two copies of the
  compat package, or two copies of `@rx-controls/core`, is the cardinal hazard
  of this design — and it used to fail in total silence. The pre-existing
  `PATCHED` symbol guard made `ensurePatched()` *return quietly* on a second
  copy, which is the bug: each copy keeps its own module-global
  `collectChange`, so a read reported by the copy that owns the prototype never
  reaches a tracker installed by the other. Reads look collected,
  subscriptions get created, components silently never re-render. **Strict
  ambient mode cannot see it** — from each copy's point of view the read was
  collected normally — which is what made the astrolabe-common editor-preview
  bug take so long to find.

  Now the prototype marker holds the *module token* that patched it rather
  than `true`, and a `globalThis` registry records every loaded copy plus
  every distinct `ControlImpl.prototype`. Two shapes are reported: a foreign
  owner token (two package copies, one engine) and more than one prototype
  (two engines). `getCompatPatchInfo()` exposes the same data for a smoke
  test.

  **Reported however the process is built, not behind `IS_DEV`** — the one
  deliberate exception to that convention. It is a single property read at
  module load, the failure is silent staleness in production exactly as much
  as in dev, and a duplicate usually shows up in the *production* dependency
  graph first, which a dev-only guard cannot catch. Strict mode escalates the
  log to a throw. The report is a diagnostic, not a bail-out: the prototype
  stays patched and the app limps rather than dying.

- **Compat ↔ core `Control` assignability.** A compat `Control<V>` is assignable to a core `Control<V>` **with no cast** — that is what lets a legacy app on `@react-typed-forms/core@5` hand its controls straight to `@rx-controls/react` hooks, `rc.getValue`/`wc.setValue`, and the Forms v2 bindings while it converts components one at a time. The relation is **fragile in a non-local way**: `fields`/`elementsNow`/`existingFields` recurse back into `Control`, so one member that stops matching core's declaration breaks the whole type, and the error TS reports points at the recursion rather than the culprit. The member that bit was `subscribe` — its listener parameter must keep core's **three-argument arity** (`SubscribeListener`, not the two-argument `ChangeListenerFunc` that compat's own collector machinery uses); a two-argument parameter is incompatible in both directions. Legacy call sites are unaffected, since a two-argument callback is assignable to a three-parameter signature. Pinned by `packages/compat-controls/test/assignability.test-d.ts`, a **type-only** file with no runtime half: `rushx build` runs a second `tsc -p tsconfig.typecheck.json` pass after the emit pass, and vitest's `test/**/*.test.{ts,tsx}` glob deliberately excludes it. (Vitest's own `typecheck` option would be the natural home but can't be used — its "experimental feature" banner goes to stderr, which `rush test` escalates into a failing run.) The reverse direction, core → compat, **cannot** hold structurally (core declares none of the legacy members) but is runtime-sound, since the prototype patch applies to `ControlImpl` itself and the legacy mutators funnel through a context-free `WriteContextImpl`; `asLegacy(c)` is the cast for it. Its caveat is reactivity, not correctness — reads through a cast control are collected **ambiently**, so reading one from an `@rx-controls/react` `useReactive()` body subscribes to nothing and the component silently never re-renders. Use `rc.getValue(…)` there instead, which accepts the control directly.
- **No schemas compat package.** A `@rx-controls/compat-forms` (wrapping `@rx-controls/forms` in the old `createFormRenderer()`/`FormRenderer` interface) was planned and deliberately dropped. Don't reintroduce it. That rejection is about the *wrapper*, and is not the same question as the one below.
- **Legacy schemas on the compat engine ✅.** The legacy `@react-typed-forms/schemas` stack runs on `@react-typed-forms/core@5` unchanged — the obstacle was only that the schema layer reached the engine under a second package name (`@astroapps/forms-core` → `@astroapps/controls`), which would have left two engines in the process. `@astroapps/controls` had exactly one consumer (`@react-typed-forms/core`, which re-exported it wholesale), so it is retired and `@astroapps/forms-core` points at the compat package instead: a pure import-specifier rewrite, no code changes. Nothing else needs rebuilding — `schemas`, `schemas-html`, `schemas-datagrid` and `schemas-editor` have zero runtime references to `@astroapps/controls` in their published builds (the one import in `schemas-html` is type-only and elided), so they stay on their published versions. That rebuild is now **published** — `@astroapps/forms-core@3`, `@react-typed-forms/schemas@19`, `schemas-html@6`, `@astroapps/schemas-datagrid@9` all peer on `@react-typed-forms/core@^5` — and the two legacy reference apps in this repo run on those releases with the workspace compat package (no overrides needed in a workspace: the peer resolves to the local build). For an external consumer trialling an unpublished build, the four-override recipe still applies: the three from `scripts/pack-compat.mjs` plus `@astroapps/forms-core`. Upstream branch: `astrolabe-common` `compat-core-v5`. Verified on the HVAMS/NaasWork production app — six Next sites building and statically exporting, one engine copy, `@astroapps/controls` absent from the install. Consumer-facing writeup, including the two provider-placement rules that are easy to get wrong, is in `packages/compat-controls/README.md`. This is an *alternative* to porting onto Forms v2, not a replacement for it.

### Smaller follow-ups

- **Lint rule: render-helper callback that never references its `rc` param.** The one wrong-`rc` hazard nothing catches: a value read in the caller's body and closed over (`RenderControl`/`RenderElements` wrapper isolates nothing, silently degrades to over-rendering). Shadowing, the `Rendered` brand, and the runtime guard are all blind to it; an unused-`rc`-parameter lint on the helper callbacks would flag it.
