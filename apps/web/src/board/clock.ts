import { isExtraTime, type MatchRules } from "@gaffer/shared";

/** Which half of a match's clock a turn falls in. */
export type MatchPhase = "regulation" | "extraTime";

/** What the clock should say, and what it is counting. */
export interface MatchClock {
  /** Regulation, or the extra time that only some matches reach. */
  phase: MatchPhase;
  /** The turn within that phase, counting from one. */
  turn: number;
  /** How many turns that phase has. */
  of: number;
  /** The whole thing as a sentence, for anyone reading rather than looking. */
  label: string;
}

/**
 * The clock, phrased the way a match is actually played.
 *
 * Regulation counts to the **turn cap**, and nothing else. Extra time is a
 * separate count that begins at one, and it only exists for a match that was
 * level when regulation ran out.
 *
 * This replaces a denominator of `totalTurns` — regulation *plus* extra time.
 * Measured over 120 self-play matches, **no match has ever ended before the
 * cap**; what happened is that a 5-a-side match finishing 2–1 on turn 24 of a
 * 24-turn regulation was labelled `Turn 24 of 32` and read as having stopped
 * eight turns short. The clock was describing a phase most matches never enter
 * as though it were part of the one they were in.
 *
 * Pure, and derived from the rules on the state rather than from the format
 * table, so a saved match's clock reads the way it did when it was played.
 */
export function matchClock(turn: number, rules: MatchRules): MatchClock {
  if (isExtraTime(turn, rules)) {
    const within = turn - rules.turnCap;
    return {
      phase: "extraTime",
      turn: within,
      of: rules.extraTimeTurns,
      label: `Extra time, turn ${within} of ${rules.extraTimeTurns}`,
    };
  }

  /*
   * Past the end of extra time is still reported as the last turn of it rather
   * than as a number nobody can place. A decided match stops on the turn that
   * decided it (see `matchResultAfterTurn`), so this is a guard rather than a
   * state the clock is expected to reach.
   */
  if (turn > rules.turnCap) {
    return {
      phase: "extraTime",
      turn: rules.extraTimeTurns,
      of: rules.extraTimeTurns,
      label: `Extra time, turn ${rules.extraTimeTurns} of ${rules.extraTimeTurns}`,
    };
  }

  return {
    phase: "regulation",
    turn,
    of: rules.turnCap,
    label: `Turn ${turn} of ${rules.turnCap}`,
  };
}
