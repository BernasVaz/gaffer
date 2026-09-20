import { z } from "zod";

/** The five positions a v1 player can fill (GDD §6). */
export const RoleSchema = z.enum(["goalkeeper", "defender", "midfielder", "winger", "striker"]);

/** A validated role. See {@link RoleSchema}. */
export type Role = z.infer<typeof RoleSchema>;

/** Every role, ordered from defence to attack. */
export const ROLES = [
  "goalkeeper",
  "defender",
  "midfielder",
  "winger",
  "striker",
] as const satisfies readonly Role[];

/**
 * The three duel stats, each 1–5 (GDD §6).
 *
 * `pas` does double duty in v1: it sets both passing distance and mobility.
 * There is deliberately no separate PACE stat — that was decision 4 of the nine
 * closed in GDD v1.0.
 */
export const StatsSchema = z.object({
  /** Attacking duels: dribbles and shots. */
  atk: z.number().int().min(1).max(5),
  /** Defensive duels: tackles, blocks, saves. */
  def: z.number().int().min(1).max(5),
  /** Passing range, and mobility. */
  pas: z.number().int().min(1).max(5),
});

/** A validated stat line. See {@link StatsSchema}. */
export type Stats = z.infer<typeof StatsSchema>;

/** Everything a role contributes to a player: its stat line and how far it moves. */
export const RoleProfileSchema = z.object({
  /** The role this profile describes. */
  role: RoleSchema,
  /** Duel stats for the role. */
  stats: StatsSchema,
  /** Maximum cells this role may travel with a single Move action. */
  moveRange: z.number().int().min(1),
});

/** A validated role profile. See {@link RoleProfileSchema}. */
export type RoleProfile = z.infer<typeof RoleProfileSchema>;

/**
 * The GDD §6 table, verbatim.
 *
 * These numbers are the contract the duel maths is balanced against, so they are
 * data rather than literals scattered through the engine — retuning is an edit
 * here, not a code change. There is no per-player variation in v1: a Striker is
 * a Striker.
 *
 * The keeper's DEF of 3 is lower than the Defender's, and that is deliberate.
 * ADR 0004 began moving the keeper's identity from a stat line to a position;
 * ADR 0006 finished the move. The keeper is the only player allowed to stand in
 * a goal and the only one who defends a shot while it does — that, not a big
 * number, is what makes it a goalkeeper. With the d4 die this puts a clean
 * striker's effort at 81%, a winger's at 62.5% and a midfielder's at 37.5%, so
 * who gets the chance finally matters as much as whether one falls.
 */
export const ROLE_PROFILES: Readonly<Record<Role, RoleProfile>> = {
  goalkeeper: { role: "goalkeeper", stats: { atk: 1, def: 3, pas: 2 }, moveRange: 1 },
  defender: { role: "defender", stats: { atk: 2, def: 4, pas: 3 }, moveRange: 2 },
  midfielder: { role: "midfielder", stats: { atk: 3, def: 3, pas: 4 }, moveRange: 3 },
  winger: { role: "winger", stats: { atk: 4, def: 2, pas: 3 }, moveRange: 3 },
  striker: { role: "striker", stats: { atk: 5, def: 1, pas: 2 }, moveRange: 2 },
};
