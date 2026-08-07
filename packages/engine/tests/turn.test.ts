import {
  ACTIONS_PER_TURN,
  MatchStateSchema,
  parseSeed,
  TURN_CAP,
  type MatchCommand,
  type MatchState,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { applyAction, createInitialState, createRng, legalActions } from "../src/index.js";
import { makeState, scriptedRng } from "./helpers.js";

/** Apply a command and fail the test loudly if the engine rejected it. */
function apply(state: MatchState, command: MatchCommand, rng = scriptedRng([3, 1, 3, 1, 3, 1])) {
  const result = applyAction(state, command, rng);
  if (!result.ok) throw new Error(`unexpectedly rejected: ${result.reason}`);
  return result;
}

const firstMove = (state: MatchState): MatchCommand =>
  legalActions(state).find((action) => action.type === "move")!;

describe("spending actions", () => {
  it("costs one action per gameplay verb", () => {
    const state = createInitialState();
    const { state: next, turnEnded } = apply(state, firstMove(state));

    expect(next.actionsRemaining).toBe(ACTIONS_PER_TURN - 1);
    expect(turnEnded).toBe(false);
    expect(next.activeTeam).toBe("home");
    expect(next.turn).toBe(1);
  });

  it("passes the turn automatically once the pool empties", () => {
    let state = createInitialState();
    state = apply(state, firstMove(state)).state;
    const { state: next, turnEnded } = apply(state, firstMove(state));

    expect(turnEnded).toBe(true);
    expect(next.actionsRemaining).toBe(ACTIONS_PER_TURN);
    expect(next.activeTeam).toBe("away");
    expect(next.turn).toBe(2);
  });

  it("keeps alternating sides across several turns", () => {
    let state = createInitialState();
    const seen: Array<{ turn: number; team: string }> = [];

    for (let index = 0; index < 6; index += 1) {
      seen.push({ turn: state.turn, team: state.activeTeam });
      state = apply(state, { type: "endTurn", team: state.activeTeam }).state;
    }

    expect(seen).toEqual([
      { turn: 1, team: "home" },
      { turn: 2, team: "away" },
      { turn: 3, team: "home" },
      { turn: 4, team: "away" },
      { turn: 5, team: "home" },
      { turn: 6, team: "away" },
    ]);
  });

  it("always leaves a state the schema accepts", () => {
    let state = createInitialState();
    for (let index = 0; index < 8; index += 1) {
      state = apply(state, { type: "endTurn", team: state.activeTeam }).state;
      expect(MatchStateSchema.safeParse(state).success).toBe(true);
    }
  });
});

describe("ending a turn early", () => {
  it("passes the turn even with actions left", () => {
    const state = createInitialState();
    const { state: next, turnEnded } = apply(state, { type: "endTurn", team: "home" });

    expect(turnEnded).toBe(true);
    expect(state.actionsRemaining).toBe(ACTIONS_PER_TURN); // untouched on the old state
    expect(next.activeTeam).toBe("away");
    expect(next.turn).toBe(2);
    expect(next.actionsRemaining).toBe(ACTIONS_PER_TURN);
  });

  it("rolls no dice", () => {
    const rng = scriptedRng([]); // any roll would throw
    expect(() =>
      applyAction(createInitialState(), { type: "endTurn", team: "home" }, rng),
    ).not.toThrow();
  });

  it("cannot be used to end the opponent's turn", () => {
    const result = applyAction(
      createInitialState(),
      { type: "endTurn", team: "away" },
      scriptedRng([]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not-your-turn");
  });
});

describe("rejecting illegal commands", () => {
  const reject = (state: MatchState, command: MatchCommand) => {
    const result = applyAction(state, command, scriptedRng([3, 1]));
    expect(result.ok).toBe(false);
    return result.ok ? null : result.reason;
  };

  it("reports an unknown player", () => {
    expect(
      reject(createInitialState(), { type: "move", playerId: "nobody", target: { x: 1, y: 1 } }),
    ).toBe("unknown-player");
  });

  it("reports a player from the side not to move", () => {
    expect(
      reject(createInitialState(), {
        type: "move",
        playerId: "away-winger",
        target: { x: 4, y: 3 },
      }),
    ).toBe("not-your-turn");
  });

  it("reports an empty action pool", () => {
    const state = { ...createInitialState(), actionsRemaining: 0 };
    expect(reject(state, { type: "move", playerId: "home-winger", target: { x: 2, y: 1 } })).toBe(
      "no-actions-left",
    );
  });

  it("reports an unknown target on a pass", () => {
    expect(
      reject(createInitialState(), { type: "pass", playerId: "home-striker", target: "ghost" }),
    ).toBe("unknown-target");
  });

  it("reports an action that is simply not legal", () => {
    // The winger cannot reach the far corner in one move.
    expect(
      reject(createInitialState(), {
        type: "move",
        playerId: "home-winger",
        target: { x: 6, y: 4 },
      }),
    ).toBe("illegal-action");
  });

  it("reports a shot from out of range as illegal", () => {
    expect(
      reject(createInitialState(), { type: "shoot", playerId: "home-striker", target: null }),
    ).toBe("illegal-action");
  });

  it("never throws, whatever it is handed", () => {
    const state = createInitialState();
    const nonsense: MatchCommand[] = [
      { type: "move", playerId: "nobody", target: { x: 99, y: 99 } },
      { type: "tackle", playerId: "home-striker", target: "home-striker" },
      { type: "dribble", playerId: "home-goalkeeper", target: { x: 0, y: 0 } },
      { type: "endTurn", team: "away" },
    ];
    for (const command of nonsense) {
      expect(() => applyAction(state, command, scriptedRng([3, 1]))).not.toThrow();
    }
  });

  it("leaves the caller's state untouched when it rejects", () => {
    const state = createInitialState();
    const before = JSON.stringify(state);
    applyAction(
      state,
      { type: "move", playerId: "away-winger", target: { x: 4, y: 3 } },
      scriptedRng([]),
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it("spends no action on a rejected command", () => {
    const state = createInitialState();
    const result = applyAction(
      state,
      { type: "move", playerId: "home-winger", target: { x: 6, y: 4 } },
      scriptedRng([]),
    );
    expect(result.ok).toBe(false);
    expect(state.actionsRemaining).toBe(ACTIONS_PER_TURN);
  });
});

describe("a goal", () => {
  /** Home striker in range with a full action pool, so the early end is visible. */
  const scoringPosition = () =>
    makeState([
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "goalkeeper", at: [6, 2] },
      { team: "away", role: "striker", at: [1, 2] },
    ]);

  const scoreOne = (state: MatchState) =>
    apply(state, { type: "shoot", playerId: "home-striker-0", target: null }, scriptedRng([3, 1]));

  it("ends the scoring side's turn immediately, even with actions left", () => {
    const state = scoringPosition();
    expect(state.actionsRemaining).toBe(ACTIONS_PER_TURN);

    const { state: next, turnEnded } = scoreOne(state);

    expect(turnEnded).toBe(true);
    expect(next.score).toEqual({ home: 1, away: 0 });
  });

  it("hands the next turn, possession and a full pool to the conceding side", () => {
    const { state: next } = scoreOne(scoringPosition());

    expect(next.activeTeam).toBe("away");
    expect(next.possession).toBe("away");
    expect(next.actionsRemaining).toBe(ACTIONS_PER_TURN);
    expect(next.turn).toBe(2);
  });

  it("resets the pitch to a kickoff formation", () => {
    const { state: next } = scoreOne(scoringPosition());

    expect(next.players).toHaveLength(10);
    expect(next.ball.carrierId).toBe("away-striker");
    expect(MatchStateSchema.safeParse(next).success).toBe(true);
  });

  it("does not end the turn when the shot is saved", () => {
    const state = scoringPosition();
    const { state: next, turnEnded } = apply(
      state,
      { type: "shoot", playerId: "home-striker-0", target: null },
      scriptedRng([1, 3]),
    );

    expect(turnEnded).toBe(false);
    expect(next.score).toEqual({ home: 0, away: 0 });
    expect(next.activeTeam).toBe("home");
    expect(next.actionsRemaining).toBe(ACTIONS_PER_TURN - 1);
  });
});

describe("the turn cap", () => {
  it("counts turns up toward the cap without stopping play", () => {
    // The win-condition check belongs to the next slice; this one only counts.
    let state = createInitialState();
    for (let index = 0; index < TURN_CAP + 2; index += 1) {
      state = apply(state, { type: "endTurn", team: state.activeTeam }).state;
    }
    expect(state.turn).toBe(TURN_CAP + 3);
    expect(MatchStateSchema.safeParse(state).success).toBe(true);
  });
});

describe("replay through the validated entry point", () => {
  it("reproduces a match byte-identically from a seed and a command log", () => {
    const playSeed = (seed: number) => {
      const rng = createRng(parseSeed(seed));
      let state = createInitialState();
      const log: MatchCommand[] = [];

      for (let step = 0; step < 24; step += 1) {
        const options = legalActions(state);
        const contested = options.filter((action) => action.type !== "move");
        const pool = contested.length > 0 ? contested : options;

        const command: MatchCommand =
          pool.length === 0
            ? { type: "endTurn", team: state.activeTeam }
            : pool[(step * 5 + 1) % pool.length]!;

        const result = applyAction(state, command, rng);
        if (!result.ok) throw new Error(`rejected during replay: ${result.reason}`);
        log.push(command);
        state = result.state;
      }
      return { state, log };
    };

    const { state, log } = playSeed(20260807);

    // Replay the log from scratch.
    const rng = createRng(parseSeed(20260807));
    let replayed = createInitialState();
    for (const command of log) {
      const result = applyAction(replayed, command, rng);
      if (!result.ok) throw new Error(`rejected during replay: ${result.reason}`);
      replayed = result.state;
    }

    expect(JSON.stringify(replayed)).toBe(JSON.stringify(state));
  });

  it("gives both sides turns, so the log is not one-sided", () => {
    const rng = createRng(parseSeed(4242));
    let state = createInitialState();
    const teams = new Set<string>();

    for (let step = 0; step < 20; step += 1) {
      teams.add(state.activeTeam);
      const result = applyAction(state, { type: "endTurn", team: state.activeTeam }, rng);
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }

    expect([...teams].sort()).toEqual(["away", "home"]);
  });
});
