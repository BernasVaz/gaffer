import {
  FORMAT_PROFILES,
  totalTurns,
  MatchStateSchema,
  parseSeed,
  SHOOTOUT_KICKS,
  SHOOTOUT_SUDDEN_DEATH_ROUNDS,
  type MatchState,
  type Team,
} from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import {
  applyAction,
  createInitialState,
  createRng,
  legalActions,
  previewDuel,
} from "../src/index.js";
import { makeState, scriptedRng } from "./helpers.js";

/* These tests pin the rules, and a rule is best pinned on the smallest board
   that can express it. The numbers are 5-a-side's; the rules they check are
   the same at every format. */
const FIVES = FORMAT_PROFILES["5v5"].rules;
const TURN_CAP = FIVES.turnCap;
const EXTRA_TIME_TURNS = FIVES.extraTimeTurns;
const TOTAL_TURNS = totalTurns(FIVES);

/**
 * Hand the turn back and forth `count` times without doing anything else.
 *
 * Uses a real seeded generator rather than an empty scripted one, because
 * passing the final turn can trigger a shootout, and that needs dice.
 */
function endTurns(state: MatchState, count: number, seed = 12345): MatchState {
  const rng = createRng(parseSeed(seed));
  let current = state;

  for (let index = 0; index < count; index += 1) {
    if (current.result) break;
    const result = applyAction(current, { type: "endTurn", team: current.activeTeam }, rng);
    if (!result.ok) throw new Error(`unexpectedly rejected: ${result.reason}`);
    current = result.state;
  }

  return current;
}

/** A state parked on the given turn with the given score, nothing else going on. */
function atTurn(turn: number, score: { home: number; away: number }): MatchState {
  const base = createInitialState();
  return { ...base, turn, score };
}

/** Rolls that make every penalty miss: shooter's lowest die, keeper's highest. */
const ALL_MISSES = Array.from({ length: 200 }, (_unused, index) => (index % 2 === 0 ? 1 : 3));

describe("regulation", () => {
  it("does not end the match while turns remain", () => {
    const state = endTurns(createInitialState(), 5);
    expect(state.result).toBeNull();
    expect(state.turn).toBe(6);
  });

  it("ends with the higher score once the cap is reached", () => {
    const state = endTurns(atTurn(TURN_CAP, { home: 2, away: 1 }), 1);

    // The counter stops on the turn that decided it — result, not turn, is what
    // marks a match over.
    expect(state.turn).toBe(TURN_CAP);
    expect(state.result).toEqual({ winner: "home", decidedBy: "regulation", shootout: null });
  });

  it("awards it to the away side when they lead", () => {
    const state = endTurns(atTurn(TURN_CAP, { home: 0, away: 3 }), 1);
    expect(state.result?.winner).toBe("away");
    expect(state.result?.decidedBy).toBe("regulation");
  });

  it("goes to extra time instead when the score is level", () => {
    const state = endTurns(atTurn(TURN_CAP, { home: 1, away: 1 }), 1);

    expect(state.result).toBeNull();
    expect(state.turn).toBe(TURN_CAP + 1);
  });
});

