# Forms v2 — the ServiceTas MAST EOI trial, `0.1.0-alpha.5`

The rerun of the ServiceTas **MAST licence EOI wizard** against
`@rx-controls/forms-*@0.1.0-alpha.5`, from the brief
[`FORMS-V2-SERVICETAS-MAST-EOI-TRIAL-BRIEF.md`](./FORMS-V2-SERVICETAS-MAST-EOI-TRIAL-BRIEF.md). It
starts from the alpha.4 run's branch and its worklist
([`FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.4.md`](./FORMS-V2-SERVICETAS-MAST-EOI-0.1.0-alpha.4.md),
whose gap numbers G1–G7 and T1–T5 are used here). New gaps are numbered N1 onwards.

ServiceTas branch `trial/codefirst-mast-eoi-alpha5` (throwaway): `31d5e793` the version bump,
`8ff0442d` main merged in, `b75c48e0` the worklist and component layer, `e3d4e0b2` the Ant swap
and two follow-ups. ServiceTas paths are relative to `ServiceTasAPI/NewClientApp/client-common`.
rxc lines are cited at the `@rx-controls/forms-react_v0.1.0-alpha.5` tag.

**Verdict.**
- **Every alpha.4 workaround is gone, and no slot overrides remain.** The pages and the
  component layer contain no intrinsic elements, DOM APIs, HTML strings, pseudo-element
  classes or arbitrary selectors.
- **What the contract has no boundary for goes behind one seam module:** icons, images and
  emphasis inside a label.
- **The component layer would not carry to a native implementation as it stands,** for one
  reason above all. The html theme has one look per text display and one per group, so every
  second text style and every second card is visual classes in the component layer (N1, N2).
  Those are Tailwind classes NativeWind could draw, but they are styling, not layout. Under Ant
  they still draw ServiceTas's pills and cards, so they are the layer's coupling to a look.
- **The new APIs fit, with three rough edges:**
  - `useWizard().next()` always advances, which a server-decided wizard can't use (N4).
  - A page check never focuses or reveals a refused field (N5).
  - `labelEnd` help on a checkbox lands after the switch (N6).

## 1. Platform independence

### The inventory

`grep -nE "<[a-z][a-z0-9]*[ />]"` over `forms-v2/components.tsx`,
`components/mast/eoi-v2/EoiWizard.tsx` and `steps/*.tsx` finds only TypeScript generics. Read by
eye, what is left that a native implementation could not take as it is:

| what | where | what would replace it |
|---|---|---|
| Visual classes for text styles: lead, stat label, pill text, tag text, chip text, task number, the step pill's box | `components.tsx`, `looks` | a text style the theme names (N1) |
| Visual classes for group looks: the grey card, the task card, the green-bordered callout, the pills and tags, the two rules | `components.tsx`, `looks` | a group look the theme names (N2) |
| `text-center` on the task number, `shrink-0` / `w-[70px]` / `mx-[20px]` / `pt-[7px]` around it | `TaskCard` | layout; NativeWind carries it |

Nothing else. The rest of the classes are layout (listed under "for `forms-native`" below).

### The seam: `forms-v2/platform.tsx`

One module, imported by name, with a `platform.native.tsx` beside it when `forms-native` lands.
Each export is there because the contract has no boundary for it:

| export | wraps | why the contract had none |
|---|---|---|
| `icons.next`, `external`, `refresh`, `warning`, `info`, `failed`, `bullet` | Font Awesome `<i>` | The contract takes icons as nodes, by design, so an app supplies them. A registry is the natural seam. |
| `Picture` (`boat`, `mastLogo`, `licenceCardBack`; `width`, `height`, `cover`, `rounded`) | `<img>` | No image display (N8). Named rather than by URL, so a native version can bundle the assets. |
| `Strong` | `<b>` | No emphasis inside a label or a sentence (N9). Used in the three "Is **UBER** …?" labels, the step pill, the details intro and the callback question. |

