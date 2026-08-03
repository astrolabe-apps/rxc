// Flat ESLint config for the whole monorepo. Run via `rush lint`, which
// resolves eslint + plugins from the `lint` autoinstaller
// (common/autoinstallers/lint) rather than from every package's devDeps.
//
// Deliberately narrow: the point is the React hooks rules. `@rxc/*` renderers
// are ordinary function components that call `useControls()` (see
// docs/RENDER-BOUNDARY.md), which is exactly the shape
// `rules-of-hooks` can analyse — under the old `controls()` HOC every hook
// sat inside a callback argument and the rule reported "cannot be called
// inside a callback" instead. Keeping this config lean means it stays a
// correctness gate rather than a style debate.

// eslint and its plugins are installed in the autoinstaller, not at the repo
// root, so bare specifiers won't resolve from here. Resolve them against the
// autoinstaller's own package.json instead — this keeps `files`/`ignores`
// globs relative to the repo root (flat config resolves them from the config
// file's directory), which a config living inside the autoinstaller would not.
import { createRequire } from "node:module";

const require = createRequire(
  new URL("./common/autoinstallers/lint/package.json", import.meta.url),
);
const tsParser = require("@typescript-eslint/parser");
const reactHooks = require("eslint-plugin-react-hooks");

export default [
  {
    // The repo carries `eslint-disable` comments aimed at a fuller rule set
    // (no-console etc.) that this deliberately-narrow config doesn't enable.
    // Don't report them as unused — they're not stale, just out of scope here.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/lib/**",
      "**/dist/**",
      "**/.next/**",
      "**/common/temp/**",
      "**/common/autoinstallers/**",
      // Vendored verbatim from astrolabe-common; not ours to restyle.
      "packages/forms-core/src/json/schemaSchemas.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // A conditional hook is a real bug, not a preference.
      "react-hooks/rules-of-hooks": "error",
      // Warn only: the reactive layer means many of our effects intentionally
      // depend on a narrower set than the closure reads (the rc is read fresh
      // each render). Left visible rather than silenced.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
