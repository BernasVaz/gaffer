import {
  ACTIONS_PER_TURN,
  DECISION_METHODS,
  MatchStateSchema,
  parseSeed,
  REJECTION_REASONS,
  TOTAL_TURNS,
  type MatchCommand,
  type MatchState,
  type Position,
} from "@gaffer/shared";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { applyAction, createInitialState, createRng, legalActions } from "../src/index.js";

/**
 * One instruction in a generated match.
 *
 * Mostly legal play, because that is how a match gets deep enough for the
 * interesting states to appear; occasionally raw nonsense, because a referee has
 * to survive a client that sends it.
 */
type Step = { kind: "legal"; index: number } | { kind: "raw"; command: MatchCommand };

const PLAYER_IDS = [
  "home-goalkeeper",
  "home-defender",
  "home-midfielder",
  "home-winger",
  "home-striker",
  "away-goalkeeper",
  "away-defender",
  "away-midfielder",
  "away-winger",
  "away-striker",
  "nobody-at-all",
] as const;

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

/** Cells on and just off the board, so out-of-bounds targets get exercised. */
const positionArb: fc.Arbitrary<Position> = fc.record({
  x: fc.integer({ min: 0, max: 8 }),
  y: fc.integer({ min: 0, max: 6 }),
});

const playerIdArb = fc.constantFrom(...PLAYER_IDS);

/** A well-typed command that is very unlikely to be legal. */
const rawCommandArb: fc.Arbitrary<MatchCommand> = fc.oneof(
  fc.record({ type: fc.constant("move" as const), playerId: playerIdArb, target: positionArb }),
  fc.record({ type: fc.constant("dribble" as const), playerId: playerIdArb, target: positionArb }),
  fc.record({ type: fc.constant("pass" as const), playerId: playerIdArb, target: playerIdArb }),
  fc.record({ type: fc.constant("tackle" as const), playerId: playerIdArb, target: playerIdArb }),
  fc.record({
    type: fc.constant("shoot" as const),
    playerId: playerIdArb,
    target: fc.constant(null),
  }),
  fc.record({
    type: fc.constant("endTurn" as const),
    team: fc.constantFrom("home" as const, "away" as const),
  }),
);

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 5,
    arbitrary: fc.nat({ max: 500 }).map((index) => ({ kind: "legal" as const, index })),
  },
  { weight: 1, arbitrary: rawCommandArb.map((command) => ({ kind: "raw" as const, command })) },
);

const scriptArb = fc.array(stepArb, { minLength: 1, maxLength: 80 });

/** Turn a step into a concrete command against the state in front of it. */
function toCommand(state: MatchState, step: Step): MatchCommand {
  if (step.kind === "raw") return step.command;

  const options = legalActions(state);
  if (options.length === 0) return { type: "endTurn", team: state.activeTeam };
  return options[step.index % options.length]!;
}

/**
 * Everything that must be true of a state the engine hands back, whatever route
 * it took to get there.
 */
function assertInvariants(next: MatchState, previous: MatchState): void {
  // The schema is the contract; anything it rejects is a state that should never
  // have existed. It also covers the one-piece-per-cell and ball/possession
  // rules, which are asserted again below so a schema change cannot quietly
  // stop checking them.
  expect(MatchStateSchema.safeParse(next).success).toBe(true);

  const cells = next.players.map((player) => `${player.position.x},${player.position.y}`);
  expect(new Set(cells).size).toBe(cells.length);

  if (next.ball.carrierId !== null) {
    const carrier = next.players.find((player) => player.id === next.ball.carrierId);
    expect(carrier).toBeDefined();
    expect(next.ball.position).toEqual(carrier!.position);
    expect(next.possession).toBe(carrier!.team);
  }

  expect(next.score.home).toBeGreaterThanOrEqual(previous.score.home);
  expect(next.score.away).toBeGreaterThanOrEqual(previous.score.away);

  expect(next.actionsRemaining).toBeGreaterThanOrEqual(0);
  expect(next.actionsRemaining).toBeLessThanOrEqual(ACTIONS_PER_TURN);

  expect(next.turn).toBeGreaterThanOrEqual(previous.turn);
  expect(next.turn).toBeGreaterThanOrEqual(1);
  expect(next.turn).toBeLessThanOrEqual(TOTAL_TURNS);

  // Bookkeeping only ever accumulates.
  expect(next.stats.shotsAttempted.home).toBeGreaterThanOrEqual(previous.stats.shotsAttempted.home);
  expect(next.stats.shotsAttempted.away).toBeGreaterThanOrEqual(previous.stats.shotsAttempted.away);
  expect(next.stats.duelsWon.home).toBeGreaterThanOrEqual(previous.stats.duelsWon.home);
  expect(next.stats.duelsWon.away).toBeGreaterThanOrEqual(previous.stats.duelsWon.away);

  // A decided match names a winner — GDD §10 forbids a draw, so there is no
  // "nobody won" state to represent.
  if (next.result !== null) {
    expect(["home", "away"]).toContain(next.result.winner);
    expect(DECISION_METHODS).toContain(next.result.decidedBy);
  }

  // Who took the kickoff is fixed for the match; the tiebreaker depends on it.
  expect(next.kickedOff).toBe(previous.kickedOff);
}