describe("golden goal", () => {
  it("ends the match the moment a side leads in extra time", () => {
    // Level into extra time, then home scores. Built from scratch rather than by
    // shifting the kickoff formation, whose cells are already taken.
    const scoring: MatchState = {
      ...makeState([
        { team: "home", role: "striker", at: [4, 2], ball: true },
        { team: "away", role: "goalkeeper", at: [6, 2] },
        { team: "away", role: "striker", at: [1, 2] },
      ]),
      turn: TURN_CAP + 1,
      score: { home: 1, away: 1 },
    };

    const result = applyAction(
      scoring,
      { type: "shoot", playerId: "home-striker-0", target: null },
      scriptedRng([3, 1]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.score).toEqual({ home: 2, away: 1 });
    expect(result.state.result).toEqual({
      winner: "home",
      decidedBy: "goldenGoal",
      shootout: null,
    });
  });

  it("keeps playing while extra time is still level", () => {
    const state = endTurns(atTurn(TURN_CAP + 1, { home: 1, away: 1 }), 2);
    expect(state.result).toBeNull();
    expect(state.turn).toBe(TURN_CAP + 3);
  });

  it("runs for exactly EXTRA_TIME_TURNS before the tiebreaker", () => {
    let state = atTurn(TURN_CAP + 1, { home: 0, away: 0 });
    state = endTurns(state, EXTRA_TIME_TURNS - 1);

    expect(state.turn).toBe(TOTAL_TURNS);
    expect(state.result).toBeNull(); // the last extra-time turn is still live
  });
});

describe("the shootout", () => {
  const levelAtTheEnd = () => atTurn(TOTAL_TURNS, { home: 1, away: 1 });

  it("decides a match still level after extra time", () => {
    const state = endTurns(levelAtTheEnd(), 1);

    expect(state.result).not.toBeNull();
    expect(state.result?.shootout).not.toBeNull();
    expect(["home", "away"]).toContain(state.result?.winner);
  });

  it("records the kicks it took", () => {
    const state = endTurns(levelAtTheEnd(), 1);
    const shootout = state.result!.shootout!;

    /* No lower bound of five each any more: best of five stops the moment one
       side cannot be caught (ADR 0026). What must always hold is that the score
       is exactly the kicks that beat the keeper. */
    expect(shootout.kicks.length).toBeGreaterThan(0);
    expect(shootout.home + shootout.away).toBe(shootout.kicks.filter((kick) => kick.scored).length);
  });

  it("gives the first kick to the side that did not kick off", () => {
    const state = endTurns(levelAtTheEnd(), 1);
    expect(state.result!.shootout!.kicks[0]!.team).toBe("away"); // home kicked off
  });

  it("alternates kicks between the sides", () => {
    const { kicks } = endTurns(levelAtTheEnd(), 1).result!.shootout!;
    for (let index = 1; index < kicks.length; index += 1) {
      expect(kicks[index]!.team).not.toBe(kicks[index - 1]!.team);
    }
  });

  it("is deterministic — the same seed always produces the same shootout", () => {
    const runOnce = () => {
      const rng = createRng(parseSeed(20260807));
      const result = applyAction(levelAtTheEnd(), { type: "endTurn", team: "home" }, rng);
      if (!result.ok) throw new Error(result.reason);
      return JSON.stringify(result.state.result);
    };
    expect(runOnce()).toBe(runOnce());
  });

  it("never runs longer than its cap", () => {
    // Every kick missing is the worst case: it must still terminate.
    const rng = scriptedRng(ALL_MISSES);
    const result = applyAction(levelAtTheEnd(), { type: "endTurn", team: "home" }, rng);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { kicks } = result.state.result!.shootout!;
    expect(kicks.length).toBeLessThanOrEqual(SHOOTOUT_KICKS * 2 + SHOOTOUT_SUDDEN_DEATH_ROUNDS * 2);
    expect(result.state.result!.winner).toBeDefined();
  });
});

describe("the statistical backstop", () => {
  /** A level match where every penalty will miss, so the backstop must decide it. */
  const goesToBackstop = (stats: MatchState["stats"], kickedOff: Team = "home"): MatchState => ({
    ...createInitialState({ kickingOff: kickedOff }),
    turn: TOTAL_TURNS,
    score: { home: 1, away: 1 },
    stats,
  });

  const decide = (state: MatchState) => {
    const result = applyAction(
      state,
      { type: "endTurn", team: state.activeTeam },
      scriptedRng(ALL_MISSES),
    );
    if (!result.ok) throw new Error(result.reason);
    return result.state.result!;
  };

  it("gives it to the side that attempted more shots", () => {
    const result = decide(
      goesToBackstop({
        shotsAttempted: { home: 7, away: 3 },
        duelsWon: { home: 0, away: 99 },
      }),
    );

    expect(result.winner).toBe("home");
    expect(result.decidedBy).toBe("shotsAttempted");
  });

  it("falls to duels won when shots are level", () => {
    const result = decide(
      goesToBackstop({
        shotsAttempted: { home: 4, away: 4 },
        duelsWon: { home: 2, away: 9 },
      }),
    );

    expect(result.winner).toBe("away");
    expect(result.decidedBy).toBe("duelsWon");
  });

  it("falls to the side that did not kick off when everything else is level", () => {
    const result = decide(
      goesToBackstop({
        shotsAttempted: { home: 4, away: 4 },
        duelsWon: { home: 5, away: 5 },
      }),
    );

    // Home took the kickoff, so away takes the tie.
    expect(result.winner).toBe("away");
    expect(result.decidedBy).toBe("kickoffCompensation");
  });

  it("compensates whichever side actually kicked off", () => {
    const result = decide(
      goesToBackstop(
        { shotsAttempted: { home: 0, away: 0 }, duelsWon: { home: 0, away: 0 } },
        "away",
      ),
    );

    expect(result.winner).toBe("home");
    expect(result.decidedBy).toBe("kickoffCompensation");
  });

  it("always produces a winner — a draw is never representable", () => {
    const result = decide(
      goesToBackstop({
        shotsAttempted: { home: 0, away: 0 },
        duelsWon: { home: 0, away: 0 },
      }),
    );
    expect(["home", "away"]).toContain(result.winner);
  });
});

describe("match statistics", () => {
  it("starts a match with everything at zero", () => {
    const state = createInitialState();
    expect(state.stats).toEqual({
      shotsAttempted: { home: 0, away: 0 },
      duelsWon: { home: 0, away: 0 },
    });
  });

  it("counts a shot whether it scores or is saved", () => {
    const shooting = makeState([
      { team: "home", role: "striker", at: [4, 2], ball: true },
      { team: "away", role: "goalkeeper", at: [6, 2] },
      { team: "away", role: "striker", at: [1, 2] },
    ]);

    const saved = applyAction(
      shooting,
      { type: "shoot", playerId: "home-striker-0", target: null },
      scriptedRng([1, 3]),
    );
    expect(saved.ok && saved.state.stats.shotsAttempted).toEqual({ home: 1, away: 0 });

    const scored = applyAction(
      shooting,
      { type: "shoot", playerId: "home-striker-0", target: null },
      scriptedRng([3, 1]),
    );
    // A goal rebuilds the pitch — the tally has to survive that.
    expect(scored.ok && scored.state.stats.shotsAttempted).toEqual({ home: 1, away: 0 });
  });

  it("credits a won duel to the side that won it", () => {
    const state = makeState([
      { team: "home", role: "striker", at: [3, 2], ball: true },
      { team: "away", role: "defender", at: [4, 2] },
    ]);

    const won = applyAction(
      state,
      { type: "dribble", playerId: "home-striker-0", target: { x: 3, y: 1 } },
      scriptedRng([3, 1]),
    );
    expect(won.ok && won.state.stats.duelsWon).toEqual({ home: 1, away: 0 });

    const lost = applyAction(
      state,
      { type: "dribble", playerId: "home-striker-0", target: { x: 3, y: 1 } },
      scriptedRng([1, 3]),
    );
    expect(lost.ok && lost.state.stats.duelsWon).toEqual({ home: 0, away: 1 });
  });

  it("counts nothing for an uncontested action", () => {
    /* Past the kickoff first: a kickoff offers only the pass (ADR 0018), and
       what is being checked here is that an *uncontested* action tallies
       nothing — not which verb it happened to be. */
    const start = createInitialState();
    /* An *uncontested* kickoff pass, so the empty scripted generator is never
       asked for a die. Since ADR 0025 the opening offers contested balls too. */
    const opener = legalActions(start).find((action) => previewDuel(start, action) === null)!;
    const kickoff = applyAction(start, opener, scriptedRng([]));
    expect(kickoff.ok).toBe(true);
    if (!kickoff.ok) return;

    const state = kickoff.state;
    const move = legalActions(state).find((action) => action.type === "move")!;
    const moved = applyAction(state, move, scriptedRng([]));

    expect(moved.ok && moved.state.stats).toEqual(state.stats);
  });
});

describe("a finished match", () => {
  const finished = () => endTurns(atTurn(TURN_CAP, { home: 2, away: 0 }), 1);

  it("refuses any further command", () => {
    const state = finished();
    expect(state.result).not.toBeNull();

    const result = applyAction(
      state,
      { type: "move", playerId: "home-winger-1", target: { x: 2, y: 1 } },
      scriptedRng([]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("match-over");
  });

  it("refuses an end-turn too", () => {
    const result = applyAction(finished(), { type: "endTurn", team: "home" }, scriptedRng([]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("match-over");
  });

  it("is still a valid state", () => {
    expect(MatchStateSchema.safeParse(finished()).success).toBe(true);
  });
});

describe("a full match", () => {
  it("always reaches a decided result, whatever the seed", () => {
    for (const seed of [0, 1, 42, 20260807, 0xffffffff]) {
      const rng = createRng(parseSeed(seed));
      let state = createInitialState();

      // Nobody does anything: every turn is passed straight back.
      for (let guard = 0; guard < TOTAL_TURNS + 10 && !state.result; guard += 1) {
        const result = applyAction(state, { type: "endTurn", team: state.activeTeam }, rng);
        if (!result.ok) throw new Error(result.reason);
        state = result.state;
      }

      expect(state.result).not.toBeNull();
      expect(["home", "away"]).toContain(state.result!.winner);
      expect(MatchStateSchema.safeParse(state).success).toBe(true);
    }
  });

  it("replays a decided match byte-identically", () => {
    const playThrough = (seed: number) => {
      const rng = createRng(parseSeed(seed));
      let state = createInitialState();
      while (!state.result) {
        const result = applyAction(state, { type: "endTurn", team: state.activeTeam }, rng);
        if (!result.ok) throw new Error(result.reason);
        state = result.state;
      }
      return JSON.stringify(state);
    };

    expect(playThrough(31337)).toBe(playThrough(31337));
  });
});

describe("a shootout that is taken rather than tallied", () => {
  const levelAtTheEnd = () => atTurn(TOTAL_TURNS, { home: 1, away: 1 });
  const shootoutFrom = (seed: number) => {
    const rng = createRng(parseSeed(seed));
    const result = applyAction(levelAtTheEnd(), { type: "endTurn", team: "home" }, rng);
    if (!result.ok) throw new Error(result.reason);
    return result.state.result!.shootout!;
  };

  it("carries everything a client needs to play the kick out", () => {
    /* The client shows the odds, then the dice, then the outcome. All three come
       off the kick: recomputing any of them elsewhere is a second source of
       truth that can drift from the one the die was compared against. */
    for (const kick of shootoutFrom(20260924).kicks) {
      expect(kick.takerId).not.toBe("");
      expect(kick.keeperId).not.toBe("");
      expect(kick.number).toBeGreaterThanOrEqual(1);
      expect(kick.winChance).toBeGreaterThan(0);
      expect(kick.winChance).toBeLessThanOrEqual(1);
      expect(kick.attackerRoll).toBeGreaterThanOrEqual(1);
      expect(kick.defenderRoll).toBeGreaterThanOrEqual(1);
      // The outcome is the two totals, and a tie is a save.
      expect(kick.scored).toBe(kick.attackerTotal > kick.defenderTotal);
    }
  });

  it("takes its penalties in ATK order, a different player each time", () => {
    const { kicks } = shootoutFrom(4242);
    const away = kicks.filter((kick) => kick.team === "away" && !kick.suddenDeath);

    const takers = away.map((kick) => kick.takerId);
    expect(new Set(takers).size).toBe(takers.length);

    /* And in descending ATK: the best penalty taker goes first. */
    const state = levelAtTheEnd();
    const atkOf = (id: string) => state.players.find((player) => player.id === id)!.stats.atk;
    for (let index = 1; index < takers.length; index += 1) {
      expect(atkOf(takers[index]!)).toBeLessThanOrEqual(atkOf(takers[index - 1]!));
    }
  });

  it("stops once one side cannot be caught", () => {
    /* Best of five means best of five. Nobody should be asked to press through
       a penalty that cannot change the result. */
    for (let seed = 1; seed <= 200; seed += 1) {
      const shootout = shootoutFrom(seed);
      const regulation = shootout.kicks.filter((kick) => !kick.suddenDeath);

      const taken = { home: 0, away: 0 };
      const scored = { home: 0, away: 0 };

      for (const kick of regulation) {
        const left = {
          home: SHOOTOUT_KICKS - taken.home,
          away: SHOOTOUT_KICKS - taken.away,
        };
        const settled =
          scored.home > scored.away + left.away || scored.away > scored.home + left.home;
        expect(settled, `seed ${seed}: a kick was taken after the result was settled`).toBe(false);

        taken[kick.team] += 1;
        if (kick.scored) scored[kick.team] += 1;
      }
    }
  });

  it("rotates back to the best taker in sudden death", () => {
    /* Everyone takes one before anyone takes two. */
    for (let seed = 1; seed <= 400; seed += 1) {
      const { kicks } = shootoutFrom(seed);
      const sudden = kicks.filter((kick) => kick.suddenDeath && kick.team === "away");
      if (sudden.length === 0) continue;

      const squadSize = levelAtTheEnd().players.filter((player) => player.team === "away").length;
      const regulation = kicks.filter((kick) => !kick.suddenDeath && kick.team === "away").length;

      // The next kick after the regulation ones continues the same rotation.
      const order = kicks.filter((kick) => kick.team === "away").map((kick) => kick.takerId);
      for (let index = 0; index < order.length; index += 1) {
        expect(order[index]).toBe(order[index % squadSize]);
      }
      expect(regulation).toBeLessThanOrEqual(SHOOTOUT_KICKS);
      return;
    }
  });

  it("always terminates, and always names a winner", () => {
    /* The property that matters most: a shootout is the last thing standing
       between a level match and a draw, which GDD §10 forbids. */
    for (let seed = 1; seed <= 400; seed += 1) {
      const rng = createRng(parseSeed(seed));
      const result = applyAction(levelAtTheEnd(), { type: "endTurn", team: "home" }, rng);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      const decided = result.state.result!;
      expect(["home", "away"]).toContain(decided.winner);

      const shootout = decided.shootout!;
      const cap = (SHOOTOUT_KICKS + SHOOTOUT_SUDDEN_DEATH_ROUNDS) * 2;
      expect(shootout.kicks.length).toBeLessThanOrEqual(cap);
    }
  });

  it("replays byte-identically from the same seed", () => {
    const once = JSON.stringify(shootoutFrom(31337));
    const twice = JSON.stringify(shootoutFrom(31337));
    expect(once).toBe(twice);
  });
});
