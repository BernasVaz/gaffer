import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    /*
     * Only the component suite. `e2e/` is Playwright's, and vitest picking those
     * files up produces a baffling error about test.describe being called in the
     * wrong place — two runners, one convention for naming tests.
     */
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
