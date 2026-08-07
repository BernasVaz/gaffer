import { z } from "zod";

import { BoardSchema, isWithinBoard, PositionSchema } from "./pitch.js";
import { PlayerIdSchema, PlayerSchema } from "./player.js";
import { TeamSchema } from "./team.js";

/** Actions a side may spend per turn (GDD §13). */
export const ACTIONS_PER_TURN = 2;

/**
 * The single ball.
 *
 * `carrierId` is null when the ball is loose — nobody is carrying it. While it
 * is carried, the ball's cell always equals its carrier's cell; that invariant
 * is enforced by {@link MatchStateSchema}, which is the only place both are
 * visible at once.
 */
export const BallSchema = z.object({
  /** The ball's cell. */
  position: PositionSchema,
  /** The player carrying the ball, or null if it is loose. */
  carrierId: PlayerIdSchema.nullable(),
});

/** A validated ball. See {@link BallSchema}. */
export type Ball = z.infer<typeof BallSchema>;

/** Goals scored by each side. */
export const ScoreSchema = z.object({
  /** Goals for the home side. */
  home: z.number().int().min(0),
  /** Goals for the away side. */
  away: z.number().int().min(0),
});

/** A validated scoreline. See {@link ScoreSchema}. */
export type Score = z.infer<typeof ScoreSchema>;

/**
 * The complete state of a match at one instant.
 *
 * This is the value the engine transforms: every rule is a
 * `state + action -> state` function over this shape (GDD §15). It holds
 * everything needed to render or resume a match and nothing derived, so two
 * clients given the same state agree on what they are looking at.
 *
 * The cross-field invariants below cannot be expressed field by field, so they
 * live in a refinement. Parsing an untrusted state — from the network, a save,
 * or a URL — therefore rejects impossible boards rather than letting them reach
 * the rules.
 */
export const MatchStateSchema = z
  .object({
    /** Pitch dimensions for this match. */
    board: BoardSchema,
    /** Every player from both sides. */
    players: z.array(PlayerSchema),
    /** The ball and who has it. */
    ball: BallSchema,
    /** Which side holds the ball, or null when it is loose. */
    possession: TeamSchema.nullable(),
    /** 1-based turn counter. */
    turn: z.number().int().min(1),
    /** Which side is to act. */
    activeTeam: TeamSchema,
    /** Actions the active side has left this turn. */
    actionsRemaining: z.number().int().min(0).max(ACTIONS_PER_TURN),
    /** Current scoreline. */
    score: ScoreSchema,
  })
  .superRefine((state, ctx) => {
    const seenIds = new Set<string>();
    const seenCells = new Set<string>();

    state.players.forEach((player, index) => {
      if (seenIds.has(player.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["players", index, "id"],
          message: `Duplicate player id "${player.id}"`,
        });
      }
      seenIds.add(player.id);

      if (!isWithinBoard(player.position, state.board)) {
        ctx.addIssue({
          code: "custom",
          path: ["players", index, "position"],
          message: `Player "${player.id}" stands off the board`,
        });
      }

      // One piece per cell (GDD §5).
      const cell = `${player.position.x},${player.position.y}`;
      if (seenCells.has(cell)) {
        ctx.addIssue({
          code: "custom",
          path: ["players", index, "position"],
          message: `Two players occupy cell (${cell})`,
        });
      }
      seenCells.add(cell);
    });

    if (!isWithinBoard(state.ball.position, state.board)) {
      ctx.addIssue({
        code: "custom",
        path: ["ball", "position"],
        message: "Ball is off the board",
      });
    }

    const { carrierId } = state.ball;
    if (carrierId === null) return;

    const carrier = state.players.find((player) => player.id === carrierId);
    if (!carrier) {
      ctx.addIssue({
        code: "custom",
        path: ["ball", "carrierId"],
        message: `No player with id "${carrierId}" is on the pitch`,
      });
      return;
    }

    if (
      carrier.position.x !== state.ball.position.x ||
      carrier.position.y !== state.ball.position.y
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["ball", "position"],
        message: "Ball must sit on its carrier's cell",
      });
    }

    if (state.possession !== carrier.team) {
      ctx.addIssue({
        code: "custom",
        path: ["possession"],
        message: `Possession is "${state.possession}" but the carrier plays for "${carrier.team}"`,
      });
    }
  });

/** A validated match state. See {@link MatchStateSchema}. */
export type MatchState = z.infer<typeof MatchStateSchema>;
