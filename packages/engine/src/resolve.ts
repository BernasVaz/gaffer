import {
  DUEL_DIE_SIDES,
  goalMouthOwner,
  isWithinBoard,
  opponentOf,
  type Action,
  type Duel,
  type DuelPreview,
  type MatchState,
  type Player,
  type Position,
  type Team,
} from "@gaffer/shared";

import { previewDuel } from "./duel.js";
import type { Rng } from "./rng.js";
import { createInitialState } from "./state.js";

/** What an action did: the board it produced, and the duel it provoked if any. */
export interface ResolvedAction {
  /** The state after the action. Always a fresh object. */
  state: MatchState;
  /** The duel that decided it, or null when the action was uncontested. */
  duel: Duel | null;
}

const findPlayer = (state: MatchState, id: string): Player | undefined =>
  state.players.find((player) => player.id === id);

/** Roll a previewed duel. Attacker's die first — the order is part of the replay. */
function rollDuel(duelPreview: DuelPreview, rng: Rng): Duel {
  const attackerRoll = rng.int(1, DUEL_DIE_SIDES);
  const defenderRoll = rng.int(1, DUEL_DIE_SIDES);

  const attackerTotal = duelPreview.attacker.stat + duelPreview.attacker.modifier + attackerRoll;
  const defenderTotal = duelPreview.defender.stat + duelPreview.defender.modifier + defenderRoll;

  return {
    ...duelPreview,
    attackerRoll,
    defenderRoll,
    attackerTotal,
    defenderTotal,
    // Strictly higher: a tie goes to the defender (GDD §9).
    attackerWon: attackerTotal > defenderTotal,
  };
}

/**
 * Where a won dribble actually finishes.
 *
 * One cell further than it was aimed at, in the direction it was going — you
 * knock it past him and run on. Only when that cell is on the board, empty, and
 * one this player may stand on; otherwise the run simply ends where it was
 * aimed.
 *
 * This is what stopped dribbling being a tax. Taking the man on (ADR 0021) gave
 * a dribble a destination a move could not reach, but every dribble was still
 * paying a duel for ground a move would have covered for free — and 5-a-side
 * lost a seventh of its goals to the turnovers that bought. Winning now buys
 * ground (GDD §7, ADR 0023).
 *
 * Composes with the through-the-man case: beating the defender in front carries
 * the carrier past him *and* on, which is the one run in the game a move could
 * never make.
 */
function carriedOn(state: MatchState, actor: Player, target: Position): Position {
  const step = {
    x: Math.sign(target.x - actor.position.x),
    y: Math.sign(target.y - actor.position.y),
  };
  if (step.x === 0 && step.y === 0) return target;

  const beyond = { x: target.x + step.x, y: target.y + step.y };
  if (!isWithinBoard(beyond, state.board)) return target;

  const blocked = state.players.some(
    (player) =>
      player.id !== actor.id && player.position.x === beyond.x && player.position.y === beyond.y,
  );
  if (blocked) return target;

  /* A goal mouth is what a shot is aimed into, not somewhere a player stands —
     only the keeper defending it may be there (GDD §7). */
  const owner = goalMouthOwner(beyond, state.board);
  if (owner !== null && !(actor.team === owner && actor.role === "goalkeeper")) return target;

  return beyond;
}

/** Move one player, leaving everything else alone. */
function movePlayer(state: MatchState, playerId: string, to: Position): MatchState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, position: { ...to } } : player,
    ),
  };
}

/** Put the ball on a player's cell and hand that player's side possession. */
function giveBallTo(state: MatchState, playerId: string): MatchState {
  const holder = findPlayer(state, playerId);
  if (!holder) return state;

  return {
    ...state,
    ball: { position: { ...holder.position }, carrierId: holder.id },
    possession: holder.team,
  };
}

/**
 * Rebuild the pitch for a kickoff after a goal (GDD §7, §10).
 *
 * Both squads return to formation and the conceding side takes the kickoff. The
 * score carries over; `turn`, `activeTeam` and `actionsRemaining` deliberately
 * do not change, because whose turn it is belongs to the turn-economy slice.
 */
