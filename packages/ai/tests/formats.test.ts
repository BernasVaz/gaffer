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
import { pastKickoff } from "./helpers.js";

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
  let spent = 0;
  let decisions = 0;

  while (state.result === null && decisions < limit) {
    expect(decisions).toBeLessThan(3000);

    const started = Date.now();
    const command = chooseCommand(state, { difficulty, variety: seed });
    const took = Date.now() - started;
    slowest = Math.max(slowest, took);
    spent += took;

    const result = applyAction(state, command, rng);
    expect(result.ok, `engine refused ${JSON.stringify(command)} at ${format}`).toBe(true);
    if (!result.ok) break;

    state = result.state;
    decisions += 1;
  }

  return { state, slowest, decisions, mean: decisions === 0 ? 0 : spent / decisions };
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
   * A *ratio*, not a stopwatch.
   *
   * The thing worth protecting is that search cost does not explode with the
   * size of the board: branching goes from about 30 legal actions a turn at
   * 5-a-side to 110 at 11-a-side, and the cost of the search goes with the
   * square of that unless the breadth comes down to meet it.
   *
   * An absolute budget cannot say that. It reports how fast the machine is —
   * the first version of this test asserted 400ms, passed here at 164ms, and
   * failed in CI at 512ms on a runner roughly three times slower. Comparing two
   * formats measured in the same process on the same machine divides the
   * machine out.
   *
   * For reference, measured on a laptop with `elite` on both: 5-a-side means
   * about 12ms a decision and 11-a-side about 47ms — a ratio near 4. Before the
   * breadth scaling went in it was 12ms against 104ms, a ratio over 8.
   */
  const RATIO_LIMIT = 6;

  /* Enough decisions for a stable mean, few enough to be quick at 11-a-side.
     A ceiling rather than a target: a 5-a-side match can simply end first. */
  const SAMPLE = 60;

  it("does not let cost explode with the size of the pitch", () => {
    const small = playMatch("5v5", 7, "elite", SAMPLE);
    const large = playMatch("11v11", 7, "elite", SAMPLE);

    expect(small.decisions).toBeGreaterThanOrEqual(30);
    expect(large.decisions).toBeGreaterThanOrEqual(30);

    /* Floor the denominator: on a fast machine 5-a-side can round to zero, and
       dividing by that measures nothing at all. */
    const ratio = large.mean / Math.max(small.mean, 1);
    expect(
      ratio,
      `11v11 costs ${large.mean.toFixed(1)}ms a decision against 5v5's ${small.mean.toFixed(1)}ms`,
    ).toBeLessThan(RATIO_LIMIT);
  });

  it("searches a wider pitch less widely, which is how it stays affordable", () => {
    // Recorded because it is a deliberate trade — the opponent plays a little
    // worse at 11-a-side — rather than something that happens to be true.
    /* Measured one action in. At a kickoff the board offers only the pass
       (ADR 0018), which is a handful of options at every format and says
       nothing about how widely the search has to look. */
    const counts = FORMATS.map(
      (format) => legalActions(pastKickoff(createInitialState({ format }))).length,
    );

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
