import { describe, expect, it } from "vitest";

import {
  DECISION_METHODS,
  DecisionMethodSchema,
  EXTRA_TIME_TURNS,
  isExtraTime,
  isRegulationOver,
  MatchResultSchema,
  SHOOTOUT_KICKS,
  SHOOTOUT_SUDDEN_DEATH_ROUNDS,
  TURN_CAP,
  TOTAL_TURNS,
} from "../src/index.js";

describe("extra time", () => {
  it("is 4 turns — 2 a side, per GDD §10", () => {
    expect(EXTRA_TIME_TURNS).toBe(4);
    expect(EXTRA_TIME_TURNS % 2).toBe(0); // must split evenly
  });

  it("brings the whole match to 28 turns", () => {
    expect(TOTAL_TURNS).toBe(TURN_CAP + EXTRA_TIME_TURNS);
    expect(TOTAL_TURNS).toBe(28);
  });
});

describe("isExtraTime", () => {
  it("covers exactly the turns after the cap and up to the end", () => {
    expect(isExtraTime(TURN_CAP)).toBe(false); // last regulation turn
    expect(isExtraTime(TURN_CAP + 1)).toBe(true); // first extra-time turn
    expect(isExtraTime(TOTAL_TURNS)).toBe(true); // last extra-time turn
    expect(isExtraTime(TOTAL_TURNS + 1)).toBe(false); // match is over
  });

  it("agrees with isRegulationOver at the boundary", () => {
    expect(isRegulationOver(TURN_CAP)).toBe(false);
    expect(isRegulationOver(TURN_CAP + 1)).toBe(true);
  });
});

describe("the shootout", () => {
  it("is 3 kicks a side then a bounded sudden death", () => {
    expect(SHOOTOUT_KICKS).toBe(3);
    expect(SHOOTOUT_SUDDEN_DEATH_ROUNDS).toBe(10);
  });

  it("is bounded, so the engine can never be asked to run forever", () => {
    // The whole reason for a cap: a symmetric duel settles a sudden-death round
    // at most half the time, so "play until someone wins" has no upper bound.
    const mostKicksPossible = SHOOTOUT_KICKS * 2 + SHOOTOUT_SUDDEN_DEATH_ROUNDS * 2;
    expect(Number.isFinite(mostKicksPossible)).toBe(true);
    expect(mostKicksPossible).toBe(26);
  });
});

describe("DECISION_METHODS", () => {
  it("lists every way a match can be decided, most earned first", () => {
    expect(DECISION_METHODS).toEqual([
      "regulation",
      "goldenGoal",
      "shootout",
      "shotsAttempted",
      "duelsWon",
      "kickoffCompensation",
    ]);
  });

  it("is a closed set", () => {
    for (const method of DECISION_METHODS) {
      expect(DecisionMethodSchema.safeParse(method).success).toBe(true);
    }
    expect(DecisionMethodSchema.safeParse("coin-toss").success).toBe(false);
  });
});

describe("MatchResultSchema", () => {
  it("accepts a result decided in regulation, with no shootout", () => {
    const result = { winner: "home", decidedBy: "regulation", shootout: null };
    expect(MatchResultSchema.safeParse(result).success).toBe(true);
  });

  it("accepts a result decided on penalties, carrying the kicks", () => {
    const result = {
      winner: "away",
      decidedBy: "shootout",
      shootout: {
        home: 1,
        away: 2,
        kicks: [
          { team: "away", scored: true },
          { team: "home", scored: false },
        ],
      },
    };
    expect(MatchResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects a result with no winner — GDD §10 forbids a draw", () => {
    expect(
      MatchResultSchema.safeParse({ winner: null, decidedBy: "regulation", shootout: null })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown decision method", () => {
    expect(
      MatchResultSchema.safeParse({ winner: "home", decidedBy: "vibes", shootout: null }).success,
    ).toBe(false);
  });
});
