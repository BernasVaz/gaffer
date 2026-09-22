import { z } from "zod";

import { MatchFormatSchema, MatchRulesSchema } from "./format.js";
import { BoardSchema, isWithinBoard, PositionSchema } from "./pitch.js";
import { PlayerIdSchema, PlayerSchema } from "./player.js";
import { MatchResultSchema } from "./outcome.js";
import { TeamSchema } from "./team.js";

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
 * Running match totals, kept because the tiebreaker needs them.
 *
 * Not statistics for their own sake: when a shootout ends level, GDD §10's ban on
 * draws has to be honoured by something, and these are what the cascade compares
 * before falling back to kickoff compensation.
 */
export const MatchStatsSchema = z.object({
  /** Shots taken, whether scored or saved. Shootout penalties do not count. */
  shotsAttempted: z.object({
    /** Home shots. */
    home: z.number().int().min(0),
    /** Away shots. */
    away: z.number().int().min(0),
  }),
  /** Duels each side came out of on top, across every contested action. */
  duelsWon: z.object({
    /** Duels won by home. */
    home: z.number().int().min(0),
    /** Duels won by away. */
    away: z.number().int().min(0),
  }),
});

/** Validated match totals. See {@link MatchStatsSchema}. */
export type MatchStats = z.infer<typeof MatchStatsSchema>;

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
    /** Which game type this is. Fixed for the life of the match. */
    format: MatchFormatSchema,
    /**
     * The numbers this match is played by.
     *
     * Carried on the state rather than looked up from the format table, so a
     * saved or transmitted match replays identically even if that table is
     * later retuned — the same reason a player's stats are copied onto the
     * player at kickoff rather than read from the role profiles.
     */
    rules: MatchRulesSchema,
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
    /** Actions the active side has left this turn. Never more than the rules allow. */
    actionsRemaining: z.number().int().min(0),
    /** Current scoreline. */
    score: ScoreSchema,
    /**
     * Which side took the opening kickoff.
     *
     * Fixed for the whole match — kickoffs after a goal go to the conceding side
     * and do not change this. It is the last rung of the tiebreaker: the side
     * that did *not* start with the ball takes a tie nothing else could settle.
     */
    kickedOff: TeamSchema,
    /**
     * The side that still owes a kickoff pass, or null when none is due.
     *
     * A kickoff is a pass in football, and it was not one here: a match opened
     * with whatever the kicking side fancied, usually a dribble into the
     * opponent standing next to it. Set at kickoff and after every goal, and
     * cleared by the first action that side takes (GDD §7, ADR 0018).
     *
     * On the state rather than derived, because "is this a kickoff" cannot be
     * read off a board — the formation reset after a goal produces the same
     * arrangement a restart does, and a side that has already played its pass
     * still stands mostly in shape.
     */
    kickoffPending: TeamSchema.nullable(),
    /** Running totals the tiebreaker compares. */
    stats: MatchStatsSchema,
    /** How the match ended, or null while it is still being played. */
    result: MatchResultSchema.nullable(),
  })
  .superRefine((state, ctx) => {
    if (state.actionsRemaining > state.rules.actionsPerTurn) {
      ctx.addIssue({
        code: "custom",
        path: ["actionsRemaining"],
        message: `A side cannot hold ${state.actionsRemaining} actions when a turn grants ${state.rules.actionsPerTurn}`,
      });
    }

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
