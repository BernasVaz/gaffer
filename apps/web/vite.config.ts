import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import type { IndexHtmlTransformContext, PluginOption } from "vite";

/**
 * Fill the Content-Security-Policy's `connect-src` with the project this build
 * actually talks to.
 *
 * Written at build time rather than hard-coded, because a policy naming
 * `*.supabase.co` is correct in production and wrong everywhere else: a local
 * stack lives on `127.0.0.1`, and the first version of this blocked every
 * developer and every end-to-end run while looking perfectly fine in the
 * deployed site. A control that only works in production is a control nobody
 * can test.
 *
 * Naming one origin is also tighter than the wildcard it replaces.
 */
function contentSecurityPolicy(): PluginOption {
  return {
    name: "gaffer-csp",
    transformIndexHtml(html: string, context: IndexHtmlTransformContext) {
      const url =
        context.server?.config.env?.["VITE_SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";

      const origins = (() => {
        if (url === "") return "";
        try {
          const { protocol, host } = new URL(url);
          const socket = protocol === "https:" ? "wss:" : "ws:";
          return `${protocol}//${host} ${socket}//${host}`;
        } catch {
          return "";
        }
      })();

      return html.replace("%SUPABASE_ORIGINS%", origins);
    },
  };
}

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

  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
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
