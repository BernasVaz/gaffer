import { defineConfig, devices } from "@playwright/test";

/**
 * The end-to-end layer: a real browser against the real build.
 *
 * It runs against `vite preview` rather than the dev server on purpose. The
 * thing a person with a link opens is the *built* app, and the build is where
 * the differences live — minification, the base path, the hashed font. A suite
 * that only ever sees the dev server cannot tell you the deployed one works.
 *
 * `reuseExistingServer` locally so a watch loop is fast; never in CI, where a
 * stale server would quietly test the previous commit.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    // A full match is a lot of clicks; give each one room without hiding a hang.
    actionTimeout: 15_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    /*
     * The host is spelled out on purpose. `vite preview` defaults to
     * `localhost`, which on a machine with IPv6 resolves to `::1` — so a probe
     * of 127.0.0.1 never connects and the whole suite times out waiting for a
     * server that is already up and serving.
     */
    command: "pnpm build && pnpm preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
