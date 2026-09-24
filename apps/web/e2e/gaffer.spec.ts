import { expect, test } from "@playwright/test";

import {
  cellCentre,
  dragCell,
  expectNoRuleBug,
  firstOpenDestination,
  playToTheEnd,
  result,
  selectable,
  status,
  openMore,
  selectCarrier,
  step,
  takeKickoff,
  targets,
} from "./match";

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
  /* Past the kickoff, which offers nothing but the pass (ADR 0018). These are
     about what an ordinary board offers and what a click does with it. */
  test.beforeEach(async ({ page }) => {
    await page.goto("./?seed=1&play=hotseat");
    await takeKickoff(page);
  });

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
    /* Whoever the kickoff left the ball with — the striker gives it away
       (ADR 0018), and a player without the ball has nothing contested to do. */
    await selectCarrier(page);

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
    await expect(page.getByText(/hotseat/i)).toBeVisible();
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

test.describe("actions per turn", () => {
  test("is chosen before kickoff and carried in the link", async ({ page }) => {
    await page.goto("./");

    const economy = page.getByLabel("Actions per turn");
    await expect(economy.getByRole("button", { name: /^2/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await economy.getByRole("button", { name: /^4/ }).click();
    await page.getByRole("button", { name: /Kick off/ }).click();

    expect(page.url()).toContain("actions=4");
    await expect(page.getByLabel("Scoreboard")).toContainText("4 actions left");
  });

  test("follows the game type when that changes", async ({ page }) => {
    await page.goto("./");
    const economy = page.getByLabel("Actions per turn");

    await page.getByRole("button", { name: /11v11/ }).click();
    await expect(economy.getByRole("button", { name: /^4/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("actually changes how many commands a turn takes", async ({ page }) => {
    // The setting is only real if the engine honours it, so this spends a turn.
    await page.goto("./?seed=5&mode=5v5&play=hotseat&actions=1");
    await expect(page.getByLabel("Scoreboard")).toContainText("1 action left");

    await step(page);
    await expect(page.getByLabel("Scoreboard")).toContainText("Turn 2 of");
  });
});

test.describe("flagging a moment", () => {
  test("captures a note, survives a refresh, and comes back to the same board", async ({
    page,
  }) => {
    await page.goto("./?seed=42&mode=5v5&play=hotseat&actions=2");

    // Play a few actions so there is a history to attach.
    await step(page);
    await step(page);
    const turn = await page.getByLabel("Scoreboard").textContent();

    await page.keyboard.press("f");
    await expect(page.getByRole("dialog", { name: /Flag this moment/ })).toBeVisible();

    await page.getByRole("button", { name: "Confusing" }).click();
    await page.getByLabel("What happened").fill("could not tell why that pass was not offered");
    await page.getByRole("button", { name: "Save note" }).click();

    await expect(page.getByRole("button", { name: /Flag moment/ })).toContainText("1");

    // The point of persisting: a refresh keeps the note *and* the match.
    await page.reload();
    await expect(page.getByRole("button", { name: /Flag moment/ })).toContainText("1");
    await expect(page.getByLabel("Scoreboard")).toHaveText(turn ?? "");
  });

  test("holds the board still while the note is being written", async ({ page }) => {
    await page.goto("./?seed=42&mode=5v5&play=hotseat");
    // Wait for the board before typing at it: the hotkey listens on the window,
    // which does not exist until the match has rendered.
    await expect(page.getByRole("grid")).toBeVisible();

    await page.keyboard.press("f");
    await expect(page.getByRole("dialog", { name: /Flag this moment/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "End turn" })).toBeDisabled();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "End turn" })).toBeEnabled();
  });

  test("downloads a report that names the match and carries the log", async ({ page }) => {
    await page.goto("./?seed=42&mode=5v5&play=hotseat&actions=2");
    await step(page);

    await page.keyboard.press("f");
    await page.getByLabel("What happened").fill("this is the moment");
    await page.getByRole("button", { name: "Save note" }).click();

    await openMore(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download feedback/ }).click(),
    ]);

    expect(download.suggestedFilename()).toBe("gaffer-feedback-5v5-seed42.md");

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const markdown = Buffer.concat(chunks).toString("utf8");

    expect(markdown).toContain("# Gaffer feedback — 5-a-side, seed 42");
    expect(markdown).toContain("> this is the moment");
    expect(markdown).toContain("Replay to action");
    expect(markdown).toContain("replayTo=");
    expect(markdown).toContain("## The move log");

    // The log in the file is the real thing, not a placeholder.
    const block = markdown.slice(markdown.indexOf("```json") + 7, markdown.lastIndexOf("```"));
    expect(JSON.parse(block).length).toBeGreaterThan(0);
  });

  test("reopens a flagged moment from its own link", async ({ page }) => {
    await page.goto("./?seed=42&mode=5v5&play=hotseat&actions=2");
    for (let taken = 0; taken < 6; taken += 1) await step(page);

    await page.keyboard.press("f");
    await page.getByRole("button", { name: "Save note" }).click();

    await page.goto("./?seed=42&mode=5v5&play=hotseat&actions=2&replayTo=2");
    await expect(page.getByText(/Wound back to action 2/)).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
  });
});

test.describe("dragging a player", () => {
  /** Where the side to move has the ball. */
  const carrier = async (page: import("@playwright/test").Page) => {
    const label = await page
      .getByRole("gridcell", { name: /with the ball/ })
      .first()
      .getAttribute("aria-label");
    const found = /^Column (\d+), row (\d+):/.exec(label ?? "");
    if (!found) throw new Error(`no carrier in ${label}`);
    return { x: Number(found[1]), y: Number(found[2]) };
  };

  test("commits the same action a click would", async ({ page }) => {
    /* Four actions rather than two, so the kickoff pass this has to get past
       (ADR 0018) still leaves a turn to drag in. */
    await page.goto("./?seed=7&mode=5v5&play=hotseat&actions=4");
    await takeKickoff(page);
    await expect(page.getByLabel("Scoreboard")).toContainText("3 actions left");

    const from = await carrier(page);
    await page
      .getByRole("gridcell", { name: new RegExp(`^Column ${from.x}, row ${from.y}:`) })
      .click();
    const to = await firstOpenDestination(page);

    // Start over, this time by dragging rather than clicking. The reload puts
    // the board back to its kickoff, so that has to be taken again before the
    // destination recorded above is legal once more.
    await page.reload();
    await takeKickoff(page);
    await dragCell(page, from, to);

    await expect(page.getByLabel("Scoreboard")).toContainText("2 actions left");
    await expectNoRuleBug(page);
  });

  test("does nothing when it lands somewhere the rules do not allow", async ({ page }) => {
    await page.goto("./?seed=7&mode=5v5&play=hotseat&actions=2");
    const from = await carrier(page);

    // The opposing keeper's goal mouth is never a destination for a carrier
    // this far out, and dropping there must not half-commit anything.
    await dragCell(page, from, { x: 0, y: 2 });

    await expect(page.getByLabel("Scoreboard")).toContainText("2 actions left");
    await expectNoRuleBug(page);
  });

  test("leaves the click path alone when the pointer barely moves", async ({ page }) => {
    // Below the threshold the gesture is not a drag at all, so the existing
    // click-to-select behaviour has to survive a shaky hand untouched.
    await page.goto("./?seed=7&mode=5v5&play=hotseat&actions=2");
    const from = await carrier(page);
    const centre = await cellCentre(page, from.x, from.y);

    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 2, centre.y + 1);
    await page.mouse.up();

    await expect(page.getByLabel("Scoreboard")).toContainText("2 actions left");
    expect(await targets(page).count()).toBeGreaterThan(0);
  });

  test("works at the biggest board too", async ({ page }) => {
    await page.goto("./?seed=7&mode=11v11&play=hotseat");
    await takeKickoff(page);

    const before = await page.getByLabel("Scoreboard").textContent();
    const from = await carrier(page);
    await page
      .getByRole("gridcell", { name: new RegExp(`^Column ${from.x}, row ${from.y}:`) })
      .click();
    const to = await firstOpenDestination(page);

    await page.reload();
    await takeKickoff(page);
    await dragCell(page, from, to);

    await expect(page.getByLabel("Scoreboard")).not.toHaveText(before ?? "");
    await expectNoRuleBug(page);
  });
});

/**
 * A phone held upright.
 *
 * The testers are on phones, so this is the shape the game is actually played
 * in. Everything here is about the *drawing*: the same seed, the same commands
 * and the same engine, turned a quarter turn. The cells keep their names in the
 * engine's coordinates throughout, which is what lets every helper above work
 * unchanged at either orientation — and is also the assertion, since a cell
 * whose name depended on how you were holding your phone would break replay.
 */
test.describe("on a phone, upright", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  /** The middle of a cell, without caring which way round the board is. */
  const centreOf = async (page: import("@playwright/test").Page, x: number, y: number) =>
    cellCentre(page, x, y);

  for (const mode of ["5v5", "7v7", "11v11"] as const) {
    test(`${mode} runs up and down the screen, and never sideways off it`, async ({ page }) => {
      await page.goto(`./?seed=5&mode=${mode}&play=hotseat`);
      await expect(page.getByRole("grid")).toBeVisible();

      const board = await page.getByRole("grid").evaluate((grid) => ({
        cols: Number(grid.getAttribute("aria-colcount")),
        rows: Number(grid.getAttribute("aria-rowcount")),
      }));

      // Turned: the long axis of the pitch is down the screen.
      expect(board.rows).toBeGreaterThan(board.cols);

      // Home defends its goal at the foot of the screen, away at the head.
      const home = await centreOf(page, 0, 1);
      const away = await centreOf(page, board.rows - 1, 1);
      expect(home.y).toBeGreaterThan(away.y);

      // The whole point of turning it: it fits.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test(`${mode} is playable upright`, async ({ page }) => {
      await page.goto(`./?seed=5&mode=${mode}&play=hotseat`);

      const before = await page.getByLabel("Scoreboard").textContent();
      expect(await step(page)).toBe("acted");

      await expect(page.getByLabel("Scoreboard")).not.toHaveText(before ?? "");
      await expectNoRuleBug(page);
    });
  }

  test("a drag lands on the cell it was dropped on, not a quarter turn away", async ({ page }) => {
    await page.goto("./?seed=7&mode=5v5&play=hotseat&actions=4");
    await takeKickoff(page);

    const label = await page
      .getByRole("gridcell", { name: /with the ball/ })
      .getAttribute("aria-label");
    const found = /^Column (\d+), row (\d+):/.exec(label ?? "");
    const from = { x: Number(found![1]), y: Number(found![2]) };

    await page
      .getByRole("gridcell", { name: new RegExp(`^Column ${from.x}, row ${from.y}:`) })
      .click();
    const to = await firstOpenDestination(page);

    await page.reload();
    await takeKickoff(page);
    await dragCell(page, from, to);

    await expect(page.getByLabel("Scoreboard")).toContainText("2 actions left");
    await expectNoRuleBug(page);
  });

  test("plays a whole match through without the board and the engine falling out", async ({
    page,
  }) => {
    test.slow();
    await page.goto("./?seed=21&mode=5v5&play=hotseat&actions=2");

    await playToTheEnd(page);
    await expect(result(page)).toBeVisible();
  });
});