function afterGoal(state: MatchState, scoringTeam: Team): MatchState {
  const conceding = opponentOf(scoringTeam);
  const kickoff = createInitialState({ format: state.format, kickingOff: conceding });

  return {
    ...kickoff,
    score:
      scoringTeam === "home"
        ? { home: state.score.home + 1, away: state.score.away }
        : { home: state.score.home, away: state.score.away + 1 },
    turn: state.turn,
    activeTeam: state.activeTeam,
    actionsRemaining: state.actionsRemaining,
    // createInitialState builds a brand-new match; these belong to this one.
    // `rules` included: the format table is content and may be retuned, but a
    // match in progress keeps the numbers it kicked off under.
    rules: state.rules,
    kickedOff: state.kickedOff,
    /* `createInitialState` already set this to the conceding side, which is
       exactly right — a kickoff after a goal is still a kickoff. Spelled out
       so the next person reading this list does not "restore" it from the
       old state along with everything else around it. */
    kickoffPending: kickoff.kickoffPending,
    stats: state.stats,
    result: state.result,
  };
}

/**
 * Play one action out and return the board it produces.
 *
 * Rolls only for contested actions, and exactly twice when it does — attacker's
 * die then defender's. An uncontested move or pass consumes no randomness at
 * all, which is what lets a replay insert a reposition without rewriting the
 * outcomes that follow it.
 *
 * What each result does to the board:
 *
 * | Action | Attacker wins | Attacker loses |
 * |---|---|---|
 * | Move | relocates, carrying the ball if it has it | — |
 * | Dribble | advances with the ball, **and one cell further** in the direction of travel when that cell is free | turnover: the defender takes the ball where it stands, and the carrier does not advance |
 * | Pass | the receiver collects it | the interceptor collects it |
 * | Launch | the receiver collects it | the interceptor collects it |
 * | Tackle | the tackler wins the ball | the carrier keeps it |
 * | Shot | goal, and the pitch resets for a kickoff to the conceding side | the keeper gathers it |
 *
 * Deliberately **not** here: advancing the turn, spending an action, or testing
 * the win condition. Those are the next slice, so `turn`, `actionsRemaining` and
 * `activeTeam` come back untouched.
 *
 * @param state - The board before the action. Not modified.
 * @param action - The action to play. Assumed legal — see `legalActions`.
 * @param rng - The match's seeded generator. Advanced only by contested actions.
 *
 * @example
 * ```ts
 * const rng = createRng(parseSeed(1234));
 * const { state, duel } = resolveAction(createInitialState(), action, rng);
 * duel?.winChance; // the odds the player was shown before committing
 * ```
 */
export function resolveAction(state: MatchState, action: Action, rng: Rng): ResolvedAction {
  const actor = findPlayer(state, action.playerId);
  if (!actor) return { state, duel: null };

  const duelPreview = previewDuel(state, action);
  const duel = duelPreview ? rollDuel(duelPreview, rng) : null;
  const attackerWon = duel === null || duel.attackerWon;

  switch (action.type) {
    case "move": {
      const moved = movePlayer(state, actor.id, action.target);
      return {
        state: state.ball.carrierId === actor.id ? giveBallTo(moved, actor.id) : moved,
        duel,
      };
    }

    case "dribble": {
      if (attackerWon) {
        const moved = movePlayer(state, actor.id, carriedOn(state, actor, action.target));
        return { state: giveBallTo(moved, actor.id), duel };
      }
      // A turnover: the challenge won the ball, and the run does not happen.
      return { state: giveBallTo(state, duel!.defender.playerId), duel };
    }

    case "pass":
    case "launch": {
      // One outcome for both: whoever ends up with it, ends up with it. The
      // difference between the two verbs is entirely in the odds above.
      const collector = attackerWon ? action.target : duel!.defender.playerId;
      return { state: giveBallTo(state, collector), duel };
    }

    case "tackle": {
      // The tackler initiates, so "attacker wins" means the ball changes hands.
      return { state: attackerWon ? giveBallTo(state, actor.id) : state, duel };
    }

    case "shoot": {
      if (attackerWon) return { state: afterGoal(state, actor.team), duel };
      return { state: giveBallTo(state, duel!.defender.playerId), duel };
    }
  }
}
