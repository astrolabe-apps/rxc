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
merge with `tailwind-merge`, so a state or variant slot wins over the base slot
it overrides.

**Named looks.** A form names a role and the theme says what it looks like:

```tsx
<NativeThemeProvider
  theme={{
    text: { variants: { lead: "text-lg font-semibold" } },
    contents: { variants: { card: { className: "rounded-lg bg-gray-100 p-4" } } },
    action: { variants: { quiet: { className: "bg-transparent", textClassName: "text-blue-700" } } },
    image: { variants: { rounded: "rounded-xl" } },
  }}
>
```

```tsx
<TextDisplay text="Before you start" variant="lead" />
```

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
