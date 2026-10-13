# Forms v2 — looks

**Status: built.** A boundary is styled by a **name**, and each implementation's theme says what
the name looks like. This replaced the contract's class slots (`className`, `textClassName`,
`shellClassName`, `labelClassName`, `labelTextClassName`, and a radio's per-option three), which
are **retired** — Forms v2 had no real adopters, so they went outright, with no alias. The legacy
JSON loader turns each control's class slots into a look as it loads the form.

## The idea in one paragraph

The contract carries a **name**. A boundary says `look="card"`, and nothing in `forms-react`
knows what a card is. Each implementation's theme maps names to its own kind of styling: class
strings on the web, React Native styles or NativeWind classes on a device, props and `sx` under a
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
the form's own over it. It is on every boundary that draws: fields, groups, displays, actions,
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

**An action's emphases are looks.** `primary`, `secondary` and `link` are looks every
implementation ships; `secondary` is the default and the fallback for an action's unknown name.

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
are both nominally 1:1 and neither fixes a physical size, so one number serves both. Two rules
keep it honest, and html's `portableCss` applies both:

- **Box model.** React Native is always `border-box`, so html sets `box-sizing: border-box` on a
  styled element, and draws a border that has a width and no style as `solid`, as React Native does.
- **Text scales with the user.** React Native text follows the OS font setting; a CSS `px` font
  size ignores the browser's. So html emits `px` for layout and **`rem` for `fontSize`,
  `lineHeight` and `letterSpacing`** (16 is `1rem`), as legacy's `rem`-based classes did.

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
looks: Record<string, HtmlLook>   // parts are class strings, or { replace }
// forms-native
looks: Record<string, NativeLook> // parts are NativeWind classes, React Native styles,
                                  // a function of state, or { replace }
// forms-mui / -antd / -fluent: a *LooksProvider of the library's props, `sx` or style, per kind
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

`control` and `text` stay two parts because on React Native text styles do not cascade from a
`View`: the words need their own. A web implementation merges them onto one element where the
markup has one.

- A string part is **added** to the implementation's own classes for that element.
- `{ replace }` stands in for them — and for any part of an earlier look in a list. It is legacy's
  `"@ "`, in the theme where it belongs.
- A group's `control` is the body's layout, and replaces the theme's default layout.
- Native's parts may be a **function of the element's state** (`invalid`, `disabled`, `focused`,
  `pressed`). State is data the implementation passes in, so a look never needs a variant a platform
  lacks (`active:` on the web, a pressed callback on a device).

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
implementation that styles with classes — html, and React Native under NativeWind — can draw one;
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
4. On the web the outermost element of a boundary carries `data-look="name"`, so the name is a
   hook for a host's own stylesheet.

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

Combining many forms' looks is an offline step, for translating to JSX or a new JSON format:
`rushx extract-looks` (`tools/forms-corpus`) writes each form's looks and their union under the
gitignored `corpus/looks/`, with `names.json` to rename.

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
- **On Android, under real NativeWind**, `style` and `className` combine, a function-of-state look
  tracks press and focus, and text properties given on a control reach its `TextInput`. Checked on
  an emulator, not a device.
- **The parity gate's environment mattered.** With no DOM at load, an asynchronous
  `AllowedOptions` expression's pending interval went unobserved and hid a clear-on-move bug on
  the JSON path; the gate now loads a DOM first, and the loader turns `restrictToOptions` off.
- **Suites resolve a package's built `lib/`**, so a suite edit (`tools/forms-conformance`) shows in
  another package's tests only after that package is rebuilt.

## Not built, and open

- **html resolving a *portable* look** (a look written once as CSS, used on every renderer), with
  a breakpoint or pressed state: a build-time `looksToCss`, or an injected `<style>`. Today html's
  looks are class strings, and its `style` is inline.
- **Native output of the converter**: turning the utilities into styles (a Tailwind compile over
  the host's config, probably), so a legacy form draws without NativeWind.
- **Looks on fields under MUI, Ant and Fluent, and on every native widget but the text field**;
  they accept `look` and ignore it.
- **State on a field**: whether `invalid` / `disabled` reach a look automatically, or only when it
  asks (a function of state). Today native passes them; html relies on its `data-*` attributes.
- **Group `layout`**: the typed flex body overlaps with the portable flex properties and probably
  folds into them.
- **Structural names** for layout-only looks (`col-gap-16`) instead of a hash.