/**
 * Notes outliving the match that produced them.
 *
 * The gap this closes is not that feedback was unsaved — it was always on
 * disk — but that nothing outside the match it belonged to could reach it.
 * These drive the real thing: flag a moment, walk away, and go and find it.
 */
test.describe("the feedback archive", () => {
  test("finds a note taken in a match you have since left", async ({ page }) => {
    await page.goto("./?seed=1234&mode=5v5&play=hotseat");

    await page.getByRole("button", { name: /Flag moment/ }).click();
    await page.getByRole("textbox").fill("the keeper is standing in the wrong place");
    await page.getByRole("button", { name: /^Save/ }).click();

    // Walk away, exactly as somebody who never finishes a match would.
    await openMore(page);
    await page.getByRole("button", { name: "New match" }).click();
    await expect(page.getByRole("button", { name: /Kick off/ })).toBeVisible();

    await page.getByRole("button", { name: "My feedback" }).click();

    const dialog = page.getByRole("dialog", { name: "My feedback" });
    await expect(dialog).toContainText("the keeper is standing in the wrong place");
    await expect(dialog).toContainText("seed 1234");
  });

  test("hands the whole lot over as one file", async ({ page }) => {
    await page.goto("./?seed=4321&mode=5v5&play=hotseat");

    await page.getByRole("button", { name: /Flag moment/ }).click();
    await page.getByRole("textbox").fill("offside was never called");
    await page.getByRole("button", { name: /^Save/ }).click();
    await openMore(page);
    await page.getByRole("button", { name: "New match" }).click();

    await page.getByRole("button", { name: "My feedback" }).click();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download everything" }).click();

    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^gaffer-feedback-all-\d{4}-\d{2}-\d{2}\.md$/);

    const stream = await file.createReadStream();
    const text = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      stream.on("error", reject);
    });

    expect(text).toContain("offside was never called");
    expect(text).toContain("Seed `4321`");
    expect(text).toContain("replayTo=");
  });

  test("says where the notes live when there are none", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "My feedback" }).click();

    await expect(page.getByRole("dialog", { name: "My feedback" })).toContainText(
      "Nothing saved yet",
    );
  });
});

