import { MatchStateSchema, parseSeed, type MatchCommand, type MatchState } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { applyAction, createInitialState, createRng, legalActions } from "../src/index.js";
import { makeState } from "./helpers.js";

/** A stable ordering, so a playthrough never depends on enumeration order. */
const sortKey = (command: MatchCommand) =>
  command.type === "endTurn"
    ? `endTurn|${command.team}`
    : `${command.type}|${command.playerId}|${JSON.stringify(command.target)}`;

/**
 * Play a scripted match through the public entry point, recording what was sent.
 *
 * Everything goes through `applyAction`, exactly as a client, a server and a
 * replay would — there is no trusted fast path around the referee.
 *
 * Commands are chosen from `legalActions` by a fixed arithmetic rule rather than
 * hard-coded, so every step stays legal however the dice fall, and contested
 * actions are preferred because moves outnumber duels roughly ten to one.
 */
function play(
  seed: number,
  steps: number,
  start: MatchState = createInitialState(),
): { state: MatchState; log: MatchCommand[] } {
  const rng = createRng(parseSeed(seed));
  let state = start;
  const log: MatchCommand[] = [];

  for (let step = 0; step < steps; step += 1) {
    const options = [...legalActions(state)].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const contested = options.filter((action) => action.type !== "move");
    const pool = contested.length > 0 ? contested : options;

    const command: MatchCommand =
      pool.length === 0
        ? { type: "endTurn", team: state.activeTeam }
        : pool[(step * 7 + 3) % pool.length]!;

    const result = applyAction(state, command, rng);
    if (!result.ok) throw new Error(`engine rejected its own legal command: ${result.reason}`);

    log.push(command);
    state = result.state;
  }

  return { state, log };
}

/** Replay a recorded log from scratch — what a shared match URL does. */
function replay(
  seed: number,
  log: readonly MatchCommand[],
  start: MatchState = createInitialState(),
): MatchState {
  const rng = createRng(parseSeed(seed));
  let state = start;

  for (const command of log) {
    const result = applyAction(state, command, rng);
    if (!result.ok) throw new Error(`replay rejected: ${result.reason}`);
    state = result.state;
  }

  return state;
}

describe("replay determinism", () => {
  it("reaches a byte-identical state from the same seed and command log", () => {
    // The guarantee the whole engine rests on. If this fails, shareable match
    // links and server-side verification are both broken.
    const { state, log } = play(20260807, 16);
    expect(JSON.stringify(replay(20260807, log))).toBe(JSON.stringify(state));
  });

  it("plays the identical match when run twice from one seed", () => {
    const first = play(20260807, 16);
    const second = play(20260807, 16);

    expect(second.log).toEqual(first.log);
    expect(JSON.stringify(second.state)).toBe(JSON.stringify(first.state));
  });

  it("stays identical across many repetitions, not just two", () => {
    const reference = JSON.stringify(play(7, 12).state);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(JSON.stringify(play(7, 12).state)).toBe(reference);
    }
  });

  it("holds for a range of seeds, not one lucky one", () => {
    for (const seed of [0, 1, 42, 4095, 65535, 0xffffffff]) {
      const { state, log } = play(seed, 10);
      expect(JSON.stringify(replay(seed, log))).toBe(JSON.stringify(state));
    }
  });

  it("keeps every intermediate state valid, not just the last one", () => {
    const { log } = play(31337, 12);
    const rng = createRng(parseSeed(31337));
    let state = createInitialState();

    for (const command of log) {
      const result = applyAction(state, command, rng);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      expect(MatchStateSchema.safeParse(state).success).toBe(true);
    }
  });

  it("is sensitive to the seed — otherwise the dice change nothing", () => {
    const reference = JSON.stringify(play(1, 12).state);
    const diverges = Array.from({ length: 40 }, (_unused, index) => index + 2).some(
      (seed) => JSON.stringify(play(seed, 12).state) !== reference,
    );
    expect(diverges).toBe(true);
  });

  it("actually exercises duels rather than drifting through moves", () => {
    // Guards the tests above from going vacuous: a replay proves nothing about
    // the dice if the playthrough never rolled any.
    const { log } = play(20260807, 16);
    const contested = log.filter(
      (command) => command.type !== "move" && command.type !== "endTurn",
    );
    expect(contested.length).toBeGreaterThanOrEqual(10);
  });

  it("gives both sides turns, so a log is never one-sided", () => {
    const { log } = play(4242, 16);
    const actors = new Set(
      log.map((command) =>
        command.type === "endTurn" ? command.team : command.playerId.split("-")[0],
      ),
    );
    expect([...actors].sort()).toEqual(["away", "home"]);
  });

  it("replays identically through a goal and the kickoff reset that follows", () => {
    // A goal swaps the whole board for a fresh formation and ends the turn —
    // the most destructive thing the engine does. Replay must survive it.
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
    const start = createInitialState();
    const move = legalActions(start).find((action) => action.type === "move")!;
    const dribble = legalActions(start).find((action) => action.type === "dribble")!;

    const rngA = createRng(parseSeed(4242));
    const rngB = createRng(parseSeed(4242));

    const direct = applyAction(start, dribble, rngA);
    const afterMove = applyAction(start, move, rngB);
    expect(afterMove.ok).toBe(true);
    if (!afterMove.ok || !direct.ok) return;

    const viaMove = applyAction(afterMove.state, dribble, rngB);
    expect(viaMove.ok).toBe(true);
    if (!viaMove.ok) return;

    expect(viaMove.duel!.attackerRoll).toBe(direct.duel!.attackerRoll);
    expect(viaMove.duel!.defenderRoll).toBe(direct.duel!.defenderRoll);
  });

  it("spends dice only on contested actions", () => {
    const start = createInitialState();
    const move = legalActions(start).find((action) => action.type === "move")!;
    const dribble = legalActions(start).find((action) => action.type === "dribble")!;

    const rng = createRng(parseSeed(9));
    const before = rng.state();

    applyAction(start, move, rng);
    expect(rng.state()).toBe(before);

    applyAction(start, dribble, rng);
    expect(rng.state()).not.toBe(before);
  });

  it("spends no dice on an end-turn", () => {
    const rng = createRng(parseSeed(9));
    const before = rng.state();
    applyAction(createInitialState(), { type: "endTurn", team: "home" }, rng);
    expect(rng.state()).toBe(before);
  });
});

describe("the engine takes no hidden inputs", () => {
  it("gives the same answer regardless of when it runs", () => {
    // The lint rules forbid Date and Math.random inside the engine; this asserts
    // the behaviour those rules exist to protect.
    const first = JSON.stringify(play(2024, 12).state);
    let spin = 0;
    for (let index = 0; index < 200_000; index += 1) spin += index % 7;
    expect(spin).toBeGreaterThan(0); // stop the loop being optimised away
    expect(JSON.stringify(play(2024, 12).state)).toBe(first);
  });

  it("accepts every action it says is legal", () => {
    const state = createInitialState();
    for (const action of legalActions(state)) {
      const result = applyAction(state, action, createRng(parseSeed(5)));
      expect(result.ok).toBe(true);
      if (result.ok) expect(MatchStateSchema.safeParse(result.state).success).toBe(true);
    }
  });
});
