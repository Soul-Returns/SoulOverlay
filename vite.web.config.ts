import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

/**
 * Vite config for the standalone web demo build.
 *
 * Tauri APIs are replaced with browser shims:
 *   @tauri-apps/api/core    → src/lib/web/invoke.ts  (fetch-based invoke)
 *   @tauri-apps/api/event   → src/lib/web/event.ts   (no-op listen/emit)
 *   @tauri-apps/plugin-opener → src/lib/web/opener.ts (window.open)
 *
 * Build output goes to dist-web/ (separate from the Tauri build in dist/).
 * Served by nginx which also proxies /api/uex/ to the UEX Corp API.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@tauri-apps/api/core": resolve(__dirname, "src/lib/web/invoke.ts"),
      "@tauri-apps/api/event": resolve(__dirname, "src/lib/web/event.ts"),
      "@tauri-apps/plugin-opener": resolve(__dirname, "src/lib/web/opener.ts"),
    },
  },
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
  },
});
