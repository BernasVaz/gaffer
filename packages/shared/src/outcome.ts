import { z } from "zod";

import type { MatchRules } from "./format.js";
import { TeamSchema } from "./team.js";

/**
 * Turns left in regulation, counting the one in progress.
 *
 * Zero once the cap has passed. Whether that ends the match is the win
 * condition's business, not this function's.
 *
 * The cap comes from the match's own rules rather than from a constant, because
 * it scales with the pitch: an attack on an 11-a-side board needs more actions
 * to arrive, so a cap that suited 5-a-side would end bigger matches mid-attack.
 */
export function turnsRemaining(turn: number, rules: MatchRules): number {
  return Math.max(0, rules.turnCap - turn + 1);
}

/**
 * Whether regulation has run out.
 *
 * Reports only. It does not stop play — GDD §10 sends a level match to golden
 * goal rather than ending it, and deciding that is the win condition's job.
 */
export function isRegulationOver(turn: number, rules: MatchRules): boolean {
  return turn > rules.turnCap;
}

/**
 * Penalties each side takes before the shootout goes to sudden death.
 *
 * Five, as football has it. It was three while the shootout resolved itself in
 * one step and nobody watched it — a number chosen to keep a statistical
 * tiebreaker short. Now that the kicks are taken one at a time by a person, the
 * familiar shape is worth more than the two saved rolls (ADR 0026).
 */
export const SHOOTOUT_KICKS = 5;

/**
 * Sudden-death penalty rounds before the statistical backstop takes over.
 *
 * A cap is not optional. Two evenly matched sides settle a sudden-death round at
 * most half the time — and at our actual 33% conversion rate, only 44% of the
 * time — so "keep going until someone wins" has no upper bound and an engine
 * cannot be asked to run it. Ten rounds leaves roughly one shootout in a
 * thousand for the backstop to decide.
 */
export const SHOOTOUT_SUDDEN_DEATH_ROUNDS = 10;

/** Every turn a match can run before a tiebreaker is required. */
export function totalTurns(rules: MatchRules): number {
  return rules.turnCap + rules.extraTimeTurns;
}

/** Whether `turn` falls in extra time — past the cap, but not past the end. */
export function isExtraTime(turn: number, rules: MatchRules): boolean {
  return turn > rules.turnCap && turn <= totalTurns(rules);
}

/**
 * How a match was decided, listed from most earned to least.
 *
 * GDD §10 forbids a draw, so this cascade has to terminate. Each rung is tried in
 * turn and the last one cannot tie, which is what guarantees every match ends.
 */
export const DECISION_METHODS = [
  /** Ahead when the turn cap passed. */
  "regulation",
  /** Scored first in extra time. */
  "goldenGoal",
  /** Won the penalty shootout. */
  "shootout",
  /** Shootout level: attempted more shots across the match. */
  "shotsAttempted",
  /** Shots level too: won more duels across the match. */
  "duelsWon",
  /** Everything level: did not take the opening kickoff, so takes the tie. */
  "kickoffCompensation",
] as const;

/** A closed set of ways a match ends. See {@link DECISION_METHODS}. */
export const DecisionMethodSchema = z.enum(DECISION_METHODS);

/** A validated decision method. See {@link DecisionMethodSchema}. */
export type DecisionMethod = z.infer<typeof DecisionMethodSchema>;

/** One penalty in a shootout. */
export const ShootoutKickSchema = z.object({
  /** The side taking it. */
  team: TeamSchema,
  /** Whether it beat the keeper. */
  scored: z.boolean(),
  /** Which kick this is for that side, counting from one. */
  number: z.number().int().min(1),
  /** Whether it was taken in sudden death rather than the opening five. */
  suddenDeath: z.boolean(),
  /** The player who took it. */
  takerId: z.string().min(1),
  /** The player who faced it. */
  keeperId: z.string().min(1),
  /** The taker's ATK plus the die. */
  attackerTotal: z.number().int(),
  /** The keeper's DEF plus the die. */
  defenderTotal: z.number().int(),
  /** The die the taker rolled. */
  attackerRoll: z.number().int().min(1),
  /** The die the keeper rolled. */
  defenderRoll: z.number().int().min(1),
  /**
   * The odds the taker had, worked out before the dice.
   *
   * Carried on the kick rather than recomputed by whoever is drawing it, so the
   * number a player is shown before pressing is provably the number the kick was
   * resolved at (GDD §9).
   */
  winChance: z.number().min(0).max(1),
});

/** A validated penalty. See {@link ShootoutKickSchema}. */
export type ShootoutKick = z.infer<typeof ShootoutKickSchema>;

/**
 * How a shootout went, kick by kick, so a client can play it out for the players.
 *
 * The engine resolves all of it at once and deterministically; the client walks
 * this list one kick at a time. Presentation lags the engine and never leads it,
 * which is what keeps a shootout replayable from a seed with no UI attached.
 */
export const ShootoutSchema = z.object({
  /** Penalties the home side converted. */
  home: z.number().int().min(0),
  /** Penalties the away side converted. */
  away: z.number().int().min(0),
  /** Every kick in the order taken. */
  kicks: z.array(ShootoutKickSchema),
});

/** A validated shootout. See {@link ShootoutSchema}. */
export type Shootout = z.infer<typeof ShootoutSchema>;

/**
 * How a match ended.
 *
 * There is always a winner — `winner` is not nullable, because GDD §10 rules out
 * flat draws and the decision cascade is built so it cannot produce one.
 */
export const MatchResultSchema = z.object({
  /** The side that won. Never null. */
  winner: TeamSchema,
  /** Which rung of the cascade decided it. */
  decidedBy: DecisionMethodSchema,
  /** The shootout, when one was needed; null otherwise. */
  shootout: ShootoutSchema.nullable(),
});

/** A validated result. See {@link MatchResultSchema}. */
export type MatchResult = z.infer<typeof MatchResultSchema>;
