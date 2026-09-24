import {
  areAdjacent,
  attackingGoalMouth,
  chebyshevDistance,
  COVERING_DEFENDER_BONUS,
  defendingGoalMouth,
  duelWinChance,
  LAUNCH_INTERCEPT_BONUS,
  THROUGH_COVERING_BONUS,
  SHOOT_COVERING_BONUS,
  type Action,
  type DuelPreview,
  type DuelSide,
  type MatchState,
  type Player,
  type Position,
} from "@gaffer/shared";

import { laneBetween } from "./lane.js";

const cellKey = (position: Position): string => `${position.x},${position.y}`;

const findPlayer = (state: MatchState, id: string): Player | undefined =>
  state.players.find((player) => player.id === id);

/**
 * The opponent being gone *through*, when a dribble is taking somebody on.
 *
 * A dribble that ends two cells away on a straight ray, with an opponent on the
 * cell in between, is the through-ball of dribbles — and the duel is against
 * *that* player, whatever else is standing nearby. Anyone else adjacent covers.
 *
 * Derived from the geometry rather than carried on the action, so a client
 * cannot claim to be beating a defender it is not actually going past.
 */
function manBeingBeaten(state: MatchState, actor: Player, target: Position): Player | undefined {
  if (chebyshevDistance(actor.position, target) !== 2) return undefined;

  const dx = Math.sign(target.x - actor.position.x);
  const dy = Math.sign(target.y - actor.position.y);

  // Only a straight ray can have a single cell in between.
  if (actor.position.x + dx * 2 !== target.x) return undefined;
  if (actor.position.y + dy * 2 !== target.y) return undefined;

  const between = { x: actor.position.x + dx, y: actor.position.y + dy };
  return state.players.find(
    (player) =>
      player.team !== actor.team &&
      player.position.x === between.x &&
      player.position.y === between.y,
  );
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
 * The mouth is three cells wide, so this is the union of the flights to all
 * three. An opponent standing on any of them is covering.
 *
 * It used to be the union of the lanes to whichever mouth cells happened to lie
 * on one of the shooter's eight rays — and a shot aimed at a mouth cell that did
 * not could not be covered by a body in front of it **at all**, because there
 * was no lane to stand in. A defender could be square in the way and count for
 * nothing. Line-of-sight lanes remove the special case rather than patch it: the
 * flight is the flight, for a shot exactly as for a pass.
 */
function shotLaneCells(state: MatchState, shooter: Player): Position[] {
  const cells = new Map<string, Position>();

  for (const mouthCell of attackingGoalMouth(shooter.team, state.board)) {
    for (const cell of laneBetween(shooter.position, mouthCell)) {
      cells.set(cellKey(cell), cell);
    }
  }

  return [...cells.values()];
}

/**
 * Whether a keeper is actually in its goal.
 *
 * A keeper defends a shot only while it stands in the mouth it is guarding. Step
 * off — to press, to tackle, to chase — and the goal is unattended: the shot is
 * then contested by whoever is in the lane, or by nobody at all. Drawing the
 * keeper out is meant to be a way to score, so it has to cost the keeper's side
 * something real.
 */
function isGuardingGoal(keeper: Player, state: MatchState): boolean {
  return defendingGoalMouth(keeper.team, state.board).some(
    (cell) => cell.x === keeper.position.x && cell.y === keeper.position.y,
  );
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
 * - **Launch** — the same duel, with {@link LAUNCH_INTERCEPT_BONUS} added to the
 *   defence: a longer ball is a readable one.
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

      /*
       * Going through somebody is a duel with *that* somebody, whatever else
       * is standing nearby. The players either side are partly being left
       * behind by the same movement, so they cover at half the open-play rate
       * — see {@link THROUGH_COVERING_BONUS} for what each of the three
       * possible rates was measured to do.
       *
       * Otherwise, the strongest opponent beside the run leads it as before,
       * with the rest covering.
       */
      const beaten = manBeingBeaten(state, actor, action.target);
      const primary = beaten ?? primaryDefender(candidates);
      const covering = candidates.filter((player) => player.id !== primary.id);
      const rate = beaten ? THROUGH_COVERING_BONUS : COVERING_DEFENDER_BONUS;

      return preview(
        { playerId: actor.id, stat: actor.stats.atk, modifier: 0 },
        {
          playerId: primary.id,
          stat: primary.stats.def,
          modifier: rate * covering.length,
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
      const guarding = keeper !== undefined && isGuardingGoal(keeper, state);

      const lane = new Set(shotLaneCells(state, actor).map(cellKey));
      const inLane = state.players.filter(
        (player) =>
          player.team !== actor.team &&
          player.id !== (guarding ? keeper.id : "") &&
          lane.has(cellKey(player.position)),
      );

      /*
       * With nobody in goal and nobody in the way there is no duel to have: an
       * open net is a certainty, not a gamble, and resolving it consumes no dice.
       */
      if (!guarding && inLane.length === 0) return null;

      // A keeper off its line is just another body; whoever has the best DEF in
      // the lane leads the defence instead.
      const primary = guarding ? keeper : primaryDefender(inLane);
      const covering = guarding ? inLane : inLane.filter((player) => player.id !== primary.id);

      return preview(
        { playerId: actor.id, stat: actor.stats.atk, modifier: 0 },
        {
          playerId: primary.id,
          stat: primary.stats.def,
          modifier: SHOOT_COVERING_BONUS * covering.length,
        },
        covering,
      );
    }

    case "pass":
    case "launch": {
      const receiver = findPlayer(state, action.target);
      if (!receiver) return null;

      /* The same lane enumeration used to decide the ball could be played at
         all, so what blocks a pass and what contests it are one geometry. */
      const lane = laneBetween(actor.position, receiver.position);
      if (lane.length === 0) return null;

      const candidates = opponentsBeside(state, actor.team, lane);
      /*
       * Nobody within reach of the flight: no duel, for a launch as much as for
       * a pass. That is deliberate and is the whole point of the verb — a
       * genuinely clear lane out of your own half is free, and the difficulty is
       * that a long lane is rarely clear.
       */
      if (candidates.length === 0) return null;

      const primary = primaryDefender(candidates);
      const covering = candidates.filter((player) => player.id !== primary.id);
      const airborne = action.type === "launch" ? LAUNCH_INTERCEPT_BONUS : 0;

      return preview(
        { playerId: actor.id, stat: actor.stats.pas, modifier: 0 },
        {
          playerId: primary.id,
          stat: primary.stats.def,
          modifier: COVERING_DEFENDER_BONUS * covering.length + airborne,
        },
        covering,
      );
    }
  }
}
