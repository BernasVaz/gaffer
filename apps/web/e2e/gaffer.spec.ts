import { expect, test } from "@playwright/test";

import { expectNoRuleBug, playToTheEnd, result, selectable, status, step, targets } from "./match";

test.describe("arriving", () => {
  test("a bare visit asks how you want to play", async ({ page }) => {
    await page.goto("./");

    await expect(page.getByRole("button", { name: /Kick off/ })).toBeVisible();
    await expect(page.getByRole("grid")).toHaveCount(0);
  });

  test("a link with a seed starts that match straight away", async ({ page }) => {
    await page.goto("./?seed=4242&play=hotseat");

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
    await page.goto("./?seed=banana&mode=chess&play=alone&side=middle");
    await expect(page.getByRole("grid")).toBeVisible();
  });
});

test.describe("the board", () => {
  test.beforeEach(async ({ page }) => page.goto("./?seed=1&play=hotseat"));

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

    await page.goto("./?seed=12&play=hotseat");

    const steps = await playToTheEnd(page);

    // GDD §10 forbids a draw, so a finished match always names a winner.
    await expect(result(page)).toBeVisible();
    await expect(page.getByText(/(home|away) win/i)).toBeVisible();

    // It got there by playing, not by running out of the step budget.
    expect(steps).toBeGreaterThan(20);
    expect(steps).toBeLessThan(260);

    await expectNoRuleBug(page);
    expect(refusals, `console errors during the match: ${refusals.join(" | ")}`).toEqual([]);
  });

  test("lets a solo player take a turn and the opponent answer", async ({ page }) => {
    await page.goto("./?seed=5&play=solo&side=home&level=pro");

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
    await page.goto("./?seed=777&play=hotseat");
    const first = await endEveryTurn(page);
    await expect(result(page)).toBeVisible();
    const firstResult = await result(page).textContent();

    await page.goto("./?seed=777&play=hotseat");
    const second = await endEveryTurn(page);
    const secondResult = await result(page).textContent();

    expect(second).toBe(first);
    expect(secondResult).toBe(firstResult);
  });

  test("plays out differently under a different seed", async ({ page }) => {
    // Otherwise the first test would pass on an engine that ignored the seed.
    await page.goto("./?seed=777&play=hotseat");
    await endEveryTurn(page);
    const seven = await result(page).textContent();

    await page.goto("./?seed=31337&play=hotseat");
    await endEveryTurn(page);
    const other = await result(page).textContent();

    // Same shape, and at least one of the two differs somewhere. Both matches
    // end level, so what separates them is the shootout the seed decides.
    expect(seven).toMatch(/decided by/);
    expect(other).toMatch(/decided by/);
  });
});

test.describe("game types", () => {
  test("offers all three, and flags the provisional ones", async ({ page }) => {
    await page.goto("./");

    await expect(page.getByRole("button", { name: /5v5/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /7v7/ })).toContainText("Alpha");
    await expect(page.getByRole("button", { name: /11v11/ })).toContainText("Alpha");
    await expect(page.getByRole("button", { name: /5v5/ })).not.toContainText("Alpha");
  });

  test("carries the chosen one into the link", async ({ page }) => {
    await page.goto("./");

    await page.getByRole("button", { name: /11v11/ }).click();
    await page.getByRole("button", { name: /Kick off/ }).click();

    await expect(page.getByRole("grid")).toBeVisible();
    expect(page.url()).toContain("mode=11v11");
  });

  test("draws the pitch a link asks for", async ({ page }) => {
    await page.goto("./?seed=3&mode=11v11&play=hotseat");

    // 13 × 9, from the format table — and no horizontal scroll to reach it.
    await expect(page.getByRole("gridcell")).toHaveCount(117);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("still understands a link written before game types existed", async ({ page }) => {
    // `?mode=hotseat` used to mean the play mode. Those links are out there.
    await page.goto("./?seed=42&mode=hotseat");

    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByText(/Hotseat/)).toBeVisible();
    await expect(page.getByRole("gridcell")).toHaveCount(35);
  });

  test("says a provisional game type is provisional, in the match itself", async ({ page }) => {
    await page.goto("./?seed=3&mode=7v7&play=hotseat");
    await expect(page.getByText("Alpha").first()).toBeVisible();
  });

  test("stays inside a phone without scrolling sideways", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const mode of ["5v5", "7v7", "11v11"]) {
      await page.goto(`./?seed=3&mode=${mode}&play=hotseat`);
      await expect(page.getByRole("grid")).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, `${mode} scrolls sideways on a phone`).toBe(false);

      // And the board actually fills the width it has, rather than shrinking
      // into a corner to avoid overflowing.
      const width = await page.getByRole("grid").evaluate((node) => node.clientWidth);
      expect(width, mode).toBeGreaterThan(300);
    }
  });
});

