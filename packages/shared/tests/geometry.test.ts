import { describe, expect, it } from "vitest";

import {
  areAdjacent,
  attackingGoalMouth,
  chebyshevDistance,
  DEFAULT_BOARD,
  DIRECTIONS,
  GOAL_MOUTH_HEIGHT,
} from "../src/index.js";

describe("DIRECTIONS", () => {
  it("is the 8 compass directions and nothing else", () => {
    expect(DIRECTIONS).toHaveLength(8);
    const seen = new Set(DIRECTIONS.map((d) => `${d.dx},${d.dy}`));
    expect(seen.size).toBe(8);
    for (const { dx, dy } of DIRECTIONS) {
      expect(Math.abs(dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(dy)).toBeLessThanOrEqual(1);
      expect(dx === 0 && dy === 0).toBe(false);
    }
  });
});

describe("chebyshevDistance", () => {
  it("counts a diagonal step as one, like an orthogonal step", () => {
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(1);
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1);
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3);
  });

  it("takes the longer axis when they differ", () => {
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 4, y: 1 })).toBe(4);
    expect(chebyshevDistance({ x: 0, y: 0 }, { x: 1, y: 4 })).toBe(4);
  });

  it("is zero for the same cell and symmetric otherwise", () => {
    expect(chebyshevDistance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
    expect(chebyshevDistance({ x: 1, y: 0 }, { x: 4, y: 3 })).toBe(
      chebyshevDistance({ x: 4, y: 3 }, { x: 1, y: 0 }),
    );
  });
});

describe("areAdjacent", () => {
  it("accepts all 8 surrounding cells", () => {
    const centre = { x: 3, y: 2 };
    for (const { dx, dy } of DIRECTIONS) {
      expect(areAdjacent(centre, { x: centre.x + dx, y: centre.y + dy })).toBe(true);
    }
  });

  it("rejects the cell itself and anything two or more away", () => {
    expect(areAdjacent({ x: 3, y: 2 }, { x: 3, y: 2 })).toBe(false);
    expect(areAdjacent({ x: 3, y: 2 }, { x: 5, y: 2 })).toBe(false);
    expect(areAdjacent({ x: 3, y: 2 }, { x: 3, y: 0 })).toBe(false);
  });
});

describe("attackingGoalMouth", () => {
  it("is a 3-cell mouth", () => {
    expect(GOAL_MOUTH_HEIGHT).toBe(3);
    expect(attackingGoalMouth("home", DEFAULT_BOARD)).toHaveLength(3);
    expect(attackingGoalMouth("away", DEFAULT_BOARD)).toHaveLength(3);
  });

  it("puts the home side's target on the far column, centre rows", () => {
    expect(attackingGoalMouth("home", DEFAULT_BOARD)).toEqual([
      { x: 6, y: 1 },
      { x: 6, y: 2 },
      { x: 6, y: 3 },
    ]);
  });

  it("puts the away side's target on the near column, centre rows", () => {
    expect(attackingGoalMouth("away", DEFAULT_BOARD)).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
  });

  it("covers exactly what a keeper on the goal-line centre can reach", () => {
    // The keeper's move range of 1 and the mouth's height of 3 are meant to
    // match; if either is retuned without the other, this fails loudly.
    const mouth = attackingGoalMouth("away", DEFAULT_BOARD);
    const keeperStart = { x: 0, y: 2 };
    for (const cell of mouth) {
      expect(chebyshevDistance(keeperStart, cell)).toBeLessThanOrEqual(1);
    }
  });
});
