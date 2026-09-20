import { previewDuel } from "@gaffer/engine";
import {
  areAdjacent,
  attackingGoalMouth,
  chebyshevDistance,
  defendingGoalMouth,
  type MatchState,
  type Player,
  type Position,
  type Team,
} from "@gaffer/shared";

/**
 * Every number the opponent weighs a position by.
 *
 * Kept together and exported for the same reason the client keeps its rhythm in
 * one file: these are tuned by watching matches, not by reasoning, so retuning
 * should be one edit rather than a hunt. They are the opponent's *opinions*, not
 * rules — nothing here can change what the engine allows or decides.
 */
export const WEIGHTS = {
  /** A won match, and the ceiling every other term is scaled under. */
  win: 100_000,
  /**
   * One goal on the scoreboard.
   *
   * Deliberately an order of magnitude clear of every positional term below. A
   * goal costs the scorer the ball and the rest of its turn, so if the two were
   * close the search would price a goal at a discount and decline to score —
   * which is exactly what it did at the first set of numbers tried here.
   */
  goal: 2_500,
  /** Simply having the ball. */
  possession: 120,
  /**
   * The ball at the opposing goal-line, with everything short of it scaled by
   * how far up the pitch it has been worked, squared.
   *
   * Squared rather than linear because the pitch is not worth the same
   * everywhere: a cell gained in midfield changes very little, and the same cell
   * gained at the edge of the box changes everything. A flat rate per cell
   * produced a side that passed sideways forever, because each individual step
   * forward was worth less than the risk of taking it.
   */
  advance: 420,
  /**
   * A shot that is *available*, applied to its chance.
   *
   * Kept well under what taking that shot is worth. The distinction matters more
   * than it looks: price the promise near the payoff and the search will camp in
   * the box admiring its own position instead of shooting, which is the single
   * most expensive mistake an evaluation of this game can make.
   */
  shotThreat: 260,
  /** Applied to the chance of the best shot the side *out* of possession faces. */
  shotDanger: 420,
  /** Per own player standing next to an opposing carrier. */
  pressure: 44,
  /** Per opposing player standing next to our own carrier. */
  pressed: 26,
  /**
   * Our keeper standing anywhere but in its own goal.
   *
   * Charged whoever has the ball, and charged in full once the other side does.
   * Only penalising it while under pressure looks right and is badly wrong: a
   * keeper can only move one cell an action, so by the time possession flips it
   * cannot get home. The first version of this evaluation walked its keeper up
   * the pitch as a passing outlet and then conceded into an empty net in nine
   * shots out of ten.
   */
  keeperAdrift: 480,
  /** What an adrift keeper costs while we still have the ball ourselves. */
  keeperAdriftIdle: 0.5,
  /** Per action still in hand, for whichever side is to move. */
  tempo: 18,
  /** Per team-mate within passing reach of our carrier — somewhere to go next. */
  support: 20,
  /** What a match decided on shots or duels rather than on goals is worth. */
  tiebreak: 240,
} as const;

/** How far `position` has been worked up the pitch for `team`, in cells. */
function advancement(team: Team, position: Position, width: number): number {
  return team === "home" ? position.x : width - 1 - position.x;
}

/** Whether a keeper is standing in the mouth it defends (GDD §7). */
function isOnLine(keeper: Player, state: MatchState): boolean {
  return defendingGoalMouth(keeper.team, state.board).some(
    (cell) => cell.x === keeper.position.x && cell.y === keeper.position.y,
  );
}

/**
 * The best shot the side in possession could take right now, as a probability.
 *
 * A **heuristic estimate, not a ruling.** `legalActions` only speaks for the side
 * to move, so a position cannot be judged through it: the whole point of looking
 * ahead is to ask what the *other* side will be able to do. This therefore reads
 * the shooting geometry out of `@gaffer/shared` — the same constants the engine
 * reads — and asks {@link previewDuel} what such a shot would be worth.
 *
 * It can only ever be wrong in the opponent's own head. Every command it
 * eventually chooses still goes through `applyAction` and is judged by the
 * engine, so a mistaken estimate costs the opponent a bad decision and can never
 * bend a rule.
 *
 * Returns 0 when nobody is carrying the ball or the carrier is out of range, and
 * 1 for an open goal — which is what {@link previewDuel} returning null on a
 * legal shot means.
 */
export function shotThreat(state: MatchState): number {
  const carrierId = state.ball.carrierId;
  if (carrierId === null) return 0;

  const carrier = state.players.find((player) => player.id === carrierId);
  if (!carrier) return 0;

  const inRange = attackingGoalMouth(carrier.team, state.board).some(
    (cell) => chebyshevDistance(carrier.position, cell) <= state.rules.shotRange,
  );
  if (!inRange) return 0;

  const duel = previewDuel(state, { type: "shoot", playerId: carrier.id, target: null });
  return duel === null ? 1 : duel.winChance;
}

