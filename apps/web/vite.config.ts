import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  /*
   * Relative asset URLs, so the build works wherever it is served from.
   *
   * At a domain root `./assets/…` and `/assets/…` are the same thing; under a
   * subpath they are emphatically not, and the absolute one 404s. Gaffer is a
   * single page that keeps its whole state in the query string and never touches
   * the path, so there is no router to confuse and nothing to lose by being
   * relative — and it means the same artifact can be served from a project page,
   * a domain root, or a file, without a rebuild.
   */
  base: "./",

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
