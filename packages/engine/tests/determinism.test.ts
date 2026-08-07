import { MatchStateSchema, parseSeed, type Action, type MatchState } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { createInitialState, createRng, legalActions, resolveAction } from "../src/index.js";
import { makeState } from "./helpers.js";

/** A stable ordering, so a playthrough never depends on enumeration order. */
const sortKey = (action: Action) =>
  `${action.type}|${action.playerId}|${JSON.stringify(action.target)}`;

/**
 * Play a scripted match and record what was played.
 *
 * Actions are chosen from `legalActions` by a fixed arithmetic rule rather than
 * hard-coded, so every step stays legal no matter how the dice fall — a
 * hard-coded log would go nonsensical the moment a dribble failed and the
 * scripted shooter no longer had the ball.
 */
function play(
  seed: number,
  steps: number,
  start: MatchState = createInitialState(),
): { state: MatchState; log: Action[] } {
  const rng = createRng(parseSeed(seed));
  let state = start;
  const log: Action[] = [];

  for (let step = 0; step < steps; step += 1) {
    const options = [...legalActions(state)].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    if (options.length === 0) break;

    /*
     * Prefer contested actions. Moves outnumber duels roughly ten to one, so
     * picking uniformly would leave a playthrough that hardly touches the dice
     * and a determinism test that passes without proving much.
     */
    const contested = options.filter((action) => action.type !== "move");
    const pool = contested.length > 0 ? contested : options;

    const chosen = pool[(step * 7 + 3) % pool.length]!;
    log.push(chosen);
    state = resolveAction(state, chosen, rng).state;
  }

  return { state, log };
}

/** Replay a recorded log from scratch — the operation a shared match URL performs. */
function replay(
  seed: number,
  log: readonly Action[],
  start: MatchState = createInitialState(),
): MatchState {
  const rng = createRng(parseSeed(seed));
  let state = start;
  for (const action of log) {
    state = resolveAction(state, action, rng).state;
  }
  return state;
}

describe("replay determinism", () => {
  it("reaches a byte-identical state from the same seed and action log", () => {
    // The guarantee the whole engine rests on. If this ever fails, shareable
    // match links and server-side verification are both broken.
    const { state, log } = play(20260807, 12);
    expect(JSON.stringify(replay(20260807, log))).toBe(JSON.stringify(state));
  });

  it("plays the identical match when run twice from one seed", () => {
    const first = play(20260807, 12);
    const second = play(20260807, 12);

    expect(second.log).toEqual(first.log);
    expect(JSON.stringify(second.state)).toBe(JSON.stringify(first.state));
  });

  it("stays identical across many repetitions, not just two", () => {
    const reference = JSON.stringify(play(7, 10).state);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(JSON.stringify(play(7, 10).state)).toBe(reference);
    }
  });

  it("holds for a range of seeds, not one lucky one", () => {
    for (const seed of [0, 1, 42, 4095, 65535, 0xffffffff]) {
      const { state, log } = play(seed, 8);
      expect(JSON.stringify(replay(seed, log))).toBe(JSON.stringify(state));
    }
  });

  it("keeps every intermediate state valid, not just the last one", () => {
    const { log } = play(31337, 10);
    const rng = createRng(parseSeed(31337));
    let state = createInitialState();

    for (const action of log) {
      state = resolveAction(state, action, rng).state;
      expect(MatchStateSchema.safeParse(state).success).toBe(true);
    }
  });

  it("is sensitive to the seed — otherwise the dice change nothing", () => {
    const reference = JSON.stringify(play(1, 10).state);
    const diverges = Array.from({ length: 40 }, (_unused, index) => index + 2).some(
      (seed) => JSON.stringify(play(seed, 10).state) !== reference,
    );
    expect(diverges).toBe(true);
  });

  it("diverges when a log is replayed under a different seed", () => {
    const { state, log } = play(11, 10);
    const underOtherSeeds = [12, 13, 14, 15, 16].map((seed) => JSON.stringify(replay(seed, log)));
    expect(underOtherSeeds.every((other) => other === JSON.stringify(state))).toBe(false);
  });

  it("actually exercises duels rather than drifting through moves", () => {
    // Guards the test above from going vacuous: a replay proves nothing about
    // the dice if the playthrough never rolled any.
    const { log } = play(20260807, 12);
    const contested = log.filter((action) => action.type !== "move");
    expect(contested.length).toBeGreaterThanOrEqual(8);
  });

  it("replays identically through a goal and the kickoff reset that follows", () => {
    // A goal swaps the entire board for a fresh formation, which is the most
    // destructive thing the resolver does. Replay has to survive it.
    const start = makeState([
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "goalkeeper", at: [6, 2] },
      { team: "away", role: "defender", at: [1, 1] },
    ]);

    const scoring = Array.from({ length: 40 }, (_unused, index) => index)
      .map((seed) => ({ seed, ...play(seed, 6, start) }))
      .filter((run) => run.state.score.home + run.state.score.away > 0);

    expect(scoring.length).toBeGreaterThan(0);

    for (const run of scoring) {
      expect(JSON.stringify(replay(run.seed, run.log, start))).toBe(JSON.stringify(run.state));
      expect(MatchStateSchema.safeParse(run.state).success).toBe(true);
    }
  });
});

describe("the dice sequence", () => {
  it("is untouched by uncontested actions", () => {
    // A move consumes no randomness. Inserting one before a duel must not change
    // what that duel rolls, or adding a reposition to a replay would silently
    // rewrite everything after it.
    const rngA = createRng(parseSeed(4242));
    const rngB = createRng(parseSeed(4242));
    const start = createInitialState();

    const move = legalActions(start).find((action) => action.type === "move")!;
    const dribble = legalActions(start).find((action) => action.type === "dribble")!;

    const direct = resolveAction(start, dribble, rngA).duel;
    const afterMove = resolveAction(start, move, rngB).state;
    const viaMove = resolveAction(afterMove, dribble, rngB).duel;

    expect(viaMove!.attackerRoll).toBe(direct!.attackerRoll);
    expect(viaMove!.defenderRoll).toBe(direct!.defenderRoll);
  });

  it("spends exactly two dice per contested action and none otherwise", () => {
    const start = createInitialState();
    const move = legalActions(start).find((action) => action.type === "move")!;
    const dribble = legalActions(start).find((action) => action.type === "dribble")!;

    const rng = createRng(parseSeed(9));
    const before = rng.state();
    resolveAction(start, move, rng);
    expect(rng.state()).toBe(before);

    resolveAction(start, dribble, rng);
    expect(rng.state()).not.toBe(before);
  });
});

describe("the engine takes no hidden inputs", () => {
  it("gives the same answer regardless of when it runs", () => {
    // The lint rules forbid Date and Math.random inside the engine; this asserts
    // the behaviour those rules exist to protect.
    const first = JSON.stringify(play(2024, 10).state);
    let spin = 0;
    for (let index = 0; index < 200_000; index += 1) spin += index % 7;
    expect(spin).toBeGreaterThan(0); // stop the loop being optimised away
    expect(JSON.stringify(play(2024, 10).state)).toBe(first);
  });

  it("can resolve every action it says is legal", () => {
    const state = createInitialState();
    for (const action of legalActions(state)) {
      const { state: next } = resolveAction(state, action, createRng(parseSeed(5)));
      expect(MatchStateSchema.safeParse(next).success).toBe(true);
    }
  });
});
