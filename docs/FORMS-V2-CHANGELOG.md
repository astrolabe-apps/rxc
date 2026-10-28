# Forms v2 changelog

The eight Forms v2 packages — `@rx-controls/forms-schema`, `forms-react`, `forms-json`,
`forms-html`, `forms-mui`, `forms-antd`, `forms-fluent` and `forms-native` — are released together,
at one version, on the npm `alpha` dist-tag (`npm install @rx-controls/forms-react@alpha`). Move
them together too: one alpha of every package you use.

They are alphas: a release may rename, reshape or remove part of the contract, with no deprecation
period. Each release says so under **What you change**. To upgrade across several alphas, work
through each release's list from yours upward. A release with nothing there needs nothing.

`@rx-controls/forms-scenarios` is versioned on its own and is not covered here.

## Unreleased

### What you change

- **forms-html (and MUI, Ant, Fluent): a numeric font size is px.** `fontSize`, `letterSpacing` and
  `lineHeight` in a `style`, `shellStyle` or portable look part were `rem` of a 16px root (`24` →
  `1.5rem`). They are now `px` like every other length (`24` → `24px`; `lineHeight` written out,
  since React reads a bare one as a multiplier). Nothing changes on a 16px root. On any other root
  the text is now the size written: on Bootstrap 3's 10px root it was 62% of it. Text no longer
  follows the browser's default font size setting (page zoom still scales it).
- **forms-html (and MUI, Ant, Fluent): `gap` alone no longer makes an element a flex column.** A
  style with only `gap` / `rowGap` / `columnGap` among the flex properties is left as the element
  is — a gap on a grid or on a class look's row works, and on a block does nothing. To stack with a
  gap as on React Native, write `flexDirection: "column"` beside it. Any other flex property
  (`flexDirection`, `justifyContent`, `alignItems`, `alignContent`, `flexWrap`) still makes it a
  `display: flex` column unless it says otherwise.
- **forms-html: the Tailwind theme's collapse keys on `data-collapsed`, not `data-hidden`.** A theme
  of your own with `hideWith: "collapse"` that styles the collapse on `[data-hidden]` changes it to
  `[data-collapsed]`. `data-hidden` still marks a hidden region, but it is set the moment it hides,
  and a reveal now needs a frame drawn collapsed first.

### Added

- `mergeCss` on `@rx-controls/forms-html/shared` (implementations): styles laid over each other,
  where the flex-column default `portableCss` fills in gives way to a `display` or direction set
  beneath it.

### Fixed

- An author's flex property (`justifyContent`, `alignItems` …) no longer covers a group `layout`'s
  row, or a look's, with a column.
- A collapsed region (`hideWith: "collapse"`) leaves the layout once its animation has run, so its
  padding, its border and its parent's `gap` go with it.

## 0.1.0-alpha.10

### What you change

Nothing.

### Added

- MUI, Ant and Fluent draw html's looks — the html theme's in scope, the form's beneath — for every
  name their own looks lack, on every kind of boundary. A name a library's own looks hold is drawn
  as that look alone, never stacked over html's: an app that defined the same name in both now gets
  only the library's.
- `InputFrameProps.widget` and `HtmlTheme.frameFor`: the input frame per widget, beside `shellFor`.

### Fixed

- forms-antd: a busy action keeps its text as its accessible name (it was "loading Submit"), with
  `aria-busy`.

Earlier alphas are not recorded here.
