import { z } from "zod";

import { PositionSchema } from "./pitch.js";
import { RoleSchema, StatsSchema } from "./roles.js";
import { TeamSchema, type Team } from "./team.js";
import type { Role } from "./roles.js";

/** Identifies one player within a match. Unique across both squads. */
export const PlayerIdSchema = z.string().min(1);

/** A validated player id. See {@link PlayerIdSchema}. */
export type PlayerId = z.infer<typeof PlayerIdSchema>;

/**
 * One player on the pitch.
 *
 * Stats and move range are copied onto the player rather than looked up from the
 * role-profiles table at read time, so a match state is self-contained: a saved
 * or transmitted state replays identically even if the balance table is later
 * retuned.
 */
export const PlayerSchema = z.object({
  /** Unique within the match. */
  id: PlayerIdSchema,
  /** Which side this player belongs to. */
  team: TeamSchema,
  /** The role this player fills. */
  role: RoleSchema,
  /** Current cell. */
  position: PositionSchema,
  /** Duel stats, taken from the role's profile at kickoff. */
  stats: StatsSchema,
  /** Maximum cells a single Move action may cover. */
  moveRange: z.number().int().min(1),
});

/** A validated player. See {@link PlayerSchema}. */
export type Player = z.infer<typeof PlayerSchema>;

/**
 * The id given to the one player filling `role` for `team`.
 *
 * v1 fields exactly one of each role per side, so team plus role is already
 * unique and makes a readable id — `home-striker` beats an opaque counter when
 * you are reading a failing test or a replay log.
 */
export function playerIdFor(team: Team, role: Role): PlayerId {
  return `${team}-${role}`;
}
