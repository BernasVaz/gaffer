import { describe, expect, it } from "vitest";

import {
  ACTIONS_PER_TURN,
  EndTurnCommandSchema,
  isRegulationOver,
  MatchCommandSchema,
  REJECTION_REASONS,
  RejectionReasonSchema,
  TURN_CAP,
  turnsRemaining,
} from "../src/index.js";

describe("TURN_CAP", () => {
  it("is 20 turns — 10 a side, per GDD §10", () => {
    expect(TURN_CAP).toBe(20);
    expect(TURN_CAP % 2).toBe(0); // must split evenly, or one side gets more
  });
});

describe("turnsRemaining", () => {
  it("counts the turn in progress", () => {
    expect(turnsRemaining(1)).toBe(TURN_CAP);
    expect(turnsRemaining(2)).toBe(TURN_CAP - 1);
    expect(turnsRemaining(TURN_CAP)).toBe(1);
  });

  it("never goes negative once regulation is over", () => {
    expect(turnsRemaining(TURN_CAP + 1)).toBe(0);
    expect(turnsRemaining(TURN_CAP + 50)).toBe(0);
  });
});

describe("isRegulationOver", () => {
  it("is false while turns remain and true once they do not", () => {
    expect(isRegulationOver(1)).toBe(false);
    expect(isRegulationOver(TURN_CAP)).toBe(false); // the last turn is still live
    expect(isRegulationOver(TURN_CAP + 1)).toBe(true);
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
      { type: "move", playerId: "home-winger", target: { x: 2, y: 3 } },
      { type: "dribble", playerId: "home-striker", target: { x: 4, y: 2 } },
      { type: "pass", playerId: "home-striker", target: "home-winger" },
      { type: "tackle", playerId: "away-defender", target: "home-striker" },
      { type: "shoot", playerId: "home-striker", target: null },
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
      MatchCommandSchema.safeParse({ type: "move", playerId: "x", target: "home-winger" }).success,
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
    ]);
    for (const reason of REJECTION_REASONS) {
      expect(RejectionReasonSchema.safeParse(reason).success).toBe(true);
    }
    expect(RejectionReasonSchema.safeParse("because I said so").success).toBe(false);
  });
});

describe("ACTIONS_PER_TURN", () => {
  it("is still 2 — the turn economy does not change it", () => {
    expect(ACTIONS_PER_TURN).toBe(2);
  });
});
