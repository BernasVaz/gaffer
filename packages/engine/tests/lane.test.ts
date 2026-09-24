import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { laneBetween } from "../src/lane.js";

/** A lane as a sorted list of `x,y`, so two lanes compare regardless of order. */
const cells = (from: [number, number], to: [number, number]): string[] =>
  laneBetween({ x: from[0], y: from[1] }, { x: to[0], y: to[1] })
    .map((cell) => `${cell.x},${cell.y}`)
    .sort();

describe("the lane a ball flies down", () => {
  it("is empty between neighbours, so a short ball can never be blocked", () => {
    expect(cells([2, 2], [3, 2])).toEqual([]);
    expect(cells([2, 2], [3, 3])).toEqual([]);
    expect(cells([2, 2], [2, 2])).toEqual([]);
  });

  it("is the cells in between on a straight lane", () => {
    expect(cells([0, 0], [3, 0])).toEqual(["1,0", "2,0"]);
    expect(cells([0, 3], [0, 0])).toEqual(["0,1", "0,2"]);
  });

  it("clips the corners of a diagonal rather than crossing them", () => {
    /* The flight touches the corners of (1,0) and (0,1) and no more, so a
       defender there is beside the ball, not under it — which is what keeps
       every lane that was legal before this rule legal after it. */
    expect(cells([0, 0], [2, 2])).toEqual(["1,1"]);
    expect(cells([0, 0], [3, 3])).toEqual(["1,1", "2,2"]);
  });

  it("crosses both squares on an angled ball", () => {
    /* Two across and one up: the flight is over (1,0) for the first half and
       (1,1) for the second, so either body stops it. */
    expect(cells([0, 0], [2, 1])).toEqual(["1,0", "1,1"]);
    expect(cells([0, 0], [3, 1])).toEqual(["1,0", "2,1"]);
  });

  it("is the same lane from either end", () => {
    /* A pass legal one way and blocked the other would be a rule nobody could
       hold in their head. */
    fc.assert(
      fc.property(
        fc.integer({ min: -9, max: 9 }),
        fc.integer({ min: -9, max: 9 }),
        fc.integer({ min: -9, max: 9 }),
        fc.integer({ min: -9, max: 9 }),
        (ax, ay, bx, by) => {
          expect(cells([ax, ay], [bx, by])).toEqual(cells([bx, by], [ax, ay]));
        },
      ),
      { numRuns: 500 },
    );
  });

  it("never names an endpoint, and never leaves the box between them", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -9, max: 9 }),
        fc.integer({ min: -9, max: 9 }),
        fc.integer({ min: -9, max: 9 }),
        fc.integer({ min: -9, max: 9 }),
        (ax, ay, bx, by) => {
          for (const cell of laneBetween({ x: ax, y: ay }, { x: bx, y: by })) {
            expect(cell).not.toEqual({ x: ax, y: ay });
            expect(cell).not.toEqual({ x: bx, y: by });
            expect(cell.x).toBeGreaterThanOrEqual(Math.min(ax, bx));
            expect(cell.x).toBeLessThanOrEqual(Math.max(ax, bx));
            expect(cell.y).toBeGreaterThanOrEqual(Math.min(ay, by));
            expect(cell.y).toBeLessThanOrEqual(Math.max(ay, by));
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("holds every ray lane it used to", () => {
    /* The rule it replaces, re-run as a property: along any of the eight rays
       the lane is exactly the cells stepped over. Nothing legal became illegal.  */
    const rays = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const;

    for (const [dx, dy] of rays) {
      for (let steps = 1; steps <= 6; steps += 1) {
        const expected = Array.from(
          { length: steps - 1 },
          (_unused, index) => `${dx * (index + 1)},${dy * (index + 1)}`,
        ).sort();
        expect(cells([0, 0], [dx * steps, dy * steps]), `${dx},${dy} by ${steps}`).toEqual(
          expected,
        );
      }
    }
  });
});
