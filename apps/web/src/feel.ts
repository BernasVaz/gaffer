import type { Transition } from "motion/react";

/**
 * Every number that decides how the board *feels*, in one place.
 *
 * This file exists to be argued with. Rhythm is not something you get right by
 * reasoning about it — you watch it, decide it drags or snaps, and change a
 * number. Keeping them together means that is a single edit rather than a hunt
 * through components.
 *
 * **None of it can reach the engine.** These values drive springs and keyframes
 * in `apps/web` only; the engine resolves the instant a command is committed and
 * the board catches up afterwards (see `docs/engineering.md`, "presentation lags
 * the engine"). Changing anything here cannot change a match result.
 *
 * @packageDocumentation
 */

/**
 * How a piece travels.
 *
 * Stiff enough to feel eager, damped just under critical so it arrives with a
 * hint of overshoot and settles — that tiny overrun is most of what reads as
 * "weight" rather than "teleport with a delay".
 */
export const PIECE_SPRING: Transition = {
  type: "spring",
  stiffness: 460,
  damping: 28,
  mass: 0.9,
};

/** How the ball travels — lighter and quicker, so it arrives just ahead of the eye. */
export const BALL_SPRING: Transition = {
  type: "spring",
  stiffness: 620,
  damping: 26,
  mass: 0.55,
};

/** The snap on small ornamental things: rings, badges, pops. */
export const POP_SPRING: Transition = {
  type: "spring",
  stiffness: 700,
  damping: 22,
  mass: 0.5,
};

/**
 * Squash and stretch, as multipliers along and across the direction of travel.
 *
 * A shirt stretches as it leaves, squashes as it lands, then settles. Overdone it
 * turns into jelly; this is deliberately just past the point where you notice it
 * consciously.
 */
export const SQUASH = {
  /** How far it stretches along its direction of travel. */
  stretch: 1.16,
  /** How far it compresses across that direction while stretching. */
  thin: 0.88,
  /** How far it compresses along travel as it lands. */
  squash: 0.9,
  /** How far it bulges across travel as it lands. */
  bulge: 1.1,
  /** Seconds for the whole stretch-land-settle. */
  duration: 0.42,
} as const;

/** The arc a travelling ball rises through, as a fraction of one cell. */
export const BALL_ARC = {
  /** Peak height of the hop. */
  lift: 0.42,
  /** Seconds for the hop, tuned to land with the ball's spring. */
  duration: 0.34,
  /** Degrees of roll per cell travelled. */
  spinPerCell: 260,
} as const;

/** The idle breath that keeps the board from looking like a screenshot. */
export const IDLE = {
  /** Vertical travel, as a fraction of a cell. Small enough to feel, not to watch. */
  rise: 0.035,
  /** Seconds for one full breath. */
  period: 3.4,
  /** Seconds of offset between pieces, so they never breathe in unison. */
  stagger: 0.37,
} as const;

/** The goal celebration, the emotional peak of a match. */
export const GOAL = {
  /** Total milliseconds the board is held. Also drives the burst's own timing. */
  hold: 1400,
  /** How many sparks fly. */
  particles: 22,
  /** Seconds a spark lives. */
  particleLife: 0.95,
  /** How far a spark travels, as a fraction of the pitch's smaller side. */
  particleReach: 0.62,
  /** Seconds the pitch shakes for. */
  shake: 0.42,
  /** Peak shake displacement in pixels. */
  shakeAmount: 9,
} as const;

/** The flourish as the turn changes hands. */
export const TURN_FLOURISH = {
  /** Seconds the sweep takes to cross. */
  duration: 0.55,
} as const;

/**
 * How long the opponent appears to think before each action.
 *
 * Nothing to do with how long it *takes* — a decision costs about four
 * milliseconds. This is a pause put there on purpose, because an opponent whose
 * two actions land the instant your turn ends reads as the board rearranging
 * itself rather than as somebody playing. The pause is what turns a state change
 * into a move.
 *
 * It cannot reach the rules. The opponent is handed a board and returns a
 * command; when that happens changes nothing about which command it is.
 */
export const OPPONENT = {
  /** Milliseconds before the opponent's first action of a turn. */
  firstAction: 620,
  /** Milliseconds before each action after it — it has already "seen" the board. */
  nextAction: 460,
} as const;

/** A transition that does nothing, for readers who asked for less motion. */
export const INSTANT: Transition = { duration: 0 };
