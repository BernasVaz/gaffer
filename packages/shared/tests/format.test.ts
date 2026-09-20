import { describe, expect, it } from "vitest";

import {
  attackingGoalMouth,
  centreSpot,
  defendingGoalMouth,
  DEFAULT_FORMAT,
  FORMAT_PROFILES,
  FORMATS,
  halfwayColumn,
  isWithinBoard,
  MatchFormatSchema,
  MatchRulesSchema,
  mirrorPosition,
  squadSize,
  totalTurns,
  type MatchFormat,
  type Position,
} from "../src/index.js";

const key = (cell: Position) => `${cell.x},${cell.y}`;
const every = [...FORMATS];

describe("the format catalogue", () => {
  it("offers the three game types a link can name", () => {
    expect(FORMATS).toEqual(["5v5", "7v7", "11v11"]);
    expect(MatchFormatSchema.safeParse("9v9").success).toBe(false);
  });

  it("defaults to the one that is actually finished", () => {
    expect(DEFAULT_FORMAT).toBe("5v5");
    expect(FORMAT_PROFILES[DEFAULT_FORMAT].status).toBe("stable");
  });

  it("marks everything else as provisional, so nobody mistakes it for tuned", () => {
    for (const format of every) {
      if (format === DEFAULT_FORMAT) continue;
      expect(FORMAT_PROFILES[format].status).toBe("alpha");
    }
  });

  it("names itself consistently", () => {
    for (const format of every) expect(FORMAT_PROFILES[format].id).toBe(format);
  });
});

describe.each(every)("the %s line-up", (format: MatchFormat) => {
  const profile = FORMAT_PROFILES[format];
  const { board, lineup } = profile;
  const mirror = (cell: Position) => mirrorPosition(cell, board);

  it("fields the squad its name promises", () => {
    const expected = Number(format.split("v")[0]);
    expect(lineup).toHaveLength(expected);
    expect(squadSize(format)).toBe(expected);
  });

  it("fields exactly one goalkeeper", () => {
    // Every other role may repeat; the keeper may not, because "the only player
    // allowed in the goal" stops meaning anything the moment there are two.
    const keepers = lineup.filter((slot) => slot.role === "goalkeeper");
    expect(keepers).toHaveLength(1);
  });

  it("fields at least one striker, because somebody has to take the kickoff", () => {
    expect(lineup.some((slot) => slot.role === "striker")).toBe(true);
  });

  it("is played on a pitch with a true centre", () => {
    // The away side is the home side rotated 180°, and a rotation needs one
    // fixed point to turn about. An even dimension has none.
    expect(board.width % 2).toBe(1);
    expect(board.height % 2).toBe(1);
  });

  it("keeps everyone on the pitch", () => {
    for (const slot of lineup) {
      expect(isWithinBoard(slot.at, board), `${slot.role} at ${key(slot.at)}`).toBe(true);
    }
  });

  it("puts nobody on two cells at once", () => {
    const cells = new Set(lineup.map((slot) => key(slot.at)));
    expect(cells.size).toBe(lineup.length);
  });

  it("does not collide with itself once the away side is rotated in", () => {
    // The one failure mode a hand-written shape invites: a cell whose mirror is
    // another cell in the same shape puts a home and an away player on one cell.
    const home = new Set(lineup.map((slot) => key(slot.at)));
    for (const slot of lineup) {
      expect(
        home.has(key(mirror(slot.at))),
        `${slot.role} at ${key(slot.at)} mirrors onto a team-mate`,
      ).toBe(false);
    }
  });

  it("leaves the centre spot free for the kickoff", () => {
    const centre = key(centreSpot(board));
    expect(lineup.map((slot) => key(slot.at))).not.toContain(centre);
  });

  it("starts the keeper in the middle of the goal it defends", () => {
    const keeper = lineup.find((slot) => slot.role === "goalkeeper")!;
    const mouth = defendingGoalMouth("home", board);

    expect(mouth.map(key)).toContain(key(keeper.at));
    // The centre of the mouth specifically, so one step covers either post.
    expect(keeper.at).toEqual(mouth[1]);
  });

  it("keeps every outfielder out of both goal mouths", () => {
    // Only the defending keeper may stand in a mouth (GDD §5), so a line-up that
    // puts anyone else there is unrepresentable before the match even starts.
    const barred = new Set([
      ...attackingGoalMouth("home", board).map(key),
      ...defendingGoalMouth("home", board).map(key),
    ]);

    for (const slot of lineup) {
      if (slot.role === "goalkeeper") continue;
      expect(barred.has(key(slot.at)), `${slot.role} at ${key(slot.at)}`).toBe(false);
    }
  });

  it("keeps the home side in its own half", () => {
    for (const slot of lineup) {
      expect(slot.at.x, `${slot.role} at ${key(slot.at)}`).toBeLessThanOrEqual(
        halfwayColumn(board),
      );
    }
  });

  it("uses the width of the pitch rather than just the middle of it", () => {
    // Both touchlines get a player once the away side is rotated in, which is
    // what stops a bigger pitch reading as a corridor.
    const rows = new Set([
      ...lineup.map((slot) => slot.at.y),
      ...lineup.map((slot) => mirror(slot.at).y),
    ]);
    expect(rows.has(0)).toBe(true);
    expect(rows.has(board.height - 1)).toBe(true);
  });

  it("cannot open with a shot at goal", () => {
    // GDD v1.2 cut SHOT_RANGE from 3 to 2 for exactly this reason: the kickoff
    // spot must sit outside shooting range, or a match can start with a strike.
    const centre = centreSpot(board);
    const nearest = Math.min(
      ...attackingGoalMouth("home", board).map((cell) =>
        Math.max(Math.abs(cell.x - centre.x), Math.abs(cell.y - centre.y)),
      ),
    );
    expect(profile.rules.shotRange).toBeLessThan(nearest);
  });
});

describe.each(every)("the %s numbers", (format: MatchFormat) => {
  const { rules } = FORMAT_PROFILES[format];

  it("are a valid rule set", () => {
    expect(MatchRulesSchema.safeParse(rules).success).toBe(true);
  });

  it("split evenly between the two sides", () => {
    // An odd count would hand one side an extra turn, in regulation or in extra
    // time — a structural advantage nothing in the design compensates for.
    expect(rules.turnCap % 2).toBe(0);
    expect(rules.extraTimeTurns % 2).toBe(0);
    expect(totalTurns(rules)).toBe(rules.turnCap + rules.extraTimeTurns);
  });
});

describe("the numbers across formats", () => {
  it("give a bigger pitch more turns to play with", () => {
    // The point of scaling the cap: an attack on a longer pitch needs more
    // actions to arrive, so a fixed cap ends bigger matches mid-attack.
    const caps = every.map((format) => FORMAT_PROFILES[format].rules.turnCap);
    const widths = every.map((format) => FORMAT_PROFILES[format].board.width);

    for (let index = 1; index < every.length; index += 1) {
      expect(widths[index]!).toBeGreaterThan(widths[index - 1]!);
      expect(caps[index]!).toBeGreaterThan(caps[index - 1]!);
    }
  });

  it("give a bigger pitch more extra time too", () => {
    const extra = every.map((format) => FORMAT_PROFILES[format].rules.extraTimeTurns);
    for (let index = 1; index < every.length; index += 1) {
      expect(extra[index]!).toBeGreaterThanOrEqual(extra[index - 1]!);
    }
  });
});
