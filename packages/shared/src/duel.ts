import { z } from "zod";

import { PlayerIdSchema } from "./player.js";

/** Sides on each duel die — an opposed d3 (GDD §13). */
export const DUEL_DIE_SIDES = 3;

/** What each covering defender adds to the defending total in open play (GDD §13). */
export const COVERING_DEFENDER_BONUS = 2;

/**
 * What each defender in the lane adds to a shot (GDD §13).
 *
 * Softer than {@link COVERING_DEFENDER_BONUS} on purpose. A shot already faces a
 * keeper, so charging the field rate on top drove any covered effort to near
 * zero and made bodies in the box worth more than the goalkeeper. At +1 a single
 * defender turns a good chance into a gamble rather than into nothing.
 */
export const SHOOT_COVERING_BONUS = 1;

/**
 * The exact probability the attacker wins a duel, from the two scores.
 *
 * A "score" is a stat plus any modifiers, before the die. Both sides roll a d3
 * and the higher total wins, with a tie going to the defender.
 *
 * Computed by **enumerating all nine equally likely die pairs**, never by
 * sampling and never derived from a roll that has already happened. That matters
 * for two reasons: GDD §9 requires the odds to be shown *before* the player
 * commits, and a sampled estimate would make the number drift between clients
 * looking at the same board.
 *
 * Because ties go to the defender, a level duel is 3/9 for the attacker rather
 * than a coin flip. That asymmetry is intended — it is what makes position and
 * support worth spending actions on.
 *
 * @param attackerScore - Attacking stat plus modifiers.
 * @param defenderScore - Defending stat plus modifiers.
 * @returns A probability in `[0, 1]`, always an exact multiple of 1/9.
 *
 * @example
 * ```ts
 * duelWinChance(5, 4); // 6/9  — a +1 edge, the GDD's "≈67%"
 * duelWinChance(5, 6); // 1/9  — the same duel with one covering defender
 * ```
 */
export function duelWinChance(attackerScore: number, defenderScore: number): number {
  let wins = 0;

  for (let attackerDie = 1; attackerDie <= DUEL_DIE_SIDES; attackerDie += 1) {
    for (let defenderDie = 1; defenderDie <= DUEL_DIE_SIDES; defenderDie += 1) {
      if (attackerScore + attackerDie > defenderScore + defenderDie) wins += 1;
    }
  }

  return wins / (DUEL_DIE_SIDES * DUEL_DIE_SIDES);
}

/** One participant in a duel, and what it brings before the die. */
export const DuelSideSchema = z.object({
  /** The player contesting on this side. */
  playerId: PlayerIdSchema,
  /** The stat this side contributes — ATK, DEF or PAS depending on the action. */
  stat: z.number().int(),
  /** Covering-defender bonus applied to this side. Zero for the side on the ball. */
  modifier: z.number().int().min(0),
});

/** A validated duel side. See {@link DuelSideSchema}. */
export type DuelSide = z.infer<typeof DuelSideSchema>;

/**
 * A duel as it stands before the dice — everything a player needs to decide
 * whether to commit.
 *
 * This is the "odds always shown" half of GDD §9's contract, and it is a
 * first-class engine output rather than something the UI reconstructs.
 */
export const DuelPreviewSchema = z.object({
  /** The side initiating the action. */
  attacker: DuelSideSchema,
  /** The side responding. Wins ties. */
  defender: DuelSideSchema,
  /** Players whose presence produced the covering bonus, sorted by id. */
  coveringPlayerIds: z.array(PlayerIdSchema),
  /** Exact probability the attacker wins. See {@link duelWinChance}. */
  winChance: z.number().min(0).max(1),
});

/** A validated duel preview. See {@link DuelPreviewSchema}. */
export type DuelPreview = z.infer<typeof DuelPreviewSchema>;

/** A duel that has been rolled: the preview plus what the dice said. */
export const DuelSchema = DuelPreviewSchema.extend({
  /** The attacker's die. */
  attackerRoll: z.number().int().min(1).max(DUEL_DIE_SIDES),
  /** The defender's die. */
  defenderRoll: z.number().int().min(1).max(DUEL_DIE_SIDES),
  /** Attacking stat + modifier + die. */
  attackerTotal: z.number().int(),
  /** Defending stat + modifier + die. */
  defenderTotal: z.number().int(),
  /** True only when the attacker's total is strictly higher — ties go to the defender. */
  attackerWon: z.boolean(),
});

/** A validated resolved duel. See {@link DuelSchema}. */
export type Duel = z.infer<typeof DuelSchema>;
