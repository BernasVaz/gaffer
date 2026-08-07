import { z } from "zod";

/**
 * Columns on the v1 pitch, running from the home goal (x = 0) to the away goal.
 *
 * GDD §5 fixes the 5-a-side flagship at 7 × 5. The number lives here rather than
 * being written into rules so that 7-a-side and 11-a-side can arrive later as
 * data, not as a code change.
 */
export const PITCH_WIDTH = 7;

/** Rows on the v1 pitch, running touchline (y = 0) to touchline. See {@link PITCH_WIDTH}. */
export const PITCH_HEIGHT = 5;

/**
 * The column both halves share.
 *
 * With an odd width there is a true middle column, which acts as the halfway
 * line: it belongs to both halves, and at kickoff only the player taking the
 * kickoff stands on it.
 */
export const HALFWAY_COLUMN = Math.floor(PITCH_WIDTH / 2);

/** Dimensions of a pitch. Data, so game modes can vary it without touching rules. */
export const BoardSchema = z.object({
  /** Number of columns, goal to goal. */
  width: z.number().int().positive(),
  /** Number of rows, touchline to touchline. */
  height: z.number().int().positive(),
});

/** A validated pitch size. See {@link BoardSchema}. */
export type Board = z.infer<typeof BoardSchema>;

/** The v1 5-a-side pitch: 7 columns × 5 rows (GDD §5). */
export const DEFAULT_BOARD: Board = { width: PITCH_WIDTH, height: PITCH_HEIGHT };

/**
 * A cell on the pitch, as zero-based column/row.
 *
 * Deliberately unbounded above: the upper limit depends on the board in play, so
 * it is checked against a specific {@link Board} by {@link isWithinBoard} and by
 * the match-state validator, not baked into the coordinate type.
 */
export const PositionSchema = z.object({
  /** Column, 0 at the home goal-line, increasing toward the away goal. */
  x: z.number().int().min(0),
  /** Row, 0 at one touchline, increasing toward the other. */
  y: z.number().int().min(0),
});

/** A validated cell on the pitch. See {@link PositionSchema}. */
export type Position = z.infer<typeof PositionSchema>;

/** The centre of the pitch, where the ball sits at kickoff (GDD §7). */
export const CENTRE_SPOT: Position = {
  x: HALFWAY_COLUMN,
  y: Math.floor(PITCH_HEIGHT / 2),
};

/** Whether `position` falls inside `board`. */
export function isWithinBoard(position: Position, board: Board): boolean {
  return (
    position.x >= 0 && position.x < board.width && position.y >= 0 && position.y < board.height
  );
}

/**
 * The equivalent cell for the opposite side.
 *
 * This is a 180° rotation, not a left-right reflection, because the two teams
 * face each other: rotating keeps a player who is wide on one touchline wide on
 * the other, which a reflection would not. The rotation is its own inverse, and
 * the centre spot is its only fixed point.
 */
export function mirrorPosition(position: Position, board: Board): Position {
  return {
    x: board.width - 1 - position.x,
    y: board.height - 1 - position.y,
  };
}
