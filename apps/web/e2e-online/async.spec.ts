import { expect, test, type Page } from "@playwright/test";

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

  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: /I understand/ }).click();
  await expect(page.getByText(new RegExp(`Signed in as\\s*${name}`))).toBeVisible();
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
