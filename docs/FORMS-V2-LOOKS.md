# Forms v2 — looks

**Status: built, and shown to hold across the implementations.** A boundary is styled by a **name**, and each implementation's theme says what
the name looks like. This replaced the contract's class slots (`className`, `textClassName`,
`shellClassName`, `labelClassName`, `labelTextClassName`, and a radio's per-option three), which
are **retired** — Forms v2 had no real adopters, so they went outright, with no alias. The legacy
JSON loader turns each control's class slots into a look as it loads the form, and an offline step
(`rushx convert-looks`) can do it ahead of time (below).

The design documents carry it: GOALS decision 4, INTERFACES §2 and PLAN phase 11 (which also lists
what a consumer changes for the release).

**What has been shown, and what has not.** Shown: the 80-form local corpus, converted to named looks,
draws identically to the raw legacy forms under html (160 of 160 runs, and it was identical through
looks as through class slots before the slots were retired); the generated native table renders real
forms on an Android emulator; one look table drawn under html, native, MUI, Ant and Fluent reads as the
same design, including state and width; and a named look reaches all six field widgets in every
implementation. Not shown: native checked against the real ServiceTas app (a theme fixture restates it, but it has
not been compared to the app running), anything in a production app
(Forms v2 has no adopters yet), and the C# side (`look` is not in the server's schema). See "Not
built, and open" at the end.

## The idea in one paragraph

The contract carries a **name**. A boundary says `look="card"`, and nothing in `forms-react`
knows what a card is. Each implementation's theme maps names to its own kind of styling: class
strings on the web, React Native styles on a device, props and `sx` under a
component library. Beside the name sits a small, rare **escape hatch**: `style` and `shellStyle`,
CSS properties that mean the same on the web and on React Native.

## Why

- A class string is a web idea (or NativeWind's). `{ replace }` was in the contract only because
  legacy's `"@ "` prefix was.
- A renderer with no stylesheet should not need a Tailwind compiler: native resolves a look
  straight to a style object.
- A look added beside a base slot is resolved by stylesheet order for class strings, a hazard
  `forms-html`'s theme documents. A look given as styles is one resolved unit.
- The name channel already existed: `variant`, resolved per implementation from a theme. A look is
  that, on every boundary and reaching every part. `variant` is gone.

## The JSX

```tsx
<Group look="card" title="Details">
  <TextField look="compact" label="Name" field={c.fields.name} />
  <TextDisplay look="title1" text="Hello" />
  <Action look="quiet" onClick={save} text="Save" />
</Group>
```

`look` is a `FormProp` like every other prop, so it can be derived:
`look={(rc) => rc.getValue(c.fields.invalid) ? "danger" : "plain"}`. It is **one name or a list**,
layered in order — `look={["primary", "wide"]}` is the emphasis every theme draws with a look of
the form's own over it. Layering is part by part, a later name over an earlier. In html and native
that is classes added or styles merged, with `{ replace }` dropping what came before; in MUI, Ant and
Fluent, whose looks are the library's own props and styles, each prop a later name gives replaces the
earlier's and styles (`sx` in MUI) are laid in order — they have no `{ replace }`. It is on every boundary that draws: fields, groups, displays, actions,
collections, tabs, wizards, dialogs and disclosures.

**It is typed by augmentation.** An app declares the names it has once, and a typo is a compile
error everywhere:

```ts
declare module "@rx-controls/forms-react" {
  interface FormLooks { card: true; compact: true; quiet: true; title1: true }
}
```

With nothing declared, `look` is a plain `string`, which is what the JSON loader and a quick
prototype use.

**A look names an element's whole appearance**, every part of it: for a field, the shell, the
control, the label and its text. The author never says which part. The theme does.

**No cascade.** A look styles the boundary it is on, not its descendants. React Native has no
cascade, and a look written for one platform has to mean the same on the other.

**An action's emphases are looks.** `primary`, `secondary`, `link` and `group` are looks every
implementation ships; `secondary` is the default and the fallback for an action's unknown name.
`group` draws **no button**: the action is a pressable wrapper around its children — legacy's
`actionStyle: "Group"`, which had its own `groupClass` and none of the button's chrome. (Found on a
device: the loader had mapped it to `primary`, so a card drew as a blue slab with the card on it.)

