import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Storybook's own manager and preview runtime are the large chunks; the
  // warning is noise, and anything Rush sees as a warning fails the build.
  build: { chunkSizeWarningLimit: 4000 },
});
