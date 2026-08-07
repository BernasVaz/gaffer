import { z } from "zod";

/**
 * Which side of the pitch a player belongs to.
 *
 * "home" attacks toward increasing x; "away" attacks toward decreasing x. There
 * is no asymmetry beyond direction — v1 gives both sides the identical squad
 * (GDD §14).
 */
export const TeamSchema = z.enum(["home", "away"]);

/** A validated side. See {@link TeamSchema}. */
export type Team = z.infer<typeof TeamSchema>;

/** Both sides, home first. Useful for iterating without repeating the literals. */
export const TEAMS = ["home", "away"] as const satisfies readonly Team[];

/** The other side. */
export function opponentOf(team: Team): Team {
  return team === "home" ? "away" : "home";
}
