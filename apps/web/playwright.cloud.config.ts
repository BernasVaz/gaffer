import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

/**
 * The online suite, against the **cloud** Supabase project.
 *
 * The local stack is a faithful copy and it is not the thing testers use. Three
 * things only exist in the cloud: row-level security running against real
 * anonymous JWTs issued by the hosted auth service, the `supabase_realtime`
 * publication as `db push` actually applied it, and a websocket crossing the
 * internet rather than a loopback interface. Each has its own way of being
 * subtly absent, and the local suite cannot see any of them.
 *
 * Reads `apps/web/.env`, which is gitignored — no cloud key is committed, and a
 * machine without that file cannot run this by accident.
 *
 * ```bash
 * pnpm --filter @gaffer/web test:e2e:cloud
 * ```
 *
 * **This writes to the real project.** It creates anonymous users and matches
 * that stay there. That is the point — it is testing the thing testers use —
 * and it is worth knowing before running it a hundred times.
 */
function fromEnvFile(): { url: string; key: string } {
  const raw = readFileSync(new URL("./.env", import.meta.url), "utf8");
  const read = (name: string) =>
    raw
      .split("\n")
      .find((line) => line.startsWith(`${name}=`))
      ?.slice(name.length + 1)
      .trim() ?? "";

  const url = read("VITE_SUPABASE_URL");
  const key = read("VITE_SUPABASE_ANON_KEY");
  if (url === "" || key === "") {
    throw new Error("apps/web/.env needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  }
  return { url, key };
}

const cloud = fromEnvFile();

export default defineConfig({
  testDir: "./e2e-online",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],

  use: {
    baseURL: "http://127.0.0.1:4175/",
    trace: "on-first-retry",
    /* The internet is slower than a loopback socket, and a realtime event now
       crosses it. Room for that, without hiding a genuine hang. */
    actionTimeout: 30_000,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "pnpm build && pnpm preview --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_ASYNC_MULTIPLAYER: "true",
      VITE_SUPABASE_URL: cloud.url,
      VITE_SUPABASE_ANON_KEY: cloud.key,
    },
  },
});
