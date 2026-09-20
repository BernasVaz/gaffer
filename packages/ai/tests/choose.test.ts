import { applyAction, createInitialState, createRng, legalActions } from "@gaffer/engine";
import {
  defendingGoalMouth,
  parseSeed,
  TEAMS,
  type MatchCommand,
  type MatchState,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { chooseCommand, DIFFICULTIES, PROFILES, type Difficulty } from "../src/index.js";
import { mirrorCommand, mirrorState } from "./helpers.js";

const kickoff = () => createInitialState();

/** Play a whole match with the opponent on both sides. */
function playMatch(seed: number, difficulty: Difficulty = "pro") {
  const rng = createRng(parseSeed(seed));
  let state: MatchState = kickoff();
  const commands: MatchCommand[] = [];
  let keeperStrayed = 0;

  while (state.result === null) {
    // Guard against a runaway rather than hanging the suite.
    expect(commands.length).toBeLessThan(2000);

    const command = chooseCommand(state, { difficulty, variety: seed });
    const result = applyAction(state, command, rng);

    // The strongest claim this package makes: everything it proposes is legal.
    expect(result.ok, `engine refused ${JSON.stringify(command)}: ${JSON.stringify(result)}`).toBe(
      true,
    );
    if (!result.ok) break;

    commands.push(command);
    state = result.state;

    for (const team of TEAMS) {
      const keeper = state.players.find((p) => p.team === team && p.role === "goalkeeper")!;
      const mouth = defendingGoalMouth(team, state.board);
      if (!mouth.some((c) => c.x === keeper.position.x && c.y === keeper.position.y)) {
        keeperStrayed += 1;
      }
    }
  }

  return { state, commands, keeperStrayed };
}

describe("chooseCommand", () => {
  it("only ever proposes commands the engine accepts, across a whole match", () => {
    const { state } = playMatch(1);
    expect(state.result).not.toBeNull();
  });

  it.each([...DIFFICULTIES])("plays a legal match at %s", (difficulty) => {
    const { state } = playMatch(4, difficulty);
    expect(state.result).not.toBeNull();
  });

  it("is deterministic — the same board always produces the same command", () => {
    const state = kickoff();

    expect(chooseCommand(state)).toEqual(chooseCommand(state));
    expect(chooseCommand(state, { variety: 9 })).toEqual(chooseCommand(state, { variety: 9 }));
  });

  it("replays a whole match identically from the same seed", () => {
    // This is what lets a solo match be shared as a link: the seed fixes the
    // dice and the opponent fixes itself, so there is nothing else to record.
    const first = playMatch(12);
    const second = playMatch(12);

    expect(second.commands).toEqual(first.commands);
    expect(second.state).toEqual(first.state);
  });

  it("does not play the same opening in every match", () => {
    /*
     * Variety only reorders options the search rated equal, so it cannot make
     * the opponent worse — but without it, a deterministic chooser opens every
     * single match with the identical three moves, which reads as a script
     * rather than as an opponent.
     */
    const state = kickoff();
    const openings = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        JSON.stringify(chooseCommand(state, { variety: seed })),
      ),
    );

    expect(openings.size).toBeGreaterThan(1);
  });

  it("has no preference for one end of the pitch", () => {
    /*
     * A regression guard with a story. Ties are common — the evaluation has only
     * so many distinct values to separate options with — and the first version
     * of this broke them on the raw cell coordinate. Raw `x` means "forward" to
     * home and "back" to away, so away quietly got the better of every tie and
     * won 88% of self-play matches. Mirroring the board must mirror the choice.
     */
    let state = kickoff();
    const rng = createRng(parseSeed(3));

    for (let action = 0; action < 12 && state.result === null; action += 1) {
      const command = chooseCommand(state, { variety: 3 });
      expect(chooseCommand(mirrorState(state), { variety: 3 })).toEqual(
        mirrorCommand(command, state),
      );

      const result = applyAction(state, command, rng);
      if (!result.ok) break;
      state = result.state;
    }
  });

  it("leaves its keeper in its goal", () => {
    /*
     * The other regression worth naming. An evaluation that counts the keeper as
     * a passing outlet will walk it up the pitch, and a keeper cannot get home in
     * the one action a turnover gives it — nine goals in ten then went into an
     * empty net (ADR 0004 calls an unattended goal a certainty, not a gamble).
     */
    const { keeperStrayed } = playMatch(5);
    expect(keeperStrayed).toBe(0);
  });

  it("ends the turn when the rules leave it nothing else", () => {
    const state: MatchState = { ...kickoff(), actionsRemaining: 0 };

    expect(legalActions(state)).toEqual([]);
    expect(chooseCommand(state)).toEqual({ type: "endTurn", team: state.activeTeam });
  });

  it("refuses to act on a decided match", () => {
    const state: MatchState = {
      ...kickoff(),
      result: { winner: "home", decidedBy: "regulation", shootout: null },
    };

    expect(chooseCommand(state)).toEqual({ type: "endTurn", team: state.activeTeam });
  });

  it("takes an open goal rather than admiring it", () => {
    // The evaluation's single most expensive possible mistake, pinned down: with
    // one action left, anything but the shot throws the chance away.
    let state = kickoff();
    const away = (role: string) => `away-${role}`;

    state = {
      ...state,
      players: state.players.map((player) => {
        if (player.id === "home-striker") return { ...player, position: { x: 4, y: 2 } };
        if (player.id === away("goalkeeper")) return { ...player, position: { x: 4, y: 0 } };
        if (player.id === away("defender")) return { ...player, position: { x: 6, y: 0 } };
        return player;
      }),
      ball: { position: { x: 4, y: 2 }, carrierId: "home-striker" },
      actionsRemaining: 1,
    };

    expect(chooseCommand(state)).toEqual({
      type: "shoot",
      playerId: "home-striker",
      target: null,
    });
  });
});

describe("PROFILES", () => {
  it("describes every difficulty", () => {
    for (const difficulty of DIFFICULTIES) expect(PROFILES[difficulty]).toBeDefined();
  });

  it("only lets the easiest setting play blind", () => {
    expect(PROFILES.casual.reckless).toBe(true);
    expect(PROFILES.pro.reckless).toBe(false);
    expect(PROFILES.elite.reckless).toBe(false);
  });

  it("plans a whole turn from pro upward", () => {
    expect(PROFILES.casual.lookahead).toBe(1);
    expect(PROFILES.pro.lookahead).toBeGreaterThan(1);
    expect(PROFILES.elite.lookahead).toBeGreaterThan(1);
  });

  it("only reads the reply at the hardest setting", () => {
    expect(PROFILES.casual.anticipate).toBe(false);
    expect(PROFILES.pro.anticipate).toBe(false);
    expect(PROFILES.elite.anticipate).toBe(true);
  });
});

describe("the opponent across a match", () => {
  it("reaches a decided result from several seeds", () => {
    for (const seed of [2, 88]) {
      const { state } = playMatch(seed);
      expect(state.result).not.toBeNull();
      expect(state.turn).toBeLessThanOrEqual(28);
    }
  });

  it("scores — a solo opponent that cannot finish is not an opponent", () => {
    const goals = [1, 2, 3].map((seed) => {
      const { state } = playMatch(seed);
      return state.score.home + state.score.away;
    });

    expect(goals.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});
