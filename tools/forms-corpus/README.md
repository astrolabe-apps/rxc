# forms-corpus — the loader against real forms

The Forms v2 loader's corpus tooling (`docs/FORMS-V2-PLAN.md`, phase 3), over
the real `@rx-controls/forms-json` / `forms-react` / `forms-html` packages:

```bash
rush build --to rxc-forms-corpus
rushx extract-corpus <name> <src-dir>   # a legacy app's forms + schemas → corpus/<name>/
rushx burndown [<dir-or-file>...]       # what the loader cannot carry across; --json, --strict
rushx burndown --show unread:layoutClass # every warning of one shape, with the control it came from
rushx burndown --no-actions              # also report every button no host handler claimed
rushx parity [--show <form>] [--fixture empty|filled] [--trace <field>]   # legacy vs v2, per path
rushx extract-looks [<dir>...]            # combine the looks of many forms (corpus/looks/): per form and the union
rushx looks-check                         # every form drawn with the loader's looks, nothing printed
rushx convert-looks                       # forms that name their looks + a looks table per renderer (corpus/converted/)
rushx converted-check                     # converted forms draw the same as the originals
rushx gates [--update]                  # all three, as gates: fail on a regression
```

**The corpus is not in the repository.** It is other repositories' forms and
schemas — ServiceTas's among them — and this repository is public, so
`corpus/` is gitignored and the gates run locally rather than in CI. Run
`rushx gates` before landing a change to the loader, a translator or an
implementation. To rebuild the corpus, point the extractor at each legacy
app's source directory (the one holding `schemas.ts` and its pairing file):

```bash
rushx extract-corpus servicetas   ~/astrolabe/ServiceTas/ServiceTasAPI/NewClientApp/client-common
rushx extract-corpus forms-app    ~/astrolabe/astrolabe-common/forms-app/src
rushx extract-corpus testtemplate ~/astrolabe/astrolabe-common/Astrolabe.TestTemplate/ClientApp/sites/formServer/src
```

## The gates

`gates.json` holds the baseline — counts only, never corpus content.

- **Burndown: a ratchet.** The warning count may not rise, and no form may
  crash the loader. When it falls, `rushx gates --update` lowers the ratchet so
  the gain cannot be given back unnoticed.
- **Parity: absolute.** Every corpus form runs twice over the same fixture
  data — through legacy itself (`@react-typed-forms/schemas@19`, headless, on
  the compat engine) and through the v2 loader mounted under React — and the
  values and errors each leaves are diffed path by path. Any difference fails,
  apart from two classified divergences the summary counts: v2's write-free
  display-only field, and legacy's one shared `jsonata` error key. Anything
  the v2 side prints to the console while it renders fails too.

- **Looks: absolute.** Every form is drawn under html through the loader, which
  turns each control's class slots into a look and brings the looks with the
  form (`TranslateResult.looks`, mounted by `JsonForm` under a
  `FormLooksProvider`). Anything printed to the console fails — a look the
  implementation could not find, a React warning — and so does a run in which no
  element names a look. Both themes run (default and Tailwind). (Before the class
  slots were retired this compared the markup with what the class slots drew, and
  found them identical on every form.) `extract-looks` is the offline step that
  combines many forms' looks into one set, for translating to JSX or a new JSON
  format; its output holds the corpus's class strings, so it stays under the
  gitignored `corpus/`.

- **Converted: absolute, with a ratchet.** `rushx convert-looks` rewrites every form to name its
  looks and writes a table per renderer (html: the classes verbatim; native: generated portable
  styles — see `docs/FORMS-V2-LOOKS.md`, "Pre-conversion"). Each converted form drawn under html
  with the generated table must be markup-identical to the original (look names aside), the native
  module must load and evaluate, and the count of class tokens native cannot express may only fall.
  Inputs, hand-written and **committed** in `sidecar/`: `names.json` (derived name → the name you
  want), `classNames.json` (the host's own classes → portable styles), `native-overrides.json`
  (hand-written native parts), `nativeTokens.json` (the colour tokens the native theme defines). `test/` holds the converter's unit tests, which need no corpus.

The runs happen in happy-dom with the DOM globals in place **before** React and the
renderers load, as in a browser (`src/dom.ts`, imported first). Set up after them, the
run measured an environment no browser has — an asynchronous expression's pending
interval went unobserved — and hid a real divergence: an `AllowedOptions` answer
clearing a value legacy keeps.

## The stand-in host

`src/host/standInHost.tsx` is one of each loader extension a real host adds —
a render type (`Switch`), group kinds (`MessageBox`, and `TopLevelGroup` over a
compound, with `CompoundCycle`), an adornment (`Spotlight`), a take-over of a
built-in one (`HelpText` + `helpLabel`), ServiceTas's Textfield extension
(`keyboardType` → `inputMode`) and a custom display by id — so the burndown
counts what they claim as claimed. It is exported as `rxc-forms-corpus/host`,
which is how the dev app's `/v2/servicetas` page uses the same host the gates
do.

## Comparing on a device against the real ServiceTas renderers

`scripts/device-compare.mjs` draws the same forms on the Android emulator through the legacy
renderers as ServiceTas's app builds them and through `forms-native`, then diffs what each put
on screen (`uiautomator dump`: text, position, enabled, clickable) and keeps a screenshot of
each. The legacy side is a harness on a branch of the ServiceTas repo
(`servicetas-rn/harness`, `feature/forms-v2-compare-harness`: the real `createDefaultRenderer`
and `defaultRNRenderOptions`, no auth, API or maps), the v2 side `apps/native-dev`'s Converted
screen.

1. `rushx convert-looks` here, then `rushx sync-converted <Form…>` in `apps/native-dev`.
2. In `servicetas-rn`: `node scripts/sync-harness-forms.mjs <Form…>` (same names).
3. Metro for each, without `CI=1`: `native-dev` on 8082, the harness on 8083 with
   `EXPO_PUBLIC_FORMS_HARNESS=1 npx expo start --go --localhost --port 8083 < /dev/null`.
4. `node scripts/device-compare.mjs <Form…>`: `corpus/compare/report.md` and the screenshots.

Forms are drawn with empty data and the form is one tall screen (`wm size`, reset after).
A difference is a prompt to look, not a failure: the dump shows where a gap grew or an element
is missing, the screenshot says whether it matters.

## What lives where, for a second machine

Regenerated from the ServiceTas code (gitignored, never committed): `corpus/` — the forms and
schemas (`rushx extract-corpus`), `corpus/converted/` (`rushx convert-looks`), `corpus/compare/` (the
device comparison), `apps/native-dev/src/converted/` (`rushx sync-converted <Form…>`) and the
harness's `harness/forms.local.ts` (`node scripts/sync-harness-forms.mjs <Form…>`).

Committed, because nothing regenerates it: `sidecar/` here (the hand-written inputs above, and
`rn-forms.json`, the 45 forms the React Native app draws — `node scripts/rn-forms.mjs [path]`
rebuilds it from the app's source), `scripts/`, and the ServiceTas fixtures in `forms-native`'s tests.

Not in this repo: the harness itself, which is a branch of the ServiceTas repo
(`feature/forms-v2-compare-harness`, `servicetas-rn/harness/`) — push it, or `git bundle` it, to
reach another machine. A fresh machine also needs the Android SDK with an emulator and Expo Go 57, and
`rush install` in the ServiceTas `NewClientApp` (it needs `NPM_AUTH_TOKEN` and
`FONT_AWESOME_NPM_TOKEN` in the environment).