The web host is separate from the form. `EoiWizard.tsx` is the form (`<Form>` + `<Wizard>` +
pages), with nothing of the platform in it. `EoiWizardV2.tsx` is the web host: the browser's side
of each action (`window.open`, navigation), the page backdrop, the spinner and the `&step`
scaffolding. A native host would supply the same around the same form.

### HTML strings

None left. alpha.4 had three:

- **The details intro's "including any middle names":** now a `Lead` whose text holds a `Strong`.
- **The step pill:** now a `TextDisplay` with a `Strong`.
- **The boat image:** now a `Picture`.

None needed to be HTML once there was a way to say "this word is bold" (N9). `HtmlDisplay` is
not used.

### The Ant swap

The unchanged wizard under `antdRenderers` (`@rx-controls/forms-antd@0.1.0-alpha.5`, `antd`
6.6.5), in a nested `<FormProvider>` with no ServiceTas theme, at `?path=mast-eoi-v2-antd`.

**Nothing broke:**
- every page renders;
- the identifier checkboxes reveal their inputs;
- the `labelEnd` help draws Ant's own icon;
- the disclosure opens to the licence diagram;
- the headings keep their levels.

**What showed the coupling:**
- **The `looks` classes are a ServiceTas look Ant doesn't own.** The stat pills, tags, chips,
  task cards and callout all came out in it, inside an otherwise Ant-styled page. A native
  implementation would draw them the same way (N1, N2).
- **The seam carries a little of the look too:** `Picture`'s rounded corners and `Strong`'s
  extra-bold weight are ServiceTas choices made in the seam rather than the theme.
- **ServiceTas's `globals.css` restyles every radio app-wide,** so Ant's radios lose their
  border. That's the app's stylesheet (alpha.4 T1), not the form source.

### Would the component layer carry to native?

**Not as it stands, and only because of the `looks` (N1, N2).** Everything else is contract
boundaries, layout classes and the seam. With named text styles and group looks in the theme,
`looks` would move there and the layer would carry. NativeWind could draw `looks` as they are,
but then a native look would be the html look, chosen in the form source, which is what goal 5
rules out.

### For `forms-native`: what this form needs

**Boundaries and props:**
- `Form`.
- `Wizard`: `navigation="none"`, a bound `page`, `hidden`, items with `key` and `title`; plus
  `useWizard().next()`.
- `Section`: `title`, `className`.
- `Contents`: `title`, `hidden`, `clearHidden`, `className`, `shellClassName`.
- `InlineGroup`: prose with a link in it.
- `TextDisplay`: `text` as a node with a `Strong` inside, `heading`, `tone="error" | "info"`,
  `announce`, `hidden`, `textClassName`, `shellClassName`.
- `IconDisplay`: `icon`, `tone`.
- `DisplayOnlyField`: `label`, `startIcon`.
- `RadioField`: `options` with boolean values, `label` as a derived node, `helpText`, `hidden`.
- `CheckboxField`: drawn as a switch; `helpText`, `helpPlacement="labelEnd"`.
- `TextField`:
  - `hideLabel`, `readOnly`, `required`, `requiredMessage`;
  - `validate`, a function;
  - `placeholder`, `clearTo`;
  - `inputType="tel"`, `inputMode="tel"`, `autoComplete="tel"`.
- `Action`:
  - variants `primary`, `secondary` and `link`, a link also inline in prose;
  - `icon` with `iconPlacement="after"`;
  - `disabled` and `hidden` as derived values;
  - `disableType="global"`, and an async `onClick`.
- `Disclosure`: `title`.
- `useValidation()`: `check()` and `focusInvalid()`.

**Layout classes it depends on.** NativeWind has to carry these, or `layout` has to:
- `flex`, `flex-col`, `flex-row`, `flex-col-reverse`, `flex-wrap`, `flex-1`, `min-w-0`,
  `shrink-0`;
