/** @type {import('tailwindcss').Config} */
module.exports = {
  // forms-native's classes live in its built output: list it, as an app
  // consuming the package from npm lists node_modules/@rx-controls/forms-native/lib.
  content: ["./src/**/*.{ts,tsx}", "../../packages/forms-native/lib/**/*.js"],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
