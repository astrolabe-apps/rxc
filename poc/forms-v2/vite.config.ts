import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5183 },
  build: {
    // Four UI libraries in one bundle is the point of this POC, so the
    // chunk-size warning is noise — and Rush escalates anything on stderr
    // into a failing build (same reason the Next 15 apps disable lint there).
    chunkSizeWarningLimit: 4000,
  },
});