/**
 * The guided introduction.
 *
 * Driven on a phone held upright, because that is the shape the alpha is
 * played in and because the spotlight's whole job is landing on the right
 * thing when the board is drawn a quarter turn round.
 */
test.describe("how to play", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("never starts by itself", async ({ page }) => {
    await page.goto("./");

    await expect(page.getByRole("button", { name: /Kick off/ })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "How to play" })).toBeVisible();
  });

  test("teaches the whole thing and ends in a real match", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "How to play" }).click();

    const step = page.getByRole("dialog");
    await expect(step).toContainText("Pick a game type");

    await step.getByRole("button", { name: "Next" }).click();
    await expect(step).toContainText("Actions are your turn");

    await step.getByRole("button", { name: "Next" }).click();
    await expect(step).toContainText("whole setup");

    /* The step is waiting on the real button, and the real button must not be
       hidden underneath the card that is asking for it. */
    const kickOff = page.locator('[data-guide="kick-off"]');
    const button = await kickOff.boundingBox();
    const sheet = await step.boundingBox();
    expect(button!.y + button!.height).toBeLessThan(sheet!.y);

    await kickOff.click();
    await expect(step).toContainText("Tap one of your players");
    await expect(page.getByRole("grid")).toBeVisible();

    await page.getByRole("button", { name: /^Select home winger/ }).click();
    await expect(step).toContainText("lights up at once");

    await step.getByRole("button", { name: "Next" }).click();
    await expect(step).toContainText("Take the safe one");

    await page
      .getByRole("button", { name: /^Pass to/ })
      .first()
      .click();
    await expect(step).toContainText("whole game");

    await step.getByRole("button", { name: "Play for real" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Scoreboard")).toBeVisible();
    await expect(page.getByRole("button", { name: "End turn" })).toBeVisible();
    expect(page.url()).toContain("seed=");
  });

  test("lights up the thing it is talking about, and nothing else", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "How to play" }).click();

    const spot = page.locator(".guide-spotlight");
    await expect(spot).toBeVisible();

    /* Polled rather than measured once: the spotlight slides between steps, so
       a single `boundingBox` catches it in flight and compares the hole with
       where it is *going*. The claim is about where it settles. */
    await expect(async () => {
      const lit = await spot.boundingBox();
      const section = await page.locator('section[aria-labelledby="format-heading"]').boundingBox();

      // Within a few pixels of padding, the hole is over the game-type section.
      expect(Math.abs(lit!.y - section!.y)).toBeLessThan(16);
      expect(Math.abs(lit!.height - section!.height)).toBeLessThan(24);
    }).toPass({ timeout: 5_000 });
  });

  test("can be left at any point", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "How to play" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Skip" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Kick off/ })).toBeVisible();
    await expect(page.getByLabel("Scoreboard")).toHaveCount(0);
  });

  test("closes on Escape", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("is reachable from inside a match too", async ({ page }) => {
    await page.goto("./?seed=9&mode=5v5&play=hotseat");
    await expect(page.getByRole("grid")).toBeVisible();

    await openMore(page);
    await page.getByRole("button", { name: "How to play" }).click();
    await expect(page.getByRole("dialog")).toContainText("Pick a game type");
  });
});

