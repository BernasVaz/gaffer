import { z } from "zod";

import { PositionSchema } from "./pitch.js";
import { PlayerIdSchema } from "./player.js";

/** The five things a player can do with an action (GDD §7). */
export const ActionTypeSchema = z.enum(["move", "pass", "dribble", "tackle", "shoot"]);

/** A validated action type. See {@link ActionTypeSchema}. */
export type ActionType = z.infer<typeof ActionTypeSchema>;

/** Every action type, in the order GDD §7 lists them. */
export const ACTION_TYPES = [
  "move",
  "pass",
  "dribble",
  "tackle",
  "shoot",
] as const satisfies readonly ActionType[];

/** Relocate a player to an empty cell. Uncontested. */
export const MoveActionSchema = z.object({
  /** Discriminator. */
  type: z.literal("move"),
  /** The player being moved. */
  playerId: PlayerIdSchema,
  /** The cell to move to. */
  target: PositionSchema,
});

/**
 * A carrier's move that an opponent contests.
 *
 * Same geometry as a move; the difference is purely whether an opponent is
 * adjacent at the origin or the destination (GDD §7).
 */
export const DribbleActionSchema = z.object({
  /** Discriminator. */
  type: z.literal("dribble"),
  /** The carrier. */
  playerId: PlayerIdSchema,
  /** The cell to carry the ball to. */
  target: PositionSchema,
});

/** Send the ball down a straight lane to a team-mate. */
export const PassActionSchema = z.object({
  /** Discriminator. */
  type: z.literal("pass"),
  /** The carrier. */
  playerId: PlayerIdSchema,
  /** The team-mate receiving the ball. */
  target: PlayerIdSchema,
});

/**
 * Challenge the carrier for the ball.
 *
 * Atomic: the challenging player must already be adjacent. Getting there costs a
 * separate {@link MoveActionSchema} first.
 */
export const TackleActionSchema = z.object({
  /** Discriminator. */
  type: z.literal("tackle"),
  /** The challenging player. */
  playerId: PlayerIdSchema,
  /** The carrier being challenged. */
  target: PlayerIdSchema,
});

/**
 * Strike at goal.
 *
 * `target` is always null: v1 shots are not aimed at a particular cell — the
 * shot is one duel against the keeper (GDD §13), so there is nothing to choose.
 * The field is kept for a uniform action shape.
 */
export const ShootActionSchema = z.object({
  /** Discriminator. */
  type: z.literal("shoot"),
  /** The carrier shooting. */
  playerId: PlayerIdSchema,
  /** Always null — shots are not aimed in v1. */
  target: z.null(),
});

/**
 * One thing a player does with one action.
 *
 * GDD §15 fixes the shape as `{ playerId, type, target }`. What `target` means
 * depends on the verb — a cell for move and dribble, a player for pass and
 * tackle, nothing for a shot — so this is a discriminated union rather than one
 * loose object, and an action that names the wrong kind of target fails to parse
 * rather than reaching the rules.
 */
export const ActionSchema = z.discriminatedUnion("type", [
  MoveActionSchema,
  PassActionSchema,
  DribbleActionSchema,
  TackleActionSchema,
  ShootActionSchema,
]);

/** A validated action. See {@link ActionSchema}. */
export type Action = z.infer<typeof ActionSchema>;
