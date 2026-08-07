import {
  COVERING_DEFENDER_BONUS,
  duelWinChance,
  SHOOT_COVERING_BONUS,
  MatchStateSchema,
  ROLE_PROFILES,
  type Action,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { previewDuel } from "../src/index.js";
// resolveAction is deliberately not part of the public API — applyAction is the
// only door in. It is imported directly here because these are its unit tests.
import { resolveAction } from "../src/resolve.js";
import { makeState, scriptedRng } from "./helpers.js";

/** Rolls that make the attacker win outright: highest attack die, lowest defence die. */
const ATTACKER_WINS = [3, 1];
/** Rolls that make the attacker lose: lowest attack die, highest defence die. */
const ATTACKER_LOSES = [1, 3];

describe("previewDuel", () => {
  it("returns null for an uncontested move", () => {
    const state = makeState([{ team: "home", role: "midfielder", at: [1, 2] }]);
    const action: Action = { type: "move", playerId: "home-midfielder-0", target: { x: 2, y: 2 } };
    expect(previewDuel(state, action)).toBeNull();
  });

  it("returns null for a pass down an uncovered lane", () => {
    const state = makeState([
      { team: "home", role: "midfielder", at: [1, 2], ball: true },
      { team: "home", role: "striker", at: [4, 2] },
    ]);
    const action: Action = {
      type: "pass",
      playerId: "home-midfielder-0",
      target: "home-striker-1",
    };
    expect(previewDuel(state, action)).toBeNull();
  });

  describe("a dribble", () => {
    it("pits the carrier's ATK against the adjacent opponent's DEF", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [3, 2], ball: true }, // ATK 5
        { team: "away", role: "defender", at: [4, 2] }, // DEF 4
      ]);
      const duel = previewDuel(state, {
        type: "dribble",
        playerId: "home-striker-0",
        target: { x: 3, y: 1 },
      })!;

      expect(duel.attacker).toEqual({ playerId: "home-striker-0", stat: 5, modifier: 0 });
      expect(duel.defender).toEqual({ playerId: "away-defender-1", stat: 4, modifier: 0 });
      expect(duel.coveringPlayerIds).toEqual([]);
      expect(duel.winChance).toBeCloseTo(6 / 9, 10); // GDD §9's worked example
    });

    it("adds a covering defender, turning the favourite into the underdog", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [3, 2], ball: true },
        { team: "away", role: "defender", at: [4, 2] }, // DEF 4 — primary
        { team: "away", role: "midfielder", at: [4, 1] }, // DEF 3 — covering
      ]);
      const duel = previewDuel(state, {
        type: "dribble",
        playerId: "home-striker-0",
        target: { x: 3, y: 3 },
      })!;

      expect(duel.defender.stat).toBe(4);
      expect(duel.defender.modifier).toBe(COVERING_DEFENDER_BONUS);
      expect(duel.coveringPlayerIds).toEqual(["away-midfielder-2"]);
      expect(duel.winChance).toBeCloseTo(1 / 9, 10); // exactly the GDD's ~11%
    });

    it("picks the highest-DEF opponent as the primary defender", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [3, 2], ball: true },
        { team: "away", role: "midfielder", at: [4, 1] }, // DEF 3
        { team: "away", role: "defender", at: [4, 3] }, // DEF 4 — should lead
      ]);
      const duel = previewDuel(state, {
        type: "dribble",
        playerId: "home-striker-0",
        target: { x: 2, y: 2 },
      })!;

      expect(duel.defender.playerId).toBe("away-defender-2");
      expect(duel.coveringPlayerIds).toEqual(["away-midfielder-1"]);
    });

    it("counts opponents beside the destination, not only beside the origin", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [1, 2], ball: true },
        { team: "away", role: "defender", at: [4, 2] },
      ]);
      const duel = previewDuel(state, {
        type: "dribble",
        playerId: "home-striker-0",
        target: { x: 3, y: 2 }, // lands beside the defender
      })!;
      expect(duel.defender.playerId).toBe("away-defender-1");
    });
  });

  describe("a tackle", () => {
    it("pits the tackler's DEF against the carrier's ATK", () => {
      const state = makeState(
        [
          { team: "away", role: "striker", at: [3, 2], ball: true }, // ATK 5
          { team: "home", role: "defender", at: [3, 3] }, // DEF 4
        ],
        { activeTeam: "home" },
      );
      const duel = previewDuel(state, {
        type: "tackle",
        playerId: "home-defender-1",
        target: "away-striker-0",
      })!;

      // The tackler initiates, so it is the duel's attacker even though it
      // contributes DEF. Ties therefore favour the carrier keeping the ball.
      expect(duel.attacker).toEqual({ playerId: "home-defender-1", stat: 4, modifier: 0 });
      expect(duel.defender).toEqual({ playerId: "away-striker-0", stat: 5, modifier: 0 });
      expect(duel.winChance).toBeCloseTo(duelWinChance(4, 5), 10);
    });

    it("gives the +2 to the tackling side when a team-mate covers", () => {
      const state = makeState(
        [
          { team: "away", role: "striker", at: [3, 2], ball: true },
          { team: "home", role: "defender", at: [3, 3] },
          { team: "home", role: "midfielder", at: [2, 2] }, // also beside the carrier
        ],
        { activeTeam: "home" },
      );
      const duel = previewDuel(state, {
        type: "tackle",
        playerId: "home-defender-1",
        target: "away-striker-0",
      })!;

      expect(duel.attacker.modifier).toBe(COVERING_DEFENDER_BONUS);
      expect(duel.coveringPlayerIds).toEqual(["home-midfielder-2"]);
    });
  });

  describe("a shot", () => {
    it("pits the shooter's ATK against the keeper's DEF", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [4, 2], ball: true }, // ATK 5
        { team: "away", role: "goalkeeper", at: [6, 2] }, // DEF 4, in its goal
      ]);
      const duel = previewDuel(state, { type: "shoot", playerId: "home-striker-0", target: null })!;

      expect(duel.attacker.stat).toBe(5);
      expect(duel.defender).toEqual({ playerId: "away-goalkeeper-1", stat: 4, modifier: 0 });
      expect(duel.winChance).toBeCloseTo(duelWinChance(5, 4), 10);
    });

    it("counts an opponent standing in the lane to the mouth as covering", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [4, 2], ball: true },
        { team: "away", role: "goalkeeper", at: [6, 2] },
        { team: "away", role: "defender", at: [5, 2] }, // squarely in the lane
      ]);
      const duel = previewDuel(state, { type: "shoot", playerId: "home-striker-0", target: null })!;

      expect(duel.coveringPlayerIds).toEqual(["away-defender-2"]);
      // Softer than a field duel: a shot already faces a keeper.
      expect(duel.defender.modifier).toBe(SHOOT_COVERING_BONUS);
    });

    it("ignores an opponent who is merely near the shooter but not in a lane", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [4, 2], ball: true },
        { team: "away", role: "goalkeeper", at: [6, 2] },
        { team: "away", role: "defender", at: [4, 3] }, // beside the shooter, off every ray
      ]);
      const duel = previewDuel(state, { type: "shoot", playerId: "home-striker-0", target: null })!;
      expect(duel.coveringPlayerIds).toEqual([]);
    });

    it("never counts the keeper as covering itself", () => {
      const state = makeState([
        { team: "home", role: "striker", at: [5, 2], ball: true },
        { team: "away", role: "goalkeeper", at: [6, 2] },
      ]);
      const duel = previewDuel(state, { type: "shoot", playerId: "home-striker-0", target: null })!;
      expect(duel.coveringPlayerIds).toEqual([]);
      expect(duel.defender.modifier).toBe(0);
    });
  });

  describe("a covered pass", () => {
    it("pits the passer's PAS against the interceptor's DEF", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true }, // PAS 4
        { team: "home", role: "striker", at: [4, 2] },
        { team: "away", role: "defender", at: [2, 3] }, // beside the lane cell (2,2)
      ]);
      const duel = previewDuel(state, {
        type: "pass",
        playerId: "home-midfielder-0",
        target: "home-striker-1",
      })!;

      expect(duel.attacker).toEqual({ playerId: "home-midfielder-0", stat: 4, modifier: 0 });
      expect(duel.defender.playerId).toBe("away-defender-2");
      expect(duel.defender.stat).toBe(4);
    });

    it("treats a pass to an adjacent team-mate as uncontested — there is no lane", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "striker", at: [2, 2] },
        { team: "away", role: "defender", at: [2, 3] },
      ]);
      const action: Action = {
        type: "pass",
        playerId: "home-midfielder-0",
        target: "home-striker-1",
      };
      expect(previewDuel(state, action)).toBeNull();
    });
  });

  it("computes odds without consuming any randomness", () => {
    // The odds must come from enumeration, so a preview can be shown before the
    // player commits without disturbing the replay sequence.
    const state = makeState([
      { team: "home", role: "striker", at: [3, 2], ball: true },
      { team: "away", role: "defender", at: [4, 2] },
    ]);
    const rng = scriptedRng([]); // any roll at all would throw
    expect(() =>
      previewDuel(state, { type: "dribble", playerId: "home-striker-0", target: { x: 3, y: 1 } }),
    ).not.toThrow();
    expect(rng.used()).toBe(0);
  });
});

