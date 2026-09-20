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
 * The id given to the `index`-th player filling `role` for `team`.
 *
 * Readable on purpose — `home-defender-3` beats an opaque counter when you are
 * reading a failing test or a replay log. The index is 1-based and counts only
 * within the side and the role, so an 11-a-side back four is `home-defender-1`
 * through `home-defender-4` and there is exactly one `home-goalkeeper-1`.
 *
 * It is present even when a role appears once. 5-a-side fields one of each and
 * could have managed without it, but an id whose shape depends on the format is
 * an id nothing can parse — and a match state is meant to be readable without
 * knowing which game type produced it.
 */
export function playerIdFor(team: Team, role: Role, index = 1): PlayerId {
  return `${team}-${role}-${index}`;
}
