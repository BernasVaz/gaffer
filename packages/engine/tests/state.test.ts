import {
  ACTIONS_PER_TURN,
  CENTRE_SPOT,
  DEFAULT_BOARD,
  HALFWAY_COLUMN,
  isWithinBoard,
  MatchStateSchema,
  PITCH_HEIGHT,
  ROLE_PROFILES,
  ROLES,
  type MatchState,
  type Role,
  type Team,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { createInitialState } from "../src/index.js";

/** Every player on `team`. */
const of = (s: MatchState, team: Team) => s.players.filter((p) => p.team === team);

/** The single player filling `role` for `team`. */
const one = (s: MatchState, team: Team, role: Role) => {
  const found = s.players.find((p) => p.team === team && p.role === role);
  if (!found) throw new Error(`no ${team} ${role}`);
  return found;
};

/**
 * How far a player has advanced toward the opponent's goal, in cells.
 * Home attacks toward increasing x; away toward decreasing x. Normalising this
 * lets one assertion cover both sides.
 */
const advancement = (s: MatchState, team: Team, role: Role) => {
  const { x } = one(s, team, role).position;
  return team === "home" ? x : DEFAULT_BOARD.width - 1 - x;
};

describe("createInitialState", () => {
  it("produces a state the schema accepts", () => {
    expect(MatchStateSchema.safeParse(createInitialState()).success).toBe(true);
  });

  describe("the squad", () => {
    it("fields 10 players, 5 a side", () => {
      const s = createInitialState();
      expect(s.players).toHaveLength(10);
      expect(of(s, "home")).toHaveLength(5);
      expect(of(s, "away")).toHaveLength(5);
    });

    it("gives each side exactly one of every role", () => {
      const s = createInitialState();
      for (const team of ["home", "away"] as const) {
        expect(
          of(s, team)
            .map((p) => p.role)
            .sort(),
        ).toEqual([...ROLES].sort());
      }
    });

    it("gives every player the stats and move range from the GDD §6 table", () => {
      for (const p of createInitialState().players) {
        expect(p.stats).toEqual(ROLE_PROFILES[p.role].stats);
        expect(p.moveRange).toBe(ROLE_PROFILES[p.role].moveRange);
      }
    });

    it("gives every player a unique id", () => {
      const ids = createInitialState().players.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("positions", () => {
    it("places every player on the board", () => {
      const s = createInitialState();
      for (const p of s.players) {
        expect(isWithinBoard(p.position, s.board)).toBe(true);
      }
    });

    it("never puts two players on the same cell", () => {
      const s = createInitialState();
      const cells = s.players.map((p) => `${p.position.x},${p.position.y}`);
      expect(new Set(cells).size).toBe(10);
    });

    it("keeps each side in its own half", () => {
      const s = createInitialState();
      for (const p of of(s, "home")) expect(p.position.x).toBeLessThanOrEqual(HALFWAY_COLUMN);
      for (const p of of(s, "away")) expect(p.position.x).toBeGreaterThanOrEqual(HALFWAY_COLUMN);
    });

    it("stands each keeper on its own goal-line, centre row", () => {
      const s = createInitialState();
      expect(one(s, "home", "goalkeeper").position).toEqual({ x: 0, y: 2 });
      expect(one(s, "away", "goalkeeper").position).toEqual({ x: 6, y: 2 });
    });

    it("orders keeper behind defender behind midfielder behind striker", () => {
      const s = createInitialState();
      for (const team of ["home", "away"] as const) {
        const gk = advancement(s, team, "goalkeeper");
        const df = advancement(s, team, "defender");
        const mf = advancement(s, team, "midfielder");
        const st = advancement(s, team, "striker");
        expect(gk).toBeLessThan(df);
        expect(df).toBeLessThan(mf);
        expect(mf).toBeLessThan(st);
      }
    });

    it("keeps the defender central, just ahead of its keeper", () => {
      const s = createInitialState();
      for (const team of ["home", "away"] as const) {
        expect(one(s, team, "defender").position.y).toBe(2);
      }
    });

    it("spreads the midfielder and winger off the central row", () => {
      // The shape is meant to read as a formation, not as a column of players
      // stacked nose to tail. Only the keeper, the defender and the kicking-off
      // striker belong on the centre row.
      const s = createInitialState();
      for (const team of ["home", "away"] as const) {
        expect(one(s, team, "midfielder").position.y).not.toBe(2);
        expect(one(s, team, "winger").position.y).not.toBe(2);
      }
    });

    it("puts the midfielder and winger on opposite sides of centre", () => {
      const s = createInitialState();
      for (const team of ["home", "away"] as const) {
        const midfielder = one(s, team, "midfielder").position.y;
        const winger = one(s, team, "winger").position.y;
        expect(Math.sign(midfielder - 2)).toBe(-Math.sign(winger - 2));
      }
    });

    it("leaves nobody standing on the cell in front of the defender", () => {
      // (2,2) staying empty is what stops the centre row reading as a stack.
      const s = createInitialState();
      const occupied = new Set(s.players.map((p) => `${p.position.x},${p.position.y}`));
      expect(occupied.has("2,2")).toBe(false);
      expect(occupied.has("4,2")).toBe(false);
    });

    it("puts at least one player on every row of the pitch", () => {
      const s = createInitialState();
      const rows = new Set(s.players.map((p) => p.position.y));
      expect(rows.size).toBe(s.board.height);
    });

    it("puts each winger on a touchline", () => {
      const s = createInitialState();
      for (const team of ["home", "away"] as const) {
        expect([0, PITCH_HEIGHT - 1]).toContain(one(s, team, "winger").position.y);
      }
    });

    it("mirrors the away side onto the home side", () => {
      const s = createInitialState();
      // The kicking-off striker steps onto the centre spot, so it is the one
      // documented exception to the mirror.
      for (const role of ROLES.filter((r) => r !== "striker")) {
        const home = one(s, "home", role).position;
        const away = one(s, "away", role).position;
        expect(away).toEqual({
          x: DEFAULT_BOARD.width - 1 - home.x,
          y: DEFAULT_BOARD.height - 1 - home.y,
        });
      }
    });
  });

  describe("kickoff", () => {
    it("gives the ball to the kicking-off side's striker, on the centre spot", () => {
      const s = createInitialState();
      const striker = one(s, "home", "striker");
      expect(s.ball.carrierId).toBe(striker.id);
      expect(striker.position).toEqual(CENTRE_SPOT);
      expect(s.ball.position).toEqual(CENTRE_SPOT);
      expect(s.possession).toBe("home");
    });

    it("lets the away side kick off instead, symmetrically", () => {
      const s = createInitialState({ kickingOff: "away" });
      const striker = one(s, "away", "striker");
      expect(s.ball.carrierId).toBe(striker.id);
      expect(striker.position).toEqual(CENTRE_SPOT);
      expect(s.possession).toBe("away");
      expect(s.activeTeam).toBe("away");
      expect(MatchStateSchema.safeParse(s).success).toBe(true);
    });

    it("never lets the non-kicking striker occupy the centre spot", () => {
      for (const kickingOff of ["home", "away"] as const) {
        const s = createInitialState({ kickingOff });
        const other = kickingOff === "home" ? "away" : "home";
        expect(one(s, other, "striker").position).not.toEqual(CENTRE_SPOT);
      }
    });
  });

  describe("the scoreboard", () => {
    it("starts goalless on turn 1 with a full action pool", () => {
      const s = createInitialState();
      expect(s.score).toEqual({ home: 0, away: 0 });
      expect(s.turn).toBe(1);
      expect(s.activeTeam).toBe("home");
      expect(s.actionsRemaining).toBe(ACTIONS_PER_TURN);
    });

    it("uses the v1 7×5 board", () => {
      expect(createInitialState().board).toEqual(DEFAULT_BOARD);
    });
  });

  describe("purity", () => {
    it("returns an identical state every time — no hidden randomness", () => {
      expect(createInitialState()).toEqual(createInitialState());
    });

    it("returns a fresh object each call, so callers cannot alias state", () => {
      const a = createInitialState();
      const b = createInitialState();
      expect(a).not.toBe(b);
      expect(a.players).not.toBe(b.players);
      a.players[0]!.position = { x: 0, y: 0 };
      expect(b.players[0]!.position).not.toEqual({ x: 0, y: 0 });
    });
  });
});
