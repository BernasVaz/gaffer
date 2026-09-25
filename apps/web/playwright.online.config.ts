import { defineConfig, devices } from "@playwright/test";

/**
 * The online suite: a real browser, a real build with online play switched on,
 * and a real Postgres enforcing the real policies.
 *
 * Separate from the main config because it needs three things that one does
 * not: a build with `VITE_ASYNC_MULTIPLAYER=true`, a Supabase project to point
 * at, and no parallelism across files (two browsers share one database).
 *
 * ```bash
 * supabase start && pnpm --filter @gaffer/web test:e2e:online
 * ```
 *
 * The keys below are the Supabase CLI's fixed local development keys. They are
 * the same on every machine, they only ever address a container on 127.0.0.1,
 * and they are worth nothing anywhere else — which is why they may sit in a
 * checked-in file when a real key may not.
 */
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export default defineConfig({
  testDir: "./e2e-online",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],

  use: {
    baseURL: "http://127.0.0.1:4174/",
    trace: "on-first-retry",
    actionTimeout: 15_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "pnpm build && pnpm preview --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_ASYNC_MULTIPLAYER: "true",
      VITE_SUPABASE_URL: LOCAL_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
    },
  },
});
