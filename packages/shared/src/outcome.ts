import { z } from "zod";

import { TeamSchema } from "./team.js";

/**
 * Turns a match runs for before the score decides it (GDD §10, §13).
 *
 * Counted across both sides — 24 turns is 12 each — which is why it must stay
 * even, or one side would get an extra go. Tuned so a match lands in the 3–5
 * minute target of GDD §11.
 *
 * Raised from 20 in v1.6. An attack needs three or four actions to work the ball
 * into range and finish, and possession changes hands roughly every two and a
 * half, so at 20 turns a good share of matches simply ran out of pitch before
 * anyone completed one. The extra four turns are worth about 15% more goals and
 * cut goalless matches from 12% to 7% without touching a single duel.
 */
export const TURN_CAP = 24;

/**
 * Turns left in regulation, counting the one in progress.
 *
 * Zero once the cap has passed. Whether that ends the match is the win
 * condition's business, not this function's.
 */
export function turnsRemaining(turn: number): number {
  return Math.max(0, TURN_CAP - turn + 1);
}

/**
 * Whether regulation has run out.
 *
 * Reports only. It does not stop play — GDD §10 sends a level match to golden
 * goal rather than ending it, and deciding that is the win condition's job.
 */
export function isRegulationOver(turn: number): boolean {
  return turn > TURN_CAP;
}

/**
 * Sudden-death turns played when regulation ends level (GDD §10).
 *
 * Deliberately small: it must fit inside the 3–5 minute match target of §11, and
 * because goals are scarce a longer extra time mostly delays the shootout rather
 * than avoiding it. Must stay even so both sides get the same number of turns.
 */
export const EXTRA_TIME_TURNS = 4;

/** Every turn a match can run before a tiebreaker is required. */
export const TOTAL_TURNS = TURN_CAP + EXTRA_TIME_TURNS;

/** Penalties each side takes before the shootout goes to sudden death. */
export const SHOOTOUT_KICKS = 3;

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

/** Whether `turn` falls in extra time — past the cap, but not past the end. */
export function isExtraTime(turn: number): boolean {
  return turn > TURN_CAP && turn <= TOTAL_TURNS;
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
});

/** A validated penalty. See {@link ShootoutKickSchema}. */
export type ShootoutKick = z.infer<typeof ShootoutKickSchema>;

/** How a shootout went, kick by kick, so a client can replay it for the players. */
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
