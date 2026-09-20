import { z } from "zod";

import type { Team } from "./team.js";

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
 * The column both halves share, for any board.
 *
 * With an odd width there is a true middle column, which acts as the halfway
 * line: it belongs to both halves, and at kickoff only the player taking the
 * kickoff stands on it. Every format's board is odd in both dimensions for
 * exactly this reason — see `FORMAT_PROFILES`.
 */
export function halfwayColumn(board: Board): number {
  return Math.floor(board.width / 2);
}

/** The halfway column of the 5-a-side pitch. See {@link halfwayColumn}. */
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

/**
 * The centre of a pitch, where the ball sits at kickoff (GDD §7).
 *
 * The one cell a 180° rotation maps onto itself, which is what makes it both
 * the natural kickoff spot and the one cell no line-up may place a player on.
 */
export function centreSpot(board: Board): Position {
  return { x: halfwayColumn(board), y: Math.floor(board.height / 2) };
}

/** The centre spot of the 5-a-side pitch. See {@link centreSpot}. */
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

/** A unit step on the grid: one of the 8 compass directions. */
export interface Direction {
  /** Column delta, -1, 0 or 1. */
  dx: number;
  /** Row delta, -1, 0 or 1. */
  dy: number;
}

/**
 * The 8 directions movement and passing travel in (GDD §5).
 *
 * Both actions run in straight lines along one of these, which is why distance
 * is counted in steps rather than in cells crossed — see
 * {@link chebyshevDistance}.
 */
export const DIRECTIONS: readonly Direction[] = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: -1, dy: -1 },
];

/**
 * Distance in steps, where a diagonal step costs the same as an orthogonal one.
 *
 * This is the metric the game runs on: because a player may travel in any of the
 * 8 directions, "three cells away" has to mean three steps in some direction,
 * not three cells of Euclidean separation.
 */
export function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Whether two cells touch — the 8 surrounding cells, not the cell itself. */
export function areAdjacent(a: Position, b: Position): boolean {
  return chebyshevDistance(a, b) === 1;
}

/**
 * How many cells wide each goal mouth is (GDD §5).
 *
 * The same at every format, on purpose. A goal in football is a fixed physical
 * size and the pitch grows around it — and here that also keeps the keeper
 * coherent, because 3 is exactly what a keeper standing on its line can cover
 * with a move range of 1. Widening the mouth on a bigger pitch would either
 * hand the attacker a goal the keeper cannot defend, or require a faster keeper
 * and a different game.
 */
export const GOAL_MOUTH_HEIGHT = 3;

/**
 * The cells making up the goal that `team` is attacking.
 *
 * Home attacks the far column, away the near one. The mouth is the middle
 * {@link GOAL_MOUTH_HEIGHT} rows of that column rather than the whole goal-line,
 * so scoring from the touchline is not a thing — and on the v1 pitch it is
 * exactly the span a keeper starting on the goal-line centre can cover with its
 * move range of 1.
 */
export function attackingGoalMouth(team: Team, board: Board): Position[] {
  const x = team === "home" ? board.width - 1 : 0;
  const firstRow = Math.floor((board.height - GOAL_MOUTH_HEIGHT) / 2);

  return Array.from({ length: GOAL_MOUTH_HEIGHT }, (_unused, offset) => ({
    x,
    y: firstRow + offset,
  }));
}

/** The cells making up the goal `team` is defending. */
export function defendingGoalMouth(team: Team, board: Board): Position[] {
  return attackingGoalMouth(team === "home" ? "away" : "home", board);
}

/**
 * Which side defends the goal this cell belongs to, or null for ordinary pitch.
 *
 * The mouth is not somewhere a player stands: it is what a shot is aimed *into*.
 * Only the keeper defending it may occupy it, which is what stops an attacker
 * walking into the net and then shooting at the goal it is standing inside.
 * The goal-line cells outside the mouth — the corners — remain ordinary pitch.
 */
export function goalMouthOwner(cell: Position, board: Board): Team | null {
  for (const team of ["home", "away"] as const) {
    const mine = defendingGoalMouth(team, board);
    if (mine.some((mouth) => mouth.x === cell.x && mouth.y === cell.y)) return team;
  }
  return null;
}