/**
 * Team-mates the carrier could plausibly find with a pass, as a crude count.
 *
 * The keeper is not one of them. It is counted nowhere as an outlet, because an
 * evaluation that rewards having it close by will walk it out of its goal to get
 * it there — and an empty net is worth far more to the other side than a safe
 * pass is to us.
 */
function supportFor(state: MatchState, carrier: Player): number {
  return state.players.filter(
    (player) =>
      player.team === carrier.team &&
      player.id !== carrier.id &&
      player.role !== "goalkeeper" &&
      chebyshevDistance(player.position, carrier.position) <= carrier.stats.pas,
  ).length;
}

/**
 * What a finished match is worth.
 *
 * A win in football — regulation or golden goal — is the full prize. A win on the
 * tiebreaker cascade is not: a shootout is decided by dice the opponent has no
 * say in, and the search reaches one only through a scratch generator whose dice
 * are rigged, so believing its winner would be believing a coin it flipped
 * itself. Those results are valued by the rungs that *are* earned — shots
 * attempted, then duels won — at a fraction of a real victory, which leaves the
 * opponent playing for goals rather than for a lottery it cannot influence.
 */
function valueOfResult(state: MatchState, team: Team): number {
  const result = state.result;
  if (result === null) return 0;

  if (result.decidedBy === "regulation" || result.decidedBy === "goldenGoal") {
    return result.winner === team ? WEIGHTS.win : -WEIGHTS.win;
  }

  const sign = team === "home" ? 1 : -1;
  const { shotsAttempted, duelsWon } = state.stats;
  const shots = Math.sign(shotsAttempted.home - shotsAttempted.away) * sign;
  const duels = Math.sign(duelsWon.home - duelsWon.away) * sign;

  return WEIGHTS.tiebreak * (shots !== 0 ? shots : duels * 0.4);
}

/** How much of the board an evaluation is allowed to see. */
export interface EvaluateOptions {
  /**
   * Drop every term about what the *other* side can do.
   *
   * A reckless reader still wants the ball, still works it upfield and still
   * wants to shoot; it simply cannot see that leaving a shot on, or walking its
   * keeper off its line, costs anything. That is what an inexperienced player
   * actually looks like, and it makes a far better easy mode than one that plays
   * well and then throws a move away for no reason.
   */
  reckless?: boolean;
}

/**
 * How good `state` is for `team`, in arbitrary units where bigger is better.
 *
 * This is the opponent's taste in football, and the only place it has one. It is
 * a pure function of a board — it plays nothing, changes nothing, and is as
 * happy judging a position that will never be reached as the one on screen.
 *
 * What it cares about, in order of weight: the result, the score, then whether
 * the ball is ours and how dangerous it is where it sits. Position is worth
 * something only because of where it leads — a ball in the corner of the
 * attacking third scores well below the same ball in front of goal.
 *
 * @param state - The board to judge. Not modified.
 * @param team - The side to judge it for. Judging the same board for the other
 *   side is *not* guaranteed to give the exact negation: the terms are written
 *   from a defender's point of view as well as an attacker's.
 * @param options - How much of it to look at. See {@link EvaluateOptions}.
 */
export function evaluateState(
  state: MatchState,
  team: Team,
  options: EvaluateOptions = {},
): number {
  const blind = options.reckless ?? false;
  if (state.result !== null) return valueOfResult(state, team);

  const sign = team === "home" ? 1 : -1;

  let value = WEIGHTS.goal * (state.score.home - state.score.away) * sign;

  const carrierId = state.ball.carrierId;
  const carrier =
    carrierId === null ? undefined : state.players.find((player) => player.id === carrierId);

  if (carrier) {
    const ours = carrier.team === team;
    const side = ours ? 1 : -1;

    const progress =
      advancement(carrier.team, carrier.position, state.board.width) / (state.board.width - 1);

    value += WEIGHTS.possession * side;
    value += WEIGHTS.advance * side * progress * progress;

    const threat = shotThreat(state);
    if (ours) value += WEIGHTS.shotThreat * threat;
    else if (!blind) value -= WEIGHTS.shotDanger * threat;

    const marking = state.players.filter(
      (player) => player.team !== carrier.team && areAdjacent(player.position, carrier.position),
    ).length;
    if (ours) value -= WEIGHTS.pressed * marking;
    else if (!blind) value += WEIGHTS.pressure * marking;

    if (ours) value += WEIGHTS.support * supportFor(state, carrier);
  }

  // A keeper off its line is an open goal waiting to happen (ADR 0004). It is
  // charged whether or not the ball is ours, because a keeper cannot get home
  // in the one action a turnover gives it.
  if (!blind) {
    const keeper = state.players.find(
      (player) => player.team === team && player.role === "goalkeeper",
    );
    if (keeper && !isOnLine(keeper, state)) {
      const exposed = carrier !== undefined && carrier.team !== team;
      value -= WEIGHTS.keeperAdrift * (exposed ? 1 : WEIGHTS.keeperAdriftIdle);
    }
  }

  value += WEIGHTS.tempo * state.actionsRemaining * (state.activeTeam === team ? 1 : -1);

  return value;
}