/**
 * The field is always whole, and you never scroll to it.
 *
 * ADR 0019's promise, asserted at the sizes it has to hold at — including a
 * 320-wide phone, which is the tightest screen anybody is still using.
 */
test.describe("the board fits the screen", () => {
  const PHONES = [
    { name: "small", width: 320, height: 568 },
    { name: "common", width: 375, height: 667 },
    { name: "tall", width: 390, height: 844 },
  ];

  for (const phone of PHONES) {
    for (const mode of ["5v5", "11v11"] as const) {
      test(`${mode} on a ${phone.name} phone`, async ({ page }) => {
        await page.setViewportSize({ width: phone.width, height: phone.height });
        await page.goto(`./?seed=7&mode=${mode}&play=hotseat`);
        await expect(page.getByRole("grid")).toBeVisible();

        const fit = await page.evaluate(() => {
          const doc = document.documentElement;
          const board = document.querySelector(".pitch-board")!.getBoundingClientRect();
          return {
            vertical: doc.scrollHeight - doc.clientHeight,
            horizontal: doc.scrollWidth - doc.clientWidth,
            top: board.top,
            bottom: board.bottom,
            height: window.innerHeight,
            width: board.width,
          };
        });

        expect(fit.vertical, "the page scrolls vertically").toBeLessThanOrEqual(0);
        expect(fit.horizontal, "the page scrolls sideways").toBeLessThanOrEqual(0);
        expect(fit.top, "the board is cut off at the top").toBeGreaterThanOrEqual(0);
        expect(fit.bottom, "the board is cut off at the bottom").toBeLessThanOrEqual(fit.height);
        expect(fit.width, "the board has collapsed").toBeGreaterThan(80);
      });
    }
  }

  test("stays whole when an information panel is opened", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("./?seed=7&mode=11v11&play=hotseat");

    const board = () => page.locator(".pitch-board").boundingBox();
    const before = await board();

    await page.getByRole("tab", { name: /Commentary/ }).click();
    await expect(page.getByRole("tabpanel")).toBeVisible();

    const after = await board();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );

    // The pitch gives way to the panel rather than the page growing.
    expect(after!.height).toBeLessThan(before!.height);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("turns sideways and back from the match header", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("./?seed=7&mode=5v5&play=hotseat");

    const grid = page.getByRole("grid");
    await expect(grid).toHaveAttribute("aria-colcount", "5");

    await page.getByRole("button", { name: /Turn the board sideways/ }).click();
    await expect(grid).toHaveAttribute("aria-colcount", "7");

    await page.getByRole("button", { name: /Stand the board upright/ }).click();
    await expect(grid).toHaveAttribute("aria-colcount", "5");
  });
});

