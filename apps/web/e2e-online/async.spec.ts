import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

import { testDisplayName } from "@gaffer/shared";

import { measureContrast } from "../e2e-theme/contrast";

/**
 * Create → invite → join → take a turn → the other side is notified.
 *
 * Two browser contexts, so the two players are genuinely two browsers with two
 * anonymous identities and two sets of local storage — a single context sharing
 * a session would test nothing about whose turn it is.
 *
 * Against a real Postgres with the real policies: the row-level security and
 * the append-only trigger are the Phase 1 integrity spine (ADR 0029), and a
 * suite that stubbed them would be checking the stub.
 */

/** Sign in anonymously with a display name, acknowledging the warning. */
async function enterAs(page: Page, name: string): Promise<void> {
  await page.goto("./?online=1");

  // The identity warning is not optional and not buried: it is the first thing.
  const warning = page.getByRole("region", { name: "About your identity" });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText(/clear this browser's storage/i);
  await expect(warning).toContainText(/attach an email later/i);

  /* The privacy line sits with the field somebody is filling in. */
  await expect(page.getByText(/Your opponent sees this name/i)).toBeVisible();
  await expect(page.getByText(/no email, no password, no account/i)).toBeVisible();

  await page.getByLabel("Display name").fill(testDisplayName(name));
  await page.getByRole("button", { name: /I understand/ }).click();
  await expect(page.getByText(/Signed in as/)).toBeVisible();
}

test("create, invite, join, take a turn, and notify", async ({ browser }) => {
  test.slow();

  const homeContext = await browser.newContext();
  const awayContext = await browser.newContext();
  const home = await homeContext.newPage();
  const away = await awayContext.newPage();

  await enterAs(home, "Alex");
  await enterAs(away, "Sam");

  // --- create -------------------------------------------------------------
  await home.getByRole("button", { name: /Start a match/ }).click();
  await expect(home.getByRole("region", { name: "Online match" })).toBeVisible();

  const invite = home.getByLabel("Invite link");
  await expect(invite).toBeVisible();

  /* One tap to send it, which on a phone is the difference between an invite
     being sent and a long URL being squinted at. */
  await expect(home.getByRole("button", { name: /Share the link/ })).toBeVisible();

  /* The link is a bearer capability, and the copy has to say so out loud. */
  await expect(home.getByText(/Anyone who opens this link takes the second seat/i)).toBeVisible();

  const link = await invite.inputValue();
  expect(link).toContain("online=1");
  expect(link).toContain("match=");

  await expect(home.getByTestId("turn-state")).toHaveText(/Waiting for an opponent/);

  // --- join ---------------------------------------------------------------
  await away.goto(link);
  await expect(away.getByRole("region", { name: "Online match" })).toBeVisible();

  /* Home is notified that the seat filled, without a reload: Realtime. */
  await expect(home.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 20_000 });
  await expect(away.getByTestId("turn-state")).toHaveText(/Waiting for your opponent/);

  // --- take a turn --------------------------------------------------------
  await home.getByRole("button", { name: /^End turn/ }).click();

  /* The turn lands and, crucially, arrives at the other browser on its own. */
  await expect(away.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 20_000 });
  await expect(home.getByTestId("turn-state")).toHaveText(/Waiting for your opponent/);

  // --- and back -----------------------------------------------------------
  await away.getByRole("button", { name: /^End turn/ }).click();
  await expect(home.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 20_000 });

  // --- reconnect ----------------------------------------------------------
  /* A board is a seed and a list, so reopening the link rebuilds it. Nothing is
     restored because there is no session to restore. */
  await home.reload();
  await expect(home.getByRole("region", { name: "Online match" })).toBeVisible();
  await expect(home.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 20_000 });

  await homeContext.close();
  await awayContext.close();
});

test("a stranger cannot open somebody else's match", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const strangerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const stranger = await strangerContext.newPage();

  await enterAs(owner, "Owner");
  await owner.getByRole("button", { name: /Start a match/ }).click();
  const link = await owner.getByLabel("Invite link").inputValue();

  /* The first stranger takes the seat — that is what a bearer link means, and
     the copy says so. A *second* one must be refused. */
  const firstContext = await browser.newContext();
  const first = await firstContext.newPage();
  await enterAs(first, "First");
  await first.goto(link);
  await expect(first.getByRole("region", { name: "Online match" })).toBeVisible();

  await enterAs(stranger, "Stranger");
  await stranger.goto(link);

  await expect(
    stranger.getByText(/could not be found|not yours to see|took that seat first/i),
  ).toBeVisible({ timeout: 20_000 });

  await ownerContext.close();
  await firstContext.close();
  await strangerContext.close();
});

test("refuses a name an opponent should not have to read", async ({ browser }) => {
  /* The name is shown to somebody else, which is the whole reason it is
     checked (ADR 0031). */
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("./?online=1");

  const go = page.getByRole("button", { name: /I understand/ });
  await expect(go).toBeDisabled();

  await page.getByLabel("Display name").fill("fuck");
  await expect(page.getByRole("alert")).toContainText(/happy for your opponent/i);
  await expect(go).toBeDisabled();

  /* And an innocent name that merely contains one is fine. */
  await page.getByLabel("Display name").fill("Scunthorpe");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(go).toBeEnabled();

  await ctx.close();
});

