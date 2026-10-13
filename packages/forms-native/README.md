# @rx-controls/forms-native

The React Native implementation of Forms v2: every registry slot of
[`@rx-controls/forms-react`](https://www.npmjs.com/package/@rx-controls/forms-react)
drawn with React Native's own components, styled through
[NativeWind](https://www.nativewind.dev/). The same form source that draws under
`forms-html`, `forms-mui`, `forms-antd` and `forms-fluent` draws here.

**An alpha**, published on the npm `alpha` dist-tag with the other Forms v2
packages: `npm install @rx-controls/forms-native@alpha`.

## Requirements

- React Native **0.86** or later (Expo 57), on React 19.2.
- NativeWind **4.2**, on Tailwind CSS **3.4** (NativeWind 4 does not run on
  Tailwind 4).
- One copy each of React, React Native, NativeWind and `@rx-controls/core` in
  the bundle (see Metro, below).

```bash
npm install @rx-controls/forms-native@alpha @rx-controls/forms-react@alpha \
  @rx-controls/react @rx-controls/core nativewind tailwindcss@3
```

## Setup

### 1. NativeWind, as its own guide has it

`babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
```

`metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: "./global.css" });
```

`global.css`, imported once at the app's entry:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 2. List the package in Tailwind's `content`

The implementation's classes live in its built output, which Tailwind does not
scan unless told to. Without this entry the form renders and works, unstyled.

```js
// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@rx-controls/forms-native/lib/**/*.js",
  ],
  presets: [require("nativewind/preset")],
};
```

The package is compiled with NativeWind's JSX runtime
(`jsxImportSource: "nativewind"`), so its `className`s are NativeWind's however
your own code is compiled.

### 3. The renderers, and a theme

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
theme is a set of NativeWind class slots, one per element and state, given
partially and nesting — a slot given replaces the enclosing theme's. Classes
merge with `tailwind-merge`, so a state or look slot wins over the base slot
it overrides.

**Named looks.** A form names a look and the theme says what it looks like. A
look is a table entry whose parts (`shell`, `control`, `text`, `label`,
`labelText`, `icon`, and a radio's `entry`, `selected`, `notSelected`) are NativeWind classes, or React Native styles with no class
and no NativeWind in the way:

```tsx
<NativeThemeProvider
  theme={{
    tokens: { colors: { accent: "#1d4ed8" } },
    looks: {
      // classes
      lead: { control: "text-lg font-semibold" },
      card: { shell: "rounded-lg bg-gray-100 p-4" },
      quiet: { control: "bg-transparent", text: "text-blue-700" },
      // styles: a colour token, and a function of the element's state
      pill: {
        control: (s) => ({
          backgroundColor: s.pressed ? "$accent/80" : "$accent",
          borderRadius: 999,
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
the theme's own styling of that element instead of merging over it. For a rare
one-off a boundary also takes `style` and `shellStyle`: a portable subset of CSS,
laid over the look. See `docs/FORMS-V2-LOOKS.md`.

The slots are named as `forms-html`'s are where the two draw the same thing — a
group's `wrapper`, `title` and `body`, a field's `shellFor` — so a theme's roles
carry across with only their classes rewritten.

**Shells per widget.** `shellFor` merges slots over `shell` for one widget's
shell, keyed by its `FieldShellProps.widget` (`radio`, `checkbox`, a
third-party widget's own name), as html's does:

```tsx
<NativeThemeProvider
  theme={{
    shellFor: {
      radio: { className: "gap-2 rounded-lg bg-gray-100 p-4" },
      checkbox: { label: "shrink text-lg font-bold" },
    },
  }}
>
```

**Flex items don't shrink.** On the web a flex item shrinks to fit by default;
in React Native `flexShrink` is 0, so a long text beside something else in a
row runs off the screen or out of its button. The default theme's own row
children shrink — a label, a label row, a button's text — and a theme that
replaces those slots should keep `shrink` in them. A row in a look's classes needs `shrink` on the child that should give way (`shrink min-w-0`,
for one that also lays out the same on the web).

### Metro in a monorepo

Linked workspace packages resolve React and React Native from their own
`node_modules`, and two copies in one bundle break every hook. Resolve those to
the app's own wherever the import comes from:

```js
const single = ["react", "react-native", "nativewind", "react-native-css-interop"];
config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    single.some((p) => moduleName === p || moduleName.startsWith(p + "/"))
      ? { ...context, originModulePath: path.join(__dirname, "package.json") }
      : context,
    moduleName,
    platform,
  );
```

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
  match where the two draw the same thing, so the port is the classes.
- **A row in a look's classes needs `shrink`** on the child that should
  give way (see "Flex items don't shrink", above).