- `items-start`, `items-center`, `justify-between`, `justify-center`;
- gaps 5, 8, 10, 12, 15, 16, 20, 24, 40, 80 and 100px;
- `lg:flex-row`, `lg:items-center`, `lg:gap-[24px]`, `lg:max-w-[701px]`;
- `w-[70px]`, `mx-[20px]`, `pt-[7px]`, `py-[70px]`, `text-center`.

All are arbitrary-value Tailwind, because ServiceTas's spacing scale is customised. One
responsive reversal matters: the start page's `flex-col-reverse lg:flex-row` puts the image
first on a phone.

**Icons:** seven, by meaning, through the seam: next, external, refresh, warning, info, failed,
bullet.

**HTML strings:** none.

## 2. The worklist

| alpha.4 workaround | alpha.5 replacement | result |
|---|---|---|
| `PagesWizard` slot override | `<Wizard navigation="none">` | **Gone.** Fits exactly. |
| Pages gating with `useValidation().check()` and writing `step` | `useWizard()` | **Changed.** Only "Start task 1" uses `next()`. Every other move is decided by a server call after the check, and `next()` advances when the check passes (N4). The data layer keeps owning the step, and the bound `page` is how it moves the wizard. `useEoiWizard.ts`'s step logic didn't shrink. |
| A nested `<Form clearHidden>` around the identifiers | `clearHidden` on the group | **Gone.** It clears a switched-off identifier, while the callback block, bound to the same controls on three pages, keeps its values when hidden and shown again. Checked both. |
| `label` + `labelClassName={{ replace: "sr-only" }}` | `hideLabel` | **Gone.** Each identifier input is named by its hidden label. |
| `PageHeading` / `Subheading` as `<p>` | `TextDisplay heading`, `text.heading` | **Changed.** `Subheading` is a heading display. The page title had to become a `Section` title to sit above the groups in the outline (N3). |
| UVI help moved under its switch | `helpPlacement="labelEnd"` | **Gone, awkwardly.** On a checkbox the button lands after the switch (N6). |
| The plain-JSX `<details>` | `<Disclosure>` | **Gone.** The chevron is a theme pseudo-element (N11). |
| `async () => { await …; }` | return the promise | **Gone.** `checkDetailsAgain` returns `runSafe(…)` directly. |
| `[&>i]:…` button icon selectors | `action.iconClassName` / `variants[v].iconClassName` | **Gone.** Fits exactly. |
| `BulletValue`'s `before:` bullet | `DisplayOnlyField startIcon` | **Gone.** `displayOnly.icon` sizes it. |
| `QuestionRadio` slot override | `shellFor: { radio: … }` | **Gone.** Fits exactly. |
| `!`-prefixed radio and checkbox utilities | none expected (documented) | **Still needed**, as documented. It also beat the `ml-auto` the labelEnd workaround needed, which needed its own `!`. |

**Slot overrides remaining: none.** `ServiceTasFormProvider` is the theme and `htmlRenderers`,
18 lines.

**Sizes, before (alpha.4) → after:**

| file | before | after |
|---|---|---|
| `serviceTasTheme.tsx` | 127 | 179 |
| `ServiceTasFormProvider.tsx` | 69 | 18 |
| `components.tsx` | 372 | 345 |
| `platform.tsx` | — | 68 |
| the form (`EoiWizard.tsx`) + its web host (`EoiWizardV2.tsx`) | 119 (one file) | 79 + 60 |
| `steps/*.tsx` | 814 | 825 |

The theme grew by what moved into it: `shellFor`, the heading levels, `labelRow` /
`helpButton`, the disclosure and the action icon slots. The provider shrank by the two
overrides.

## 3. The new APIs in a real form

- **`navigation="none"` + a bound `page`.** Exactly right for a wizard whose pages a server
  decides. Pages not yet reached stayed silent; hidden pages didn't validate.
