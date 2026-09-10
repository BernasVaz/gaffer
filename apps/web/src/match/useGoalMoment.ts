import type { MatchState, Team } from "@gaffer/shared";
import { useCallback, useEffect, useState } from "react";

import { GOAL } from "../feel";

/**
 * How long the goal celebration runs, in milliseconds.
 *
 * Re-exported from `feel.ts`, which is where every number that decides how the
 * board feels lives, so the rhythm can be tuned in one place. A JS timer releases
 * the board and the same number drives the burst's animation.
 *
 * Presentation only. Nothing in the engine reads it, and changing it cannot
 * change a match result.
 */
export const GOAL_MOMENT_MS = GOAL.hold;

/** A goal being celebrated: who scored, and the board as it was when they did. */
export interface GoalMoment {
  /** The side that scored. */
  team: Team;
  /** Where everyone stood at the moment the ball went in. */
  board: MatchState;
}

/** A goal celebration in progress, and the way to start one. */
export interface GoalMomentController {
  /** The celebration under way, or null when there is none. */
  moment: GoalMoment | null;
  /** Begin celebrating a goal, holding `board` on screen while it runs. */
  celebrate: (board: MatchState, team: Team) => void;
}

/**
 * Hold the pre-goal board on screen for a moment after a goal.
 *
 * **The pattern this establishes: presentation lags the engine, never the other
 * way round.**
 *
 * A goal is the sharpest case. `applyAction` scores it, rebuilds the pitch into
 * the kickoff formation and passes the turn — all before React renders a single
 * frame. Left alone, the board would snap to kickoff with nothing to celebrate,
 * because by then the thing worth celebrating has already been erased from the
 * state.
 *
 * So the client keeps its own, briefly stale copy of the board and shows that
 * instead. The engine is never asked to wait: the score, the turn and the
 * accessible description are all already correct and on screen. Only the *pitch*
 * lags, and only for as long as the celebration lasts, after which the held
 * board is dropped and the pieces slide from where they were to where the engine
 * already put them.
 *
 * Nothing here can reach the engine. The hook is handed a board and a team,
 * returns a board and a team, and has no access to `applyAction`, to a command,
 * or to the seeded generator — so no amount of timing can change a result. The
 * only timer stops the celebration; there is deliberately no timer that *starts*
 * anything, because "when the animation finishes, apply the outcome" is exactly
 * how presentation becomes a rule.
 *
 * @example
 * ```ts
 * const { moment, celebrate } = useGoalMoment();
 * const outcome = play(command);           // the engine has already scored
 * if (outcome?.scored) celebrate(outcome.before, outcome.scorer);
 * const board = moment?.board ?? state;    // draw the held board, or the live one
 * ```
 */
export function useGoalMoment(): GoalMomentController {
  const [moment, setMoment] = useState<GoalMoment | null>(null);

  const celebrate = useCallback((board: MatchState, team: Team) => {
    setMoment({ board, team });
  }, []);

  useEffect(() => {
    if (moment === null) return;

    const timer = window.setTimeout(() => setMoment(null), GOAL_MOMENT_MS);
    // Cleared on unmount or if another goal arrives, so a celebration can never
    // outlive the board it belongs to and leave the pitch frozen.
    return () => window.clearTimeout(timer);
  }, [moment]);

  return { moment, celebrate };
}
