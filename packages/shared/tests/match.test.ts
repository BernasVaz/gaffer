import { describe, expect, it } from "vitest";

import {
  DEFAULT_BOARD,
  FORMAT_PROFILES,
  MatchStateSchema,
  type MatchState,
  ROLE_PROFILES,
} from "../src/index.js";

const FIVES = FORMAT_PROFILES["5v5"].rules;

/** A minimal but valid two-player state, used as a base for the rejection cases. */
function baseState(): MatchState {
  return {
    format: "5v5",
    rules: FIVES,
    board: DEFAULT_BOARD,
    players: [
      {
        id: "home-striker-1",
        team: "home",
        role: "striker",
        position: { x: 3, y: 2 },
        stats: ROLE_PROFILES.striker.stats,
        moveRange: ROLE_PROFILES.striker.moveRange,
      },
      {
        id: "away-goalkeeper-1",
        team: "away",
        role: "goalkeeper",
        position: { x: 6, y: 2 },
        stats: ROLE_PROFILES.goalkeeper.stats,
        moveRange: ROLE_PROFILES.goalkeeper.moveRange,
      },
    ],
    ball: { position: { x: 3, y: 2 }, carrierId: "home-striker-1" },
    possession: "home",
    turn: 1,
    activeTeam: "home",
    actionsRemaining: FIVES.actionsPerTurn,
    score: { home: 0, away: 0 },
    kickedOff: "home",
    stats: {
      shotsAttempted: { home: 0, away: 0 },
      duelsWon: { home: 0, away: 0 },
    },
    result: null,
  };
}

describe("MatchStateSchema", () => {
  it("accepts a well-formed state", () => {
    expect(MatchStateSchema.safeParse(baseState()).success).toBe(true);
  });

  it("rejects two players sharing a cell", () => {
    const s = baseState();
    s.players[1]!.position = { ...s.players[0]!.position };
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });

  it("rejects a player standing off the board", () => {
    const s = baseState();
    s.players[0]!.position = { x: DEFAULT_BOARD.width, y: 0 };
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });

  it("rejects duplicate player ids", () => {
    const s = baseState();
    s.players[1]!.id = s.players[0]!.id;
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });

  it("rejects a carrier who is not on the pitch", () => {
    const s = baseState();
    s.ball.carrierId = "nobody";
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });

  it("rejects a ball that is not on its carrier's cell", () => {
    const s = baseState();
    s.ball.position = { x: 0, y: 0 };
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });

  it("rejects possession disagreeing with the carrier's team", () => {
    const s = baseState();
    s.possession = "away";
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });

  it("accepts a loose ball with no carrier", () => {
    const s = baseState();
    s.ball = { position: { x: 1, y: 1 }, carrierId: null };
    s.possession = null;
    expect(MatchStateSchema.safeParse(s).success).toBe(true);
  });

  it("rejects a turn count below 1", () => {
    const s = baseState();
    s.turn = 0;
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });

  it("rejects more actions remaining than a turn allows", () => {
    const s = baseState();
    s.actionsRemaining = FIVES.actionsPerTurn + 1;
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });

  it("rejects a negative score", () => {
    const s = baseState();
    s.score.home = -1;
    expect(MatchStateSchema.safeParse(s).success).toBe(false);
  });
});