/**
 * The clock says what phase the match is in.
 *
 * Regulation counts to the turn cap and nothing else; extra time is a separate
 * count that begins at one, and it only exists for a match that was level when
 * regulation ran out (ADR 0020).
 */
test.describe("the match clock", () => {
  test("counts regulation to the turn cap", async ({ page }) => {
    await page.goto("./?seed=5&mode=5v5&play=hotseat");

    const board = page.getByLabel("Scoreboard");
    await expect(board).toContainText("Turn 1 of 24");
    await expect(board).not.toContainText("extra time");

    // And it is still the cap a few turns in, not a number that includes extra time.
    await page.getByRole("button", { name: "End turn" }).click();
    await expect(board).toContainText("Turn 2 of 24");
    await expect(board).not.toContainText(/of 32/);
  });

  test("names extra time, and counts it from one", async ({ page }) => {
    test.slow();

    /* Played out rather than constructed: the only way into extra time is to be
       level when regulation ends, which is a property of the match, not a state
       a link can ask for. A goalless seed gets there. */
    await page.goto("./?seed=5&mode=5v5&play=hotseat");
    const board = page.getByLabel("Scoreboard");

    for (let turn = 0; turn < 24; turn += 1) {
      const end = page.getByRole("button", { name: "End turn" });
      if (!(await end.isEnabled())) break;
      await end.click();
    }

    // Level after 24 turns of nothing, so extra time begins.
    await expect(board).toContainText("extra time");
    await expect(board).toContainText("Turn 1 of 8");
    await expect(board).not.toContainText("Turn 25");
  });
});

