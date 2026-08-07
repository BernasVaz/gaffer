import {
  areAdjacent,
  attackingGoalMouth,
  chebyshevDistance,
  COVERING_DEFENDER_BONUS,
  duelWinChance,
  type Action,
  type DuelPreview,
  type DuelSide,
  type MatchState,
  type Player,
  type Position,
} from "@gaffer/shared";

const cellKey = (position: Position): string => `${position.x},${position.y}`;

const findPlayer = (state: MatchState, id: string): Player | undefined =>
  state.players.find((player) => player.id === id);

/**
 * The cells strictly between two positions along a straight line, or null when
 * they do not sit on one of the 8 rays.
 *
 * Endpoints are excluded: a lane is what the ball travels *through*, not where
 * it starts or ends. Neighbouring cells therefore give an empty lane, which is
 * why a pass to an adjacent team-mate can never be intercepted.
 */
function laneBetween(from: Position, to: Position): Position[] | null {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const steps = chebyshevDistance(from, to);

  if (steps === 0) return null;
  if (Math.abs(deltaX) !== 0 && Math.abs(deltaX) !== steps) return null;
  if (Math.abs(deltaY) !== 0 && Math.abs(deltaY) !== steps) return null;

  const stepX = Math.sign(deltaX);
  const stepY = Math.sign(deltaY);

  return Array.from({ length: steps - 1 }, (_unused, index) => ({
    x: from.x + stepX * (index + 1),
    y: from.y + stepY * (index + 1),
  }));
}

/** Opponents of `team` standing next to any of `cells`, each listed once. */
function opponentsBeside(state: MatchState, team: Player["team"], cells: Position[]): Player[] {
  return state.players.filter(
    (player) => player.team !== team && cells.some((cell) => areAdjacent(cell, player.position)),
  );
}

/**
 * Which opponent leads the challenge.
 *
 * The strongest available defender contests and the rest cover, so a player is
 * never punished for having help nearby. Ties break on id, which keeps a replay
 * stable when two equal defenders are both in position.
 */
function primaryDefender(candidates: Player[]): Player {
  return [...candidates].sort((a, b) => b.stats.def - a.stats.def || a.id.localeCompare(b.id))[0]!;
}

/**
 * Cells a shot passes through on its way to goal.
 *
 * The mouth is three cells wide and a shooter is rarely aligned with all three,
 * so this is the union of the straight lanes to whichever mouth cells *are* on
 * one of the shooter's rays. An opponent standing on any of them is covering.
 */
function shotLaneCells(state: MatchState, shooter: Player): Position[] {
  const cells = new Map<string, Position>();

  for (const mouthCell of attackingGoalMouth(shooter.team, state.board)) {
    for (const cell of laneBetween(shooter.position, mouthCell) ?? []) {
      cells.set(cellKey(cell), cell);
    }
  }

  return [...cells.values()];
}

/** Assemble a preview, computing the odds from the two finished scores. */
function preview(attacker: DuelSide, defender: DuelSide, covering: Player[]): DuelPreview {
  return {
    attacker,
    defender,
    coveringPlayerIds: covering.map((player) => player.id).sort(),
    winChance: duelWinChance(attacker.stat + attacker.modifier, defender.stat + defender.modifier),
  };
}

/**
 * The duel an action would provoke, and the exact odds of winning it — without
 * rolling anything.
 *
 * This is what GDD §9's "odds always shown before commit" needs: a player can
 * inspect every option, including the ones they decline, without disturbing the
 * dice sequence a replay depends on.
 *
 * Returns null when the action is uncontested — a move, or a pass down a lane
 * nobody covers — because there is no duel to preview.
 *
 * Who contests what:
 * - **Dribble** — carrier ATK against the strongest opponent beside its origin
 *   or destination; every other such opponent covers.
 * - **Tackle** — the tackler's DEF against the carrier's ATK. The tackler
 *   initiates, so it is the *attacker* here and a tie leaves the ball where it
 *   was. Team-mates beside the carrier cover the tackler.
 * - **Shot** — shooter ATK against the keeper's DEF, with opponents standing in
 *   the lane to the goal mouth covering the keeper.
 * - **Pass** — passer PAS against the strongest opponent beside the lane.
 *
 * @param state - The board to read. Not modified.
 * @param action - The action being considered. Assumed legal; see `legalActions`.
 */
export function previewDuel(state: MatchState, action: Action): DuelPreview | null {
  const actor = findPlayer(state, action.playerId);
  if (!actor) return null;

  switch (action.type) {
    case "move":
      return null;

    case "dribble": {
      const candidates = opponentsBeside(state, actor.team, [actor.position, action.target]);
      if (candidates.length === 0) return null;

      const primary = primaryDefender(candidates);
      const covering = candidates.filter((player) => player.id !== primary.id);

      return preview(
        { playerId: actor.id, stat: actor.stats.atk, modifier: 0 },
        {
          playerId: primary.id,
          stat: primary.stats.def,
          modifier: COVERING_DEFENDER_BONUS * covering.length,
        },
        covering,
      );
    }

    case "tackle": {
      const carrier = findPlayer(state, action.target);
      if (!carrier) return null;

      const covering = state.players.filter(
        (player) =>
          player.team === actor.team &&
          player.id !== actor.id &&
          areAdjacent(player.position, carrier.position),
      );

      return preview(
        {
          playerId: actor.id,
          stat: actor.stats.def,
          modifier: COVERING_DEFENDER_BONUS * covering.length,
        },
        { playerId: carrier.id, stat: carrier.stats.atk, modifier: 0 },
        covering,
      );
    }

    case "shoot": {
      const keeper = state.players.find(
        (player) => player.team !== actor.team && player.role === "goalkeeper",
      );
      if (!keeper) return null;

      const lane = new Set(shotLaneCells(state, actor).map(cellKey));
      const covering = state.players.filter(
        (player) =>
          player.team !== actor.team &&
          player.id !== keeper.id &&
          lane.has(cellKey(player.position)),
      );

      return preview(
        { playerId: actor.id, stat: actor.stats.atk, modifier: 0 },
        {
          playerId: keeper.id,
          stat: keeper.stats.def,
          modifier: COVERING_DEFENDER_BONUS * covering.length,
        },
        covering,
      );
    }

    case "pass": {
      const receiver = findPlayer(state, action.target);
      if (!receiver) return null;

      const lane = laneBetween(actor.position, receiver.position);
      if (!lane || lane.length === 0) return null;

      const candidates = opponentsBeside(state, actor.team, lane);
      if (candidates.length === 0) return null;

      const primary = primaryDefender(candidates);
      const covering = candidates.filter((player) => player.id !== primary.id);

      return preview(
        { playerId: actor.id, stat: actor.stats.pas, modifier: 0 },
        {
          playerId: primary.id,
          stat: primary.stats.def,
          modifier: COVERING_DEFENDER_BONUS * covering.length,
        },
        covering,
      );
    }
  }
}
