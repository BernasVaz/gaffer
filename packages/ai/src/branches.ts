import { applyAction, previewDuel, type Rng } from "@gaffer/engine";
import { DUEL_DIE_SIDES, type MatchCommand, type MatchState } from "@gaffer/shared";

/**
 * One way an action could turn out, and how likely it is.
 *
 * A contested action has two: the attacker wins, or it does not. An uncontested
 * one has a single certainty. The probabilities of a command's outcomes always
 * sum to 1.
 */
export interface Outcome {
  /** Exact probability of this branch, from the engine's own duel odds. */
  probability: number;
  /** The board this branch produces. */
  state: MatchState;
}

/** Which side of a duel a forced generator is rigged to favour. */
type Favour = "attacker" | "defender";

/**
 * A generator whose dice are decided in advance rather than rolled.
 *
 * The opponent needs to see *both* sides of a duel before it commits to one, and
 * the engine only exposes outcomes through {@link applyAction}. Rather than
 * re-implement what a won dribble does to the board — which would put a second
 * copy of the rules in this package, the one thing the architecture forbids —
 * the search hands the engine a generator that returns the extreme die for each
 * roller in turn and reads the board that comes back.
 *
 * `applyAction` rolls the attacker's die first and the defender's second, so
 * alternating on the call count is enough to rig a duel either way. Forcing the
 * attacker to its highest and the defender to its lowest produces the win branch
 * whenever the duel can be won at all; reversing it produces the loss branch.
 * Because a duel is decided purely by which total is larger, no other outcome is
 * reachable, so these two branches are exhaustive.
 *
 * This is a scratch generator, never the match's. It is created, read and thrown
 * away inside a single search, so nothing the opponent considers can disturb the
 * dice of the match actually being played.
 */
function riggedRng(favour: Favour): Rng {
  let calls = 0;

  const value = (min: number, max: number): number => {
    const attackersTurn = calls % 2 === 0;
    calls += 1;
    const high = favour === "attacker" ? attackersTurn : !attackersTurn;
    return high ? max : min;
  };

  return {
    next: () => (value(0, DUEL_DIE_SIDES - 1) + 0.5) / DUEL_DIE_SIDES,
    int: value,
    state: () => calls,
  };
}

/**
 * Play `command` out both ways and report what each is worth.
 *
 * The odds come from {@link previewDuel}, which is the same number the board
 * shows a human before they commit — so the opponent reasons about exactly the
 * information the rules promise both sides, and never about a roll that has
 * already happened.
 *
 * Returns an empty list when the engine refuses the command, which lets a caller
 * treat "illegal" and "worthless" the same way rather than having to pre-check.
 *
 * @param state - The board to act on. Not modified.
 * @param command - The command to explore.
 * @returns One outcome for an uncontested command, two for a contested one, or
 *   none if the command was refused.
 */
export function outcomesOf(state: MatchState, command: MatchCommand): Outcome[] {
  const chance = command.type === "endTurn" ? 1 : (previewDuel(state, command)?.winChance ?? 1);

  const branch = (favour: Favour): MatchState | null => {
    const result = applyAction(state, command, riggedRng(favour));
    return result.ok ? result.state : null;
  };

  if (chance >= 1) {
    const won = branch("attacker");
    return won ? [{ probability: 1, state: won }] : [];
  }

  if (chance <= 0) {
    const lost = branch("defender");
    return lost ? [{ probability: 1, state: lost }] : [];
  }

  const won = branch("attacker");
  const lost = branch("defender");
  if (!won || !lost) return [];

  return [
    { probability: chance, state: won },
    { probability: 1 - chance, state: lost },
  ];
}
