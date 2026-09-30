import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next's own tsconfig leaves JSX to Next; vitest has to transform it.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
  },
});
