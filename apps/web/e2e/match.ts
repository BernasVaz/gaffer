import { expect, type Page } from "@playwright/test";

/**
 * Driving a match the way a person does: only through what is on screen.
 *
 * Every locator here is a role and an accessible name, never a class or a test
 * id. That is not purity for its own sake — it means this suite exercises the
 * same surface a screen-reader user has, so a change that leaves the board
 * looking fine while making it unusable fails here rather than in someone's lap.
 */

/** Players the board is currently offering as yours to command. */
export const selectable = (page: Page) => page.getByRole("button", { name: /^Select / });

/** Everything the selected player could do. */
export const targets = (page: Page) =>
  page.getByRole("button", { name: /^(Move to|Dribble to|Pass to|Tackle |Shoot)/ });

/** The banner that only exists once a match has been decided. */
export const result = (page: Page) => page.getByText(/decided by/);

/** The one line that reports what just happened — and what was refused. */
export const status = (page: Page) => page.getByLabel("Match status");

/**
 * The engine refusing a command the board offered is the bug this whole layer
 * exists to catch: it means the two disagree about the same position.
 */
export async function expectNoRuleBug(page: Page): Promise<void> {
  await expect(status(page)).not.toContainText("Refused:");
}

/** What one step of a match did. */
export type Step = "acted" | "passed" | "over";

/**
 * Take one action, or hand the turn over if there is nothing to do.
 *
 * It tries each of its own players in turn rather than assuming the first one
 * has a move: a player can be fully boxed in, and a suite that gave up there
 * would report a rule bug that is really a crowded corner.
 */
export async function step(page: Page): Promise<Step> {
  if (await result(page).isVisible()) return "over";

  const mine = selectable(page);
  const count = await mine.count();

  for (let index = 0; index < count; index += 1) {
    await mine.nth(index).click();

    if ((await targets(page).count()) > 0) {
      await targets(page).first().click();
      await expectNoRuleBug(page);

      // A goal suspends the board while it is celebrated. Wait for it to come
      // back rather than clicking into an animation.
      await expect(selectable(page).first().or(result(page))).toBeVisible({ timeout: 10_000 });
      return "acted";
    }

    // Nothing doing — put that player back and try the next.
    const deselect = page.getByRole("button", { name: /^Deselect / });
    if ((await deselect.count()) > 0) await deselect.first().click();
  }

  const endTurn = page.getByRole("button", { name: "End turn" });
  if (await endTurn.isEnabled()) {
    await endTurn.click();
    await expectNoRuleBug(page);
    return "passed";
  }

  return "over";
}

/**
 * Play until the match is decided, or until `limit` steps have gone by.
 *
 * The limit is a guard against a hang, not an expectation: a match is at most 32
 * turns of two actions, so anything near it means something has stopped
 * progressing.
 */
export async function playToTheEnd(page: Page, limit = 260): Promise<number> {
  for (let taken = 0; taken < limit; taken += 1) {
    const outcome = await step(page);
    if (outcome === "over") return taken;
  }

  return limit;
}

/** The middle of a given cell, in page coordinates. */
export async function cellCentre(page: Page, x: number, y: number) {
  const cell = page.getByRole("gridcell", { name: new RegExp(`^Column ${x}, row ${y}:`) });
  const box = await cell.boundingBox();
  if (!box) throw new Error(`cell ${x},${y} is not on screen`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The first cell the board is currently offering as a destination. */
export async function firstOpenDestination(page: Page) {
  const label = await page
    .getByRole("button", { name: /^(Move to|Dribble to)/ })
    .first()
    .getAttribute("aria-label");

  const found = /to column (\d+), row (\d+)/i.exec(label ?? "");
  if (!found) throw new Error(`no destination in ${label}`);
  return { x: Number(found[1]), y: Number(found[2]) };
}

/** Drag from one cell to another, the way a hand would. */
export async function dragCell(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const start = await cellCentre(page, from.x, from.y);
  const end = await cellCentre(page, to.x, to.y);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}
