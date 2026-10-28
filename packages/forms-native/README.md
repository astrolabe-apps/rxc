# @rx-controls/forms-native

The React Native implementation of Forms v2: every registry slot of
[`@rx-controls/forms-react`](https://www.npmjs.com/package/@rx-controls/forms-react)
drawn with React Native's own components, styled with React Native `style`
objects. The same form source that draws under
`forms-html`, `forms-mui`, `forms-antd` and `forms-fluent` draws here.

**An alpha**, published on the npm `alpha` dist-tag with the other Forms v2
packages: `npm install @rx-controls/forms-native@alpha`.

**Upgrading?** Each Forms v2 release's [changelog](https://github.com/astrolabe-apps/rxc/blob/main/docs/FORMS-V2-CHANGELOG.md)
lists what you change first.

## Requirements

- React Native **0.86** or later (Expo 57), on React 19.2.
- One copy each of React, React Native and `@rx-controls/core` in the bundle
  (see Metro, below).

```bash
npm install @rx-controls/forms-native@alpha @rx-controls/forms-react@alpha \
  @rx-controls/react @rx-controls/core
```

There is nothing to configure for styling: no Babel preset, no Metro wrapper,
no stylesheet. The package styles every element with React Native `style`
objects.

## Setup

### The renderers, and a theme

```tsx
import { ControlContextProvider, createControlContext } from "@rx-controls/react";
import { Form, FormProvider, TextField } from "@rx-controls/forms-react";
import { NativeThemeProvider, nativeRenderers } from "@rx-controls/forms-native";

const ctx = createControlContext();

export function App() {
  return (
    <ControlContextProvider value={ctx}>
      <FormProvider renderers={nativeRenderers}>
        <NativeThemeProvider theme={{ checkbox: { control: "switch" } }}>
          <Form onSubmit={save}>
            <TextField field={name} label="Name" required />
          </Form>
        </NativeThemeProvider>
      </FormProvider>
    </ControlContextProvider>
  );
}
```

`NativeThemeProvider` is optional: with none, `defaultNativeTheme` applies. A
theme is a set of React Native styles, one slot per element and state — a
`ViewStyle` for a container, a `TextStyle` for words — given partially and
nesting; a style slot given replaces the enclosing theme's whole. An element's
styles are layered as `[theme slot, look part, the author's style]`, the later
winning, and a state slot (a frame's `focused` / `invalid` / `disabled`, a
tab's `active`) is applied after its base.

**Named looks.** A form names a look and the theme says what it looks like. A
look is a table entry whose parts (`shell`, `control`, `text`, `label`,
`labelText`, `icon`, and a radio's `entry`, `selected`, `notSelected`) are
styles, or functions of the element's state (`invalid`, `disabled`, `focused`,
`pressed`, and the window's `width`; `hovered` is always false on a device):

```tsx
<NativeThemeProvider
  theme={{
    tokens: { colors: { accent: "#1d4ed8" } },
    looks: {
      lead: { control: { fontSize: 18, fontWeight: "600" } },
      card: { shell: { borderRadius: 8, backgroundColor: "#f3f4f6", padding: 16 } },
      quiet: { control: { backgroundColor: "transparent" }, text: { color: "$accent" } },
      // a colour token, and a function of the element's state
      pill: {
        control: (s) => ({
          backgroundColor: s.pressed ? "$accent/80" : "$accent",
          borderRadius: 999,
          paddingHorizontal: s.width >= 600 ? 32 : 16,
        }),
        text: { color: "#fff", fontWeight: "bold" },
      },
    },
  }}
>
```

```tsx
<TextDisplay text="Before you start" look="lead" />
<Action actionId="go" text="Go" look="pill" />
```

The three emphases every theme draws for an action — `primary`, `secondary`,
`link` — are looks in the same table. A part given as `{ replace }` stands in for
the theme's own styling of that element (and any earlier look's) instead of
layering over it. For a rare
one-off a boundary also takes `style` and `shellStyle`: a portable subset of CSS,
laid over the look. See `docs/FORMS-V2-LOOKS.md`.

The slots are named as `forms-html`'s are where the two draw the same thing — a
group's `wrapper`, `title` and `body`, a field's `shellFor` — so a theme's roles
carry across with only their styling rewritten.

**Shells per widget.** `shellFor` merges slots over `shell` for one widget's
shell, keyed by its `FieldShellProps.widget` (`radio`, `checkbox`, a
third-party widget's own name), as html's does:

```tsx
<NativeThemeProvider
  theme={{
    shellFor: {
      radio: { style: { gap: 8, borderRadius: 8, backgroundColor: "#f3f4f6", padding: 16 } },
      checkbox: { label: { flexShrink: 1, fontSize: 18, fontWeight: "bold" } },
    },
  }}
>
```

**Flex items don't shrink.** On the web a flex item shrinks to fit by default;
in React Native `flexShrink` is 0, so a long text beside something else in a
row runs off the screen or out of its button. The default theme's own row
children shrink — a label, a label row, a button's text — and a theme that
replaces those slots should keep `flexShrink: 1` in them. A row in a look needs
`flexShrink: 1` on the child that should give way.

### Metro in a monorepo

Linked workspace packages resolve React and React Native from their own
`node_modules`, and two copies in one bundle break every hook. Resolve those to
the app's own wherever the import comes from:

```js
const single = ["react", "react-native"];
config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    single.some((p) => moduleName === p || moduleName.startsWith(p + "/"))
      ? { ...context, originModulePath: path.join(__dirname, "package.json") }
      : context,
    moduleName,
    platform,
  );
```

**The form's own looks are not drawn.** `useFormLooks()` — what the JSON loader
derives from a legacy control's class slots — is class-valued, which native
does not draw. A boundary naming such a look that the native theme lacks is
reported once per name in development; name it in `theme.looks` as styles.

**Styling is one seam.** Every element gets its styling through `src/styleProps.ts`
(`sp(theme slot, look part, own style)` returns the props to spread — here
`{ style: [...] }`), so a build that also draws classes, such as one over
NativeWind, swaps that module and nothing else.

## What differs from the web

Three things React Native has no element for. The shared conformance suite
holds this package to what it does instead:

- **A dialog moves its content across opening.** React Native's `Modal` mounts
  its content only while visible. Closed, the content is mounted in place and
  hidden, still validating; values survive, but a widget's own state (focus)
  does not.
- **No form element.** A `<Form onSubmit>` submits through its submit action,
  and through the keyboard's submit key in a single-line field.
- **`HtmlDisplay` draws its markup's text.** An app that needs rendered HTML
  replaces the `html` slot (with `react-native-render-html`, say).
  `RichText` is not HTML: its inline subset (emphasis, links, super- and
  subscripts, images) draws natively.

**Images** need a size on React Native. An `ImageDisplay` given only a width
keeps its proportions from the image itself. A bundled asset is a `require`,
supplied from a `.native.ts` module beside the web's:

```ts
// assets.ts            export const boat = "/img/boat.png";
// assets.native.ts     export const boat = require("./boat.png");
```

**Dates** (`TextField` with `inputType="date"`, the ISO date `2024-03-05` as its value) draw as a read-only
`dd/mm/yyyy` box and a button, either of which opens a picker. The picker is a native module, so the host
supplies it in the theme, and without one the date is typed as text:

```tsx
import DateTimePickerModal from "react-native-modal-datetime-picker"; // or any picker
const picker: DatePicker = ({ visible, value, onConfirm, onCancel }) => (
  <DateTimePickerModal isVisible={visible} mode="date" date={value ? new Date(value) : new Date()}
    onConfirm={(d) => onConfirm(d.toISOString().slice(0, 10))} onCancel={onCancel} />
);
<NativeThemeProvider theme={{ date: { picker } }} />
```

(`apps/native-dev` has one over `@react-native-community/datetimepicker`.)

**Accessibility** is set for both of React Native's targets: a string
`aria-label` and `accessibilityHint` on native, and `aria-labelledby` /
`aria-describedby` by id on the web (react-native-web). A label or help that is
a node is flattened to its words for native's string name.

## One form source for the web and native

The same page component can draw under `forms-html` on the web and under
`nativeRenderers` on a device, copied byte for byte. What the ServiceTas trial
needed for that:

- **A page imports a model, not its data layer.** The page's types, keys and
  actions live in a small module of their own (`eoiModel.ts`: the page keys,
  the form data's shape, the actions as functions that answer). The data layer
  implements it and hands it in. A page that takes its type from the data
  layer (`ReturnType<typeof useWizardData>`) drags in the API clients and
  generated schemas with it, and won't type-check or bundle anywhere else.
- **What differs by platform sits behind one seam.** Icons and image sources
  are the usual difference: a `platform.tsx` the web uses and a
  `platform.native.tsx` beside it, which Metro picks by itself. Type the native
  maps against the web's, so a name missing on one platform is a type error:

  ```ts
  // platform.native.tsx
  import type { icons as webIcons } from "./platform";
  export const icons = {
    next: "→",
    warning: "⚠",
  } satisfies Record<keyof typeof webIcons, unknown>;
  ```

- **Looks are roles, so the theme carries them.** The form names `look`s
  (`pageTitle`, `taskCard`), and each platform's theme says what they look
  like: an html theme and a `NativeTheme` with the same names. The slot names
  match where the two draw the same thing, so the port is the styling.
- **A row in a look needs `flexShrink: 1`** on the child that should
  give way (see "Flex items don't shrink", above).
