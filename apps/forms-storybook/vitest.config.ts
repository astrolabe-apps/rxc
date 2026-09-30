import { defineConfig } from "vitest/config";

// Not vite.config.ts: vitest carries its own vite, and the app's plugin-react
// is built for the app's.
export default defineConfig({
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
  },
});
