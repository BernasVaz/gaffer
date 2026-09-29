import { expect, test, type Page } from "@playwright/test";

import { testDisplayName } from "@gaffer/shared";

/**
 * Both players get the same pitch, and it fills the phone.
 *
 * The bug this exists for: the person who created the match had the invite —
 * a heading, a share button, the raw link and a paragraph explaining it —
 * stacked *above* the board, and the board is the thing that gives way, since
 * it takes the height left over (ADR 0019). On a 390px phone that is a pitch
 * 238px wide against the joiner's 352px: the same match, one player squinting.
 * It still showed after the opponent had joined and the link had gone dead.
 *
 * So this measures rather than looks. Two guards, because they fail for
 * different reasons and a single number would hide one behind the other:
 *
 * - **Parity** — the two phones render the same pitch to the pixel. Anything
 *   one player's screen carries that the other's does not is caught here.
 * - **Share of the width** — the pitch fills the phone it is on. Parity alone
 *   is happy with two equally squashed boards.
 *
 * Both are checked before and after the second seat is taken, and in both turn
 * states, because each of those is a moment the screen puts something new on
 * itself and the pitch is what pays for it.
 */

const PHONES = [
  { label: "375x812", width: 375, height: 812 },
  { label: "390x844", width: 390, height: 844 },
];

/** The share of the viewport width a pitch must fill to count as fitted. */
const FILLS = 0.9;

async function enterAs(page: Page, name: string): Promise<void> {
  await page.goto("./?online=1");
  await page.getByLabel("Display name").fill(testDisplayName(name));
  await page.getByRole("button", { name: /I understand/ }).click();
  await expect(page.getByText(/Signed in as/)).toBeVisible();
}

/** The pitch as this player sees it: its box, and what share of the phone it fills. */
async function pitch(page: Page): Promise<{ w: number; h: number; fills: number }> {
  const box = await page.getByRole("grid").boundingBox();
  expect(box, "the pitch has no box at all").not.toBeNull();
  const viewport = page.viewportSize();
  return {
    w: Math.round(box!.width),
    h: Math.round(box!.height),
    fills: box!.width / (viewport?.width ?? 1),
  };
}

/**
 * Put the invite away if it is the kind that can be put away.
 *
 * Tolerant on purpose: this spec has to be able to run against a build where
 * the invite is a stacked panel with no dismiss, and fail on the measurement
 * rather than on a missing button.
 */
async function dismissInvite(page: Page): Promise<void> {
  const done = page.getByRole("button", { name: /^(Done|Close)/ });
  if ((await done.count()) > 0) await done.first().click();
}

for (const phone of PHONES) {
  test(`both phones get the same pitch, and it fills the screen (${phone.label})`, async ({
    browser,
  }) => {
    test.slow();

    const viewport = { width: phone.width, height: phone.height };
    const hc = await browser.newContext({ viewport });
    const ac = await browser.newContext({ viewport });
    const home = await hc.newPage();
    const away = await ac.newPage();

    await enterAs(home, "Fit-H");
    await enterAs(away, "Fit-A");

    await home.getByRole("button", { name: /Start a match/ }).click();
    const link = await home.getByLabel("Invite link").inputValue();
    await expect(home.getByTestId("turn-state")).toBeVisible({ timeout: 30_000 });

    /* --- before the join: sharing must not cost the pitch its height ------ */
    await dismissInvite(home);
    const waiting = await pitch(home);
    expect(
      waiting.fills,
      `the creator's pitch fills ${Math.round(waiting.fills * 100)}% of the width while the invite is up`,
    ).toBeGreaterThanOrEqual(FILLS);

    /* --- the second seat is taken ----------------------------------------- */
    await away.goto(link);
    await expect(away.getByTestId("turn-state")).toBeVisible({ timeout: 30_000 });
    await expect(home.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 30_000 });

    /* The link is dead now, so nothing about it may still be on screen. */
    await expect(
      home.getByRole("region", { name: "Invite" }),
      "the invite is still up after the opponent joined",
    ).toHaveCount(0);
    await expect(home.getByLabel("Invite link")).toHaveCount(0);

    /* --- your turn / waiting, on both phones ------------------------------ */
    const both = async (state: string) => {
      const [h, a] = [await pitch(home), await pitch(away)];
      expect([h.w, h.h], `the two phones disagree about the pitch — ${state}`).toEqual([a.w, a.h]);
      expect(
        h.fills,
        `the creator's pitch fills ${Math.round(h.fills * 100)}% — ${state}`,
      ).toBeGreaterThanOrEqual(FILLS);
      expect(
        a.fills,
        `the joiner's pitch fills ${Math.round(a.fills * 100)}% — ${state}`,
      ).toBeGreaterThanOrEqual(FILLS);
    };

    await both("creator to play");

    /* And with the turn the other way round, which is a different screen on
       both devices: one gains an action bar, the other loses it. */
    await home.getByRole("button", { name: /^End turn/ }).click();
    await expect(away.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 30_000 });
    await both("joiner to play");

    await hc.close();
    await ac.close();
  });
}

/**
 * The screen says what kind of match this is, and which way *you* are playing.
 *
 * Two things were wrong and both told the player something false: the header
 * read "hotseat" in a match against somebody on another phone, and the
 * scoreboard read "HOME ↑ / AWAY ↓" on both devices although the joiner's
 * pitch is flipped — so the arrow pointed away from the goal they were
 * attacking.
 */
test("the header and scoreboard follow the player, not the database", async ({ browser }) => {
  test.slow();

  const viewport = { width: 390, height: 844 };
  const hc = await browser.newContext({ viewport });
  const ac = await browser.newContext({ viewport });
  const home = await hc.newPage();
  const away = await ac.newPage();

  await enterAs(home, "Say-H");
  await enterAs(away, "Say-A");

  await home.getByRole("button", { name: /Start a match/ }).click();
  const link = await home.getByLabel("Invite link").inputValue();
  await away.goto(link);
  await expect(home.getByTestId("turn-state")).toHaveText(/Your turn/, { timeout: 30_000 });

  for (const [page, who] of [
    [home, "creator"],
    [away, "joiner"],
  ] as const) {
    const header = page.getByTestId("match-meta");
    await expect(header, `the ${who} is told they are in a hotseat match`).not.toContainText(
      "hotseat",
    );
    await expect(header, `the ${who} is not told this is online`).toContainText(/online/i);

    /* Each player attacks up their own screen, and the strip has to say so. */
    const scoreboard = page.getByLabel("Scoreboard");
    await expect(scoreboard, `the ${who} is not shown as "you"`).toContainText(/you/i);
    await expect(
      page.getByText("you attack up"),
      `the ${who} is told they attack the wrong way`,
    ).toHaveCount(1);
  }

  /* Each player is told who they are playing. */
  await expect(home.getByTestId("match-meta")).toContainText(testDisplayName("Say-A"));
  await expect(away.getByTestId("match-meta")).toContainText(testDisplayName("Say-H"));

  await hc.close();
  await ac.close();
});
