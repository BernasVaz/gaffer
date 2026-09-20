import {
  attackingGoalMouth,
  centreSpot,
  defendingGoalMouth,
  FORMAT_PROFILES,
  FORMATS,
  isWithinBoard,
  MatchStateSchema,
  parseSeed,
  squadSize,
  totalTurns,
  type MatchFormat,
  type MatchState,
  type Position,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { applyAction, createInitialState, createRng, legalActions } from "../src/index.js";

const key = (cell: Position) => `${cell.x},${cell.y}`;

/**
 * Play a whole match out with a chooser too simple to be called an opponent:
 * take the first legal action, and end the turn when there is none.
 *
 * Deliberately not `@gaffer/ai` — this is the engine's own test, and it should
 * fail if the *rules* break at a larger scale, not if the opponent does.
 */
function playThrough(format: MatchFormat, seed: number) {
  const rng = createRng(parseSeed(seed));
  let state = createInitialState({ format });
  let commands = 0;

  while (state.result === null && commands < 20_000) {
    const options = legalActions(state);
    const command = options[0] ?? ({ type: "endTurn", team: state.activeTeam } as const);
    const result = applyAction(state, command, rng);

    expect(result.ok, `refused ${JSON.stringify(command)} at ${format}`).toBe(true);
    if (!result.ok) break;

    state = result.state;
    commands += 1;
  }

  return { state, commands };
}

describe.each([...FORMATS])("a %s match", (format: MatchFormat) => {
  const profile = FORMAT_PROFILES[format];

  it("starts from a state the schema accepts", () => {
    const parsed = MatchStateSchema.safeParse(createInitialState({ format }));
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 3))).toBe(true);
  });

  it("fields both squads at the size the format promises", () => {
    const state = createInitialState({ format });
    expect(state.players).toHaveLength(squadSize(format) * 2);
    for (const team of ["home", "away"] as const) {
      expect(state.players.filter((player) => player.team === team)).toHaveLength(
        squadSize(format),
      );
    }
  });

  it("gives every player an id of their own", () => {
    const ids = createInitialState({ format }).players.map((player) => player.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("numbers repeated roles from one", () => {
    // An 11-a-side back four only works if four defenders can coexist.
    const state = createInitialState({ format });
    const defenders = state.players
      .filter((player) => player.team === "home" && player.role === "defender")
      .map((player) => player.id)
      .sort();

    const expected = defenders.map((_unused, index) => `home-defender-${index + 1}`);
    expect(defenders).toEqual(expected);
  });

  it("puts everybody on the pitch, one to a cell", () => {
    const state = createInitialState({ format });
    const cells = state.players.map((player) => key(player.position));

    expect(new Set(cells).size).toBe(cells.length);
    for (const player of state.players) {
      expect(isWithinBoard(player.position, state.board), player.id).toBe(true);
    }
  });

  it("is a mirror of itself, so neither side starts better placed", () => {
    const state = createInitialState({ format });
    const shape = (team: "home" | "away") =>
      state.players
        .filter((player) => player.team === team)
        .map((player) => {
          const distance = Math.min(
            ...defendingGoalMouth(team, state.board).map((cell) =>
              Math.max(Math.abs(cell.x - player.position.x), Math.abs(cell.y - player.position.y)),
            ),
          );
          return `${player.role}:${distance}`;
        })
        .sort();

    expect(shape("away")).toEqual(shape("home"));
  });

  it("starts with the ball on the centre spot, carried by a striker", () => {
    const state = createInitialState({ format });
    const carrier = state.players.find((player) => player.id === state.ball.carrierId)!;

    expect(state.ball.position).toEqual(centreSpot(state.board));
    expect(carrier.role).toBe("striker");
    expect(carrier.team).toBe(state.kickedOff);
  });

  it("carries its own numbers, rather than borrowing 5-a-side's", () => {
    const state = createInitialState({ format });
    expect(state.format).toBe(format);
    expect(state.rules).toEqual(profile.rules);
    expect(state.actionsRemaining).toBe(profile.rules.actionsPerTurn);
  });

  it("cannot open with a shot at goal", () => {
    const state = createInitialState({ format });
    expect(legalActions(state).some((action) => action.type === "shoot")).toBe(false);
  });

  it("offers the kickoff taker something to do", () => {
    const options = legalActions(createInitialState({ format }));
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((action) => action.type === "pass")).toBe(true);
  });

  it("plays to a decided result without the engine refusing itself", () => {
    const { state } = playThrough(format, 5);

    expect(state.result).not.toBeNull();
    expect(state.turn).toBeLessThanOrEqual(totalTurns(state.rules));
  });

  it("replays byte-for-byte from the same seed", () => {
    // The whole point of a shareable link, now that a link also names a format.
    expect(playThrough(format, 31).state).toEqual(playThrough(format, 31).state);
  });

  it("keeps the goal mouths clear of everyone but the keeper", () => {
    const state = createInitialState({ format });
    const mouths = new Set([
      ...attackingGoalMouth("home", state.board).map(key),
      ...defendingGoalMouth("home", state.board).map(key),
    ]);

    for (const player of state.players) {
      if (player.role === "goalkeeper") continue;
      expect(mouths.has(key(player.position)), player.id).toBe(false);
    }
  });
});

describe("formats do not leak into one another", () => {
  it("keeps a kickoff after a goal at the same format", () => {
    // `afterGoal` rebuilds the pitch, and rebuilding it at the wrong size would
    // be a spectacular bug — 22 players suddenly on a 7 × 5 board.
    const before: MatchState = createInitialState({ format: "11v11" });
    const { state } = playThrough("11v11", 12);

    expect(state.board).toEqual(before.board);
    expect(state.players).toHaveLength(before.players.length);
    expect(state.format).toBe("11v11");
  });

  it("gives every format its own board", () => {
    const boards = FORMATS.map((format) => JSON.stringify(createInitialState({ format }).board));
    expect(new Set(boards).size).toBe(FORMATS.length);
  });
});