### The escape hatch

For the rare one-off, a boundary takes CSS:

```tsx
<Group look="card" style={{ paddingTop: 24, borderColor: "$danger" }}>
<TextDisplay shellStyle={{ flexGrow: 1 }} … />
```

- `style` styles the boundary's **control** element (a group's body, an action's button, a
  field's input) and `shellStyle` the **shell** (what sits in the parent). Everything else
  about a part is the theme's.
- **It is a portable subset of CSS**, the properties that mean the same on web and native
  (below). A property outside it is a type error. It is `FormProp<PortableStyle>`, so it can
  be derived.
- **Text properties follow the text.** `color`, `fontSize` and the rest of the text group go on
  the *words*, not the container: on the web that is the same element or inheritance, on React
  Native the implementation routes them to the `Text` (`splitPortableStyle`).
- It is applied **after** the look, so it wins — over *every* part of the look, not only the part
  it styles: a text property in `style` beats the look's `text` part too.

#### The portable subset

The rule is React Native's own `style` semantics, which `react-native-web` already implements
on the web, so the bridge is proven rather than invented.

| group | properties |
|---|---|
| flex layout | `display` (`flex` / `none`), `flexDirection`, `flexWrap`, `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `alignItems`, `alignSelf`, `alignContent`, `justifyContent`, `gap`, `rowGap`, `columnGap` |
| box | `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, `margin*`, `padding*`, `aspectRatio`, `overflow`, `position` (`relative` / `absolute`), `top`, `right`, `bottom`, `left`, `zIndex` |
| surface | `backgroundColor`, `opacity`, `border*Width`, `border*Color`, `borderStyle`, `borderRadius` and corners, `boxShadow` |
| text | `color`, `fontSize`, `fontWeight`, `fontStyle`, `fontFamily`, `lineHeight`, `letterSpacing`, `textAlign`, `textDecorationLine`, `textTransform` |

Values follow React Native: a **number is a logical unit**, a string is a `%` or a colour.
"Logical unit" is deliberate: React Native's density-independent units and CSS's reference pixels
are both nominally 1:1 and neither fixes a physical size, so one number serves both. Three rules
keep it honest, and html's `portableCss` applies them:

- **Box model.** React Native is always `border-box`, so html sets `box-sizing: border-box` on a
  styled element, and draws a border that has a width and no style as `solid`, as React Native does.
- **Text scales with the user.** React Native text follows the OS font setting; a CSS `px` font
  size ignores the browser's. So html emits `px` for layout and **`rem` for `fontSize`,
  `lineHeight` and `letterSpacing`** (16 is `1rem`), as legacy's `rem`-based classes did.
- **Every view is a flex container.** On React Native `gap`, `justifyContent` and
  `flexDirection: "row"` just work; on the web an element is a block and they are ignored. So html
  makes an element given any flex-container property a `display: flex` **column** unless it says
  otherwise (and leaves one with none a block).

Not in the subset, because they do not mean the same: `grid`, selectors, media queries, `:hover`,
`calc()`, `var()`, `whiteSpace`, `display: block`. Those are a theme's to write in its own terms —
a look.

**Colours** may be a literal or a theme token, `"$accent"` (and `"$accent/10"` for that colour at
10%, for a `#rgb` / `#rrggbb` token), resolved from the theme's `tokens.colors` — html's and
native's each. A token the theme lacks is reported once and the colour left out.

## The theme

Each implementation's theme has a `looks` table. The *shape of the value is the renderer's own* —
only the names are shared.

