import {
  areAdjacent,
  attackingGoalMouth,
  chebyshevDistance,
  DIRECTIONS,
  goalMouthOwner,
  isWithinBoard,
  type Action,
  type MatchState,
  type Player,
  type Position,
} from "@gaffer/shared";

/** Key a cell for map lookup. */
const cellKey = (position: Position): string => `${position.x},${position.y}`;

/**
 * Whether `player` is allowed to stand on `cell`.
 *
 * A goal mouth is what a shot is aimed into, not somewhere a player stands, so
 * only the keeper defending that goal may occupy one. Without this an attacker
 * could walk into the net and then shoot at the goal it was standing inside.
 * The goal-line corners either side of the mouth stay ordinary pitch.
 */
function mayOccupy(player: Player, cell: Position, state: MatchState): boolean {
  const owner = goalMouthOwner(cell, state.board);
  if (owner === null) return true;
  return player.team === owner && player.role === "goalkeeper";
}

/**
 * Cells a player could travel to, walking outward in each of the 8 directions
 * until the board runs out or a player blocks the way.
 *
 * The blocker's own cell is excluded and nothing beyond it is reachable — you
 * may move neither onto nor through an occupied cell (GDD §7). A goal mouth the
 * player may not enter blocks it in the same way.
 */
function reachableCells(
  player: Player,
  state: MatchState,
  occupied: ReadonlyMap<string, Player>,
): Position[] {
  const reachable: Position[] = [];

  for (const { dx, dy } of DIRECTIONS) {
    for (let step = 1; step <= player.moveRange; step += 1) {
      const cell = { x: player.position.x + dx * step, y: player.position.y + dy * step };
      if (!isWithinBoard(cell, state.board)) break;
      if (occupied.has(cellKey(cell))) break;
      // A mouth this player may not enter blocks the ray, exactly as a body does.
      if (!mayOccupy(player, cell, state)) break;
      reachable.push(cell);
    }
  }

  return reachable;
}

/**
 * Team-mates the carrier can pass to.
 *
 * A pass runs down the same straight lanes a player moves along, up to the
 * passer's PAS range, and stops at the first player it meets. If that player is
 * a team-mate the pass is legal; if it is an opponent the lane is blocked.
 *
 * An opponent merely *beside* the lane does not affect legality — that is an
 * interception duel when the pass is executed, and the odds are shown before the
 * player commits (GDD §7). Enumeration deliberately stays silent about it.
 */
function passTargets(
  carrier: Player,
  state: MatchState,
  occupied: ReadonlyMap<string, Player>,
): Player[] {
  const targets: Player[] = [];

  for (const { dx, dy } of DIRECTIONS) {
    for (let step = 1; step <= carrier.stats.pas; step += 1) {
      const cell = { x: carrier.position.x + dx * step, y: carrier.position.y + dy * step };
      if (!isWithinBoard(cell, state.board)) break;

      const blocker = occupied.get(cellKey(cell));
      if (!blocker) continue;

      if (blocker.team === carrier.team) targets.push(blocker);
      break; // the first player on a lane ends it either way
    }
  }

  return targets;
}

/** Whether any opponent of `team` stands adjacent to `cell`. */
function isContested(cell: Position, team: Player["team"], state: MatchState): boolean {
  return state.players.some((other) => other.team !== team && areAdjacent(cell, other.position));
}

/**
 * Whether a carrier is close enough to the goal it attacks to shoot (GDD §7).
 *
 * The range comes from the match's own rules, because it scales with the pitch:
 * two cells is deep in the box on a 5-a-side board and barely past halfway on
 * an 11-a-side one. What does not change is the property GDD v1.2 fixed it for
 * — every format keeps the kickoff spot outside shooting range.
 */
function canShoot(carrier: Player, state: MatchState): boolean {
  return attackingGoalMouth(carrier.team, state.board).some(
    (cell) => chebyshevDistance(carrier.position, cell) <= state.rules.shotRange,
  );
}

/**
 * Every action the side to move may legally take, right now.
 *
 * Pure enumeration: this decides what is *allowed*, never what happens. Nothing
 * here rolls a die or resolves a duel — a dribble, tackle or shot appears in the
 * list because it is legal to attempt, and its odds and outcome belong to the
 * resolver that comes next (GDD §15).
 *
 * Who gets what:
 * - **Every player** of the side to move may Move.
 * - **The carrier**, if the side to move has the ball, may also Pass, Shoot in
 *   range, and Dribble — a Dribble being the contested version of its Move.
 * - **Any player adjacent to the carrier**, if the side to move does *not* have
 *   the ball, may Tackle.
 *
 * Move and Dribble are mutually exclusive for a given destination: a carrier
 * never gets to pick the free version of a contested move.
 *
 * @param state - The match state to enumerate from. Not modified.
 * @returns Every legal action, in no guaranteed order. Empty when the side to
 *   move has spent its actions, since the only thing left is to end the turn.
 *
 * @example
 * ```ts
 * const actions = legalActions(createInitialState());
 * actions.filter((a) => a.type === "pass"); // the kickoff options
 * ```
 */
export function legalActions(state: MatchState): Action[] {
  // A decided match has no legal anything. Without this, a client reading this
  // list would offer playable moves on a finished match and `applyAction` would
  // refuse every one of them — the two would disagree about the same board.
  if (state.result !== null) return [];
  if (state.actionsRemaining <= 0) return [];

  const occupied = new Map<string, Player>(
    state.players.map((player) => [cellKey(player.position), player]),
  );

  const carrier =
    state.ball.carrierId === null
      ? undefined
      : state.players.find((player) => player.id === state.ball.carrierId);

  const actions: Action[] = [];

  for (const player of state.players) {
    if (player.team !== state.activeTeam) continue;

    const hasBall = carrier !== undefined && carrier.id === player.id;
    const pressedAtOrigin = hasBall && isContested(player.position, player.team, state);

    for (const cell of reachableCells(player, state, occupied)) {
      const contested = hasBall && (pressedAtOrigin || isContested(cell, player.team, state));
      actions.push({
        type: contested ? "dribble" : "move",
        playerId: player.id,
        target: cell,
      });
    }

    if (!hasBall) continue;

    for (const mate of passTargets(player, state, occupied)) {
      actions.push({ type: "pass", playerId: player.id, target: mate.id });
    }

    if (canShoot(player, state)) {
      actions.push({ type: "shoot", playerId: player.id, target: null });
    }
  }

  // Tackling is for the side without the ball; you cannot challenge your own carrier.
  if (carrier !== undefined && carrier.team !== state.activeTeam) {
    for (const player of state.players) {
      if (player.team !== state.activeTeam) continue;
      if (!areAdjacent(player.position, carrier.position)) continue;
      actions.push({ type: "tackle", playerId: player.id, target: carrier.id });
    }
  }

  return actions;
}