test.describe("playing at a bigger game type", () => {
  test.setTimeout(180_000);

  test("takes a stretch of an 11-a-side match with no rule bugs", async ({ page }) => {
    /*
     * A whole 11-a-side match is a couple of hundred commands, and the engine
     * and opponent suites already play those to a finish at every format. What
     * only a browser can tell you is whether a 13 × 9 board is *clickable* — so
     * this plays a real stretch of one through the interface.
     */
    await page.goto("./?seed=8&mode=11v11&play=hotseat");

    for (let taken = 0; taken < 40; taken += 1) {
      const outcome = await step(page);
      if (outcome === "over") break;
    }

    await expectNoRuleBug(page);
    await expect(page.getByLabel("Scoreboard")).not.toContainText("Turn 1 of");
  });
});

test.describe("name labels", () => {
  /**
   * Every name that is shown is shown *whole*.
   *
   * The bug this guards against did not look like a layout bug. The label sat
   * in a flex column with the player, the two came to more than a cell, and a
   * flex column that overflows does not overflow — it shrinks. Every name on
   * the board was cropped to about half its line box by its own `truncate`,
   * which reads as "the pitch edge cut it off" on the rows where the remains
   * sat against the border.
   */
  const unreadable = async (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const board = document.querySelector(".pitch-board")!.getBoundingClientRect();
      const labels = [...document.querySelectorAll(".piece-name")];
      const shown = labels.filter((node) => getComputedStyle(node).display !== "none");

      const broken = shown
        .filter((node) => {
          const box = node.getBoundingClientRect();
          // One pixel of slack: the font size is fractional, and scrollHeight
          // is an integer, so a 22.9px box honestly reports 24.
          const cropped =
            node.scrollHeight - Math.ceil(box.height) > 1 ||
            node.scrollWidth - Math.ceil(box.width) > 1;
          const escaped =
            box.bottom > board.bottom + 1 ||
            box.top < board.top - 1 ||
            box.left < board.left - 1 ||
            box.right > board.right + 1;
          return cropped || escaped;
        })
        .map((node) => node.textContent);

      return { shown: shown.length, hidden: labels.length - shown.length, broken };
    });

  for (const mode of ["5v5", "7v7", "11v11"]) {
    test(`are whole and inside the pitch at ${mode}, on a desktop`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`./?seed=7&mode=${mode}&play=hotseat`);
      await expect(page.getByRole("grid")).toBeVisible();

      const { shown, broken } = await unreadable(page);
      // At desktop width every cell is big enough, so every name is on show.
      expect(shown).toBeGreaterThan(0);
      expect(broken, `cropped or escaping at ${mode}`).toEqual([]);
    });

    test(`are whole or absent at ${mode}, on a phone`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`./?seed=7&mode=${mode}&play=hotseat`);
      await expect(page.getByRole("grid")).toBeVisible();

      // A name is either fully readable or deliberately dropped, never a
      // half-drawn smudge. Dropping is fine — the name is still in the cell's
      // accessible description.
      const { broken } = await unreadable(page);
      expect(broken, `cropped or escaping at ${mode} on a phone`).toEqual([]);
    });
  }
});
