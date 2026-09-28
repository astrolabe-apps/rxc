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

What carries over is the design and most of the framework's code. What does not: the Ant and
Mantine implementations (their job was to bend the contract, and it is done), the demo pages, and
anything shaped by being a demo.

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
| `@rx-controls/forms-html` | `impls/html.tsx`, `shared.tsx`, `htmlTheme.tsx` | The HTML implementation, its `HtmlTheme`, and a small structural stylesheet. |
| `@rx-controls/forms-mui` | `impls/mui.tsx` | In-repo, unpublished: the contract's regression gate. |
| `tools/forms-corpus` | `poc/forms-v2/scripts/` | Extract, burndown, parity. Private; run in CI. |

Two changes from the goals doc's layout:

- **No `forms-state`.** It was to be the React-free layer, but the build moved its contents: the
  cascade is React context, validators register from boundaries, and `FormNode` is the loader's.
  What is left React-free is ~250 lines (`prop.ts`, `collections.ts`, `externalEdit.ts`,
  `actionIds.ts`) with no non-React consumer — `forms-native` is React too. Folded into
  `forms-react`.
- **A loader package, `forms-json`.** The layout had none, and filed expressions under
  `forms-state`, which contradicts "hand-written forms avoid the expression engine outright".
  jsonata is a dependency of the loader and of nothing a JSX form imports.

`forms-native` and a datagrid add-on come later and slot in beside `forms-html`.

## Phases

### 0 — Settle what the POC left open

Small, and each is a contract question that is cheaper before phase 1 than after:

- **`LayoutStyle`** (15 corpus uses): a slot for a dynamic inline style, or a loader warning
  forever?
- **`keyboardType` / `autoComplete`** (14 / 13): contract props or host input options?
- **Group kind on `GroupRenderProps`.** The loader maps legacy Standard, Contents and Flex onto one
  renderer, so a theme cannot give them legacy's different body classes (finding 72, item 5).
- **`pending` on `GroupRenderProps`**, so a header can show "checking…" — asked for by nothing
  yet; decide now or record it as deliberately absent.

### 1 — Types only

Package skeletons with the public types and nothing else — from `framework/types.ts` and the
interfaces doc — reviewed before any implementation is written.

*Exit:* the type surface of `forms-react`, `forms-json` and `forms-html` is signed off.

### 2 — `forms-react` + `forms-html`, the JSX path

Port the framework and the HTML implementation, **with the tests the POC never had**, written as
each piece lands:

- the three presence states, and `silent` still validating and still computing;
- `clearHidden` ↔ `defaultValue` as a cycle (hide → cleared → show → defaulted);
- scope narrowing for `hidden` / `disabled` / `readOnly`, and validation scopes;
- `FormProp` resolved in the *consuming* renderer's window (the escaped-read guard as a test);
- render counts — memo bailouts at every boundary, as `packages/forms` already benchmarks;
- StrictMode, SSR + hydration, the render-boundary rules from `RENDER-BOUNDARY.md`;
- the theme: nesting, resolution identity, and the finding-72 rule that behaviour never hangs on a
  theme class.

**HVAMS gate, from here on:** a v2 form mounted inside a compat-engine app — one engine copy,
compat `Control`s passed straight to v2 bindings, no ambient-read staleness. An in-repo fixture
(the dev app's `/compat` shape), not HVAMS itself.

*Exit:* the `PersonForm` equivalent runs from the real packages in the dev app; `rush test` green;
the compat-app fixture green.

### 3 — `forms-json` on the canonical types

- Replace the POC's hand-written JSON subset (`loader/json.ts`) with `forms-schema`.
- Port the translators, expressions and data cursor, **with tests per translator** from the
  fixture form (`loader/demoForm.ts`).
- Take the loader's DOM out: `translate.tsx` still emits `ff-row` / `ff-empty` markup for
  collection rows, which a platform-independent package cannot own.
- Move the corpus tooling to `tools/forms-corpus`.

**ServiceTas gates, from here on, in CI:**

- `parity` must stay at 0 differences outside the classified divergences;
- `burndown` must not rise (a ratchet, starting at 622);
- the ServiceTas `HtmlTheme` moves in as a `forms-html` test fixture, with the `servicetas.html`
  page kept in the dev app for side-by-side checks against `legacy-compare`.

*Exit:* parity 144 of 144, burndown ≤ 622, both failing the build on regression.

### 4 — MUI as the second implementation

Port `forms-mui`, plus `Stars` and `PetCards` as third-party fixtures. The same fixture form and
the same suite run under both implementations, so a contract change that suits HTML and breaks
MUI — or breaks a widget written from outside — fails CI.

*Exit:* html and MUI both green on the shared suite.

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

*Exit:* nothing in the repo imports the POC packages.

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
dependencies (see `CLAUDE.md`) — so the contract can still move without a semver cost. First
publish follows the repo's rules: `workspace:^`, `--tag latest` explicitly, versions set by hand.
