# Forms v2 — the plan

How `poc/forms-v2` becomes the real libraries. What v2 *is* lives in
[`FORMS-V2-GOALS.md`](./FORMS-V2-GOALS.md) and [`FORMS-V2-INTERFACES.md`](./FORMS-V2-INTERFACES.md);
this document is only the order of work and what each step has to prove. It has **no dates**,
deliberately, and none should be added — phases end on exit criteria, not on a calendar.

## Where it starts

The build settled the contract: four implementations, every boundary kind written from outside
the package, a JSON loader with host hooks, and two instruments over the ServiceTas corpus —
`rushx burndown` (622 warnings) and `rushx parity` (144 of 144 runs identical to legacy). It also
has **no tests**. Its evidence is demo pages and those two scripts, which is right for a
throwaway and wrong for a library, so the conversion is a port-with-tests, not a move.

What carries over is the design, most of the framework's code, and three of the four
implementations — html, MUI and Ant. What does not: the Mantine implementation (its job was to bend
the contract, and it is done), the demo pages — Storybook replaces them — and anything shaped by
being a demo.

## Two adopters, two tracks

- **HVAMS (NAAS) is the first use in anger, and it exercises the JSX path.** It removed its
  schema-driven form runtime in September 2026 (`HVS-2779`, `d00095bc1`) and now writes forms as
  plain React on `@react-typed-forms/core@5`, the compat engine — 265 imports of it across the
  client, with `@astroapps/datagrid` alongside. So HVAMS will write **JSX forms, inside a compat
  app, probably in its own design system**. It tests goals 1–3 and 5, and one thing the POC never
  did: v2 mounted in an app whose other components are still on the compat surface.
- **ServiceTas exercises the JSON path, and must not be left behind.** Its ~70 forms are the
  corpus, parity and the burndown run on, and it has a worked `HtmlTheme` (README finding 72). It
  tests goal 6. It is not the first adopter, so it is protected by **gates**, not by being next in
  line: from the moment the loader is real, a change that breaks a ServiceTas form fails CI.

The tracks share everything below the loader, so they are phases of one plan, not two plans.

## Package layout

Amends *Proposed package layout* in the goals doc (updated to match).

| package | from | role |
|---|---|---|
| `@rx-controls/forms-schema` | `packages/forms-core/src/json/*` | Canonical `ControlDefinition` / `SchemaField` types, builders, `schemaSchemas`. No React. A **move**: the JSON must match the C# server's byte for byte. |
| `@rx-controls/forms-react` | `poc/forms-v2/src/framework/` | The contract: `FormProp`, scope and presence, the boundaries, validation scopes, collections, actions, tab / wizard / dialog controllers, staged edit, primitive prop types, the registry. No DOM, no class strings. |
| `@rx-controls/forms-json` | `poc/forms-v2/src/loader/` | The loader: translators, expressions + jsonata, the data cursor, host hooks, `<JsonForm>`, `strict`. The only package that reads a `ControlDefinition`. |
| `@rx-controls/forms-html` | `impls/html.tsx`, `shared.tsx`, `htmlTheme.tsx` | The HTML implementation and its `HtmlTheme`: `defaultHtmlTheme` (`rxf-` hook classes only) and `tailwindHtmlTheme`. No stylesheet. |
| `@rx-controls/forms-mui` | `impls/mui.tsx` | The MUI implementation, and the contract's regression gate. |
| `@rx-controls/forms-antd` | `impls/antd.tsx` | The Ant Design implementation. The second family-2 library, and the one whose chrome is runtime tokens rather than classes. |
| `apps/forms-storybook` | `poc/forms-v2/src/App.tsx`, `PersonForm.tsx`, `widgets/` | Private. A story per boundary kind under every implementation — the demos, and a CI smoke test. |
| `tools/forms-corpus` | `poc/forms-v2/scripts/` | Extract, burndown, parity. Private; run in CI. |

Three changes from the goals doc's layout:

