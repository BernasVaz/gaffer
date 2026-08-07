import { z } from "zod";

import {
  DribbleActionSchema,
  MoveActionSchema,
  PassActionSchema,
  ShootActionSchema,
  TackleActionSchema,
} from "./action.js";
import { TeamSchema } from "./team.js";

/**
 * Hand the turn over without spending an action.
 *
 * GDD §8 lets a side pass "when your actions are spent (or end early)". The
 * automatic case needs no command, but ending early is a real decision a player
 * makes, so it has to appear in the replay log — otherwise a match that ended a
 * turn early could not be reproduced.
 *
 * It names the acting side rather than a player, both because no player performs
 * it and because it keeps a log unambiguous when read on its own.
 */
export const EndTurnCommandSchema = z.object({
  /** Discriminator. */
  type: z.literal("endTurn"),
  /** The side giving up the rest of its turn. Must be the side to move. */
  team: TeamSchema,
});

/** A validated end-turn. See {@link EndTurnCommandSchema}. */
export type EndTurnCommand = z.infer<typeof EndTurnCommandSchema>;

/**
 * Anything a player can send the engine: the five gameplay verbs, or an
 * end-turn.
 *
 * `Action` stays exactly GDD §7's action menu — five verbs, each naming a player
 * and a target and each costing an action. This union is the wider thing a
 * client submits and a replay log stores.
 */
export const MatchCommandSchema = z.discriminatedUnion("type", [
  MoveActionSchema,
  PassActionSchema,
  DribbleActionSchema,
  TackleActionSchema,
  ShootActionSchema,
  EndTurnCommandSchema,
]);

/** A validated command. See {@link MatchCommandSchema}. */
export type MatchCommand = z.infer<typeof MatchCommandSchema>;

/**
 * Why the engine refused a command.
 *
 * A closed set of codes rather than prose: a server rejecting a client's move
 * needs something it can branch on, translate, and log — and a client that is
 * simply out of date should be distinguishable from one that is cheating.
 */
export const REJECTION_REASONS = [
  /** No player on the pitch has that id. */
  "unknown-player",
  /** The named player belongs to the side that is not to move. */
  "not-your-turn",
  /** The side to move has already spent its actions this turn. */
  "no-actions-left",
  /** A pass or tackle named a player who is not on the pitch. */
  "unknown-target",
  /** Well-formed, but not among the actions the rules allow right now. */
  "illegal-action",
] as const;

/** A closed set of refusal codes. See {@link REJECTION_REASONS}. */
export const RejectionReasonSchema = z.enum(REJECTION_REASONS);

/** A validated refusal code. See {@link RejectionReasonSchema}. */
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;
