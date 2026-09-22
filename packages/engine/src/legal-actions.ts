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

/** Team-mates a carrier can put the ball on, split by what it would take. */
interface Outlets {
  /** Within the carrier's own PAS range: an ordinary pass. */
  pass: Player[];
  /** Beyond it but within reach: only a goalkeeper's launch gets there. */
  launch: Player[];
}

/**
 * Team-mates the carrier can find, and how far each one is.
 *
 * A ball runs down the same straight lanes a player moves along and stops at the
 * first player it meets. If that player is a team-mate the ball is legal to play;
 * if it is an opponent the lane is blocked. That rule is the same for a pass and
 * for a launch, which is why one walk answers both — a launch cannot travel
 * *through* somebody a pass would have hit.
 *
 * The split is by distance alone: anything inside PAS is a pass, anything past it
 * is a launch. So the two are never offered for the same team-mate, and a keeper
 * is never asked to choose between a safe ball and a riskier version of it.
 *
 * An opponent merely *beside* the lane does not affect legality — that is an
 * interception duel when the ball is played, and the odds are shown before the
 * player commits (GDD §7). Enumeration deliberately stays silent about it.
 */
function outletTargets(
  carrier: Player,
  state: MatchState,
  occupied: ReadonlyMap<string, Player>,
  reach: number,
): Outlets {
  const outlets: Outlets = { pass: [], launch: [] };

  for (const { dx, dy } of DIRECTIONS) {
    for (let step = 1; step <= reach; step += 1) {
      const cell = { x: carrier.position.x + dx * step, y: carrier.position.y + dy * step };
      if (!isWithinBoard(cell, state.board)) break;

      const blocker = occupied.get(cellKey(cell));
      if (!blocker) continue;

      if (blocker.team === carrier.team) {
        (step <= carrier.stats.pas ? outlets.pass : outlets.launch).push(blocker);
      }
      break; // the first player on a lane ends it either way
    }
  }

  return outlets;
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
 * - **A goalkeeper carrying the ball** may additionally Launch it, to a team-mate
 *   past its own passing range but within the format's `launchRange`.
 * - **Any player adjacent to the carrier**, if the side to move does *not* have
 *   the ball, may Tackle.
 *
 * **At a kickoff, the side kicking off may only Pass** (GDD §7, ADR 0018). A
 * kickoff is a pass in football, and until this rule existed a match opened
 * with whatever the kicking side fancied — usually a dribble straight into the
 * opponent standing next to it.
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

    /*
     * Only a keeper looks past its own range, and only while it has the ball.
     * `Math.max` rather than the rule outright, so a format that ever set a
     * launch shorter than a stat could not quietly take away the pass.
     */
    const mayLaunch = player.role === "goalkeeper";
    const reach = mayLaunch
      ? Math.max(player.stats.pas, state.rules.launchRange)
      : player.stats.pas;
    const outlets = outletTargets(player, state, occupied, reach);

    for (const mate of outlets.pass) {
      actions.push({ type: "pass", playerId: player.id, target: mate.id });
    }

    if (mayLaunch) {
      for (const mate of outlets.launch) {
        actions.push({ type: "launch", playerId: player.id, target: mate.id });
      }
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

  return atKickoff(state) ? kickoffOnly(actions) : actions;
}

/** Whether the side to move still owes its kickoff pass. */
function atKickoff(state: MatchState): boolean {
  return state.kickoffPending !== null && state.kickoffPending === state.activeTeam;
}

/**
 * Narrow a kickoff down to the pass it is supposed to be.
 *
 * With a safety valve: a kickoff formation that offered no pass at all would
 * leave the side with nothing to do but give the turn away, so if there is no
 * pass the restriction simply does not apply. `packages/shared/tests` asserts
 * every shipped format *does* have one, so the valve is a guard against a
 * future formation rather than something any current match can reach — but a
 * rule that can strand a player is worse than one with a documented exception.
 */
function kickoffOnly(actions: Action[]): Action[] {
  const passes = actions.filter((action) => action.type === "pass");
  return passes.length > 0 ? passes : actions;
}