- **No `forms-state`.** It was to be the React-free layer, but the build moved its contents: the
  cascade is React context, validators register from boundaries, and `FormNode` is the loader's.
  What is left React-free is ~250 lines (`prop.ts`, `collections.ts`, `externalEdit.ts`,
  `actionIds.ts`) with no non-React consumer — `forms-native` is React too. Folded into
  `forms-react`.
- **A loader package, `forms-json`.** The layout had none, and filed expressions under
  `forms-state`, which contradicts "hand-written forms avoid the expression engine outright".
  jsonata is a dependency of the loader and of nothing a JSX form imports.
- **An Ant implementation, `forms-antd`.** The goals doc had MUI as the only third-party library.
  Ant stays because it is not a second MUI: it is the only implementation that exercises `style` on
  the control slot (its chrome is `theme.useToken()`, computed per render, with no class to put
  it in), `labelPosition` (its checkbox takes the label as a child), and a `silent` container that
  must be told twice to keep its content (`forceRender` *and* `destroyOnHidden={false}`). MUI
  alone would leave all three untested.

**Reference documentation is generated, not written.** TypeDoc runs over the public packages —
`forms-schema`, `forms-react`, `forms-json`, `forms-html`, `forms-mui`, `forms-antd` — from their
doc comments, and is the API reference. The goals and interfaces docs stay what they are: the
design and its reasons. The POC's comments are already most of that reference, but they cite README
findings by number (`finding 57`), and the README is deleted in phase 6. A comment that is ported
has to stand on its own or point at a design doc.

`forms-native` and a datagrid add-on come later and slot in beside `forms-html`.

## Phases

### 0 — Settle what the POC left open ✅

Small, and each is a contract question that is cheaper before phase 1 than after. All four are
decided and built in the POC (README findings 73 and 74), and the interfaces doc carries each
one.

- **`LayoutStyle` — decided, no slot** (POC README finding 73). The 15 corpus uses are two
  shapes, and neither is a style. 13 toggle `{ display: "none" }` over payment sections that hold
  Quickstream iframes. That is `silent`: off screen, still validating, never cleared, which legacy
  got because it never knew the section was hidden. The loader recognises the toggle statically
  and makes the region `silent`. Parity stays at 0 differences, and translating to `hidden`
  instead produces 23. The other 2 colour a border while an accordion is expanded, and already
  branch on `$platform` to write CSS keys on web and RN keys on native. That is theme styling of
  group state, so the loader reports it with a warning.

  It changed one rule in the contract: **`silent` keeps its widgets, not just its boundaries.** The
  visibility slot receives `visible = presence !== "hidden"`, and the container that made content
  silent is what hides it. Before, an inactive tab, a closed dialog and an unchosen branch kept
  their effects and unmounted every widget inside them, so the iframe above would have
  reinitialised on every switch of payment method. The interfaces doc's presence and visibility
  sections have to say this.