describe("resolveAction", () => {
  it("always returns a state the schema accepts", () => {
    const state = makeState([{ team: "home", role: "midfielder", at: [1, 2] }]);
    const { state: next } = resolveAction(
      state,
      { type: "move", playerId: "home-midfielder-0", target: { x: 2, y: 2 } },
      scriptedRng([]),
    );
    expect(MatchStateSchema.safeParse(next).success).toBe(true);
  });

  it("does not mutate the state it is given", () => {
    const state = makeState([{ team: "home", role: "midfielder", at: [1, 2] }]);
    const before = JSON.stringify(state);
    resolveAction(
      state,
      { type: "move", playerId: "home-midfielder-0", target: { x: 2, y: 2 } },
      scriptedRng([]),
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it("leaves the turn economy alone — that is the next slice", () => {
    const state = makeState([{ team: "home", role: "midfielder", at: [1, 2] }]);
    const { state: next } = resolveAction(
      state,
      { type: "move", playerId: "home-midfielder-0", target: { x: 2, y: 2 } },
      scriptedRng([]),
    );
    expect(next.turn).toBe(state.turn);
    expect(next.actionsRemaining).toBe(state.actionsRemaining);
    expect(next.activeTeam).toBe(state.activeTeam);
  });

  describe("move", () => {
    it("relocates the player and rolls nothing", () => {
      const state = makeState([{ team: "home", role: "midfielder", at: [1, 2] }]);
      const rng = scriptedRng([]);
      const { state: next, duel } = resolveAction(
        state,
        { type: "move", playerId: "home-midfielder-0", target: { x: 2, y: 2 } },
        rng,
      );

      expect(duel).toBeNull();
      expect(rng.used()).toBe(0);
      expect(next.players.find((p) => p.id === "home-midfielder-0")!.position).toEqual({
        x: 2,
        y: 2,
      });
    });

    it("carries the ball along when the mover has it", () => {
      const state = makeState([{ team: "home", role: "midfielder", at: [1, 2], ball: true }]);
      const { state: next } = resolveAction(
        state,
        { type: "move", playerId: "home-midfielder-0", target: { x: 2, y: 2 } },
        scriptedRng([]),
      );
      expect(next.ball.position).toEqual({ x: 2, y: 2 });
      expect(next.ball.carrierId).toBe("home-midfielder-0");
    });
  });

  describe("dribble", () => {
    const setup = () =>
      makeState([
        { team: "home", role: "striker", at: [3, 2], ball: true },
        { team: "away", role: "defender", at: [4, 2] },
      ]);

    it("advances the carrier with the ball when the dribble comes off", () => {
      const { state: next, duel } = resolveAction(
        setup(),
        { type: "dribble", playerId: "home-striker-0", target: { x: 3, y: 1 } },
        scriptedRng(ATTACKER_WINS),
      );

      expect(duel!.attackerWon).toBe(true);
      expect(next.players.find((p) => p.id === "home-striker-0")!.position).toEqual({ x: 3, y: 1 });
      expect(next.ball.carrierId).toBe("home-striker-0");
      expect(next.possession).toBe("home");
    });

    it("is a turnover when it fails: the defender takes the ball, the carrier stays", () => {
      const state = setup();
      const { state: next, duel } = resolveAction(
        state,
        { type: "dribble", playerId: "home-striker-0", target: { x: 3, y: 1 } },
        scriptedRng(ATTACKER_LOSES),
      );

      expect(duel!.attackerWon).toBe(false);
      // Did not advance.
      expect(next.players.find((p) => p.id === "home-striker-0")!.position).toEqual({ x: 3, y: 2 });
      // Lost the ball to the defender that won it.
      expect(next.ball.carrierId).toBe("away-defender-1");
      expect(next.ball.position).toEqual({ x: 4, y: 2 });
      expect(next.possession).toBe("away");
    });

    it("spends exactly two dice, attacker first", () => {
      const rng = scriptedRng(ATTACKER_WINS);
      resolveAction(
        setup(),
        { type: "dribble", playerId: "home-striker-0", target: { x: 3, y: 1 } },
        rng,
      );
      expect(rng.used()).toBe(2);
    });
  });

  describe("tackle", () => {
    const setup = () =>
      makeState(
        [
          { team: "away", role: "striker", at: [3, 2], ball: true },
          { team: "home", role: "defender", at: [3, 3] },
        ],
        { activeTeam: "home" },
      );

    it("wins the ball for the tackler", () => {
      const { state: next } = resolveAction(
        setup(),
        { type: "tackle", playerId: "home-defender-1", target: "away-striker-0" },
        scriptedRng(ATTACKER_WINS),
      );

      expect(next.ball.carrierId).toBe("home-defender-1");
      expect(next.ball.position).toEqual({ x: 3, y: 3 });
      expect(next.possession).toBe("home");
    });

    it("leaves the ball where it was when the challenge fails", () => {
      const { state: next } = resolveAction(
        setup(),
        { type: "tackle", playerId: "home-defender-1", target: "away-striker-0" },
        scriptedRng(ATTACKER_LOSES),
      );

      expect(next.ball.carrierId).toBe("away-striker-0");
      expect(next.possession).toBe("away");
    });
  });

  describe("pass", () => {
    it("moves the ball to the receiver down a clear lane, with no dice", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "striker", at: [4, 2] },
      ]);
      const rng = scriptedRng([]);
      const { state: next, duel } = resolveAction(
        state,
        { type: "pass", playerId: "home-midfielder-0", target: "home-striker-1" },
        rng,
      );

      expect(duel).toBeNull();
      expect(rng.used()).toBe(0);
      expect(next.ball.carrierId).toBe("home-striker-1");
      expect(next.ball.position).toEqual({ x: 4, y: 2 });
      expect(next.possession).toBe("home");
    });

    it("is intercepted when the covered pass is lost", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "striker", at: [4, 2] },
        { team: "away", role: "defender", at: [2, 3] },
      ]);
      const { state: next } = resolveAction(
        state,
        { type: "pass", playerId: "home-midfielder-0", target: "home-striker-1" },
        scriptedRng(ATTACKER_LOSES),
      );

      expect(next.ball.carrierId).toBe("away-defender-2");
      expect(next.possession).toBe("away");
    });

    it("still finds the receiver when the covered pass is won", () => {
      const state = makeState([
        { team: "home", role: "midfielder", at: [1, 2], ball: true },
        { team: "home", role: "striker", at: [4, 2] },
        { team: "away", role: "defender", at: [2, 3] },
      ]);
      const { state: next } = resolveAction(
        state,
        { type: "pass", playerId: "home-midfielder-0", target: "home-striker-1" },
        scriptedRng(ATTACKER_WINS),
      );

      expect(next.ball.carrierId).toBe("home-striker-1");
      expect(next.possession).toBe("home");
    });
  });

  describe("shot", () => {
    const setup = () =>
      makeState([
        { team: "home", role: "striker", at: [4, 2], ball: true },
        { team: "away", role: "goalkeeper", at: [6, 2] },
        { team: "away", role: "striker", at: [1, 2] },
      ]);

    it("scores, and resets the pitch for a kickoff to the conceding side", () => {
      const { state: next } = resolveAction(
        setup(),
        { type: "shoot", playerId: "home-striker-0", target: null },
        scriptedRng(ATTACKER_WINS),
      );

      expect(next.score).toEqual({ home: 1, away: 0 });
      // Full squads are back in formation, and the conceding side kicks off.
      expect(next.players).toHaveLength(10);
      expect(next.possession).toBe("away");
      expect(next.ball.carrierId).toBe("away-striker");
      expect(MatchStateSchema.safeParse(next).success).toBe(true);
    });

    it("hands the ball to the keeper on a save", () => {
      const { state: next } = resolveAction(
        setup(),
        { type: "shoot", playerId: "home-striker-0", target: null },
        scriptedRng(ATTACKER_LOSES),
      );

      expect(next.score).toEqual({ home: 0, away: 0 });
      expect(next.ball.carrierId).toBe("away-goalkeeper-1");
      expect(next.possession).toBe("away");
    });

    it("carries the score across a kickoff reset", () => {
      const state = { ...setup(), score: { home: 2, away: 1 } };
      const { state: next } = resolveAction(
        state,
        { type: "shoot", playerId: "home-striker-0", target: null },
        scriptedRng(ATTACKER_WINS),
      );
      expect(next.score).toEqual({ home: 3, away: 1 });
    });
  });
});

