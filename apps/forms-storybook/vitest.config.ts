import { defineConfig } from "vitest/config";
import { nativeWeb } from "./native-web";

// Not vite.config.ts: vitest carries its own vite, and the app's plugin-react
// is built for the app's.
export default defineConfig({
  resolve: { alias: nativeWeb },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    setupFiles: ["test/setup.tsx"],
  },
});
