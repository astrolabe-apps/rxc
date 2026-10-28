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

## 0.1.0-alpha.9

A breaking release: looks replace the class slots. See
[`FORMS-V2-LOOKS.md`](./FORMS-V2-LOOKS.md) for the model.

### What you change

- **Class slots become a look.** Every `className`, `textClassName`, `shellClassName`,
  `labelClassName`, `labelTextClassName`, and a radio's `entryClassName` / `selectedClassName` /
  `notSelectedClassName`, becomes a `look` (or `style` / `shellStyle` for a one-off). `ClassValue`
  remains only inside an html look's parts.
- **`variant` becomes `look`.** `ActionVariant` → `ActionLook`; `warnUnknownVariant` →
  `warnUnknownLook`; the `*VariantsProvider`s → `*LooksProvider`s; a theme's per-kind `variants`
  maps become one `looks` table.
- **forms-native is style-only.** A host that styled with classes (NativeWind) writes a `looks` table
  of portable styles in its `NativeTheme`; class looks are warned once per name and not drawn.
- **A disclosure's look has parts:** `shell` is the container and `control` the toggle row. html's
  `control` was the container, so move it to `shell`. MUI, Ant and Fluent read it as a group's look.
- **Icons are names.** An icon slot (`icon` on an action and an icon display, `startIcon` /
  `endIcon`, an `InputFrame`'s edges) takes `IconSpec`: a name, `{ family?, name }`, or a node as
  before. A string is words, never a name. Supply icon sets with `<FormIconsProvider set>`
  (innermost first; returning `undefined` declines); implementations draw a name with `useDrawIcon`.
  Theme slots that held a glyph (`helpButton.icon`, `date.icon`, `checkbox.markIcon`, a
  disclosure's `icon` / `iconOpen`) are now `IconSpec`s naming those. Declare typed names on
  `FormIcons`, as looks on `FormLooks`.
- **forms-json: icons.** The loader passes an `IconReference` on as `{ family: library, name }`
  (`iconRefOf`); `LoaderOptions.icon`, `IconTranslator` and `legacyIconClass` are gone. A web host
  that loads the icon font mounts forms-html's `legacyWebIcons`. An icon's `iconClass` goes in the
  look's `icon` part (`legacyIconClassSlot`).
- **forms-json: a plain Bool is no longer a checkbox.** `LoaderOptions.boolOptions` (default
  `defaultBoolOptions`, Yes / No) gives an option-less Bool options before its translator is chosen,
  so a `Standard` or `Dropdown` Bool is a select and a `Radio` one radios. Write
  `renderOptions: { type: "Checkbox" }` for a checkbox, or pass `boolOptions: null` for the old
  behaviour.
- **forms-json: messages are legacy's.** A string `Length` rule says "Length must be at least ‹n›" /
  "Length must be less than ‹n›" (was "At least ‹n›" / "At most ‹n›"); a required collection says
  "Please enter a value" (was "Please add at least one").
- **forms-json: a display-only field's text.** The loader hands the widget the whole `text` from
  `schemaInterface`; its `format` is gone.
- **forms-json: no "Nothing yet."** An empty collection draws nothing, as legacy did.
- **forms-native: `date.format` takes `(value, mode)`**, and `date.picker` is told `mode`. A theme
  that set `format` updates it.
- **A `Group` action is a wrapper around its children**, drawn with no button chrome, not a button.

### Added

- `TextField` `inputType`: `"date"` (an ISO date), `"datetime"` and `"time"` (legacy's strings). The
  loader draws Date, DateTime and Time schema fields with them. A web host replaces the browser's
  picker with `DateInputProvider` (html, MUI, Ant, Fluent); forms-native draws a box and a button
  opening the theme's `date.picker`, or a text input without one.
- `helpLabel` on a field: the words on its `labelEnd` help button, and the button's name; a
  `HelpText` adornment's `helpLabel` reaches it on the JSON path. A collection's `labelEnd` help is
  a button at its label's end.
- `Feed`: infinite scroll — read-only rows, `onLoadMore` / `onRefresh`, the `feed` slot. The loader
  draws legacy's `ScrollList` as one (`bottomActionId` / `refreshActionId`, `feedState`).
- `LoaderOptions.schemaInterface` (legacy's `SchemaInterface`; `DefaultSchemaInterface` to extend):
  emptiness, a value's text, date parsing, rule messages, a field's options by schema path.
  `TranslateArgs` gains `options()` and `schemaInterface`; a collection gains `lengthMessage`.
- `LoaderOptions.variables`: the host's variables, bound as `$name` in every expression.
- forms-json: a `Display` expression on a display-only field, an action's `Label` dynamic, and a
  `"."` group inside a collection row bound to the row.
- Looks as portable styles: a look part may be a `PortableStyle` or a function of `LookState`
  (`width`, `pressed`, `hovered`, `focused`, `invalid`) on every implementation, and a list of looks
  layers in order on every implementation.
- forms-native: theme `disclosure.iconOpen` / `iconStyle`, `shell.helpButton.label` / `labelled`,
  `select.frame` / `icon`, `dialog.closeIcon`.

### Fixed

- forms-native: a radio group's question and a checkbox's row are reachable by TalkBack (the MAST
  alpha.8 trial's R1 and R2); a long disclosure title no longer pushes its icon out of the row; an
  inline group is one `Text` its words and links flow in.

## 0.1.0-alpha.8

### What you change

Nothing.

### Added

- forms-native: `NativeTheme` `checkbox.switchColors` (`trackOn` / `trackOff` / `thumbOn` /
  `thumbOff`) colours the checkbox's `Switch`; a colour left out keeps the platform's own.

### Fixed

- forms-native: on Android, a field disabled and then enabled again (after a
  `disableType="global"` action's lock lifts, say) is enabled and focusable again. Inputs stayed
  dead, because a lifted state became `undefined` rather than `false`.
- forms-native: a locked `TextInput` is no longer editable (`readOnly={false}` overrode `editable`).

## 0.1.0-alpha.7

### What you change

- **forms-native `NativeTheme` renames:** `contents.className` → `contents.wrapper`,
  `GroupVariantClasses.className` → `wrapper`, `inline.className` → `inline.wrapper`, and
  `inline.variants` from `Record<string, string>` to `Record<string, GroupVariantClasses>` (write
  `{ wrapper: "…" }` where you wrote a class string).
- **New required theme keys**, for a theme written in full rather than merged over the default:
  forms-native `shellFor`, `icon.variants`, `action.iconTextClassName`, `disclosure.iconPlacement`;
  forms-html `icon.variants`, `disclosure.iconPlacement`.
- forms-native: the default theme adds `shrink` to `shell.label`, `shell.labelRow` and
  `action.textClassName`. A theme overriding those slots adds it too, or long labels don't wrap.
- forms-native: an action's string icon is drawn in the button's text look (its colour), with
  `action.iconTextClassName` (`no-underline` by default) over it.
- forms-html `tailwindHtmlTheme`: `font-bold` moved from `text.heading.className` onto each
  `text.heading.levels[n]`. Replacing the levels, add the weight yourself.
- forms-react: a `heading="group"` display titles the nearest group that is more than layout —
  passing through groups with no title, no `variant` and no scope, and never past a group with a
  title of its own. It used to title the nearest group, layout groups included: check where your
  group headings land.

### Added

- `IconDisplay` takes `variant`, a named look (html `icon.variants`, native `icon.variants`, an
  `icon` key in MUI's, Ant's and Fluent's variants providers).
- forms-html, forms-native: `disclosure.iconPlacement: "before" | "after"`.
- forms-native: `NativeTheme.shellFor` (shell slots per widget, as html's) and
  `action.iconTextClassName`.

### Fixed

- A refused `check()` inside a `disableType="global"` action focuses the field once the form's lock
  lifts (it was focused while still disabled, which a browser drops).
- forms-native: pressing a checkbox's label toggles it, not while locked; an image given only a
  width keeps its proportions; the checkbox `Switch` has an accessible name on Android; merging a
  theme that sets a nested key the base lacks no longer crashes.

## 0.1.0-alpha.6

`@rx-controls/forms-native`'s first release.

### What you change

- **A refused `check()` moves focus.** `ValidationScope.check()` now focuses the first field in
  error, opening the disclosure or switching to the tab that hides it; `check({ focus: false })`
  keeps the old touch-only behaviour, and `<Form focusInvalid>` maps to it. A wizard's Next focuses
  the refused field too, and moves on only from the page it checked.
- **Help buttons are named `Help: ‹label›`** (they were "Help") under every implementation. Update
  tests or selectors that matched the old name.
- **Implementations:** `FormRenderers` has two new required slots, `richText` and `image`.
- forms-html `tailwindHtmlTheme`: button padding moved from `action.className` into each
  `action.variants.*.className`. A variant you override sets its own padding.

### Added

- `@rx-controls/forms-native`: `nativeRenderers` over React Native's own components, with a
  `NativeTheme` under `NativeThemeProvider`; peer `react-native >=0.86`. Its README is the setup.
- Named looks: `variant` on `TextDisplay` and every group kind; `ActionVariant` takes any name
  beside `primary` / `secondary` / `link`. An unknown name draws the base look, reported once.
  `MuiVariantsProvider`, `AntdVariantsProvider`, `FluentVariantsProvider`; html's `variants` slots
  on `text`, `contents`, `inline` and `action`, with `data-variant`. (All renamed to looks in
  alpha.9.)
- `ImageDisplay`: `source`, a required `alt` (`""` is decorative), `width` / `height`, `fit`,
  `variant`.
- `<RichText html>`: a safe inline subset (`b` / `strong`, `i` / `em`, `sup` / `sub`, `a`, `br`,
  `img`, entities) for labels, help and displays; the `html` template (escapes what it
  interpolates), `parseRichText`, `richTextWords`, `plainText`.
- `TextDisplay heading="group"`: the display is its group's own title.
- `CheckOptions` (`{ focus?: boolean }`); `WizardController.check()` (check the page without
  moving); `WizardPage.title` optional (an untitled step is numbered).
- `CheckboxField` `labelPosition` (`"before"` | `"after"`).
- forms-json: `LoaderOptions.displayText`, what a label's or help text's string becomes (e.g.
  `<RichText html>`); plain by default.
- forms-html theme slots: `richText`, `image`, `disclosure.icon` / `iconClassName` (`data-open`
  while open).

### Fixed

- A refused check switches to the tab holding the first field in error before focusing it.
- Commit-phase effects (validators publishing, a disclosure's or tab's reveal) run before paint on
  React Native too.
- forms-html `tailwindHtmlTheme`: the `link` variant is unpadded.

## 0.1.0-alpha.5

`@rx-controls/forms-fluent`'s first release.

### What you change

- **Implementations:** `FormRenderers` has a new required `disclosure` slot; `WizardRenderProps`
  gains `navigation` (under `"none"` draw no step strip and no Back / Next); `FieldShellProps`
  gains `widget`, `hideLabel`, `helpPlacement`, `count` and `countOver`; `DisplayRenderProps`
  gains `headingLevel`.
- forms-html: a display's colour classes no longer stack. An announced, toned display gets only
  `displayShell.message[tone]` (it got `tones[tone]` too); a toned one `tones[tone]`; one with no
  tone the new `displayShell.color`. A theme that set a colour only in `tones` also puts it in its
  `message` entries.
- forms-json: needs `jsonata` `^2.2.0` (was `^2.1.0`); a `~2.1` pin can go.

### Added

- `@rx-controls/forms-fluent`: `fluentRenderers` over `@fluentui/react-components` 9.
- `Disclosure`: `title`, `defaultOpen`, a bound `open`. Closed, its content stays mounted and
  validating and is never cleared; closing touches it; a refused submit opens it.
- `useWizard()` → `WizardController` (`page`, `canBack`, `canNext`, `next()`, `back()`,
  `goTo(key)`), and `WizardProps.navigation: "none"` for a host that drives the wizard.
- `TextDisplay` `heading`, at the level the form's outline gives that place.
- `FieldProps.hideLabel` (named by the label without drawing it) and `helpPlacement`
  (`"below" | "labelEnd"`).
- `GroupProps.clearHidden`, overriding the form's for that group.
- `TextField` `showCount` (`true` or `{ format }`).
- `Action.onClick` returns `unknown`: any thenable makes the action busy.
- forms-html theme slots: `shellFor` (and `data-widget` on the shell), `shell.labelRow`,
  `shell.helpButton`, `shell.count` / `countOver`, `displayOnly.icon`, `displayShell.color`,
  `text.heading`, `action.iconClassName`, `disclosure`.
- forms-json: a leaf field's `hideTitle` → `hideLabel`; a `HelpText` at `LabelEnd` →
  `helpPlacement: "labelEnd"`; `Accordion` adornments and groups → `Disclosure`;
  `TranslateArgs.resolveField(ref)` for host translators.

### Fixed

- `DisplayOnlyField` draws `startIcon` / `endIcon` (html, MUI, Ant), and so does a select (MUI, Ant).
- html, MUI: each tab is wired to its panel (`aria-controls`, `role="tabpanel"`, `aria-labelledby`).
- forms-json: a Jsonata expression re-runs when a key the data lacked is added.

## 0.1.0-alpha.4

### What you change

- **A refused `<Form onSubmit>` focuses the first field in error.** Pass `focusInvalid={false}` for
  the old behaviour.
- A refused submit no longer touches hidden fields, so a field revealed afterwards does not start
  in error.
- forms-html: a group body's default layout moves from `contents.body` to the new
  `contents.layout`, and applies only when the group has no `className` (a group's `className` is
  its whole layout). Move layout classes in a custom `contents.body` to `contents.layout`.
- forms-html: a complete `HtmlTheme` (not a `PartialHtmlTheme` merged by `HtmlThemeProvider`)
  needs `required.note`, `contents.layout`, `contents.section`, `visibility.transitions` and
  `displayShell.message`.
- forms-mui, forms-antd: field shells have no margin of their own; a group body spaces its children
  from the theme's tokens.
- html, MUI, Ant: a required select with a value offers no empty choice.
- **Implementations:** `ValidationScope` gains `focusInvalid()`; `register` takes an optional third
  `active` argument.

### Added

- `<Form focusInvalid>` (default `true`) and `ValidationScope.focusInvalid()`.
- Every field controller hands its widget an `elementRef`, publishing `control.meta.element`
  (`FocusTarget`).
- Implementations: `InputFrameProps.controlRef`, `FieldShellProps.describeRequired`,
  `fieldRequiredId(id)`.
- forms-html theme: `contents.section`, `displayShell.message`, `visibility.transitions`,
  `required.note`.

### Fixed

- A check list's checkboxes are `aria-invalid` in error, and the group is described as required
  without the marker entering its name.
- forms-antd: a display after a field in error is no longer flush against it.

## 0.1.0-alpha.3

### What you change

- **Implementations:** `GroupRenderProps.kind` (`"contents" | "section" | "inline"`) is required;
  `@rx-controls/forms-html/shared`'s `Contents` → `ContentsRegion` (with an optional `titleStyle`).

### Added

- `<FormRenderers renderers>`: override slots for one part of an app without mounting the
  implementation's `root` again; `(outer) => Partial<FormRenderers>` wraps the enclosing slots.

### Fixed

- forms-mui, forms-antd: section titles in the library's heading type.

## 0.1.0-alpha.2

### What you change

- **`default` is reserved in a `validate` record.** It is published per boundary, as a bare
  function is, so a host's server errors under plain `default` are no longer claimed by the field.
- **The required marker is `aria-hidden`** (html, MUI, Ant), so a field's accessible name is
  exactly its label. A test matching the label's raw text (Playwright's
  `getByLabel(…, { exact: true })` with the asterisk) finds the field by role and name instead.
- html, MUI: a check list's or radio's shell draws no `fieldset` / `legend`; the caption is a `div`.
- html, MUI, Ant: a check list or radio group is touched when focus leaves the whole widget, not
  when it moves between options.

### Added

- forms-react exports `ReadContext`, to type a derivation without depending on
  `@rx-controls/core`.
- Implementations: `InputFrameProps.required`; display render props gain `regionOnly`;
  `onFocusLeave` on `@rx-controls/forms-html/shared`.

### Fixed

- `aria-required` on required controls and `aria-invalid` on every invalid one (html, MUI, Ant).
- An `announce`d display stays mounted as an empty live region while hidden or empty, so its
  content is announced when it arrives.

## 0.1.0-alpha.1

### What you change

- **`Stack` is gone**, with `StackProps`, `useStack`, the `stack` registry slot and html's `stack`
  theme slot. Lay a group out with `<Contents layout>`, its classes, or plain elements.
  `StackLayout` → `FlexLayout`.
- **`SelectField` and `RadioField` clear a value the options move away from.**
  `restrictToOptions={false}` opts out.
- A bare-function `validate` is published under `default@‹boundary id›` (`bareValidatorKey`), not
  `default`.
- A `<Contents title>` is `role="heading"` with `aria-level`, levelled by the outline.
- forms-html: `contents.hideWith` gains `"collapse"`, and the collapse's classes move from
  `contents.wrapper` to `contents.collapse` (`tailwindHtmlTheme` uses it). A region has no inner
  element between its wrapper and its title and body unless it collapses.
- The design-chrome `display: contents` element around every field, display and collection is
  drawn only in design mode.
- **Implementations:** `FormRenderers` gains a required `checkList` slot and an optional `form`
  slot; a field shell renders the label, error and help under `fieldLabelId(id)`,
  `fieldErrorId(id)` and `fieldHelpId(id)`; `FieldBoundaryOptions` is generic,
  `FieldBoundaryOptions<T, P>`.

### Added

- `CheckListField` (an array of values), and `useMultiSelectController` for a check list of your
  own.
- `clearTo` on fields and collections; `defaultValue` refills a value the boundary cleared.
- `<Form onSubmit>` and `<Action submit>`: submits only once `check()` passes, inside a real
  `<form>` so Enter submits.
- `tone` and `announce` on displays.
- `hidden` on `TabItem` and `WizardPage`.
- `transitions={false}` on a group or `<Form>`.
- `<Form headingLevel>` (default 2) and `GroupRenderProps.headingLevel`.
- `TextField` `maxLength`, which also registers the rule.
- `fieldLabelId` / `fieldErrorId` / `fieldHelpId`, `FormElementProps`.
- forms-html theme: `checkList`, `displayShell.tones`.
- forms-json: legacy's `CheckList`; translators get `childProps`; a Tabs child's `hidden` hides its
  tab.

### Fixed

- A server error under `default` shows and counts on a field with a bare `validate`.
- Radio groups are named by their label; MUI's and Ant's select, radio and checkbox are described
  by their help and error, and Ant's ids exist.

## 0.1.0-alpha.0

The first release: `forms-schema`, `forms-react`, `forms-json`, `forms-html`, `forms-mui` and
`forms-antd`.