```ts
// forms-html
looks: Record<string, HtmlLook>   // parts are class strings, portable styles (inline, state
                                  // passed as data), a function of state, or { replace }
// forms-native
looks: Record<string, NativeLook> // parts are portable styles,
                                  // a function of state (incl. `width`), or { replace }.
                                  // Style-only: `src/styleProps.ts` is the one adapter
                                  // point a NativeWind build could bridge through
// forms-mui / -antd / -fluent: a *LooksProvider of the library's own props, `sx` or style, per kind
//   (a field's parts are `shell` / `label` / `control` / `text`; see "Field looks" below)
```

**The parts**, named for the elements they style:

| part | the element |
|---|---|
| `shell` | what sits in the parent: a field's shell, a group's wrapper |
| `control` | the control; a group's body; an action's button |
| `text` | the element's words |
| `label` / `labelText` | a label's container and its words (one element on the web, so both land on it) |
| `icon` | around an action's icon |
| `entry` / `selected` / `notSelected` | a radio's option wrapper, and its two states |

That is html's and native's part set. MUI, Ant and Fluent name fewer parts, in their own terms: a
field's are `shell` / `label` / `control` / `text`, a group's `wrapper` / `title` / `body` (below).

`control` and `text` stay two parts because on React Native text styles do not cascade from a
`View`: the words need their own. A web implementation merges them onto one element where the
markup has one.

- A string part is **added** to the implementation's own classes for that element.
- `{ replace }` stands in for them — and for any part of an earlier look in a list. It is legacy's
  `"@ "`, in the theme where it belongs.
- A group's `control` is the body's layout, and replaces the theme's default layout.
- A part may be a **function of the element's state**, in every implementation. State is data the
  implementation passes in (`LookState`: `invalid`, `disabled`, `focused`, `pressed`, `hovered`,
  `width`), so a look never needs a variant a platform lacks (`active:` on the web, a pressed callback
  on a device). What each fills in: html and native, the element's own state (a field's `invalid` /
  `focused` / `disabled`, an action's `pressed`, html's `hovered`) and `width`; MUI, Ant and Fluent,
  `width` everywhere and `invalid` on a field — their components do hover and focus themselves.
  `width` is tracked only while some part of a look is a function, and is `0` before it is read and on
  the server, the narrowest.

```ts
const htmlLooks = {
  card:   { control: "border border-accent p-[16px] flex flex-col gap-[12px]" },
  quiet:  { control: "p-0", text: "!text-accent underline" },
};
const nativeLooks = {
  card:   { control: { borderWidth: 1, borderColor: "$accent", padding: 16, gap: 12 } },
  pill:   { control: (s) => ({ backgroundColor: s.pressed ? "$danger" : "$accent", borderRadius: 999 }),
            text: { color: "#fff" } },
};
```

## A form's own looks

