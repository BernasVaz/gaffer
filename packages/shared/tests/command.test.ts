import { describe, expect, it } from "vitest";

import {
  EndTurnCommandSchema,
  FORMAT_PROFILES,
  FORMATS,
  isRegulationOver,
  MatchCommandSchema,
  REJECTION_REASONS,
  RejectionReasonSchema,
  turnsRemaining,
  type MatchFormat,
} from "../src/index.js";

/* Run the clock against every format's numbers, not just 5-a-side's. The cap is
   per-match now, and a helper that only works at one scale is worse than none. */
describe.each([...FORMATS])("the clock at %s", (format: MatchFormat) => {
  const { rules } = FORMAT_PROFILES[format];
  const cap = rules.turnCap;

  it("counts the turn in progress", () => {
    expect(turnsRemaining(1, rules)).toBe(cap);
    expect(turnsRemaining(2, rules)).toBe(cap - 1);
    expect(turnsRemaining(cap, rules)).toBe(1);
  });

  it("never goes negative once regulation is over", () => {
    expect(turnsRemaining(cap + 1, rules)).toBe(0);
    expect(turnsRemaining(cap + 50, rules)).toBe(0);
  });

  it("calls regulation over only once the last turn has been played", () => {
    expect(isRegulationOver(1, rules)).toBe(false);
    expect(isRegulationOver(cap, rules)).toBe(false); // the last turn is still live
    expect(isRegulationOver(cap + 1, rules)).toBe(true);
  });
});

describe("EndTurnCommandSchema", () => {
  it("accepts an end-turn naming the acting side", () => {
    expect(EndTurnCommandSchema.safeParse({ type: "endTurn", team: "home" }).success).toBe(true);
  });

  it("rejects an end-turn with no team — a replay must be unambiguous", () => {
    expect(EndTurnCommandSchema.safeParse({ type: "endTurn" }).success).toBe(false);
  });
});

describe("MatchCommandSchema", () => {
  it("accepts all five gameplay verbs", () => {
    const commands = [
      { type: "move", playerId: "home-winger-1", target: { x: 2, y: 3 } },
      { type: "dribble", playerId: "home-striker-1", target: { x: 4, y: 2 } },
      { type: "pass", playerId: "home-striker-1", target: "home-winger-1" },
      { type: "tackle", playerId: "away-defender-1", target: "home-striker-1" },
      { type: "shoot", playerId: "home-striker-1", target: null },
    ];
    for (const command of commands) {
      expect(MatchCommandSchema.safeParse(command).success).toBe(true);
    }
  });

  it("also accepts an end-turn", () => {
    expect(MatchCommandSchema.safeParse({ type: "endTurn", team: "away" }).success).toBe(true);
  });

  it("rejects an unknown command type", () => {
    expect(MatchCommandSchema.safeParse({ type: "substitute", team: "home" }).success).toBe(false);
  });

  it("still rejects a verb with the wrong kind of target", () => {
    expect(
      MatchCommandSchema.safeParse({ type: "move", playerId: "x", target: "home-winger-1" })
        .success,
    ).toBe(false);
  });
});

describe("RejectionReasonSchema", () => {
  it("is a closed set of codes, not free text", () => {
    expect(REJECTION_REASONS).toEqual([
      "unknown-player",
      "not-your-turn",
      "no-actions-left",
      "unknown-target",
      "illegal-action",
      "match-over",
    ]);
    for (const reason of REJECTION_REASONS) {
      expect(RejectionReasonSchema.safeParse(reason).success).toBe(true);
    }
    expect(RejectionReasonSchema.safeParse("because I said so").success).toBe(false);
  });
});

describe("actions per turn", () => {
  it("is 2 at 5-a-side — the turn economy of GDD §13", () => {
    expect(FORMAT_PROFILES["5v5"].rules.actionsPerTurn).toBe(2);
  });

  it("never drops below one, whatever the format", () => {
    for (const format of FORMATS) {
      expect(FORMAT_PROFILES[format].rules.actionsPerTurn).toBeGreaterThanOrEqual(1);
    }
  });
});
