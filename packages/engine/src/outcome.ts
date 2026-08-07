import {
  DUEL_DIE_SIDES,
  isExtraTime,
  opponentOf,
  SHOOTOUT_KICKS,
  SHOOTOUT_SUDDEN_DEATH_ROUNDS,
  TURN_CAP,
  type MatchResult,
  type MatchState,
  type Player,
  type Shootout,
  type ShootoutKick,
  type Team,
} from "@gaffer/shared";

import type { Rng } from "./rng.js";

/** The side with more goals, or null when the scores are level. */
function leader(state: MatchState): Team | null {
  if (state.score.home > state.score.away) return "home";
  if (state.score.away > state.score.home) return "away";
  return null;
}

/**
 * Who takes a side's penalties.
 *
 * The best attacker shoots and the keeper saves, which for a v1 squad is always
 * the Striker and the Goalkeeper. Chosen by stat rather than by role so a state
 * missing either role still resolves instead of throwing — a shootout must never
 * be the thing that crashes a match.
 */
function penaltyTaker(state: MatchState, team: Team): Player | undefined {
  return state.players
    .filter((player) => player.team === team)
    .sort((a, b) => b.stats.atk - a.stats.atk || a.id.localeCompare(b.id))[0];
}

/** Who faces a side's penalties: their keeper, or the best defender available. */
function penaltyKeeper(state: MatchState, team: Team): Player | undefined {
  const squad = state.players.filter((player) => player.team === team);
  return (
    squad.find((player) => player.role === "goalkeeper") ??
    [...squad].sort((a, b) => b.stats.def - a.stats.def || a.id.localeCompare(b.id))[0]
  );
}

/**
 * Run the shootout.
 *
 * Each penalty is the shot duel the rest of the engine already uses — taker ATK
 * against keeper DEF, an opposed d3, a tie going to the keeper — with no covering
 * defenders, because nobody else is on the pitch for it.
 *
 * There is nothing for a player to decide here, so the whole shootout resolves in
 * one step and lands in the result for a client to animate. That also keeps it
 * replayable: it consumes the match's own seeded generator in a fixed order.
 *
 * The side that did **not** take the opening kickoff goes first, the same
 * compensation the final tiebreaker rung applies.
 */
function runShootout(state: MatchState, rng: Rng): Shootout {
  const first = opponentOf(state.kickedOff);
  const second = state.kickedOff;

  const kicks: ShootoutKick[] = [];
  const scored: Record<Team, number> = { home: 0, away: 0 };

  const take = (team: Team): void => {
    const taker = penaltyTaker(state, team);
    const keeper = penaltyKeeper(state, opponentOf(team));

    const attack = (taker?.stats.atk ?? 0) + rng.int(1, DUEL_DIE_SIDES);
    const defence = (keeper?.stats.def ?? 0) + rng.int(1, DUEL_DIE_SIDES);

    // Strictly higher, so a tie is a save (GDD §9).
    const beat = attack > defence;
    if (beat) scored[team] += 1;
    kicks.push({ team, scored: beat });
  };

  for (let kick = 0; kick < SHOOTOUT_KICKS; kick += 1) {
    take(first);
    take(second);
  }

  for (let round = 0; round < SHOOTOUT_SUDDEN_DEATH_ROUNDS; round += 1) {
    if (scored.home !== scored.away) break;
    take(first);
    take(second);
  }

  return { home: scored.home, away: scored.away, kicks };
}

/**
 * Decide a match that is level after extra time.
 *
 * The cascade, in order: the shootout, then more shots attempted, then more duels
 * won, then the side that did not take the opening kickoff. The last rung cannot
 * tie, which is what guarantees a result — GDD §10 forbids flat draws, and a
 * symmetric shootout can always come back level however long it runs.
 */
function decideLevelMatch(state: MatchState, rng: Rng): MatchResult {
  const shootout = runShootout(state, rng);

  if (shootout.home !== shootout.away) {
    return {
      winner: shootout.home > shootout.away ? "home" : "away",
      decidedBy: "shootout",
      shootout,
    };
  }

  const { shotsAttempted, duelsWon } = state.stats;

  if (shotsAttempted.home !== shotsAttempted.away) {
    return {
      winner: shotsAttempted.home > shotsAttempted.away ? "home" : "away",
      decidedBy: "shotsAttempted",
      shootout,
    };
  }

  if (duelsWon.home !== duelsWon.away) {
    return {
      winner: duelsWon.home > duelsWon.away ? "home" : "away",
      decidedBy: "duelsWon",
      shootout,
    };
  }

  // Nothing separates them. The only structural asymmetry in the game is that one
  // side moved first with the ball, so the other takes the tie.
  return {
    winner: opponentOf(state.kickedOff),
    decidedBy: "kickoffCompensation",
    shootout,
  };
}

/**
 * Close the match out if it is over, otherwise hand back the state unchanged.
 *
 * Called after every turn passes, which is also immediately after a goal — a goal
 * ends the scoring side's turn, so golden goal takes effect at once rather than
 * waiting for anyone else to act.
 *
 * The three moments that matter:
 * - **the cap passes with a lead** — decided in regulation;
 * - **a side leads during extra time** — golden goal;
 * - **extra time runs out level** — the tiebreaker cascade.
 *
 * @param state - The board after a turn passed. Not modified.
 * @param rng - The match's seeded generator, used only if a shootout is needed.
 */
export function concludeIfOver(state: MatchState, rng: Rng): MatchState {
  if (state.result !== null) return state;
  if (state.turn <= TURN_CAP) return state; // regulation still running

  const ahead = leader(state);

  if (ahead !== null) {
    return {
      ...state,
      result: {
        winner: ahead,
        // Crossing the cap exactly is the end of regulation; anything later is a
        // goal scored during extra time.
        decidedBy: state.turn === TURN_CAP + 1 ? "regulation" : "goldenGoal",
        shootout: null,
      },
    };
  }

  if (isExtraTime(state.turn)) return state; // still level, extra time to play

  // Past TOTAL_TURNS and level: the cascade has to produce a winner.
  return { ...state, result: decideLevelMatch(state, rng) };
}
