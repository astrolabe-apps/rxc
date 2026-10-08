/**
 * forms-native on the web, for the Storybook and its smoke test: React
 * Native resolves to react-native-web, and NativeWind's JSX runtime to the
 * shim forms-native's own suites use, under which a `className` reaches the
 * DOM as classes rather than being compiled against an app's Tailwind build.
 */
export const nativeWeb: Record<string, string> = {
  "react-native": "react-native-web",
  "nativewind/jsx-runtime": new URL(
    "../../packages/forms-native/test/nativewind-web.ts",
    import.meta.url,
  ).pathname,
  "nativewind/jsx-dev-runtime": new URL(
    "../../packages/forms-native/test/nativewind-web.ts",
    import.meta.url,
  ).pathname,
};
