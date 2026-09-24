import { z } from "zod";

/**
 * Which edition of the rules a match was played under.
 *
 * A seed and a command log reproduce a match **only against the rules that
 * produced them**. The engine is deterministic, which guarantees that the same
 * inputs give the same board — it guarantees nothing at all once the rules
 * themselves have moved. ADR 0018 made a kickoff a pass, and every log written
 * before it begins with an action the engine now refuses; ADR 0021 changed what
 * a won dribble does, so a log written before it replays to a *different board*
 * without erroring at all. That second kind is the dangerous one.
 *
 * So anything that stores a match stores this beside it, and anything that
 * replays a stored match can say whether it was played under the rules it is
 * being replayed against.
 *
 * **Bump it in the same commit as any change to what `applyAction` accepts or
 * to what it produces.** Enumeration, resolution, duel odds, the turn economy,
 * the formats' numbers — if a replay could come out differently, it is a bump.
 * Presentation, the opponent, and anything in `apps/` are not.
 *
 * Not the same thing as the package's semver, which is about publishing and is
 * owned by Changesets. This is about whether two matches are the same game.
 *
 * The editions so far:
 *
 * - **1** — the rules as they stood when this field shipped.
 * - **2** — a carrier may take the man on (ADR 0021), and a won dribble carries
 *   on a cell further (ADR 0023). Both change what a dribble *produces*, so a
 *   log from edition 1 replays silently to a board that never happened.
 * - **3** — a pass finds any team-mate with a clear lane rather than only one
 *   standing on a ray (ADR 0025). This changes what is *legal*, so an edition-2
 *   log does not merely replay differently: a command in it can be refused
 *   outright, or a board can offer a ball that was unimaginable when it was
 *   written.
 * - **4** — the penalty shootout is five kicks a side rather than three, stops
 *   as soon as one side cannot be caught, and rotates its takers (ADR 0026). A
 *   level match under edition 3 draws a different number of dice in a different
 *   order, so the shootout — and therefore the winner — comes out differently.
 */
export const RULES_VERSION = 4;

/** A validated rules edition. See {@link RULES_VERSION}. */
export const RulesVersionSchema = z.number().int().min(1);

/**
 * What a stored match's rules edition tells us about replaying it.
 *
 * `unknown` is for matches saved before this existed: they cannot be placed,
 * and saying so is more honest than guessing. They are *probably* older, but a
 * match saved five minutes before the field shipped is not.
 */
export type RulesStanding = "current" | "older" | "newer" | "unknown";

/**
 * Whether a stored match was played under the rules we are about to replay it
 * against.
 *
 * Deliberately not a boolean: "this was played under rules we no longer have"
 * and "we have no idea" call for different words in front of somebody who is
 * looking at their own feedback and wondering whether to trust it.
 */
export function rulesStanding(stored: number | undefined): RulesStanding {
  if (stored === undefined) return "unknown";
  if (stored === RULES_VERSION) return "current";
  return stored < RULES_VERSION ? "older" : "newer";
}

/** Whether a replay of this match can be trusted to reproduce what was played. */
export function replaysFaithfully(stored: number | undefined): boolean {
  return rulesStanding(stored) === "current";
}
