import { describe, expect, it } from "vitest";

import {
  DECISION_METHODS,
  DecisionMethodSchema,
  FORMAT_PROFILES,
  FORMATS,
  isExtraTime,
  isRegulationOver,
  MatchResultSchema,
  SHOOTOUT_KICKS,
  SHOOTOUT_SUDDEN_DEATH_ROUNDS,
  totalTurns,
  type MatchFormat,
} from "../src/index.js";

describe("extra time at 5-a-side", () => {
  it("is 8 turns — 4 a side, per GDD §10", () => {
    const { rules } = FORMAT_PROFILES["5v5"];
    expect(rules.extraTimeTurns).toBe(8);
    expect(rules.turnCap).toBe(24);
  });

  it("brings the whole match to 32 turns", () => {
    expect(totalTurns(FORMAT_PROFILES["5v5"].rules)).toBe(32);
  });
});

describe.each([...FORMATS])("extra time at %s", (format: MatchFormat) => {
  const { rules } = FORMAT_PROFILES[format];
  const end = totalTurns(rules);

  it("covers exactly the turns after the cap and up to the end", () => {
    expect(isExtraTime(rules.turnCap, rules)).toBe(false); // last regulation turn
    expect(isExtraTime(rules.turnCap + 1, rules)).toBe(true); // first extra-time turn
    expect(isExtraTime(end, rules)).toBe(true); // last extra-time turn
    expect(isExtraTime(end + 1, rules)).toBe(false); // match is over
  });

  it("agrees with isRegulationOver at the boundary", () => {
    expect(isRegulationOver(rules.turnCap, rules)).toBe(false);
    expect(isRegulationOver(rules.turnCap + 1, rules)).toBe(true);
  });
});

describe("the shootout", () => {
  it("is 5 kicks a side then a bounded sudden death", () => {
    // Five since ADR 0026, when the kicks stopped being tallied and started
    // being taken: the familiar shape is worth more than two saved rolls.
    expect(SHOOTOUT_KICKS).toBe(5);
    expect(SHOOTOUT_SUDDEN_DEATH_ROUNDS).toBe(10);
  });

  it("is bounded, so the engine can never be asked to run forever", () => {
    // The whole reason for a cap: a symmetric duel settles a sudden-death round
    // at most half the time, so "play until someone wins" has no upper bound.
    const mostKicksPossible = SHOOTOUT_KICKS * 2 + SHOOTOUT_SUDDEN_DEATH_ROUNDS * 2;
    expect(Number.isFinite(mostKicksPossible)).toBe(true);
    expect(mostKicksPossible).toBe(30);
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
          {
            team: "away",
            scored: true,
            number: 1,
            suddenDeath: false,
            takerId: "away-striker-1",
            keeperId: "home-goalkeeper-1",
            attackerTotal: 8,
            defenderTotal: 5,
            attackerRoll: 3,
            defenderRoll: 2,
            winChance: 0.625,
          },
          {
            team: "home",
            scored: false,
            number: 1,
            suddenDeath: false,
            takerId: "home-striker-1",
            keeperId: "away-goalkeeper-1",
            attackerTotal: 6,
            defenderTotal: 6,
            attackerRoll: 1,
            defenderRoll: 3,
            winChance: 0.625,
          },
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
