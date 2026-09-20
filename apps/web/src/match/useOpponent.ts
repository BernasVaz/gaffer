import { chooseCommand } from "@gaffer/ai";
import type { Difficulty, MatchState, Team } from "@gaffer/shared";
import { useEffect } from "react";

import { OPPONENT } from "../feel";
import type { PlayOutcome } from "./useMatch";

/** What {@link useOpponent} needs to know to take its turn. */
export interface OpponentOptions {
  /** The live board. */
  state: MatchState;
  /** The side the opponent commands, or null in a hotseat match. */
  team: Team | null;
  /** How hard it tries. */
  difficulty: Difficulty;
  /** The match seed, so its choices vary between matches but not within one. */
  seed: number;
  /**
   * Hold the opponent while something is being shown.
   *
   * Presentation only, and the same reason the board suspends input during a
   * goal: the engine has already moved on, but acting against a position nobody
   * can currently see is confusing rather than fast.
   */
  paused: boolean;
  /** The one way into the engine. */
  play: (command: ReturnType<typeof chooseCommand>) => PlayOutcome | null;
  /** Called with whatever a played command produced, so a goal can be celebrated. */
  onPlayed?: (outcome: PlayOutcome) => void;
}

/**
 * Let the solo opponent take its turn, one action at a time, with a pause the
 * player can watch.
 *
 * **The pause is presentation, not rules.** A decision costs about four
 * milliseconds; the delay exists because two actions landing the instant your
 * turn ends reads as the board rearranging itself rather than as an opponent
 * playing. Nothing about *when* the command is sent can change *which* command
 * it is — `chooseCommand` is handed a board and returns a command, and has no
 * access to a clock. This is the same boundary the goal moment keeps: the view
 * is allowed to take its time, the engine is never asked to wait.
 *
 * It plays one action per tick rather than a whole turn at once, because a turn
 * is two separate decisions and the second one depends on how the first landed.
 * Playing advances the state, the effect runs again, and it stops on its own
 * when the turn passes back.
 *
 * @returns Whether the opponent is currently mid-thought, for the status line.
 */
export function useOpponent({
  state,
  team,
  difficulty,
  seed,
  paused,
  play,
  onPlayed,
}: OpponentOptions): { thinking: boolean } {
  /*
   * Derived, not stored. "Thinking" is not a thing that happens to the opponent;
   * it is exactly the condition under which a command is pending — the turn is
   * its own, the match is live, and nothing is being shown. Holding it in state
   * as well would mean two sources for one fact, and the effect would have to
   * keep them in step on every render.
   */
  const thinking = team !== null && state.result === null && state.activeTeam === team && !paused;

  // The first action of a turn gets a longer pause: the opponent has just been
  // handed a board it has not seen, and the player has just finished acting.
  const delay =
    state.actionsRemaining === state.rules.actionsPerTurn
      ? OPPONENT.firstAction
      : OPPONENT.nextAction;

  useEffect(() => {
    if (!thinking) return;

    const timer = window.setTimeout(() => {
      const outcome = play(chooseCommand(state, { difficulty, variety: seed }));
      if (outcome && onPlayed) onPlayed(outcome);
    }, delay);

    /*
     * Cleared on unmount and before every re-run. That is what makes this safe
     * under React's development double-render: the first timer is cancelled
     * before the second is set, so exactly one command is ever sent — which
     * matters here more than usual, because sending one advances the match's
     * seeded generator and a duplicate would desynchronise it from its own seed.
     */
    return () => window.clearTimeout(timer);
  }, [thinking, state, difficulty, seed, delay, play, onPlayed]);

  return { thinking };
}