- **`useWizard()`.** `goTo(key)` is the right shape for a server-decided outcome, but here the
  outcome is decided in the data layer, outside the wizard, where `useWizard()` can't be called.
  So the hook writes the bound `page` instead, which works. `next()` is used once (N4).
  Related: with `navigation="none"`, `WizardPage.title` is required but never shown (keys would
  do).
- **`clearHidden` on a group.** Fits. One group that clears, in a form that doesn't, is exactly
  the case.
- **`hideLabel`.** Fits. The accessible name is the label, and nothing is drawn.
- **`TextDisplay heading`.** The outline came out right:
  - the site's `h1`;
  - each page title at level 2 (40px, the `section` title);
  - groups at level 3 ("What's involved", "Your name");
  - task-card titles and the missing-details count at level 4, or 3 where they sit directly in
    the page.

  The page title had to be a `Section`'s, though, because a heading display at the page's root
  takes the same level as the page's group titles (N3).
- **`helpPlacement="labelEnd"`.**
  - The help is the control's description, and the switch's name is exactly its label, with no
    "Help" in it (checked through the DOM's name and description).
  - The button is reachable by Tab, with `aria-expanded` and `aria-controls`.
  - The theme slots said the look (`labelRow`, `helpButton.className`, `helpButton.icon` as a
    Font Awesome info glyph). They couldn't say the order on a checkbox (N6), and the button's
    name is the same on every field (N7).
- **`<Disclosure>`.**
  - **A closed disclosure validates.** With a temporary required field inside, a refused Verify
    sent nothing and marked the toggle with its error dot.
  - **It neither opened nor focused**, because a page check doesn't (N5). After the page called
    `focusInvalid()` itself, the disclosure opened and the field took focus. All three gated
    actions now do that.
  - The `disclosure` slot reached everything the JSON accordion looked like, except the chevron,
    which is a theme `::after` (N11).
  - The toggle is a native `<summary>`, reachable by Tab.
- **Keyboard activation wasn't verified.** The browser tool's key presses don't activate even a
  plain `<button>` (a control test fired 0 clicks), so Enter / Space couldn't be tested here.
  Both controls are native elements (`<summary>`, `<button>`), and their mouse activation works.
- **`showCount`** isn't used by this form.

## 4. New gaps

### N1. A text display has one look

ServiceTas needs more than one look for text:
- body;
- lead (semibold 18px);
- a stat label (14px);
- a pill's value (bold 24px);
- a tag (bold 14px, primary);
- a chip (bold 18px);
- the task number (72px, green).

`HtmlTheme.text` has one `className`, plus `heading.levels` by outline level
(`theme.tsx:274`). A heading's size by level can't say "a card's title" against "a list's
title" either; this form happened not to need that. So each second style is `textClassName` in
the component layer.

- **Done instead:** the `looks` object in `components.tsx`.
- **Suggest:** `TextDisplay variant?: string`, resolved by the implementation from
  `text.variants[variant]` (as `shellFor` is keyed by widget). On native, the same key into
  `forms-native`'s theme. The form then names a role, never a look.

### N2. A group has one look (and a section another)

The grey card, the task card, the green-bordered callout, the pill and tag shells and the two
rules are all group or display shells with a background, border or radius. `contents` and
`contents.section` (`theme.tsx:159`) give two looks, and `section` is taken by the page.

- **Done instead:** `looks.card`, `taskCard`, `callout`, `pill`, `tag`, `chip`, `ruleTop` and
  `ruleBottom` as `className` / `shellClassName`.
- **Suggest:** `variant?: string` on groups and display shells, resolved from
  `contents.variants` / `displayShell.variants`. One mechanism with N1.

### N3. Nothing can come before a group's title, and a heading display can't take the group's level

The details page shows "Step 1 of 2" above its title. The start page shows, on a phone, the
boat image above it. A titled `Section` always draws its title first (`shared.tsx:155`, title
then body). A `TextDisplay heading` placed before the content takes "one below the titled group
it sits in" (`display.tsx:128`), the same level as the page's group titles when the page has no
titled group around it.

- **Done instead:** the page title is the `Section`'s. The pill moved under the title, and the
  start page's title sits above its image on a phone. Both are visible differences from the
  JSON version.
- **Suggest:** either a `GroupProps.header` drawn before the title, or a `heading` display that
  can be its group's own heading (`heading="group"`), giving the level a title there would take
  and letting other content precede it.

### N4. `useWizard().next()` checks and moves; nothing only checks

`next()` resolves to whether the page passed, but it has already moved on when it did
(`containers.tsx:455`). Here every page action but one checks the page, then calls MAST, then
goes wherever MAST's answer says.

- **Done instead:** `useValidation().check()`, then the data layer writes the bound `page`.
- **Suggest:** `WizardController.check()` (the page's check, with N5's focus), leaving
  `next()` / `goTo()` to move.

### N5. A page check never focuses a refused field

`ValidationScope.check()` (`validation.ts:96`) touches and reports. Only a `<Form onSubmit>`
calls `focusInvalid()` on refusal (`scope.tsx:222`). A page action refused by its check showed
its errors but left focus where it was. With the error inside a closed disclosure, nothing
visible happened at all: only the toggle's dot changed.

- **Done instead:** `else page.focusInvalid()` after each of three checks. That opened the
  disclosure and focused the field, which is right.
- **Suggest:** focus on refusal by default for a page's check, as `Form` does
  (`check({ focus: false })` to opt out). The wizard's own `next()` should do the same.

### N6. `labelEnd` help on a trailing-label widget lands after the control

For a checkbox the `<label>` wraps the control (`html.tsx:171`), and `labelRow` puts the help
button after that label (`html.tsx:136`). The row reads: text, switch, then the button. The JSON
form, and the other switches, put the switch at the far end.

- **Done instead:** `shellFor.checkbox.labelRow` flattens the label (`[&>label]:contents`) and
  reorders: text, then button, then switch with `!ml-auto`. It looks right, but the focus order
  (switch, then help) no longer matches the visual order (help, then switch), a WCAG 2.4.3
  problem the theme created.
- **Suggest:** for a trailing label with `labelEnd`, draw the label text with `htmlFor` (not
  wrapping the control), then the button, then the control.

### N7. Every help button has the same name

`aria-label={t.helpButton.text}` (`html.tsx:126`) is "Help" for every field (`theme.tsx:425`).
One per page here, but two would be two identical buttons to a screen reader.

- **Suggest:** name it from the field's label ("Help for Commercial vessel UVI"), as a theme
  template or `aria-labelledby` the button and the label.

### N8. No image boundary

Three images (the boat, the MAST logo, the licence-card diagram) needed `<img>`, so a seam.

- **Suggest:** an `ImageDisplay` (`source`, `alt`, `width` / `height`, `fit`) that `forms-html`
  draws as `<img>` and `forms-native` as `Image`. How a source names an asset across platforms is
  the design question.

### N9. No emphasis inside text

Six places bold one or more words inside a label or a sentence. `text` takes a node, and a node
on the web is DOM.

- **Done instead:** a `Strong` seam.
- **Suggest:** a contract `Emphasis` / `Strong` inline (or rich text as segments) so emphasis is
  form source, styled by the theme.

### N10. Two kinds of link, one `link` variant

The standalone "I've updated it, check again" link isn't underlined in the original; the inline
"profile page" link in prose is. `ActionVariant` is fixed at three (`theme.tsx:314`).

- **Done instead:** both underlined.
- **Suggest:** the variant mechanism from N1 / N2 for actions too, or a class the html
  implementation adds to an action inside an inline group (it already keys `[.rxf-inline_&]`).

### N11. The disclosure has no icon

The JSON accordion had a chevron that turns when open. `disclosure` has
`className` / `summary` / `content` / `invalidMarker`.

- **Done instead:** an `::after` Font Awesome glyph in `summary` that rotates under
  `[open]>&`.
- **Suggest:** `disclosure.icon` (a node, like `helpButton.icon`) drawn with `data-open` for the
  turn.

## 5. Visual parity

Compared at 1440×1000 and 375×812, the JSON version (`?path=mast-eoi`) beside v2
(`?path=mast-eoi-v2`), using `&step=N`. **Screenshots aren't attached:** the built-in browser
used for the run can't write files, so the comparison is recorded here as text. A Playwright
pass signed in to the same dev environment would capture them.

| page | 1440 | 375 |
|---|---|---|
| 1 Before you start | Matches; the title sits above the header row (N3) | No horizontal scroll. Title above the image, where the original puts the image first (N3). The 40px title wraps where the original's 32px did not. |
| — missing-details box (faked: no date of birth, a Victorian address) | Matches: count, chips, both buttons. The standalone link is underlined (N10). | — |
| 2 Personal details | Matches, except the step pill is under the title (N3) | Matches. v2's question cards pad less on a phone (`max-lg:p-[24px]`), so labels wrap less. |
| 3 Linking details | Matches the alpha.4 restyle; the UVI row has the info icon before its switch (N6) | No overflow; the UVI row holds its order |
| 4–9 | Unchanged from alpha.4's comparison apart from the page title | No overflow |

**Console.** Two things are ServiceTas's, appearing in both versions alike:
- the page-shell warning "Cannot update `PageContent` while rendering `Reactive`";
- repeated `console.log(undefined)` lines.

Nothing else apart from errors from the trial's own fetch guard.

## 6. Compat and the engine

- **Versions:**
  - `@rx-controls/forms-react` / `forms-html` / `forms-antd` pinned to `0.1.0-alpha.5`;
  - `@react-typed-forms/core` `^5.1.4` (11 declarations);
  - `@rx-controls/react` `^1.1.4`.

  Main then brought the same compat bump and `@astroapps/forms-core` 3.0.1; only the lockfile
  conflicted, and `rush update` resolved it.
- **The lockfile** holds one `@rx-controls/core@1.1.4` and one `@rx-controls/react@1.1.4`, with
  `forms-antd` and `antd@6.6.5` added.
- **`transpilePackages`** is still needed. With the engine packages taken out, `next dev`
  logged the duplicate-engine warning again, but only on a browser load: the same routes fetched
  with curl rendered with no warning. The warning's new text (`patch.ts:385`) names
  `transpilePackages` for "one file loaded twice by a bundler", and would have led straight to
  the fix. The config is back, with `forms-antd` added.

## 7. Against alpha.4

| alpha.4 suggestion | now |
|---|---|
| 1. `WizardProps.navigation: "none"` | **Fixed.** Plus `useWizard()`, with N4 and N5 left. |
| 2. A heading level on `TextDisplay` | **Fixed**, levels by place. N3 left. |
| 3. `clearHidden` on groups | **Fixed.** |
| 4. `hideLabel` / `accessibleName` | **Fixed** (`hideLabel`). |
| 5. Action icon classes; display-only icons | **Fixed** (both). |
| 6. `Disclosure`; `helpPlacement: "labelEnd"` | **Fixed**, with N6, N7 and N11 left. |
| 7. `onClick: () => unknown` | **Fixed.** |
| 8. Docs: T1, `transpilePackages`, `@rx-controls/react` as a dependency | T1 is in the `HtmlTheme` doc, and `transpilePackages` in the warning. The dependency note wasn't checked. |

**What alpha.4 got wrong.** It called the component layer "composed from contract displays and
groups" and the page classes "layout". The pages' classes were, but the component layer was
not:
- `Disclosure` and `PageBackdrop` were plain JSX;
- `faIcon` drew `<i>`;
- three `HtmlDisplay` strings carried markup, one an `<img>`;
- most components carried visual classes, not layout.

alpha.4 judged the layer by the look it produced, not by whether it would draw anywhere else,
so its "the look lives in a theme" verdict was true of the theme but not of the layer.