/**
 * Taking the man on.
 *
 * The one destination a plain move can never reach: the cell beyond an
 * adjacent opponent (ADR 0021). Driven through the board rather than asserted
 * against the engine, because what matters here is that the board offers it and
 * commits it like any other target.
 */
test.describe("dribbling past your man", () => {
  /** The cell a "Dribble to column X, row Y" button names. */
  const cellOf = (label: string) => {
    const found = /to column (\d+), row (\d+)/i.exec(label);
    return found ? { x: Number(found[1]), y: Number(found[2]) } : null;
  };

  test("offers the cell beyond an opponent, and commits it", async ({ page }) => {
    await page.goto("./?seed=11&mode=5v5&play=hotseat&actions=4");
    await takeKickoff(page);

    /* Walk the first few turns looking for a carrier with somebody in front of
       it. The geometry is common — a defender is directly ahead for roughly a
       quarter of carrier moments — but which turn it lands on is a seed detail. */
    let through: { label: string; from: { x: number; y: number } } | null = null;

    for (let attempt = 0; attempt < 12 && through === null; attempt += 1) {
      const carrier = page.getByRole("gridcell", { name: /with the ball/ });
      const carrierLabel = await carrier.getAttribute("aria-label");
      const from = cellOf(`to ${carrierLabel?.replace(":", "")}`) ?? {
        x: Number(/^Column (\d+)/.exec(carrierLabel ?? "")?.[1]),
        y: Number(/row (\d+)/.exec(carrierLabel ?? "")?.[1]),
      };

      await carrier.getByRole("button").first().click();

      const dribbles = page.getByRole("button", { name: /^Dribble to/ });
      const count = await dribbles.count();

      for (let index = 0; index < count; index += 1) {
        const label = (await dribbles.nth(index).getAttribute("aria-label")) ?? "";
        const to = cellOf(label);
        if (!to) continue;

        const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
        if (distance === 2) {
          through = { label, from };
          break;
        }
      }

      if (through === null) {
        const de = page.getByRole("button", { name: /^Deselect / });
        if (await de.count()) await de.first().click();
        if (await step(page)) continue;
      }
    }

    expect(through, "no through-the-man dribble appeared in twelve actions").not.toBeNull();

    await page.getByRole("button", { name: through!.label }).click();
    await expectNoRuleBug(page);

    // Whether it came off or not, the board moved on and the rules held.
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("never offers a dribble onto an occupied cell", async ({ page }) => {
    await page.goto("./?seed=11&mode=5v5&play=hotseat&actions=4");
    await takeKickoff(page);
    await selectCarrier(page);

    const dribbles = page.getByRole("button", { name: /^Dribble to/ });
    const occupied = new Set(
      (await page.getByRole("gridcell").all()).length > 0
        ? (
            await Promise.all(
              (await page.getByRole("gridcell").all()).map((cell) =>
                cell.getAttribute("aria-label"),
              ),
            )
          )
            .filter((label): label is string => label !== null && !/: empty$/.test(label))
            .map((label) => {
              const found = /^Column (\d+), row (\d+):/.exec(label);
              return `${found?.[1]},${found?.[2]}`;
            })
        : [],
    );

    for (let index = 0; index < (await dribbles.count()); index += 1) {
      const label = (await dribbles.nth(index).getAttribute("aria-label")) ?? "";
      const to = cellOf(label);
      if (to) expect(occupied.has(`${to.x},${to.y}`), `${label} lands on somebody`).toBe(false);
    }
  });

  test("tells you where a won dribble would carry the ball on to", async ({ page }) => {
    await page.goto("./?seed=11&mode=5v5&play=hotseat&actions=4");
    await takeKickoff(page);
    await selectCarrier(page);

    /* A dribble is aimed at one cell and, won, finishes on the next (ADR 0023).
       The board has to say so: the odds were always honest, the prize was not. */
    const carrying = page.getByRole("button", {
      name: /^Dribble to column \d+, row \d+, on to column \d+, row \d+ if you win/,
    });

    expect(await carrying.count(), "no dribble named its carry-on cell").toBeGreaterThan(0);

    const label = (await carrying.first().getAttribute("aria-label")) ?? "";
    const cells = [...label.matchAll(/column (\d+), row (\d+)/g)].map((found) => ({
      x: Number(found[1]),
      y: Number(found[2]),
    }));

    // One step further along, and never the cell it already named.
    const [aimed, on] = cells as [{ x: number; y: number }, { x: number; y: number }];
    expect(Math.abs(on.x - aimed.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(on.y - aimed.y)).toBeLessThanOrEqual(1);
    expect(on).not.toEqual(aimed);

    await carrying.first().click();
    await expectNoRuleBug(page);
  });
});

/**
 * Line-of-sight passing, and the flight the board draws for it.
 *
 * In a real browser because the flight is an overlay: cells drawn on top of the
 * board, which jsdom will happily report as present whether or not they are
 * visible or in the way of a click. The click-swallowing spotlight bug came from
 * exactly that gap.
 */
test.describe("a pass finds anyone with a clear lane", () => {
  test("offers the angled ball no ray could reach, with its odds", async ({ page }) => {
    await page.goto("./?seed=11&mode=5v5&play=hotseat&actions=4");
    await selectCarrier(page);

    /* The kickoff itself proves the rule: the striker's winger is two forward
       and one across, which under ray lanes was not a pass at all. A kickoff
       narrows the side to its passes (ADR 0018), so these are all of them. */
    const passes = page.getByRole("button", { name: /^Pass to/ });
    await expect(passes).toHaveCount(3);

    /* Every pass says whether it is contested, and contested ones say the odds —
       the promise is that you see them before you commit, not after. */
    const labels = await passes.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? ""),
    );
    expect(labels.filter((label) => /\d+% chance/.test(label)).length).toBeGreaterThan(0);
  });

  test("draws the ball's flight over the cells it crosses", async ({ page }) => {
    await page.goto("./?seed=11&mode=5v5&play=hotseat&actions=4");
    await selectCarrier(page);

    /* A contested pass has a lane with something beside it, so it certainly has
       a lane to draw. Hovering it should light the cells in between. */
    const contested = page.getByRole("button", { name: /^Pass to .*\d+% chance/ }).first();
    await expect(contested).toBeVisible();

    const lit = () => page.locator('[data-flight="true"]');
    await expect(lit()).toHaveCount(0);

    await contested.hover();
    await expect(lit().first()).toBeVisible();

    /* And it goes away again, rather than accumulating over a match. Moved with
       the mouse rather than by hovering something else, because everything else
       on this screen is layered and any target would be a second question. */
    await page.mouse.move(0, 0);
    await expect(lit()).toHaveCount(0);
  });

  test("the flight never swallows a click meant for the board", async ({ page }) => {
    await page.goto("./?seed=11&mode=5v5&play=hotseat&actions=4");
    await selectCarrier(page);

    const contested = page.getByRole("button", { name: /^Pass to .*\d+% chance/ }).first();
    await contested.hover();

    /* Committing while the flight is drawn must still reach the button under it. */
    await contested.click();
    await expectNoRuleBug(page);
    await expect(page.getByRole("grid")).toBeVisible();
  });
});