test("reads on a phone", async ({ browser }) => {
  /* 320px, the narrowest phone the setup screen promises to fit (ADR 0019).
     An invited tester opening this on a phone is the only way it gets used. */
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await ctx.newPage();

  await page.goto("./?online=1");
  await page.getByLabel("Display name").fill("Mobile");
  await page.getByRole("button", { name: /I understand/ }).click();
  await page.getByRole("button", { name: /Start a match/ }).click();

  await expect(page.getByRole("region", { name: "Online match" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "the online screen scrolls sideways on a phone").toBeLessThanOrEqual(0);

  /* The turn banner has to be findable without hunting for it. */
  const banner = page.getByTestId("turn-state");
  await expect(banner).toBeVisible();
  const box = await banner.boundingBox();
  expect(box!.height).toBeGreaterThan(30);

  await ctx.close();
});

test.describe("light mode, all the way through a match", () => {
  /* The sign-in screen is guarded without a database (e2e-theme); the invite
     and take-turn views need one, so they are guarded here. Light mode
     deliberately — dark mode hid this bug completely. */
  test.use({ colorScheme: "light" });

  test("the invite and the board stay legible", async ({ browser }) => {
    const ctx = await browser.newContext({
      colorScheme: "light",
      viewport: { width: 320, height: 640 },
    });
    const page = await ctx.newPage();

    await page.goto("./?online=1");
    await page.getByLabel("Display name").fill("Light");
    await page.getByRole("button", { name: /I understand/ }).click();
    await page.getByRole("button", { name: /Start a match/ }).click();

    /* The invite view: the link, the share button and the bearer-link warning. */
    await expect(page.getByLabel("Invite link")).toBeVisible();
    const invite = (await measureContrast(page, "main *")).filter((item) => item.ratio < 4.5);
    expect(
      invite.map((item) => `${item.ratio}:1 — "${item.label}"`),
      "the invite view is unreadable in light mode",
    ).toEqual([]);

    /*
     * The board is on screen and has real size.
     *
     * `.pitch-slot` is a size container: given a parent with only a minimum
     * height it has nothing to measure and collapses to zero, which is what it
     * did here — an online match with no visible pitch, every test passing.
     * Measured rather than merely queried, because a 0×0 element is still
     * "in the document".
     */
    const board = page.getByRole("grid");
    await expect(board).toBeVisible();
    const box = await board.boundingBox();
    expect(box, "the board has no box at all").not.toBeNull();
    expect(box!.height, "the board collapsed to nothing").toBeGreaterThan(120);
    expect(box!.width, "the board collapsed to nothing").toBeGreaterThan(120);

    /* The take-turn view: the turn banner is the thing a player looks for. */
    await expect(page.getByTestId("turn-state")).toBeVisible();
    const banner = (await measureContrast(page, '[data-testid="turn-state"]')).at(0);
    expect(banner, "the turn banner was not measured").toBeDefined();
    expect(banner!.ratio, `the turn banner is ${banner!.ratio}:1`).toBeGreaterThanOrEqual(4.5);

    await ctx.close();
  });
});

/**
 * Feedback reaches us, rather than waiting on a download somebody may never send.
 *
 * Verified by reading the table back with the **service key**, which is how
 * Bernardo reads it: row-level security lets a tester write feedback and read
 * none, so a test that checked through the client would be asserting that
 * nothing is visible — which is true, and not the question.
 *
 * The key is asked of the running stack rather than written here. It is the
 * CLI's fixed local one and worth nothing outside a container on 127.0.0.1 —
 * and GitHub's push protection still refused a file containing it, correctly.
 * A string shaped like a service key sitting in a repository is how people
 * learn to wave secret scanners through.
 */
test.describe("feedback is sent, not downloaded", () => {
  const SERVICE_KEY = (() => {
    try {
      const status: unknown = JSON.parse(
        execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8" }),
      );
      const key = (status as Record<string, unknown>)["SECRET_KEY"];
      return typeof key === "string" ? key : "";
    } catch {
      return "";
    }
  })();

  const API = "http://127.0.0.1:54321";

  const readFeedback = async (body: string) => {
    const response = await fetch(
      `${API}/rest/v1/feedback?select=kind,body,rating,meta&body=eq.${encodeURIComponent(body)}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    return (await response.json()) as Array<{
      kind: string;
      body: string;
      rating: number | null;
      meta: Record<string, unknown>;
    }>;
  };

  test("a flagged note lands in the table, with the context nobody typed", async ({ page }) => {
    expect(SERVICE_KEY, "no local Supabase stack to read the table with").not.toBe("");

    const body = `flagged at ${Date.now()}`;

    await page.goto("./?seed=4242&mode=5v5&play=hotseat&actions=4");
    await page.getByRole("button", { name: /Flag moment/ }).click();

    await page.getByRole("button", { name: /^Balance$/ }).click();
    await page.getByPlaceholder(/What happened/).fill(body);
    await page.getByRole("button", { name: /^Save note$/ }).click();

    await expect.poll(async () => (await readFeedback(body)).length, { timeout: 15_000 }).toBe(1);

    const [row] = await readFeedback(body);
    expect(row!.kind).toBe("note");

    /* The whole point: the tester typed a sentence and we got the match. */
    expect(row!.meta["seed"]).toBe(4242);
    expect(row!.meta["mode"]).toBe("5v5");
    expect(row!.meta["rulesVersion"]).toBeGreaterThan(0);
    expect(row!.meta["build"]).toBeTruthy();
    expect(row!.meta["turn"]).toBeGreaterThan(0);
    expect(row!.meta["userAgent"]).toBeTruthy();
    expect(row!.meta["theme"]).toMatch(/light|dark/);
  });
});