A look need not live in a theme. **A form can bring its own**: `ClassLooks`, the parts as classes,
provided through `FormLooksProvider`. An implementation looks a name up in its theme's looks first
and the form's second, so a host restyles a name a form brought by defining it. Only an
implementation that styles with classes — html alone — can draw one (native warns once per name that class looks are not drawn;
the conformance suite's `classLooks` limit);
MUI, Ant and Fluent do not warn about a name the form brought, since it is not a mistake that they
cannot.

This is what the JSON loader uses.

## Resolution

1. The boundary resolves `look`, `style` and `shellStyle` in its own tracking window and hands the
   implementation the **names and objects**, not classes.
2. The implementation finds each name in its theme's looks, then the form's. A name neither has
   draws the base look, with a development warning once per kind and name.
3. For each part: the implementation's base styling, then the look's part (added, or `replace`),
   layered in order for a list, then the boundary's `style` / `shellStyle`.
4. On the web an element of the boundary carries `data-look="name"` (the control, the shell or a
   library's inner row — not always the outermost), so the name is a hook for a host's own stylesheet.

## Legacy conversion

A legacy control has up to five class strings (`styleClass`, `textClass`, `layoutClass`,
`labelClass`, `labelTextClass`) and a radio three more (`renderOptions.entryWrapperClass`,
`selectedClass`, `notSelectedClass`). The loader turns them into **one look**, per form, as it
loads it:

- **Group by canonical key.** `legacyLookKey(kind, slots, labelled)`: the definition's `type` and
  the slots, each canonicalised (trim, de-duplicate, sort tokens, keep the `"@ "` marker). The same
  classes in another order are one look; a replace is not a merge.
- **Name it by its content.** `legacyLookName`: a lone typography slot is its own classes
  (`textClass: "body"` is `body`); anything else is `look-` and a 12-digit hash of the classes. The
  same classes are the same name in every form and every run, so there is nothing to coordinate.
- **Carry the classes verbatim** — no parsing, no rounding (`legacyLook` returns the parts). The
  loader collects them per translation and returns them as `TranslateResult.looks`; `JsonForm`
  mounts them under a `FormLooksProvider`.
- **An action** gets `[emphasis, look]`: its `actionStyle` and its classes are both looks.

### Pre-conversion: forms that name their looks

Deriving at load is the **bridge**: it lets a legacy form straight from the server draw. The
destination is a form that already names its looks, with a table per renderer:

```json
{ "type": "Data", "field": "name", "title": "Name", "look": "field-highlight" }
```
```
looks.html.json    { "field-highlight": { "control": "p-[16px] bg-white", "text": "text-accent underline" } }
looks.native.js    export const looks = { "field-highlight": { control: {"padding":16,"backgroundColor":"#ffffff"}, … } }
```

`rushx convert-looks` (`tools/forms-corpus`) writes both from legacy JSON, under the gitignored
`corpus/converted/`: each form with its class slots gone and `look` set, the **html** table with
the classes verbatim, and the **native** table as a generated module — portable styles, and for
a utility that depends on state or the window (`lg:flex-row`, `active:bg-…`) a function of
`LookState`, which is why it is code and not JSON. The control JSON carries only the name; what a
name draws is each renderer's table, so nothing is shared at runtime but the names.

- **Names** are the loader's content-addressed ones unless `corpus/looks/names.json` maps one to a
  name you prefer — which is where `look-3fa9…` becomes `card`.
- **The host's own classes** (ServiceTas's `title1`, `body`) come from `corpus/looks/classNames.json`:
  a class → portable style map the converter reads, since they are not utilities.
- **What cannot be expressed** (child selectors `[&>*]:`, `grid`, `w-fit`…) is reported by token in
  `corpus/converted/report.md`; hand-write those in `corpus/looks/native-overrides.json`. Colour
  tokens the native theme must define are listed too.
- **The loader** reads `look` off a control and uses it instead of deriving; a control that names
  its look needs no `TranslateResult.looks`, since the host's theme defines the name. `look` is not
  in the canonical `forms-schema` types or the C# server's yet — when it moves there, the sidecar
  needs no change, only the names do.
- **Gated:** `rushx converted-check`, part of `rushx gates`, draws every form raw and converted
  under html and requires identical markup (look names aside; class order and React's generated
  ids are normalised), requires the native module to load and every part to evaluate, and ratchets
  the count of class tokens native cannot express.

The converter is a table of the utilities the corpus uses (`tools/forms-corpus/src/convert/tailwind.ts`),
not a Tailwind compiler: it lives in tooling so `forms-native` stays style-only and never sees a
class. `rushx extract-looks` remains for combining looks across forms without rewriting them.

**Measured on the local corpus** (80 forms, 2,976 controls with class slots): 508 distinct looks;
the most-used 100 cover 76% of uses and 240 are used once. Before the class slots were retired,
every one of 160 runs (80 forms under the default and the Tailwind theme) drew the **same markup**
through looks as through class slots, with 3,814 elements naming a look. `rushx looks-check`, part
of `rushx gates`, now draws every form through the loader and fails on anything printed to the
console or on a run that names no look.

What a look needed that a class slot did not, found by that comparison: a part that can say
`{ replace }` (a third of legacy's slots use `"@ "`); `look` on every boundary the loader styles,
containers and collections too; a **list** (an action has an emphasis *and* classes); a group's
`control` as the body's layout; and a fix for three class slots html had silently dropped
(`textClassName` on a text field and a select, `className` on a checkbox, `textClassName` beside
`className` on a display-only value).

## What the build found

- **The author's style has to be resolved apart from the look's parts**, then laid over all of
  them. Resolving it with the `control` part let a look's `text` part override the author's text
  properties.
- **A look that styles an action's shell adds a wrapper element** on native, where the button has
  none, so toggling that styling at run time changes the tree and remounts the button. Open: draw
  the wrapper always, or only when styled.
- **A prop named `shellStyle` already existed** inside `forms-html/shared` (a tone's colour from
  tokens); it is now `toneStyle`.
- **On Android**, `invalid` and `width` reaching a look were re-checked on an emulator after
  NativeWind was removed (the portable-looks screen: an invalid border, a group that flips at 686 dp).
  Press and focus reaching a function look, and text properties reaching a `TextInput`, were checked
  before the removal and not since — re-check them on a device.
- **Responsive is state**, not syntax: `LookState.width` (0 = SSR / unknown, so narrowest first).
  Portable looks on the web are inline styles with state as data; hover, focus rings and
  breakpoint-heavy styling belong in a class look in the theme.
- **NativeWind is gone** from `forms-native`; a class-based native build, if wanted, is a separate
  package bridging through `styleProps.ts`. Not built.
- **The parity gate's environment mattered.** With no DOM at load, an asynchronous
  `AllowedOptions` expression's pending interval went unobserved and hid a clear-on-move bug on
  the JSON path; the gate now loads a DOM first, and the loader turns `restrictToOptions` off.
- **Suites resolve a package's built `lib/`**, so a suite edit (`tools/forms-conformance`) shows in
  another package's tests only after that package is rebuilt.

## One look table, five implementations

`rxc-forms-conformance/portable` holds one form (`PortableLooksDemo`) and one look table of portable
styles (`portableLooks`), written once. Storybook draws it under every implementation
(`Boundaries/Portable looks`; html and native from the portable table, MUI, Ant and Fluent from the
same names mapped by hand) and the native playground draws the same source on a device (the
**Portable** screen), so one look can be compared across them. It was first compared as html against
native, which is what the first findings below are about. It covers a card (border, radius, padding, gap), a tag (token colours with
alpha, text transform, letter spacing), a field whose border is a function of `focused` / `invalid`, a
pill button that is a function of `pressed`, a row (`flexDirection`, `justifyContent`, wrap) and a group
that is a function of `width`. Compared at 411 px, and at 700 px / 686 dp, html and native agree, with
these findings:

- **A flex container on the web.** Every React Native view is a flex column, so `gap`, `justifyContent`
  and `flexDirection: "row"` just work there; on the web an element is a block and they are silently
  ignored. `portableCss` now makes an element given any flex-container property a `display: flex`
  column unless it says otherwise (a test pins it). Found by this comparison: the card had no gaps and
  a row stacked on the web.
- **Placement belongs to the parent.** A child's own `alignSelf` / `flex` reaches the flex item on a
  device, but on the web a wrapper (the visibility wrapper around every boundary) is the item, so the
  same style does nothing. Write `alignItems` on the parent instead, as the demo does; that holds on
  both. Whether the html wrappers should become transparent to layout (`display: contents`, which the
  fade transition rules out) is open.
- **Theme chrome is not a look.** Fonts, the title's margin and the error colour differ because the two
  default themes differ, not because a look was read differently. The default html theme, with no
  stylesheet, also lets the browser's input and button chrome show; the Tailwind theme is the one to
  compare.

### Field looks under MUI, Ant, Fluent and native

Every implementation takes a named look on all six field widgets — text field, select, radio group,
check list, checkbox, display-only — in its own terms. MUI, Ant and Fluent take four parts (html and
native take those and more, above):

| part | the element |
|---|---|
| `shell` | what wraps label, control and message (MUI `FormControl`, Ant `Form.Item`, Fluent `Field`) |
| `label` | the label |
| `control` | the widget's own element: the text frame, the select, the option group, the box, the value |
| `text` | its words: the input's text, an option's label, the value |

- **MUI** `MuiLooks.field[name]` — each part MUI's `sx`, so a look reaches the theme (`(t) => …`) and
  the component's states (`"&.Mui-focused fieldset"`, `"&.Mui-error fieldset"`).
- **Ant** `AntdLooks.field[name]` — each part a style, or a function of the tokens and the state.
- **Fluent** `FluentLooks.field[name]` — each part a style, or a function of the state; Fluent's
  tokens are CSS values, usable as they are.
- **Native** — the theme's `looks` (`NativeLook`), the same parts as html. Every field widget passes
  its look and `shellStyle` to its shell and reads `control` and `text`.

A field hands its look to the shell and the frame over a small context in MUI, Ant and Fluent, as it
already hands over MUI's label for the outline's notch: the pair are components the field does not own.

**State reaches a look in every implementation.** A part that is a function is handed the same
`LookState` everywhere (`width`, the window's, tracked only while a look asks for it; `invalid` where
the widget knows it): `(theme, state)` in MUI, `(tokens, state)` in Ant, `(state)` in Fluent, as html's
and native's already were. So one look — "a row from 600 wide" — is written the same way for all five,
with no breakpoint syntax in the look and none in the format. MUI's `sx` keeps its own breakpoints and
states (`&.Mui-focused`) beside it, and Ant's and Fluent's controls their own hover and focus.

The shared portable-looks story draws one form (every widget above) under all five implementations —
html and native from one table of portable styles, MUI, Ant and Fluent from the same names mapped by
hand. They are recognisably the same design; what differs is each library (MUI's floating outlined
label and button elevation, Ant's and Fluent's own control chrome), and the responsive group flips at
600 wide under all five (checked at 411 and 700 px, and on the device at 686 dp).

Found on the way: Ant's frame drew its border with the `border` shorthand, so a look setting only
`borderWidth` made React warn about shorthand mixed with its parts (the frame now uses longhands); and
Fluent's action dropped a look's `style` behind the button's own `style` prop.

## Not built, and open

- **Running the converter in ServiceTas's publish step**, and a `Look` field in the C# schema; until
  then a raw legacy form's class looks are warned and skipped on native, and the loader's runtime
  derivation stays as the bridge.
- **State on a field in MUI, Ant and Fluent** beyond `width` and `invalid`: `disabled`, `focused`,
  `pressed` and `hovered` do not reach their function parts (the components style those themselves).
  A look that must read them needs them passed in.
- **Text and action looks in MUI** are `sx`, MUI's own type, so a function there gets the theme only,
  not the look's state; MUI's `sx` has its own breakpoints for that.
- **Class looks on native.** A form that brings class looks (the runtime-derived path) draws them
  nowhere but html: native warns once per name and skips them. Pre-conversion is the way across, and
  25 corpus class tokens (child selectors, `grid`, `w-fit`, …) are not expressible on native yet.
- **Placement across the web's wrappers**: a child's own `alignSelf` / `flex` does not reach the flex
  item behind a visibility wrapper (see above); whether those wrappers become transparent to layout is
  undecided.
- **Fidelity to the real app.** `forms-native` has a ServiceTas theme fixture
  (`test/fixtures/serviceTasTheme.ts`, restating `defaultRNRenderOptions` over schemas-rn's base and
  `global.css`'s typography, as html's restates the web options), and the playground draws the converted
  forms under it with Nunito loaded. It is restated from source, not compared against the app running:
  no screenshot of the real app has been set beside it, so two choices (an input's padding, the focus
  colour) are ours and marked, and anything the source does not state is the default theme's.
- **Group `layout`**: the typed flex body overlaps with the portable flex properties and probably
  folds into them.
- **Structural names** for layout-only looks (`col-gap-16`) instead of a hash.
