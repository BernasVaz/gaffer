import type { Board, Position } from "@gaffer/shared";
import { preference, usePreference } from "../ui/preference";

/** Which way round the board is drawn. */
export type Orientation = "landscape" | "portrait";

/** A direction on the board, as a vector. Only its rotation matters here. */
export interface Vector {
  x: number;
  y: number;
}

/**
 * Where a board cell is drawn, and which cell a drawn position belongs to.
 *
 * The engine's coordinates are fixed: `x` runs goal to goal with home attacking
 * up the numbers, `y` runs touchline to touchline. That never changes, at any
 * screen size, which is what keeps a match replayable from its seed however it
 * happened to be displayed.
 *
 * What changes is only where those coordinates land on glass. A phone held
 * upright has the pitch the wrong way round — a 13-wide board across 375px is a
 * 28px cell, and nobody can play that. Turning the drawing a quarter turn puts
 * the long axis down the screen where the room is, and costs the engine
 * nothing, because a rotation is a fact about the *view*.
 */
export interface BoardLayout {
  /** Which way round this layout draws. */
  orientation: Orientation;
  /** Columns in the drawn grid. */
  cols: number;
  /** Rows in the drawn grid. */
  rows: number;
  /** Where a board cell is drawn. */
  toScreen: (cell: Position) => { col: number; row: number };
  /** Which board cell is drawn at a grid position. The inverse of `toScreen`. */
  toBoard: (col: number, row: number) => Position;
  /** A board direction, turned the same way the board is. */
  rotate: (vector: Vector) => Vector;
}

/**
 * Build the mapping for a board drawn `orientation` way round.
 *
 * Portrait is a quarter turn anticlockwise, which is the one that puts the
 * **home goal at the bottom** and sends home's attack up the screen. Attacking
 * upwards is what a phone game trains you to expect, and the home end is the
 * side a solo player takes by default, so the common case reads the right way
 * without anything having to be flipped per seat.
 *
 * Both directions are given rather than derived, because the inverse is needed
 * on every pointer move and a rotation that is inverted slightly differently in
 * two places is a drag that lands one cell off.
 */
export function layoutFor(board: Board, orientation: Orientation): BoardLayout {
  if (orientation === "landscape") {
    return {
      orientation,
      cols: board.width,
      rows: board.height,
      toScreen: ({ x, y }) => ({ col: x, row: y }),
      toBoard: (col, row) => ({ x: col, y: row }),
      rotate: (vector) => vector,
    };
  }

  const lastRow = board.width - 1;

  return {
    orientation,
    cols: board.height,
    rows: board.width,
    toScreen: ({ x, y }) => ({ col: y, row: lastRow - x }),
    toBoard: (col, row) => ({ x: lastRow - row, y: col }),
    // The same quarter turn, applied to a direction: +x (upfield for home)
    // becomes −y (up the screen).
    rotate: ({ x, y }) => ({ x: y, y: -x }),
  };
}

/**
 * The SVG transform that turns board-unit drawing into screen units.
 *
 * Lets anything drawn in the grid's own coordinates — the markings, which are
 * laid out one unit per cell — be reused unchanged in either orientation
 * instead of being redrawn a second time in a second coordinate system, where
 * the halfway line and the penalty boxes would then have to be kept in step by
 * hand.
 */
export function svgTransform(board: Board, orientation: Orientation): string | undefined {
  // (x, y) -> (y, width - x): the same anticlockwise quarter turn as `toScreen`,
  // in continuous units, so cell corners still land on cell corners.
  return orientation === "portrait" ? `matrix(0 -1 1 0 0 ${board.width})` : undefined;
}

/** Where the chosen orientation is remembered. */
const ORIENTATIONS = ["portrait", "landscape"] as const;

/**
 * Portrait, unless the player says otherwise — at every screen size.
 *
 * This replaces the media query ADR 0014 shipped with, and the reason is what
 * the alpha showed: the upright board is simply the better one to play on. It
 * fills a phone, it is the shape the pitch already is, and on a desktop it
 * leaves room beside the board for everything that is not the board. A media
 * query was answering "what shape is the window", which turned out to be the
 * wrong question — the right one is "which way do you want it", and that has a
 * sensible default and an answer the player can change (ADR 0019).
 */
export const layoutOrientation = preference<Orientation>(
  "gaffer:orientation",
  "portrait",
  ORIENTATIONS,
);

/** Which way round the board is drawn, live. */
export function useOrientation(): Orientation {
  return usePreference(layoutOrientation, "portrait");
}

/** Turn the board the other way round. */
export function turnBoard(): void {
  layoutOrientation.set(layoutOrientation.get() === "portrait" ? "landscape" : "portrait");
}
