import {
  ACTIONS_PER_TURN,
  opponentOf,
  type Action,
  type Duel,
  type MatchCommand,
  type MatchState,
  type RejectionReason,
} from "@gaffer/shared";

import { legalActions } from "./legal-actions.js";
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

/** Hand the turn to the other side with a fresh pool of actions. */
function passTurn(state: MatchState): MatchState {
  return {
    ...state,
    turn: state.turn + 1,
    activeTeam: opponentOf(state.activeTeam),
    actionsRemaining: ACTIONS_PER_TURN,
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
  if (command.type === "endTurn") {
    if (command.team !== state.activeTeam) return { ok: false, reason: "not-your-turn" };
    return { ok: true, state: passTurn(state), duel: null, turnEnded: true };
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

  /*
   * A goal ends the turn on the spot. resolveAction has already rebuilt the
   * pitch for the kickoff and given the conceding side the ball; passing the
   * turn hands it the clock too, since the scorer is always the side to move.
   */
  const scored =
    resolved.score.home !== state.score.home || resolved.score.away !== state.score.away;
  if (scored) {
    return { ok: true, state: passTurn(resolved), duel, turnEnded: true };
  }

  const spent: MatchState = { ...resolved, actionsRemaining: resolved.actionsRemaining - 1 };
  if (spent.actionsRemaining <= 0) {
    return { ok: true, state: passTurn(spent), duel, turnEnded: true };
  }

  return { ok: true, state: spent, duel, turnEnded: false };
}
