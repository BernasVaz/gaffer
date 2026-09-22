import type { Board, Position } from "@gaffer/shared";
import { useSyncExternalStore } from "react";

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

const PORTRAIT = "(orientation: portrait)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia?.(PORTRAIT);
  if (!query) return () => {};

  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function snapshot(): Orientation {
  return window.matchMedia?.(PORTRAIT)?.matches ? "portrait" : "landscape";
}

/** Landscape on a server, where there is no viewport to ask. */
const serverSnapshot = (): Orientation => "landscape";

/**
 * Which way up the viewport is, live.
 *
 * A media query rather than a width breakpoint: the question is genuinely about
 * the shape of the window, and phrasing it that way means a phone turned on its
 * side goes back to the wide board at once, and a tall narrow desktop window
 * gets the tall board — both of which are what you would want and neither of
 * which a device guess would get right.
 *
 * Subscribed rather than measured in an effect, so the first paint is already
 * the right way round instead of flipping a frame later.
 */
export function useOrientation(): Orientation {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
