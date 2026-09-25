import { defineConfig, devices } from "@playwright/test";

/**
 * The theme suite: a build with multiplayer on, and **no Supabase**.
 *
 * It exists so the online screens' appearance can be guarded in CI, where there
 * is no database. The sign-in screen is the first thing a tester sees and it
 * renders before anything is fetched, so it needs no project to be looked at —
 * which is exactly the property that makes this cheap enough to run on every
 * push.
 *
 * Kept apart from the offline suite because that one builds with the flag
 * *off*, and its bundle-isolation gate depends on that.
 */
export default defineConfig({
  testDir: "./e2e-theme",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: { baseURL: "http://127.0.0.1:4176/", trace: "on-first-retry" },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "pnpm build && pnpm preview --host 127.0.0.1 --port 4176 --strictPort",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_ASYNC_MULTIPLAYER: "true" },
  },
});
