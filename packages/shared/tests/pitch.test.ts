import { describe, expect, it } from "vitest";

import {
  CENTRE_SPOT,
  DEFAULT_BOARD,
  HALFWAY_COLUMN,
  isWithinBoard,
  mirrorPosition,
  PITCH_HEIGHT,
  PITCH_WIDTH,
  PositionSchema,
} from "../src/index.js";

describe("pitch dimensions", () => {
  it("matches the GDD §5 v1 flagship: 7 columns × 5 rows", () => {
    expect(PITCH_WIDTH).toBe(7);
    expect(PITCH_HEIGHT).toBe(5);
    expect(DEFAULT_BOARD).toEqual({ width: 7, height: 5 });
  });

  it("puts the halfway line and centre spot in the middle", () => {
    expect(HALFWAY_COLUMN).toBe(3);
    expect(CENTRE_SPOT).toEqual({ x: 3, y: 2 });
  });
});

describe("PositionSchema", () => {
  it("accepts non-negative integer coordinates", () => {
    expect(PositionSchema.parse({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(PositionSchema.parse({ x: 6, y: 4 })).toEqual({ x: 6, y: 4 });
  });

  it("rejects negative or fractional coordinates", () => {
    expect(PositionSchema.safeParse({ x: -1, y: 0 }).success).toBe(false);
    expect(PositionSchema.safeParse({ x: 0, y: 1.5 }).success).toBe(false);
  });
});

describe("isWithinBoard", () => {
  it("accepts every cell of the default board", () => {
    for (let x = 0; x < PITCH_WIDTH; x += 1) {
      for (let y = 0; y < PITCH_HEIGHT; y += 1) {
        expect(isWithinBoard({ x, y }, DEFAULT_BOARD)).toBe(true);
      }
    }
  });

  it("rejects cells past either edge", () => {
    expect(isWithinBoard({ x: PITCH_WIDTH, y: 0 }, DEFAULT_BOARD)).toBe(false);
    expect(isWithinBoard({ x: 0, y: PITCH_HEIGHT }, DEFAULT_BOARD)).toBe(false);
  });
});

describe("mirrorPosition", () => {
  /*
   * The away side is the home side rotated 180°, not reflected — the teams face
   * each other. That means both axes flip, which is what keeps a wide player wide
   * on the opposite touchline.
   */
  it("rotates a corner to the opposite corner", () => {
    expect(mirrorPosition({ x: 0, y: 0 }, DEFAULT_BOARD)).toEqual({ x: 6, y: 4 });
    expect(mirrorPosition({ x: 6, y: 4 }, DEFAULT_BOARD)).toEqual({ x: 0, y: 0 });
  });

  it("maps a home goal-line centre to the away goal-line centre", () => {
    expect(mirrorPosition({ x: 0, y: 2 }, DEFAULT_BOARD)).toEqual({ x: 6, y: 2 });
  });

  it("keeps a wide player on a touchline, on the far side", () => {
    expect(mirrorPosition({ x: 2, y: 0 }, DEFAULT_BOARD)).toEqual({ x: 4, y: 4 });
  });

  it("leaves the centre spot fixed", () => {
    expect(mirrorPosition(CENTRE_SPOT, DEFAULT_BOARD)).toEqual(CENTRE_SPOT);
  });

  it("is its own inverse", () => {
    const p = { x: 1, y: 3 };
    expect(mirrorPosition(mirrorPosition(p, DEFAULT_BOARD), DEFAULT_BOARD)).toEqual(p);
  });
});
