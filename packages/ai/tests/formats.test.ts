import { applyAction, createInitialState, createRng, legalActions } from "@gaffer/engine";
import {
  FORMAT_PROFILES,
  FORMATS,
  parseSeed,
  totalTurns,
  type Difficulty,
  type MatchFormat,
  type MatchState,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { chooseCommand, PROFILES } from "../src/index.js";

/**
 * Play at `format` until the match is decided, or until `limit` commands.
 *
 * The limit is there so a test can prove something about *how* the opponent
 * plays without paying for a whole 11-a-side match to do it — those run to
 * around 150 commands and a dozen seconds at `elite`.
 */
function playMatch(
  format: MatchFormat,
  seed: number,
  difficulty: Difficulty = "pro",
  limit = Infinity,
) {
  const rng = createRng(parseSeed(seed));
  let state: MatchState = createInitialState({ format });
  let slowest = 0;
  let decisions = 0;

  while (state.result === null && decisions < limit) {
    expect(decisions).toBeLessThan(3000);

    const started = Date.now();
    const command = chooseCommand(state, { difficulty, variety: seed });
    slowest = Math.max(slowest, Date.now() - started);

    const result = applyAction(state, command, rng);
    expect(result.ok, `engine refused ${JSON.stringify(command)} at ${format}`).toBe(true);
    if (!result.ok) break;

    state = result.state;
    decisions += 1;
  }

  return { state, slowest, decisions };
}

describe.each([...FORMATS])("the opponent at %s", (format: MatchFormat) => {
  it("plays a whole match without the engine refusing a single command", () => {
    // The opponent reads the engine generically, so it *should* work at any
    // scale — but "should" is exactly the kind of claim that quietly stops
    // being true when a squad grows a fourth defender.
    const { state } = playMatch(format, 3);

    expect(state.result).not.toBeNull();
    expect(state.turn).toBeLessThanOrEqual(totalTurns(state.rules));
  });

  it("replays identically from the same seed", () => {
    // A link now names a game type as well as a seed, and it has to mean the
    // same match at every one of them. Forty commands is plenty to catch a
    // divergence — they compound, they do not cancel — and costs a fraction of
    // a full 11-a-side match.
    expect(playMatch(format, 21, "pro", 40).state).toEqual(playMatch(format, 21, "pro", 40).state);
  });

  it.each([...Object.keys(PROFILES)] as const)("proposes only legal commands at %s", (level) => {
    // `playMatch` asserts on every single command the engine is handed, so
    // forty of them is forty assertions, not one.
    const { decisions } = playMatch(format, 4, level as Difficulty, 40);
    expect(decisions).toBe(40);
  });
});

describe("what the opponent costs to run", () => {
  /*
   * A budget rather than a benchmark. The client gives the opponent a pause of
   * roughly half a second before it moves, so a decision has room — but a single
   * decision blocking the main thread for longer than a frame or two is felt as
   * a stutter on the board it is playing on. 400ms is the line: comfortably
   * inside the pause, and far enough above the measured worst case (~165ms for
   * `elite` at 11-a-side) that this fails on a regression rather than on a busy
   * machine. Measured with `Date.now()` rather than `performance.now()`, which
   * this package's lib does not have and should not need — millisecond
   * resolution is ample when the line is 400 of them.
   */
  const BUDGET_MS = 400;

  it.each([...FORMATS])("decides inside its budget at %s", (format: MatchFormat) => {
    const { slowest, decisions } = playMatch(format, 7, "elite");

    expect(decisions).toBeGreaterThan(10);
    expect(slowest, `slowest decision at ${format} was ${slowest.toFixed(0)}ms`).toBeLessThan(
      BUDGET_MS,
    );
  });

  it("searches less widely on a bigger pitch, which is how it stays inside it", () => {
    // Branching grows with the pitch and the search cost grows with its square,
    // so the breadth has to come down or the budget goes. Recorded here because
    // it is a deliberate trade — the opponent plays a little worse at 11-a-side
    // — rather than something that happens to be true.
    const counts = FORMATS.map((format) => legalActions(createInitialState({ format })).length);

    for (let index = 1; index < counts.length; index += 1) {
      expect(counts[index]!).toBeGreaterThan(counts[index - 1]!);
    }
  });

  it("leaves the tuned format's search untouched", () => {
    // 5-a-side is the one whose balance is settled, and it was settled against
    // a search of this width. Scaling must not quietly retune it.
    const state = createInitialState({ format: "5v5" });
    const cells = state.board.width * state.board.height;
    expect(cells).toBeLessThanOrEqual(35);
    expect(PROFILES.pro.breadth).toBe(10);
  });
});

describe("the format table the opponent plays under", () => {
  it("gives every format enough actions to cross its own pitch", () => {
    /*
     * The finding that made the two new formats playable. At two actions a turn
     * — right for a 7-wide pitch — an attack on a 13-wide one never arrives:
     * 11-a-side produced 0.63 goals a match and 50% of matches were goalless.
     * The action economy has to grow with the pitch, and this is the guard that
     * says so out loud.
     */
    for (const format of FORMATS) {
      const { board, rules } = FORMAT_PROFILES[format];
      expect(rules.actionsPerTurn * 3).toBeGreaterThanOrEqual(board.width / 2);
    }
  });
});