describe("the exposed odds match the resolution", () => {
  it("previews the same duel the resolver then plays out", () => {
    const state = makeState([
      { team: "home", role: "striker", at: [3, 2], ball: true },
      { team: "away", role: "defender", at: [4, 2] },
      { team: "away", role: "midfielder", at: [4, 1] },
    ]);
    const action: Action = {
      type: "dribble",
      playerId: "home-striker-0",
      target: { x: 3, y: 3 },
    };

    const preview = previewDuel(state, action)!;
    const { duel } = resolveAction(state, action, scriptedRng(ATTACKER_WINS));

    expect(duel!.attacker).toEqual(preview.attacker);
    expect(duel!.defender).toEqual(preview.defender);
    expect(duel!.coveringPlayerIds).toEqual(preview.coveringPlayerIds);
    expect(duel!.winChance).toBe(preview.winChance);
  });

  it("agrees with duelWinChance over the scores it reports", () => {
    const state = makeState([
      { team: "home", role: "striker", at: [3, 2], ball: true },
      { team: "away", role: "defender", at: [4, 2] },
      { team: "away", role: "midfielder", at: [4, 1] },
    ]);
    const duel = previewDuel(state, {
      type: "dribble",
      playerId: "home-striker-0",
      target: { x: 3, y: 3 },
    })!;

    expect(duel.winChance).toBeCloseTo(
      duelWinChance(
        duel.attacker.stat + duel.attacker.modifier,
        duel.defender.stat + duel.defender.modifier,
      ),
      10,
    );
  });

  it("reports totals consistent with the rolls and the tie rule", () => {
    const state = makeState([
      { team: "home", role: "striker", at: [3, 2], ball: true },
      { team: "away", role: "defender", at: [4, 2] },
    ]);
    // Attacker 5 + 1 = 6, defender 4 + 2 = 6 — a tie, which the defender takes.
    const { duel } = resolveAction(
      state,
      { type: "dribble", playerId: "home-striker-0", target: { x: 3, y: 1 } },
      scriptedRng([1, 2]),
    );

    expect(duel!.attackerTotal).toBe(6);
    expect(duel!.defenderTotal).toBe(6);
    expect(duel!.attackerWon).toBe(false);
  });
});

describe("stat and role sanity", () => {
  it("uses the GDD §6 stat lines, not hard-coded numbers", () => {
    expect(ROLE_PROFILES.striker.stats.atk).toBe(5);
    expect(ROLE_PROFILES.defender.stats.def).toBe(4);
    expect(ROLE_PROFILES.goalkeeper.stats.def).toBe(4);
    expect(ROLE_PROFILES.midfielder.stats.pas).toBe(4);
  });
});