/** Play a generated script, checking every step on the way through. */
function run(seed: number, script: readonly Step[], check = true): MatchState {
  const rng = createRng(parseSeed(seed));
  let state = createInitialState();

  for (const step of script) {
    const wasOver = state.result !== null;
    const command = toCommand(state, step);
    const result = applyAction(state, command, rng);

    if (!result.ok) {
      if (check) {
        expect(REJECTION_REASONS).toContain(result.reason);
        // A decided match refuses everything, and for that reason specifically.
        if (wasOver) expect(result.reason).toBe("match-over");
      }
      continue;
    }

    if (check) assertInvariants(result.state, state);
    state = result.state;
  }

  return state;
}

describe("invariants over random play", () => {
  it("holds every rule the engine claims, across generated matches", () => {
    fc.assert(
      fc.property(seedArb, scriptArb, (seed, script) => {
        run(seed, script);
      }),
      { numRuns: 200 },
    );
  });

  it("never lets a command through once a match is decided", () => {
    fc.assert(
      fc.property(seedArb, fc.array(stepArb, { minLength: 40, maxLength: 120 }), (seed, script) => {
        const rng = createRng(parseSeed(seed));
        let state = createInitialState();
        let frozen: string | null = null;

        for (const step of script) {
          const result = applyAction(state, toCommand(state, step), rng);

          if (frozen !== null) {
            // Once decided, nothing may change the board again.
            expect(result.ok).toBe(false);
            expect(JSON.stringify(state)).toBe(frozen);
            continue;
          }

          if (result.ok) {
            state = result.state;
            if (state.result !== null) frozen = JSON.stringify(state);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("accepts everything it says is legal, at every point in a match", () => {
    /*
     * The two halves of the public API must agree about the same board. This
     * caught a real disagreement: a decided match still listed 37 "legal"
     * actions while applyAction refused all of them, so a client would have
     * offered playable moves on a finished match.
     */
    fc.assert(
      fc.property(seedArb, scriptArb, (seed, script) => {
        const rng = createRng(parseSeed(seed));
        let state = createInitialState();

        for (const step of script) {
          for (const offered of legalActions(state)) {
            const probe = applyAction(state, offered, createRng(parseSeed(seed)));
            expect(probe.ok).toBe(true);
          }

          const result = applyAction(state, toCommand(state, step), rng);
          if (result.ok) state = result.state;
        }
      }),
      { numRuns: 40 },
    );
  });

  it("only ever answers with a valid state or a known refusal", () => {
    fc.assert(
      fc.property(seedArb, fc.array(rawCommandArb, { maxLength: 30 }), (seed, commands) => {
        const rng = createRng(parseSeed(seed));
        let state = createInitialState();

        for (const command of commands) {
          const result = applyAction(state, command, rng);

          if (result.ok) {
            expect(MatchStateSchema.safeParse(result.state).success).toBe(true);
            state = result.state;
          } else {
            expect(REJECTION_REASONS).toContain(result.reason);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe("determinism over random play", () => {
  it("reaches the same state from the same seed and script", () => {
    fc.assert(
      fc.property(seedArb, scriptArb, (seed, script) => {
        const first = run(seed, script, false);
        const second = run(seed, script, false);
        expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      }),
      { numRuns: 200 },
    );
  });

  /*
   * There is deliberately no property asserting "different seeds give different
   * matches". It cannot be stated soundly here: with an opposed d3, a stat gap of
   * three or more saturates the odds to 0 or 1, so a script can roll a dozen
   * duels and still be entirely seed-independent — a Striker on ATK 5 dribbling a
   * Winger on DEF 2 wins whatever the dice say. A property that is true only
   * usually is a flaky test, which is worse than none.
   *
   * Seed sensitivity is asserted deterministically instead, over a fixed script
   * known to contain uncertain duels — see determinism.test.ts.
   */
});
