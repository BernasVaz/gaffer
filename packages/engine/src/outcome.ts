import {
  duelWinChance,
  DUEL_DIE_SIDES,
  isExtraTime,
  opponentOf,
  SHOOTOUT_KICKS,
  SHOOTOUT_SUDDEN_DEATH_ROUNDS,
  totalTurns,
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
 * The order a side takes its penalties in: best attacker first.
 *
 * The whole squad, sorted by ATK, ties broken on id so a replay is stable. Five
 * different players take the opening five, as football requires — which at
 * 5-a-side means the goalkeeper takes one, because there are exactly five of
 * them and somebody has to.
 *
 * Sudden death **rotates**: kick six goes back to the best attacker and the
 * order runs again. Everyone takes one before anyone takes two (ADR 0026).
 */
function penaltyOrder(state: MatchState, team: Team): Player[] {
  return state.players
    .filter((player) => player.team === team)
    .sort((a, b) => b.stats.atk - a.stats.atk || a.id.localeCompare(b.id));
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
 * Whether the shootout is already decided with kicks still to take.
 *
 * Best of five means exactly that: once one side cannot be caught, the rest are
 * not taken. Before ADR 0026 every kick was taken regardless, which nobody saw
 * because nobody watched it — but a person pressing through three dead penalties
 * to reach a result already settled is a different thing entirely.
 *
 * @param scored - Penalties converted so far.
 * @param taken - Penalties taken so far, per side.
 */
function alreadyDecided(scored: Record<Team, number>, taken: Record<Team, number>): boolean {
  const left = (team: Team) => SHOOTOUT_KICKS - taken[team];
  return scored.home > scored.away + left("away") || scored.away > scored.home + left("home");
}

/**
 * Run the shootout.
 *
 * Each penalty is the shot duel the rest of the engine already uses — taker ATK
 * against keeper DEF, an opposed die, a tie going to the keeper — with no
 * covering defenders, because nobody else is on the pitch for it. **No new
 * balance surface:** a penalty is priced by the same two stats and the same die
 * as every other shot in the game.
 *
 * The whole shootout resolves here, in one step, consuming the match's own
 * seeded generator in a fixed order. That is what makes it replayable: a seed
 * and a command log reproduce the same kicks in the same order with no client
 * attached, and self-play runs it exactly as a person's match does. A client
 * takes the resulting list and walks it one kick at a time, which is
 * presentation and nothing more (ADR 0026).
 *
 * Every kick carries the odds it was resolved at, so the number shown before a
 * player presses is provably the number the die was compared against rather than
 * a second, parallel calculation that could drift.
 *
 * The side that did **not** take the opening kickoff goes first, the same
 * compensation the final tiebreaker rung applies.
 */
function runShootout(state: MatchState, rng: Rng): Shootout {
  const first = opponentOf(state.kickedOff);
  const second = state.kickedOff;

  const order: Record<Team, Player[]> = {
    home: penaltyOrder(state, "home"),
    away: penaltyOrder(state, "away"),
  };

  const kicks: ShootoutKick[] = [];
  const scored: Record<Team, number> = { home: 0, away: 0 };
  const taken: Record<Team, number> = { home: 0, away: 0 };

  const take = (team: Team, suddenDeath: boolean): void => {
    const squad = order[team];
    const taker = squad.length > 0 ? squad[taken[team] % squad.length] : undefined;
    const keeper = penaltyKeeper(state, opponentOf(team));

    const attack = taker?.stats.atk ?? 0;
    const defence = keeper?.stats.def ?? 0;

    const attackerRoll = rng.int(1, DUEL_DIE_SIDES);
    const defenderRoll = rng.int(1, DUEL_DIE_SIDES);
    const attackerTotal = attack + attackerRoll;
    const defenderTotal = defence + defenderRoll;

    // Strictly higher, so a tie is a save (GDD §9).
    const beat = attackerTotal > defenderTotal;
    taken[team] += 1;
    if (beat) scored[team] += 1;

    kicks.push({
      team,
      scored: beat,
      number: taken[team],
      suddenDeath,
      takerId: taker?.id ?? "",
      keeperId: keeper?.id ?? "",
      attackerTotal,
      defenderTotal,
      attackerRoll,
      defenderRoll,
      winChance: duelWinChance(attack, defence),
    });
  };

  for (let kick = 0; kick < SHOOTOUT_KICKS; kick += 1) {
    if (alreadyDecided(scored, taken)) break;
    take(first, false);
    if (alreadyDecided(scored, taken)) break;
    take(second, false);
  }

  for (let round = 0; round < SHOOTOUT_SUDDEN_DEATH_ROUNDS; round += 1) {
    if (scored.home !== scored.away) break;
    take(first, true);
    take(second, true);
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
 * How the match ended, given that `state.turn` has just been played out — or null
 * if there is another turn to play.
 *
 * Deliberately asked **before** the turn counter advances, so a decided match
 * stops on the turn that decided it. `turn` therefore never exceeds the match's
 * own {@link totalTurns}, and `result` being non-null is the only thing that
 * marks a match as over. Reading the phase from the completed turn is also more honest
 * than inferring it from an already-incremented counter.
 *
 * The three moments that matter:
 * - **regulation ends with a lead** — decided in regulation;
 * - **a side leads during extra time** — golden goal, which takes effect at once
 *   because a goal ends the scoring side's turn;
 * - **extra time runs out level** — the tiebreaker cascade.
 *
 * @param state - The board, with `turn` naming the turn just completed. Not modified.
 * @param rng - The match's seeded generator, used only if a shootout is needed.
 */
export function matchResultAfterTurn(state: MatchState, rng: Rng): MatchResult | null {
  if (state.result !== null) return state.result;

  const completed = state.turn;
  const ahead = leader(state);

  if (ahead !== null) {
    // A lead entering extra time is impossible — extra time only happens when
    // the sides are level — so any lead after the cap was scored during it.
    if (completed === state.rules.turnCap) {
      return { winner: ahead, decidedBy: "regulation", shootout: null };
    }
    if (isExtraTime(completed, state.rules)) {
      return { winner: ahead, decidedBy: "goldenGoal", shootout: null };
    }
    return null; // still in regulation, a lead settles nothing yet
  }

  // Level, and extra time has run out: the cascade has to produce a winner.
  if (completed >= totalTurns(state.rules)) return decideLevelMatch(state, rng);

  return null;
}
