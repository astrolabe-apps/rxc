import { defineConfig } from "vitest/config";

/**
 * React Native's own renderer cannot run here (React Native 0.81 pins React
 * 19.1; the repo develops on 19.2), so the suites render through
 * react-native-web in happy-dom: `react-native` resolves to it. That tests
 * the contract through React Native's components and props as the web maps
 * them — the native half is a smoke in a real app.
 *
 * The library compiles its JSX with NativeWind's runtime, which turns
 * `className` into styles — but only against the Tailwind CSS an app
 * compiles, and its CommonJS runtime would load React Native's Flow source
 * past the alias. Here it is `test/nativewind-web.ts`, which does what
 * NativeWind does on the web — the classes reach the DOM — and no more: the
 * look is checked in the app.
 */
export default defineConfig({
  resolve: {
    alias: {
      "react-native": "react-native-web",
      "nativewind/jsx-runtime": new URL("./test/nativewind-web.ts", import.meta.url).pathname,
      "nativewind/jsx-dev-runtime": new URL("./test/nativewind-web.ts", import.meta.url).pathname,
    },
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    setupFiles: ["test/setup.tsx"],
  },
});
