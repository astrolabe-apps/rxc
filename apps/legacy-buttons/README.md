# Legacy ButtonAction demo

Mirrors `apps/dev/src/app/buttons/page.tsx` using the legacy
`@react-typed-forms/schemas` + `@react-typed-forms/schemas-html` stack
(via the published npm versions). Built for side-by-side visual
comparison while validating `ButtonAction` parity in `@rxc/forms`.

This is a separate Rush project from `apps/dev` because the legacy
stack is Next 14 / React 18, whereas `apps/dev` is Next 16 / React 19.
Both apps use Tailwind 4.

## Run

From the repo root after `rush update`:

```bash
cd apps/legacy-buttons
rushx dev
# → http://localhost:3001
```

`apps/dev` defaults to port 3000, so both can run side by side:
- New: <http://localhost:3000/buttons>
- Legacy: <http://localhost:3001>

## What's wired up

- `@react-typed-forms/core@^4.5.3`, `@react-typed-forms/schemas@^17.1.2`,
  `@react-typed-forms/schemas-html@^5.1.1` from the npm registry.
- Stock theme: `createDefaultRenderers(defaultTailwindTheme)` — no
  per-action styling overrides except the two demonstrative cases in the
  "Per-action styling" section.
- Tailwind 4 with `primary` / `secondary` palettes (RTOeForms production
  values, declared via `@theme` in `app/globals.css`) so
  `bg-primary-500` / `bg-secondary-500` from the stock theme render
  meaningfully. `@source` registers `schemas-html/lib/**/*.js` so the
  classes baked into the compiled lib are emitted.
- Same Font Awesome Kit URL as the new demo (`kit.fontawesome.com/95cc77b353`).
  Material Symbols stylesheet is also loaded so Material rows show as
  glyphs rather than ligature text fallback.

## Sections (mirroring new demo)

1. ActionStyle variants — Button / Secondary / Link / Group
2. Icon placement — Before / After / ReplaceText / FA
3. Busy / async — Self disable / Global disable / no disableType
4. Per-action styling — `styleClass` override + `textClass`
5. Font Awesome icons — Edit/Save/Delete, Confirm/Cancel, Add/Search,
   icon-only navigation, spin
6. Disabled state — pre-disabled primary + link

## Workarounds in this app

A couple of friction points showed up integrating the legacy stack
into a Rush + Next 14 app — both are isolated to this project:

- **`@react-typed-forms/core@4.x` `exports` ordering bug.** The
  published `package.json` lists `default` before `require`, which
  webpack 5 / Next 14 reject ("Default condition should be last one"),
  and Node's resolver also blocks any subpath load. `next.config.mjs`
  works around it by reading the manifest off the resolved symlink and
  aliasing the bare specifier to the real ESM entry on disk.
- **`@types/react@19` leaking via Rush hoisting.** Some sibling project
  in the workspace pulls React 19 types, which TypeScript then refuses
  to "name" inferred component return types from. Affected components
  (`RootLayout`, `Page`) are annotated with `: JSX.Element` explicitly
  to keep the inference stable.

## Things to eyeball

- Busy spinner swap (resting label → busy spinner)
- `ReplaceText` icon-only sizing
- `ActionStyle.Group` action-bar markup
- Link underline metrics
- FA vs Material glyph weight
- Class composition: `rendererClass(buttonClass, primary/secondary)` chain
- `definition.styleClass` with leading `@` override sentinel
- `definition.textClass` threading into the text span