- **`keyboardType` / `autoComplete` (14 / 13) — decided, contract props.** They are a
  ServiceTas extension of Textfield's render options, not the canonical format, and only its
  React Native renderer read them. But the hints are the same on both platforms: HTML and React
  Native's `TextInput` take the same `inputMode` and `autoComplete` values. So `TextField` gains
  `inputMode` and `autoComplete`, and the **host** translates, mapping `keyboardType` (React
  Native's vocabulary) onto `inputMode`. The loader never learns a host's render-option
  extensions.
- **Group kind on `GroupRenderProps` — decided, a `layout`, not a kind.** Legacy's Standard and
  Flex groups differ in one element, the body, which carries `standardClassName` or
  `flexClassName` with `styleClass` merged onto it. The POC nested a `Stack` inside a standard
  body instead. That put `styleClass` on the wrong element (21 corpus Flex groups carry one meant
  for the flex box), let the `formStyles` overlays reach Flex bodies, and overrode responsive
  direction classes. `GroupProps.layout` (the `Stack` props, resolved) makes the body itself the
  flex box, and the html theme gains `contents.flexBody` / `flexGap`. The markup now matches
  `legacy-compare`. Legacy's `Contents` kind has zero corpus uses and is not carried.
- **`pending` on `GroupRenderProps` — decided, deliberately absent.** Nothing asks for it, and
  adding an optional render prop later breaks no implementation.

*Exit:* met. Parity is unchanged, and the burndown drops by the 15 `LayoutStyle` and 27
input-hint warnings, less the 2 `LayoutStyle` uses that stay as warnings (a net fall of 40 on the
local corpus).

### 1 — Types only

Package skeletons with the public types and nothing else — from `framework/types.ts` and the
interfaces doc — reviewed before any implementation is written.

TypeDoc is wired up here, on the skeletons: the type surface is reviewed *as the generated
reference*, which is the form a consumer will meet it in, and a gap in a doc comment shows up as a
gap on the page. `rush docs` builds it. TypeDoc's `notDocumented` validation is on for exported
symbols from the start, so the rule never has to be retrofitted onto a finished package.

*Exit:* the type surface of `forms-react`, `forms-json` and `forms-html` is signed off, from the
generated reference, with every export documented.

**Built and signed off.** `forms-schema` is the move (`forms-core/src/json` → its own
package, which `forms-core` now depends on and re-exports until phase 6). `forms-react`,
`forms-json` and `forms-html` are skeletons: every export has its real signature and a body that
throws "not built yet", so they build, import and document, and `rush docs` passes with
`notDocumented` on and warnings treated as errors. CI runs it after the tests. `forms-schema` is
exempt from `notDocumented` for now (905 undocumented exports, carried over as moved).

The surface is **minimal, by audience** — Authoring, Implementations and Extensions in
`forms-react`, Loading and Hosts in `forms-json`, Rendering and Theming in `forms-html` — taken
from what the POC's own consumers import rather than from its export list. So compared with the
POC:

- **Internal:** the validation plumbing (`useMirror`, `useFieldValidation`, validation scopes),
  `fieldState`, `narrowPresence`, `lengthValidator`, `peekExternalEdit`, `tabPanelClass`,
  `deepMergeTheme`, the loader's expression and data-cursor helpers, and the edit session's
  `origin` token. What the loader needs from the framework (`useDefaultValue`, `hiddenPending`)
  is on a `forms-react/internal` subpath, the convention `@rx-controls/core/internal` already set.
- **Named where the POC was inline:** `RegistrySlot`, `GroupBoundaryOptions`, `TabsRenderItem`,
  `WizardRenderItem`, the providers' props, `TranslateResult`, `LoaderWarningKind`.
- **New:** `LoaderOptions.strict` and `LoaderStrictError`, the CI policy the goals doc names
  and the POC never built.

Open for the review:

- ~~**There is no author-level "validate this form" call.**~~ **Decided and in the skeleton**
  (POC README findings 75 and 76). The validation scopes are a tree an author walks —
  `useValidation()` from inside a form, and `useFormValidation()` + `<Form validation>` for the
  component that renders it, with `children` / `child` / `find`, `pending`, `isValid` and
  `check()` — and a submit is the root's `check()`: settle, touch if invalid, report. A scope judges only the rules
  written inside it, and a field displays only its own; errors no rule wrote (a server
  rejection) count everywhere. `Form`, `Tabs`, `Wizard`, `Dialog` and `Section` take a
  `validationKey`.
- ~~Is `DataScope` enough for a host translator?~~ **Decided: `DataScope` is not public** (POC
  README finding 78). Its one use was the radio adding per-option expression variables, which
  the narrowed type could not do anyway. `retranslate` takes a declarative `rebuild` — `at`,
  `variables: { key, values }`, `collectWarnings` — instead.
- ~~`defaultHtmlTheme`'s `ff-*` names need a stylesheet.~~ **Decided: no stylesheet, two
  themes** (POC README finding 79). `defaultHtmlTheme` is `rxf-` hook classes only and works
  with no CSS; `tailwindHtmlTheme` is the hooks plus Tailwind utilities, valid in 3.4 and 4 and
  assuming no preflight. `contents.hideWith` and `visibility.fade` moved the two behaviours that
  hung on CSS into theme data. With this, all three review questions are closed.

### 2 — `forms-react` + `forms-html`, the JSX path

**In progress.** Slices, each with its tests: (1) `forms-react` foundations — props, scope and
presence, the validation tree with verdicts, field validation, the registry and primitive hooks
**(built, 40 tests)**; (2) the boundaries — field, group, display, action, collection, staged
edit **(built, 29 tests)**; (3) tabs, wizard, dialog, the controllers and the built-ins **(built,
15 tests — `forms-react` complete, 84 in all)**; (4) `forms-html` **(built, 27 tests — both themes,
the providers, every renderer, hiding with no CSS; still to fix: the html dialog's Close button is a
plain `<button>`, not an `<Action>`, so a host cannot restyle it by id)**; (5) the
Storybook app; (6) the dev-app `PersonForm` and the compat fixture.

Port the framework and the HTML implementation, **with the tests the POC never had**, written as
each piece lands:

- the three presence states, `silent` still validating and still computing, and a `silent`
  widget staying mounted — the same DOM node across a hide and show (finding 73);
- `clearHidden` ↔ `defaultValue` as a cycle (hide → cleared → show → defaulted);
- scope narrowing for `hidden` / `disabled` / `readOnly`, and validation scopes;
- `FormProp` resolved in the *consuming* renderer's window (the escaped-read guard as a test);
- render counts — memo bailouts at every boundary, as `packages/forms` already benchmarks;
- StrictMode, SSR + hydration, the render-boundary rules from `RENDER-BOUNDARY.md`;
- the theme: nesting, resolution identity, and the finding-72 rule that behaviour never hangs on a
  theme class.

**Storybook starts here**, in `apps/forms-storybook`, with a story per boundary kind as it lands:
field, options, collection, group, display, action, tabs, wizard, dialog, staged edit. Stories are
written against the contract, not the implementation, so an implementation switcher (a toolbar
global and a decorator that swaps the registry) turns every story into one per implementation when
phase 4 adds MUI and Ant. They replace the POC's demo pages, including the controls that page used
to flip presence, locks and design mode, which become story args. The third-party fixtures
(`Stars`, `PetCards`, `SelectChild`, `Collapsible`) get stories too, since writing from outside
the package is part of the contract. In CI, every story is rendered and fails on any console error
or warning. That is the same rule `rush test` enforces through stderr, and it would have caught the
render-phase warnings the POC carried unnoticed. Storybook is a Vite build, as the POC is.

**HVAMS gate, from here on:** a v2 form mounted inside a compat-engine app — one engine copy,
compat `Control`s passed straight to v2 bindings, no ambient-read staleness. An in-repo fixture
(the dev app's `/compat` shape), not HVAMS itself.

*Exit:* the `PersonForm` equivalent runs from the real packages in the dev app; `rush test` green;
the compat-app fixture green; every boundary kind has a story, and the story smoke test is in CI.

### 3 — `forms-json` on the canonical types

- Replace the POC's hand-written JSON subset (`loader/json.ts`) with `forms-schema`.
- Port the translators, expressions and data cursor, **with tests per translator** from the
  fixture form (`loader/demoForm.ts`).
- Take the loader's DOM out: `translate.tsx` still emits `rxf-row` / `rxf-empty` markup for
  collection rows, which a platform-independent package cannot own.
- Move the corpus tooling to `tools/forms-corpus`.

**ServiceTas gates, from here on, in CI:**

- `parity` must stay at 0 differences outside the classified divergences;
- `burndown` must not rise (a ratchet, starting at 622);
- the ServiceTas `HtmlTheme` moves in as a `forms-html` test fixture, with the `servicetas.html`
  page kept in the dev app for side-by-side checks against `legacy-compare`.

*Exit:* parity 144 of 144, burndown ≤ 622, both failing the build on regression.

### 4 — MUI and Ant

Port `forms-mui` and `forms-antd`, plus `Stars` and `PetCards` as third-party fixtures. The same
fixture form and the same suite run under all three implementations, so a contract change that
suits HTML and breaks one library — or breaks a widget written from outside — fails CI. Storybook
gains its implementation switcher, and the smoke test runs every story under all three.

What each library has to be tested for is what the POC found it getting wrong silently:

- **MUI:** the notch via its private label context; the control slot reaching the frame as a
  stable component identity (`inputComponent`), without which every keystroke remounts the input;
  and `keepMounted` for a closed dialog.
- **Ant:** chrome through `style`, not `className`; the checkbox's label-as-child; `forceRender`
  plus `destroyOnHidden={false}` on tabs and modals, without which `silent` content stops
  validating while it looks fine; and no deprecated props (the POC was still passing
  `iconPosition` after Ant 6 renamed it).

*Exit:* html, MUI and Ant all green on the shared suite and the story smoke test.

### 5 — HVAMS in anger

HVAMS's real forms decide the order of work here, not the POC's gap list. Expected, from what it
uses today:

- **Its own look.** Either an `HtmlTheme` over its Tailwind config, or its own implementation
  over its component library — the second is goal 5 in production, and the more valuable test.
- **Date fields** (it uses `@astroapps/aria-datepicker`), **datagrid-backed collections**, and
  whatever the first forms surface.
- The compat interop from phase 2, now for real: forms converted one at a time beside components
  still on the ambient surface.

ServiceTas work continues underneath on the burndown list — `DataGrid` / `Pager` /
`ColumnOptions`, the `Accordion` adornment, host adornments (`Spotlight`), the help popover as a
shell override — so the JSON path advances while HVAMS sets the pace. The gates from phase 3 keep
it from sliding backwards regardless.

*Exit:* HVAMS ships a form on v2.

### 6 — Retire the POC

Delete `@rx-controls/forms`, `-react-core`, `-motion`, `-dnd`, `-datagrid`; the `FormStateNode` /
scripted-proxy half of `@rx-controls/forms-core` (its JSON half having become `forms-schema`);
the dev-app pages built on them; `apps/rxc-compare`; and `poc/forms-v2`. The legacy reference apps
(`legacy-compare`, `legacy-demos`) stay — they are parity's baseline. Update `CLAUDE.md` and the
docs that describe the POC (`MIGRATION-FROM-LEGACY.md`, `FORM-SEMANTICS.md`,
`FORM-FUTURE-API-DESIGN.md`, `RENDERER-HOOK-EXTRACTION.md`) in the same change.

*Exit:* nothing in the repo imports the POC packages, and no doc comment cites a POC README
finding.

### Later, not blocked on any of this

- **The designer** (goal 7). Needs definitions exposed as live values; reimplemented against the
  v2 renderers, as promised.
- **`forms-native`**, starting as a one-renderer spike. Shares the contract, not source (decision 6).
- **A ServiceTas migration.** Moving production ServiceTas off the legacy stack is a separate
  decision; it keeps running on the compat engine until then.
- **Base UI**, the one family the primitives were modelled on and never built against.

## Publishing

The v2 packages stay **unpublished until HVAMS ships a form on them** (phase 5). HVAMS consumes
them the way the compat trial did — packed tarballs through `pnpm.overrides`, never plain
dependencies (see `CLAUDE.md`) — so the contract can still move without a semver cost. The
implementations publish with the contract: `forms-mui` and `forms-antd` go out alongside
`forms-html`, not after. `apps/forms-storybook` is never published. First
publish follows the repo's rules: `workspace:^`, `--tag latest` explicitly, versions set by hand.
