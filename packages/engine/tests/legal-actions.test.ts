import { ActionSchema, DEFAULT_BOARD, type Action, type Team } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { createInitialState, legalActions } from "../src/index.js";
import { makeState } from "./helpers.js";

const only = (actions: readonly Action[], type: Action["type"]) =>
  actions.filter((action) => action.type === type);

const cellsOf = (actions: readonly Action[], type: "move" | "dribble", playerId?: string) =>
  new Set(
    only(actions, type)
      .filter((action) => playerId === undefined || action.playerId === playerId)
      .map((action) => {
        const target = action.target as { x: number; y: number };
        return `${target.x},${target.y}`;
      }),
  );

describe("legalActions", () => {
  describe("contract", () => {
    it("returns actions that all validate against ActionSchema", () => {
      for (const action of legalActions(createInitialState())) {
        expect(ActionSchema.safeParse(action).success).toBe(true);
      }
    });

    it("only ever offers actions for the side to move", () => {
      const state = createInitialState();
      const ids = new Set(
        state.players.filter((p) => p.team === state.activeTeam).map((p) => p.id),
      );
      for (const action of legalActions(state)) {
        expect(ids.has(action.playerId)).toBe(true);
      }
    });

    it("offers nothing once the action pool is spent", () => {
      const state = createInitialState();
      expect(legalActions({ ...state, actionsRemaining: 0 })).toEqual([]);
    });

    it("never lists the same action twice", () => {
      const actions = legalActions(createInitialState());
      const keys = actions.map((a) => `${a.type}:${a.playerId}:${JSON.stringify(a.target)}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("does not mutate the state it is given", () => {
      const state = createInitialState();
      const before = JSON.stringify(state);
      legalActions(state);
      expect(JSON.stringify(state)).toBe(before);
    });
  });

  describe("move geometry", () => {
    it("radiates along all 8 directions up to the role's range", () => {
      // A lone midfielder (range 3) at the centre of an otherwise empty pitch.
      const state = makeState([{ team: "home", role: "midfielder", at: [3, 2] }]);
      const moves = cellsOf(legalActions(state), "move");

      // N and S run out of pitch after 2 and the four diagonals after 2. East
      // and west would reach three, but the third cell each way is a goal mouth,
      // which no outfielder may enter — so they stop at two.
      expect(moves.size).toBe(16);
      expect(moves).toContain("5,2"); // up to the away mouth
      expect(moves).not.toContain("6,2"); // never into it
      expect(moves).toContain("1,2"); // up to its own mouth
      expect(moves).not.toContain("0,2"); // nor into that one
      expect(moves).toContain("3,0"); // two north
      expect(moves).toContain("5,0"); // two north-east
      expect(moves).not.toContain("3,2"); // never its own cell
    });

    it("stops before the first occupied cell and cannot pass through it", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [3, 2] },
        { team: "home", role: "winger", at: [5, 2] },
      ]);
      // Scoped to the midfielder: the blocking winger is also on the side to
      // move and contributes its own destinations.
      const moves = cellsOf(legalActions(state), "move", "home-midfielder-0");

      expect(moves).toContain("4,2"); // up to the blocker
      expect(moves).not.toContain("5,2"); // not onto it
      expect(moves).not.toContain("6,2"); // not through it
    });

    it("is blocked by opponents exactly as by team-mates", () => {
      const movesOfMidfielder = (blockerTeam: Team) =>
        cellsOf(
          legalActions(
            makeState([
              { team: "home", role: "midfielder", at: [3, 2] },
              { team: blockerTeam, role: "winger", at: [5, 2] },
            ]),
          ),
          "move",
          "home-midfielder-0",
        );

      expect(movesOfMidfielder("away")).toEqual(movesOfMidfielder("home"));
    });

    it("respects each role's own range", () => {
      const keeper = makeState([{ team: "home", role: "goalkeeper", at: [3, 2] }]);
      const striker = makeState([{ team: "home", role: "striker", at: [3, 2] }]);

      // Range 1 reaches its 8 neighbours; range 2 reaches further.
      expect(cellsOf(legalActions(keeper), "move").size).toBe(8);
      expect(cellsOf(legalActions(striker), "move").size).toBeGreaterThan(8);
    });

    it("never leaves the pitch", () => {
      const state = makeState([{ team: "home", role: "midfielder", at: [0, 0] }]);
      for (const action of only(legalActions(state), "move")) {
        const target = action.target as { x: number; y: number };
        expect(target.x).toBeGreaterThanOrEqual(0);
        expect(target.y).toBeGreaterThanOrEqual(0);
        expect(target.x).toBeLessThan(DEFAULT_BOARD.width);
        expect(target.y).toBeLessThan(DEFAULT_BOARD.height);
      }
    });
  });

  describe("the Move / Dribble boundary", () => {
    it("makes escaping a press a Dribble, not a free Move", () => {
      // Carrier pressed at its origin; every destination is contested, even the
      // ones that end far from the opponent.
      const state = makeState([
        { team: "home", role: "midfielder", at: [3, 2], ball: true },
        { team: "away", role: "defender", at: [3, 3] },
      ]);
      const actions = legalActions(state);

      expect(only(actions, "move")).toHaveLength(0);
      expect(only(actions, "dribble").length).toBeGreaterThan(0);
      expect(cellsOf(actions, "dribble")).toContain("3,0"); // well clear of the presser
    });

    it("makes advancing into contact a Dribble", () => {
      // Carrier starts free; only the destinations beside the opponent are contested.
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "away", role: "defender", at: [4, 2] },
      ]);
      const actions = legalActions(state);
      const dribbles = cellsOf(actions, "dribble");
      const moves = cellsOf(actions, "move");

      expect(dribbles).toContain("3,2"); // lands beside the opponent
      expect(moves).toContain("2,1"); // reachable, and clear of the opponent
      expect(dribbles).not.toContain("2,1");
    });

    it("leaves a clean run free even when the path grazes an opponent", () => {
      // Diagonal run from (0,0). It passes (1,1) and (2,2), both beside the
      // defender at (2,1), then finishes at (3,3), which is clear of it.
      // Locked design: only origin and destination decide, so (3,3) is a Move.
      const state = makeState([
        { team: "home", role: "midfielder", at: [0, 0], ball: true },
        { team: "away", role: "defender", at: [2, 1] },
      ]);
      const actions = legalActions(state);

      expect(cellsOf(actions, "move")).toContain("3,3");
      expect(cellsOf(actions, "dribble")).not.toContain("3,3");
      // ...while stopping alongside the defender mid-run stays contested.
      expect(cellsOf(actions, "dribble")).toContain("1,1");
      expect(cellsOf(actions, "dribble")).toContain("2,2");
    });

    it("classifies every carrier destination as exactly one of Move or Dribble", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [3, 2], ball: true },
        { team: "away", role: "defender", at: [5, 2] },
      ]);
      const actions = legalActions(state);
      const moves = cellsOf(actions, "move");
      const dribbles = cellsOf(actions, "dribble");

      for (const cell of moves) expect(dribbles).not.toContain(cell);
      for (const cell of dribbles) expect(moves).not.toContain(cell);
    });

    it("never offers a Dribble to a player without the ball", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [3, 2] },
        { team: "home", role: "winger", at: [1, 1], ball: true },
        { team: "away", role: "defender", at: [3, 3] },
      ]);
      const dribblers = new Set(only(legalActions(state), "dribble").map((a) => a.playerId));
      expect(dribblers.has("home-midfielder-0")).toBe(false);
    });
  });

  describe("passing", () => {
    it("offers a team-mate down a clear lane within PAS range", () => {
      // Midfielder PAS 4.
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "striker", at: [4, 2] },
      ]);
      const passes = only(legalActions(state), "pass");
      expect(passes.map((p) => p.target)).toEqual(["home-striker-1"]);
    });

    it("does not offer a team-mate beyond PAS range", () => {
      // Striker PAS 2, team-mate 4 cells away.
      const state = makeState([
        { team: "home", role: "striker", at: [1, 2], ball: true },
        { team: "home", role: "winger", at: [5, 2] },
      ]);
      expect(only(legalActions(state), "pass")).toHaveLength(0);
    });

    it("does not offer a team-mate who is off any straight lane", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "winger", at: [3, 3] }, // knight-ish offset
      ]);
      expect(only(legalActions(state), "pass")).toHaveLength(0);
    });

    it("does not pass through a player standing in the lane", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "away", role: "defender", at: [2, 2] },
        { team: "home", role: "striker", at: [3, 2] },
      ]);
      expect(only(legalActions(state), "pass")).toHaveLength(0);
    });

    it("still offers a pass when an opponent merely sits beside the lane", () => {
      // Interception is a duel on execution, not an illegality (GDD §7).
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "striker", at: [4, 2] },
        { team: "away", role: "defender", at: [2, 3] },
      ]);
      expect(only(legalActions(state), "pass").map((p) => p.target)).toEqual(["home-striker-1"]);
    });

    it("offers only the nearest team-mate on a lane, not the one screened behind", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "winger", at: [2, 2] },
        { team: "home", role: "striker", at: [3, 2] },
      ]);
      expect(only(legalActions(state), "pass").map((p) => p.target)).toEqual(["home-winger-1"]);
    });

    it("never offers a pass from a player without the ball", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "striker", at: [3, 2] },
      ]);
      for (const pass of only(legalActions(state), "pass")) {
        expect(pass.playerId).toBe("home-midfielder-0");
      }
    });
  });

  describe("tackling", () => {
    it("offers a tackle from a defender already beside the carrier", () => {
      const state = makeState(
        [
          { team: "away", role: "striker", at: [3, 2], ball: true },
          { team: "home", role: "defender", at: [3, 3] },
        ],
        { activeTeam: "home" },
      );
      const tackles = only(legalActions(state), "tackle");
      expect(tackles).toHaveLength(1);
      expect(tackles[0]!.playerId).toBe("home-defender-1");
      expect(tackles[0]!.target).toBe("away-striker-0");
    });

    it("does not bundle movement — a distant defender must Move first", () => {
      const state = makeState(
        [
          { team: "away", role: "striker", at: [3, 2], ball: true },
          { team: "home", role: "defender", at: [1, 2] }, // two cells away
        ],
        { activeTeam: "home" },
      );
      const actions = legalActions(state);
      expect(only(actions, "tackle")).toHaveLength(0);
      expect(cellsOf(actions, "move")).toContain("2,2"); // can step in this turn
    });

    it("offers a tackle from every adjacent defender", () => {
      const state = makeState(
        [
          { team: "away", role: "striker", at: [3, 2], ball: true },
          { team: "home", role: "defender", at: [3, 3] },
          { team: "home", role: "midfielder", at: [2, 1] },
          { team: "home", role: "winger", at: [0, 0] },
        ],
        { activeTeam: "home" },
      );
      const tacklers = only(legalActions(state), "tackle").map((a) => a.playerId);
      expect(tacklers.sort()).toEqual(["home-defender-1", "home-midfielder-2"]);
    });

    it("never offers a tackle to the side holding the ball", () => {
      const state = makeState(
        [
          { team: "home", role: "striker", at: [3, 2], ball: true },
          { team: "away", role: "defender", at: [3, 3] },
        ],
        { activeTeam: "home" },
      );
      expect(only(legalActions(state), "tackle")).toHaveLength(0);
    });

    it("offers no tackle when the ball is loose", () => {
      const state = makeState(
        [
          { team: "home", role: "defender", at: [3, 3] },
          { team: "away", role: "striker", at: [3, 2] },
        ],
        { activeTeam: "home" },
      );
      expect(only(legalActions(state), "tackle")).toHaveLength(0);
    });
  });

  describe("shooting", () => {
    it("offers a shot from inside SHOT_RANGE of the goal mouth", () => {
      // Home attacks x = 6; mouth is (6,1)–(6,3). From (4,2) that is 2 cells.
      const state = makeState([{ team: "home", role: "striker", at: [4, 2], ball: true }]);
      const shots = only(legalActions(state), "shoot");
      expect(shots).toHaveLength(1);
      expect(shots[0]!.playerId).toBe("home-striker-0");
      expect(shots[0]!.target).toBeNull();
    });

    it("offers no shot from beyond SHOT_RANGE", () => {
      // (3,2) is 3 cells out — one step too far now that SHOT_RANGE is 2.
      const state = makeState([{ team: "home", role: "striker", at: [3, 2], ball: true }]);
      expect(only(legalActions(state), "shoot")).toHaveLength(0);
    });

    it("measures range to the nearest mouth cell, so wide positions still count", () => {
      // (4,0) is 2 from (6,1), the top of the mouth, though 3 from its centre.
      const state = makeState([{ team: "home", role: "striker", at: [4, 0], ball: true }]);
      expect(only(legalActions(state), "shoot")).toHaveLength(1);
    });

    it("aims the away side at the opposite goal", () => {
      const state = makeState([{ team: "away", role: "striker", at: [2, 2], ball: true }], {
        activeTeam: "away",
      });
      expect(only(legalActions(state), "shoot")).toHaveLength(1);
    });

    it("is not blocked by bodies in the way — they are duel modifiers, not walls", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [4, 2], ball: true },
        { team: "away", role: "defender", at: [5, 2] },
        { team: "away", role: "goalkeeper", at: [6, 2] },
      ]);
      expect(only(legalActions(state), "shoot")).toHaveLength(1);
    });

    it("never offers a shot to a player without the ball", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [4, 2], ball: true },
        { team: "home", role: "winger", at: [4, 0] },
      ]);
      const shots = only(legalActions(state), "shoot");
      expect(shots).toHaveLength(1);
      expect(shots[0]!.playerId).toBe("home-striker-0");
    });
  });

  describe("the opening position", () => {
    it("offers no tackle to the side holding the ball", () => {
      expect(only(legalActions(createInitialState()), "tackle")).toHaveLength(0);
    });

    it("makes every one of the kickoff taker's moves a Dribble", () => {
      // The two strikers start adjacent, so the carrier is pressed at its
      // origin and cannot step anywhere uncontested. Flagged for review: it
      // means the side kicking off must pass, shoot, or accept a duel.
      const state = createInitialState();
      const actions = legalActions(state);
      const striker = state.players.find((p) => p.id === "home-striker")!;

      expect(cellsOf(actions, "move", striker.id).size).toBe(0);
      expect(cellsOf(actions, "dribble", striker.id).size).toBeGreaterThan(0);
    });

    it("offers two passes from the kickoff", () => {
      // Striker PAS 2, so only players within two steps on one of its eight
      // lanes can receive. The spread formation puts both the midfielder and the
      // defender on one; the earlier central-column shape offered just one, which
      // was flagged as a thin opening.
      const passes = only(legalActions(createInitialState()), "pass");
      expect(passes.map((pass) => pass.target).sort()).toEqual([
        "home-defender",
        "home-midfielder",
      ]);
    });

    it("allows no shot straight from the kickoff", () => {
      // The centre spot is 3 steps from the goal mouth and SHOT_RANGE is 2, so
      // a match cannot open with a strike at goal. This is exactly why the
      // constant is 2 rather than 3 — see ADR-free note in pitch.ts.
      expect(only(legalActions(createInitialState()), "shoot")).toHaveLength(0);
      expect(only(legalActions(createInitialState({ kickingOff: "away" })), "shoot")).toHaveLength(
        0,
      );
    });

    it("lets the away side act when it kicks off", () => {
      const state = createInitialState({ kickingOff: "away" });
      const actions = legalActions(state);
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        expect(action.playerId.startsWith("away-")).toBe(true);
      }
    });
  });
});
