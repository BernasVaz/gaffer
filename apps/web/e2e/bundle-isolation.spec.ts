import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

/**
 * **G2 — nothing behind the multiplayer flag may reach a tester.**
 *
 * This is the only kind of test that catches the failure it exists for. The
 * leak it guards against was invisible to the type checker, to every unit test
 * and to every other end-to-end test, because the code was *correct* — it was
 * simply also *present*. `import.meta.env["VITE_X"]` type-checks, runs, and
 * behaves exactly like `import.meta.env.VITE_X`, but Vite only substitutes the
 * dot form at build time. The bracket form survives as a runtime lookup, so
 * every branch behind it stays reachable and nothing is tree-shaken.
 *
 * The result shipped the whole online layer — `signInAnonymously`, the invite
 * copy and 214 KB of Supabase client — inside a build whose flag was off. It
 * was found by grepping the built file by hand. This is that grep, made
 * permanent.
 *
 * It asserts on the **built artifact** rather than on source, because the
 * artifact is the thing a tester downloads and the build is where the mistake
 * was. It needs no Supabase and no network.
 */

/** Strings that must not appear in a build with multiplayer switched off. */
const FORBIDDEN = [
  // The client library, by name and by the modules it pulls in.
  "supabase",
  "gotrue",
  // Environment variables, which would mean the keys were inlined.
  "VITE_SUPABASE",
  "sb_publishable",
  "sb_secret",
  "service_role",
  // The project this repository is configured against.
  "tptglnkxxajaylispgki",
  // The online code itself: an API call, the chunk, and two strings only it has.
  "signInAnonymously",
  "OnlineScreen",
  "Invite link",
  "clear this browser",
  // The way in. A build with the flag off must not even offer the door.
  "Play someone else",
] as const;

const DIST = join(import.meta.dirname, "..", "dist");

test.describe("the alpha build carries no multiplayer", () => {
  test.skip(
    Boolean(process.env["GAFFER_E2E_URL"]),
    "points at a deployed site, so there is no local build to inspect",
  );

  test("ships nothing from behind the flag", () => {
    const assets = join(DIST, "assets");
    const files = readdirSync(assets).filter(
      (name) => name.endsWith(".js") || name.endsWith(".css"),
    );

    expect(files.length, "the build produced nothing to check").toBeGreaterThan(0);

    const bundle = files.map((name) => readFileSync(join(assets, name), "utf8")).join("\n");
    const html = readFileSync(join(DIST, "index.html"), "utf8");
    const everything = `${bundle}\n${html}`.toLowerCase();

    const found = FORBIDDEN.filter((needle) => everything.includes(needle.toLowerCase()));

    expect(
      found,
      `the flag-off build contains multiplayer code or configuration: ${found.join(", ")}`,
    ).toEqual([]);
  });

  test("emits no chunk for the online screen", () => {
    /* A lazily imported module still ships if anything references it. The
       online chunk must not merely go unfetched — it must not be built. */
    const names = readdirSync(join(DIST, "assets"));
    expect(names.filter((name) => /online/i.test(name))).toEqual([]);
  });

  test("would notice if the check had nothing to check", () => {
    /* A guard that silently passes on an empty directory guards nothing. This
       asserts the bundle really was read and really does contain the app. */
    const assets = join(DIST, "assets");
    const bundle = readdirSync(assets)
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFileSync(join(assets, name), "utf8"))
      .join("\n");

    expect(bundle.length).toBeGreaterThan(50_000);
    expect(bundle).toContain("Gaffer");
  });
});
