import { legalActions, previewDuel } from "@gaffer/engine";
import type { Action, DuelPreview, MatchState, Position } from "@gaffer/shared";

/** A cell reference that can be used as a map key. */
export const cellKey = (position: Position) => `${position.x},${position.y}`;

/** Something a selected player may do, and the odds if it is contested. */
export interface Target {
  /** The action that would be sent to the engine. */
  action: Action;
  /** The duel it would provoke, or null when nothing contests it. */
  duel: DuelPreview | null;
}

/**
 * Everything a selected player can do, sorted by how it should be drawn.
 *
 * The engine returns one flat list of actions, but three of them point at
 * different kinds of thing: a move or dribble names an empty **cell**, a pass or
 * tackle names a **player**, and a shot names **nothing at all**. Drawing them
 * identically would tell the player a lie about what they are clicking, so they
 * are split here rather than in the component.
 */
export interface Targets {
  /** Empty destinations, keyed by {@link cellKey}. */
  cells: Map<string, Target>;
  /** Players that can be passed to or challenged, keyed by player id. */
  players: Map<string, Target>;
  /** The shot at goal, when one is legal. */
  shot: Target | null;
}

/** Nothing selected, nothing to draw. */
export const NO_TARGETS: Targets = { cells: new Map(), players: new Map(), shot: null };

/**
 * Work out what `playerId` can do in `state`.
 *
 * Reads the engine and nothing else: `legalActions` decides what is allowed and
 * `previewDuel` decides the odds, so the board cannot offer a move the rules
 * would refuse or show a number the resolver would disagree with.
 *
 * The odds come from a preview rather than from a roll, so inspecting an option
 * and then declining it costs nothing — no dice are consumed until a command is
 * actually committed (GDD §9).
 */
export function targetsFor(state: MatchState, playerId: string | null): Targets {
  if (playerId === null) return NO_TARGETS;

  const cells = new Map<string, Target>();
  const players = new Map<string, Target>();
  let shot: Target | null = null;

  for (const action of legalActions(state)) {
    if (action.playerId !== playerId) continue;
    const target: Target = { action, duel: previewDuel(state, action) };

    switch (action.type) {
      case "move":
      case "dribble":
        cells.set(cellKey(action.target), target);
        break;
      case "pass":
      case "tackle":
        players.set(action.target, target);
        break;
      case "shoot":
        shot = target;
        break;
    }
  }

  return { cells, players, shot };
}

/** Whether this side may be commanded right now — hotseat, so whoever is to move. */
export function isCommandable(state: MatchState, playerId: string): boolean {
  if (state.result !== null) return false;
  const player = state.players.find((candidate) => candidate.id === playerId);
  return player !== undefined && player.team === state.activeTeam;
}
