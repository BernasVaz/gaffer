import { dribbleFinish, legalActions, previewDuel } from "@gaffer/engine";
import {
  attackingGoalMouth,
  type Action,
  type DuelPreview,
  type MatchState,
  type Player,
  type Position,
  type Team,
} from "@gaffer/shared";

/** A cell reference that can be used as a map key. */
export const cellKey = (position: Position) => `${position.x},${position.y}`;

/** Something a selected player may do, and the odds if it is contested. */
export interface Target {
  /** The action that would be sent to the engine. */
  action: Action;
  /** The duel it would provoke, or null when nothing contests it. */
  duel: DuelPreview | null;
  /**
   * Where a won dribble actually finishes, when that is past the cell it is
   * aimed at.
   *
   * `null` for everything else, including a dribble that carries on to nowhere.
   * A won dribble knocks the ball a cell further (ADR 0023), so a ring drawn on
   * the cell the action names would otherwise understate the prize — and §9
   * promises the reward is knowable before committing, not only the odds.
   */
  carriesTo: { x: number; y: number } | null;
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
    const target: Target = { action, duel: previewDuel(state, action), carriesTo: null };

    switch (action.type) {
      case "move":
        cells.set(cellKey(action.target), target);
        break;
      case "dribble": {
        /* Asked of the engine rather than worked out here: where a won dribble
           ends is a rule, and rules do not live in the client. */
        const finish = dribbleFinish(state, playerId, action.target);
        const moved = finish.x !== action.target.x || finish.y !== action.target.y;
        cells.set(cellKey(action.target), { ...target, carriesTo: moved ? finish : null });
        break;
      }
      case "pass":
      case "launch":
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

/**
 * Which side or sides the person at the keyboard is commanding.
 *
 * `"both"` is hotseat — two people, one screen, so whoever is to move is
 * whoever is playing. A team means a solo match: the other side belongs to the
 * opponent and its players are never yours to move, even while it is thinking.
 */
export type Seat = Team | "both";

/**
 * Whether `playerId` may be commanded right now.
 *
 * Two questions at once, and both have to be yes: the rules must allow this side
 * to act, and the seat must be one the person at the keyboard is sitting in.
 * Keeping them together is what stops a solo player from being offered a move
 * for the opponent during the half-second before it plays.
 */
export function isCommandable(state: MatchState, playerId: string, seat: Seat): boolean {
  if (state.result !== null) return false;

  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) return false;
  if (player.team !== state.activeTeam) return false;

  return seat === "both" || player.team === seat;
}

/**
 * What committing on a given cell would do, or null for nothing.
 *
 * Three kinds of target point at three different things — a move or dribble at
 * an empty cell, a pass or tackle at a shirt, a shot at the goal mouth — and a
 * cell can be more than one of them at once. This is the order they resolve in,
 * in one place, so that clicking a cell and dropping a player on it cannot
 * come to different conclusions.
 *
 * A lit destination wins over the player standing there. Clicking a ringed
 * team-mate passes to them rather than switching to them, which is why
 * selecting that player instead means clearing the selection first.
 */
export function targetAt(
  state: MatchState,
  targets: Targets,
  selected: Player | undefined,
  cell: Position,
): Target | null {
  const here = targets.cells.get(cellKey(cell));
  if (here) return here;

  const occupant = state.players.find(
    (player) => player.position.x === cell.x && player.position.y === cell.y,
  );
  const onPlayer = occupant ? targets.players.get(occupant.id) : undefined;
  if (onPlayer) return onPlayer;

  if (targets.shot && selected) {
    const mouth = attackingGoalMouth(selected.team, state.board);
    if (mouth.some((mouthCell) => mouthCell.x === cell.x && mouthCell.y === cell.y)) {
      return targets.shot;
    }
  }

  return null;
}
