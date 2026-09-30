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
rushx gates [--update]                  # both, as gates: fail on a regression
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

## The two gates

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

## The stand-in host

`src/host/standInHost.tsx` is one of each loader extension a real host adds —
a render type (`Switch`), group kinds (`MessageBox`, and `TopLevelGroup` over a
compound, with `CompoundCycle`), an adornment (`Spotlight`), a take-over of a
built-in one (`HelpText` + `helpLabel`), ServiceTas's Textfield extension
(`keyboardType` → `inputMode`) and a custom display by id — so the burndown
counts what they claim as claimed. It is exported as `rxc-forms-corpus/host`,
which is how the dev app's `/v2/servicetas` page uses the same host the gates
do.
