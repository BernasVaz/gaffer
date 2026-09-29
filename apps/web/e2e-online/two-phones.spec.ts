import { expect, test, type Page } from "@playwright/test";

import { testDisplayName } from "@gaffer/shared";

/**
 * Two people, two phones, a real match.
 *
 * The suite that existed before this only ever pressed **End turn**, which
 * spends no dice — so it exercised the plumbing and never the game, and passed
 * happily while a real match died on the second player's phone. This plays.
 */

const PHONE = { width: 390, height: 844 };

async function enterAs(page: Page, name: string): Promise<void> {
  await page.goto("./?online=1");
  await page.getByLabel("Display name").fill(testDisplayName(name));
  await page.getByRole("button", { name: /I understand/ }).click();
  await expect(page.getByText(/Signed in as/)).toBeVisible();
}

/** Select whoever has the ball — the only player with anything to do at kickoff. */
async function selectCarrier(page: Page): Promise<void> {
  const carrier = page.getByRole("gridcell", { name: /with the ball/ });
  await expect(carrier).toHaveCount(1);
  await carrier.getByRole("button").first().click();
}

/** Take one action if the board offers one, and say whether it did. */
async function actOnce(page: Page): Promise<boolean> {
  const players = page.getByRole("button", { name: /^Select / });

  for (let index = 0; index < (await players.count()); index += 1) {
    await players.nth(index).click();

    const targets = page.getByRole("button", { name: /^(Pass to|Move to|Dribble to|Shoot)/ });
    if ((await targets.count()) > 0) {
      await targets.first().click();
      return true;
    }

    const deselect = page.getByRole("button", { name: /^Deselect / });
    if ((await deselect.count()) > 0) await deselect.first().click();
  }

  return false;
}

test("two phones play a real match, kickoff to full time", async ({ browser }) => {
  test.slow();

  const hc = await browser.newContext({ viewport: PHONE });
  const ac = await browser.newContext({ viewport: PHONE });
  const home = await hc.newPage();
  const away = await ac.newPage();

  await enterAs(home, "Two-H");
  await enterAs(away, "Two-A");

  await home.getByRole("button", { name: /Start a match/ }).click();
  const link = await home.getByLabel("Invite link").inputValue();
  await away.goto(link);

  await expect(home.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 30_000 });

  /* --- the whole single-player screen, online ---------------------------- */
  await expect(home.getByRole("grid")).toBeVisible();
  await expect(home.getByLabel("Scoreboard")).toBeVisible();
  await expect(home.getByRole("button", { name: /Flag moment/ })).toBeVisible();

  /* Each player sees their own team along the bottom of their own screen. */
  const bottomTeam = async (page: Page) => {
    const rows = await page.getByRole("gridcell").all();
    const boxes = await Promise.all(
      rows.map(async (cell) => ({
        name: (await cell.getAttribute("aria-label")) ?? "",
        y: (await cell.boundingBox())?.y ?? 0,
      })),
    );
    const occupied = boxes.filter((cell) => !cell.name.includes(": empty"));
    const lowest = occupied.sort((a, b) => b.y - a.y)[0];
    return lowest?.name.includes("home") === true ? "home" : "away";
  };

  expect(await bottomTeam(home), "home sees its own team at the bottom").toBe("home");
  expect(await bottomTeam(away), "away sees its own team at the bottom").toBe("away");

  /* --- pass at kickoff, through the real UI ------------------------------ */
  await selectCarrier(home);
  const kickoffPasses = home.getByRole("button", { name: /^Pass to/ });
  expect(await kickoffPasses.count(), "a kickoff must offer a pass").toBeGreaterThan(0);
  await kickoffPasses.first().click();

  await home.getByRole("button", { name: /^End turn/ }).click();

  /* --- the opponent receives it and can act ------------------------------ */
  await expect(away.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 30_000 });
  await expect(away.getByText(/This match is stopped/)).toHaveCount(0);
  expect(await actOnce(away), "the opponent must be able to move").toBe(true);
  await away.getByRole("button", { name: /^End turn/ }).click();

  await expect(home.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 30_000 });

  /* --- and on, both ways, with dice being spent -------------------------- */
  for (let turn = 0; turn < 8; turn += 1) {
    const mover = turn % 2 === 0 ? home : away;
    const other = turn % 2 === 0 ? away : home;

    await expect(mover.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 30_000 });
    await expect(mover.getByText(/This match is stopped/), "a match must not stop").toHaveCount(0);

    await actOnce(mover);
    await mover.getByRole("button", { name: /^End turn/ }).click();
    await expect(other.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 30_000 });
  }

  /* Neither phone has been told the match broke. */
  await expect(home.getByText(/This match is stopped/)).toHaveCount(0);
  await expect(away.getByText(/This match is stopped/)).toHaveCount(0);

  await hc.close();
  await ac.close();
});
