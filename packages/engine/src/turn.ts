import {
  opponentOf,
  type Action,
  type Duel,
  type MatchCommand,
  type MatchState,
  type RejectionReason,
  type Team,
} from "@gaffer/shared";

import { legalActions } from "./legal-actions.js";
import { matchResultAfterTurn } from "./outcome.js";
import { resolveAction } from "./resolve.js";
import type { Rng } from "./rng.js";

/** A command the engine accepted. */
export interface CommandAccepted {
  /** Discriminator — always true here. */
  ok: true;
  /** The board after the command. A fresh object; the input is untouched. */
  state: MatchState;
  /** The duel that decided it, or null when nothing was contested. */
  duel: Duel | null;
  /** Whether the turn passed to the other side as a result. */
  turnEnded: boolean;
}

/** A command the engine refused. The caller's state is unchanged. */
export interface CommandRejected {
  /** Discriminator — always false here. */
  ok: false;
  /** Which rule the command broke. */
  reason: RejectionReason;
}

/** The outcome of {@link applyAction}. */
export type CommandResult = CommandAccepted | CommandRejected;

/**
 * A comparison key for an action.
 *
 * Built field by field rather than by serialising the object, because a client
 * may send `{ y, x }` where we build `{ x, y }` — JSON of the same cell would
 * differ and a perfectly legal move would be refused.
 */
function actionKey(action: Action): string {
  switch (action.type) {
    case "move":
    case "dribble":
      return `${action.type}|${action.playerId}|${action.target.x},${action.target.y}`;
    case "pass":
    case "tackle":
      return `${action.type}|${action.playerId}|${action.target}`;
    case "shoot":
      return `${action.type}|${action.playerId}|`;
  }
}

/** Add one to a side's tally, leaving the other alone. */
const bump = (tally: { home: number; away: number }, team: Team) => ({
  home: tally.home + (team === "home" ? 1 : 0),
  away: tally.away + (team === "away" ? 1 : 0),
});

/**
 * Record what the command contributed to the running totals.
 *
 * These exist for one reason: when a shootout comes back level, GDD §10's ban on
 * draws has to be honoured by comparing something. Shots count whether they score
 * or are saved; a duel is credited to whichever side came out on top, which for a
 * tackle is the tackler and for a dribble is the carrier.
 */
function withStats(
  resolved: MatchState,
  before: MatchState,
  command: Action,
  duel: Duel | null,
): MatchState {
  const actor = before.players.find((player) => player.id === command.playerId);
  if (!actor) return resolved;

  let { shotsAttempted, duelsWon } = resolved.stats;

  if (command.type === "shoot") {
    shotsAttempted = bump(shotsAttempted, actor.team);
  }

  if (duel !== null) {
    const winnerId = duel.attackerWon ? duel.attacker.playerId : duel.defender.playerId;
    const winner = before.players.find((player) => player.id === winnerId);
    if (winner) duelsWon = bump(duelsWon, winner.team);
  }

  return { ...resolved, stats: { shotsAttempted, duelsWon } };
}

/**
 * End the turn that `state` is on: either the match is decided here, or the turn
 * passes.
 *
 * The result is settled **before** the counter moves, so a decided match stops on
 * the turn that decided it and `turn` never runs past the cap. `result` being
 * non-null is what marks a match over — the counter is not doing double duty.
 */
function endOfTurn(state: MatchState, rng: Rng): MatchState {
  const result = matchResultAfterTurn(state, rng);
  if (result !== null) return { ...state, result };

  return {
    ...state,
    turn: state.turn + 1,
    activeTeam: opponentOf(state.activeTeam),
    actionsRemaining: state.rules.actionsPerTurn,
  };
}

/**
 * The validated way into the engine: check a command against the rules, then
 * play it out and spend what it costs.
 *
 * This is where GDD §15's "the server runs the same engine as referee" lands. A
 * client sends what it would like to do; this decides whether the rules allow
 * it. It is the **only** way to advance a match: the assumes-legal transition it
 * calls internally is not exported, so a client, a server and a replay all take
 * the same path and meet the same referee.
 *
 * It **never throws** for a badly chosen command. An out-of-date or dishonest
 * client is an ordinary condition for a server, so refusals come back as a typed
 * {@link CommandRejected} the caller has to handle. Exceptions are reserved for
 * engine invariants that should be impossible.
 *
 * Turn handling, per GDD §8:
 * - a gameplay verb spends one action;
 * - when the pool empties the turn passes automatically;
 * - an `endTurn` command passes it early, and spends nothing;
 * - **a goal ends the scoring side's turn at once**, however many actions were
 *   left, and the conceding side takes the next turn with a full pool.
 *
 * The turn counter advances on every pass. Whether the cap has been reached is
 * reported by `isRegulationOver`, but nothing here stops play — that is the win
 * condition's job.
 *
 * @param state - The board before the command. Not modified, including on refusal.
 * @param command - What the player wants to do.
 * @param rng - The match's seeded generator. Advanced only by contested actions.
 *
 * @example
 * ```ts
 * const result = applyAction(state, command, rng);
 * if (!result.ok) return reject(result.reason);
 * state = result.state;
 * ```
 */
export function applyAction(state: MatchState, command: MatchCommand, rng: Rng): CommandResult {
  if (state.result !== null) return { ok: false, reason: "match-over" };

  if (command.type === "endTurn") {
    if (command.team !== state.activeTeam) return { ok: false, reason: "not-your-turn" };
    return {
      ok: true,
      state: endOfTurn(state, rng),
      duel: null,
      turnEnded: true,
    };
  }

  const actor = state.players.find((player) => player.id === command.playerId);
  if (!actor) return { ok: false, reason: "unknown-player" };
  if (actor.team !== state.activeTeam) return { ok: false, reason: "not-your-turn" };
  if (state.actionsRemaining <= 0) return { ok: false, reason: "no-actions-left" };

  if (command.type === "pass" || command.type === "tackle") {
    const target = state.players.find((player) => player.id === command.target);
    if (!target) return { ok: false, reason: "unknown-target" };
  }

  const permitted = new Set(legalActions(state).map(actionKey));
  if (!permitted.has(actionKey(command))) return { ok: false, reason: "illegal-action" };

  const { state: resolved, duel } = resolveAction(state, command, rng);
  const tallied = withStats(resolved, state, command, duel);

  /*
   * A goal ends the turn on the spot. resolveAction has already rebuilt the
   * pitch for the kickoff and given the conceding side the ball; passing the
   * turn hands it the clock too, since the scorer is always the side to move.
   */
  const scored =
    resolved.score.home !== state.score.home || resolved.score.away !== state.score.away;
  if (scored) {
    return { ok: true, state: endOfTurn(tallied, rng), duel, turnEnded: true };
  }

  const spent: MatchState = { ...tallied, actionsRemaining: tallied.actionsRemaining - 1 };
  if (spent.actionsRemaining <= 0) {
    return { ok: true, state: endOfTurn(spent, rng), duel, turnEnded: true };
  }

  return { ok: true, state: spent, duel, turnEnded: false };
}
