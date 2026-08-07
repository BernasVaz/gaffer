import { applyAction, createInitialState, createRng, type Rng } from "@gaffer/engine";
import { parseSeed, type Duel, type MatchCommand, type MatchState } from "@gaffer/shared";
import { useCallback, useRef, useState } from "react";

/** What the last accepted command did, for the status line. */
export interface MatchEvent {
  /** The command that was played. */
  command: MatchCommand;
  /** The duel it provoked, or null when nothing was contested. */
  duel: Duel | null;
  /** True when it put the ball in the net. */
  scored: boolean;
}

/** A match in progress, and the one way to move it forward. */
export interface MatchController {
  /** The current board. */
  state: MatchState;
  /** What the last accepted command did. */
  lastEvent: MatchEvent | null;
  /** Why the last command was refused, if it was. Cleared by the next success. */
  rejection: string | null;
  /** Send a command to the engine. */
  play: (command: MatchCommand) => void;
  /** Start again from the same seed. */
  restart: () => void;
}

/**
 * Hold a match and step it forward.
 *
 * Everything about the game lives in the engine; this owns exactly two things
 * React needs — the current state and the match's seeded generator.
 *
 * The generator is the reason for the care here. `applyAction` advances it, so
 * it must be called **once per click and never during render**: React may render
 * a component twice in development, and a roll consumed by a discarded render
 * would silently desynchronise the match from its own seed. It therefore lives
 * in a ref, is read only inside the event handler, and the state passed to the
 * engine comes from a ref too so a fast second click cannot act on a stale board.
 *
 * Both sides are played from this one controller: hotseat, so whoever is to move
 * is whoever the person at the keyboard is currently commanding.
 */
export function useMatch(seed: number): MatchController {
  const initial = () => createInitialState();

  const [state, setState] = useState<MatchState>(initial);
  const [lastEvent, setLastEvent] = useState<MatchEvent | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const stateRef = useRef<MatchState>(state);
  const rngRef = useRef<Rng | null>(null);
  rngRef.current ??= createRng(parseSeed(seed));

  const play = useCallback((command: MatchCommand) => {
    const before = stateRef.current;
    const rng = rngRef.current;
    if (!rng) return;

    const result = applyAction(before, command, rng);

    if (!result.ok) {
      setRejection(result.reason);
      return;
    }

    stateRef.current = result.state;
    setState(result.state);
    setRejection(null);
    setLastEvent({
      command,
      duel: result.duel,
      scored:
        result.state.score.home !== before.score.home ||
        result.state.score.away !== before.score.away,
    });
  }, []);

  const restart = useCallback(() => {
    const fresh = createInitialState();
    rngRef.current = createRng(parseSeed(seed));
    stateRef.current = fresh;
    setState(fresh);
    setLastEvent(null);
    setRejection(null);
  }, [seed]);

  return { state, lastEvent, rejection, play, restart };
}
