import { DEFAULT_BOARD } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { layoutFor } from "../src/board/orientation";

/**
 * Each player looks up the pitch at their own goal.
 *
 * Online, the two people are on two phones, and "home attacks up" is only
 * friendly to one of them. The away player gets the same picture turned round:
 * their own team along the bottom, attacking up their own screen.
 *
 * **Display only.** The engine's coordinates never move — `x` still runs goal to
 * goal with home attacking up the numbers — which is what keeps a match
 * replayable from its seed however it was drawn, and why cell names stay in
 * engine coordinates (ADR 0014).
 */
const board = DEFAULT_BOARD;

describe("the away player's view", () => {
  it("is the home view turned round", () => {
    const home = layoutFor(board, "portrait", false);
    const away = layoutFor(board, "portrait", true);

    /* The same cell, drawn at opposite ends. */
    const corner = { x: 0, y: 0 };
    expect(home.toScreen(corner)).not.toEqual(away.toScreen(corner));

    expect(home.cols).toBe(away.cols);
    expect(home.rows).toBe(away.rows);
  });

  it("puts each side attacking up its own screen", () => {
    /* Home attacks +x, away attacks −x. Drawn, both should move towards
       row 0 — up the screen — from their own point of view. */
    const home = layoutFor(board, "portrait", false);
    const away = layoutFor(board, "portrait", true);

    const upfieldForHome = home.rotate({ x: 1, y: 0 });
    const upfieldForAway = away.rotate({ x: -1, y: 0 });

    expect(upfieldForHome.y, "home attacks up their screen").toBeLessThan(0);
    expect(upfieldForAway.y, "away attacks up their screen").toBeLessThan(0);
  });

  it("puts the away goal at the bottom of the away player's screen", () => {
    const away = layoutFor(board, "portrait", true);

    /* Away defends x = width − 1. On their screen that should be the bottom. */
    const ownGoal = away.toScreen({ x: board.width - 1, y: 1 });
    const theirGoal = away.toScreen({ x: 0, y: 1 });

    expect(ownGoal.row).toBeGreaterThan(theirGoal.row);
  });

  it("round-trips every cell, in both viewpoints and both orientations", () => {
    /* A layout that cannot be inverted is a board where a tap lands on the
       wrong cell — which is the whole failure mode this guards against. */
    for (const orientation of ["portrait", "landscape"] as const) {
      for (const flipped of [false, true]) {
        const layout = layoutFor(board, orientation, flipped);

        for (let x = 0; x < board.width; x += 1) {
          for (let y = 0; y < board.height; y += 1) {
            const { col, row } = layout.toScreen({ x, y });
            expect(
              layout.toBoard(col, row),
              `${orientation} flipped=${flipped} (${x},${y})`,
            ).toEqual({ x, y });
          }
        }
      }
    }
  });

  it("leaves the home view exactly as it was", () => {
    /* The single-player screen must not move a pixel. */
    const before = layoutFor(board, "portrait");
    expect(before.toScreen({ x: 0, y: 0 })).toEqual({ col: 0, row: board.width - 1 });
    expect(before.rotate({ x: 1, y: 0 })).toEqual({ x: 0, y: -1 });
  });
});
