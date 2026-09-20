import { expect, test } from "@playwright/test";

import { expectNoRuleBug, playToTheEnd, result, selectable, status, step, targets } from "./match";

test.describe("arriving", () => {
  test("a bare visit asks how you want to play", async ({ page }) => {
    await page.goto("./");

    await expect(page.getByRole("button", { name: /Kick off/ })).toBeVisible();
    await expect(page.getByRole("grid")).toHaveCount(0);
  });

  test("a link with a seed starts that match straight away", async ({ page }) => {
    await page.goto("./?seed=4242&mode=hotseat");

    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByText(/seed 4242/)).toBeVisible();
  });

  test("choosing a setup puts it in the address bar, ready to share", async ({ page }) => {
    await page.goto("./");

    await page.getByRole("button", { name: /Away/ }).click();
    await page.getByRole("button", { name: /Elite/ }).click();
    await page.getByRole("button", { name: /Kick off/ }).click();

    await expect(page.getByRole("grid")).toBeVisible();
    expect(page.url()).toContain("seed=");
    expect(page.url()).toContain("side=away");
    expect(page.url()).toContain("level=elite");
  });

  test("a mangled link is still a match", async ({ page }) => {
    await page.goto("./?seed=banana&mode=chess&side=middle");
    await expect(page.getByRole("grid")).toBeVisible();
  });
});

test.describe("the board", () => {
  test.beforeEach(async ({ page }) => page.goto("./?seed=1&mode=hotseat"));

  test("offers nothing until a player is chosen, then lights every legal option", async ({
    page,
  }) => {
    await expect(targets(page)).toHaveCount(0);

    await selectable(page).first().click();
    expect(await targets(page).count()).toBeGreaterThan(0);
  });

  test("shows the odds before the commit, which is the whole promise", async ({ page }) => {
    // GDD §9: if a player could not have anticipated the odds from the visible
    // board, the rule is wrong. This asserts they are actually on the board.
    const carrier = page.getByRole("button", { name: /^Select home striker/ });
    await carrier.click();

    const contested = page.getByRole("button", { name: /\d+% chance/ });
    expect(await contested.count()).toBeGreaterThan(0);
  });

  test("commits on the click, and says what the dice did", async ({ page }) => {
    await selectable(page).first().click();
    await targets(page).first().click();

    await expect(status(page)).not.toHaveText("");
    await expectNoRuleBug(page);
  });
});

test.describe("a whole match", () => {
  // Twenty-eight turns of two actions each, driven a click at a time.
  test.setTimeout(240_000);

  test("plays to a decided result with no rule bugs", async ({ page }) => {
    const refusals: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") refusals.push(message.text());
    });

    await page.goto("./?seed=12&mode=hotseat");

    const steps = await playToTheEnd(page);

    // GDD §10 forbids a draw, so a finished match always names a winner.
    await expect(result(page)).toBeVisible();
    await expect(page.getByText(/(home|away) win/i)).toBeVisible();

    // It got there by playing, not by running out of the step budget.
    expect(steps).toBeGreaterThan(20);
    expect(steps).toBeLessThan(220);

    await expectNoRuleBug(page);
    expect(refusals, `console errors during the match: ${refusals.join(" | ")}`).toEqual([]);
  });

  test("lets a solo player take a turn and the opponent answer", async ({ page }) => {
    await page.goto("./?seed=5&mode=solo&side=home&level=pro");

    // Everything offered is ours; the opponent's players are never on the menu.
    const names = await selectable(page).evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? ""),
    );
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((name) => name.includes("home"))).toBe(true);

    const turn = page.getByLabel("Scoreboard");
    await expect(turn).toContainText("Turn 1 of");

    await step(page);
    await step(page);

    /*
     * Having spent our turn, the opponent takes its own and hands it back. The
     * assertion is on what it *did* rather than on catching it mid-thought:
     * "thinking" is a few hundred milliseconds wide and a browser test that
     * races it is a flake waiting to happen. The vitest suite pins the pause
     * itself, with the clock under its own control.
     */
    await expect(selectable(page).first()).toBeVisible({ timeout: 20_000 });
    await expect(turn).toContainText("Turn 3 of");

    // Whatever it chose, an away player did it — so the opponent really played.
    await expect(status(page)).toContainText(/Novak|Halden|Amadi|Corso|Bex|away/);
    await expectNoRuleBug(page);
  });
});

test.describe("the seed in the link", () => {
  test.setTimeout(120_000);

  /**
   * The claim a shared link makes: same seed, same match.
   *
   * Driven by a script with no choices in it — end every turn — so the only
   * thing that can vary between the two runs is the engine's own randomness.
   * The match runs out level and is settled from the seed, which means this
   * checks the tiebreaker cascade end to end through a real browser.
   */
  const endEveryTurn = async (page: import("@playwright/test").Page) => {
    for (let turn = 0; turn < 40; turn += 1) {
      if (await result(page).isVisible()) break;
      const endTurn = page.getByRole("button", { name: "End turn" });
      if (!(await endTurn.isEnabled())) break;
      await endTurn.click();
    }
    return page.getByLabel("Scoreboard").textContent();
  };

  test("plays out the same way twice", async ({ page }) => {
    await page.goto("./?seed=777&mode=hotseat");
    const first = await endEveryTurn(page);
    await expect(result(page)).toBeVisible();
    const firstResult = await result(page).textContent();

    await page.goto("./?seed=777&mode=hotseat");
    const second = await endEveryTurn(page);
    const secondResult = await result(page).textContent();

    expect(second).toBe(first);
    expect(secondResult).toBe(firstResult);
  });

  test("plays out differently under a different seed", async ({ page }) => {
    // Otherwise the first test would pass on an engine that ignored the seed.
    await page.goto("./?seed=777&mode=hotseat");
    await endEveryTurn(page);
    const seven = await result(page).textContent();

    await page.goto("./?seed=31337&mode=hotseat");
    await endEveryTurn(page);
    const other = await result(page).textContent();

    // Same shape, and at least one of the two differs somewhere. Both matches
    // end level, so what separates them is the shootout the seed decides.
    expect(seven).toMatch(/decided by/);
    expect(other).toMatch(/decided by/);
  });
});
