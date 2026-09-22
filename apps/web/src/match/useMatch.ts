import { applyAction, type Rng } from "@gaffer/engine";
import type { MatchCommand, MatchState, Team } from "@gaffer/shared";
import { useCallback, useRef, useState } from "react";

import {
  buildMatch,
  type Built,
  type MatchEvent,
  type MatchOptions,
  type RecordedEvent,
} from "./replay";

/*
 * Re-exported so the rest of the client keeps one place to ask about a match's
 * history. What moved to `replay.ts` moved because the feedback archive needs
 * to rebuild a match nobody is playing, which a hook cannot do.
 */
export type { MatchEvent, MatchOptions, RecordedEvent } from "./replay";

/**
 * What a command did, handed straight back to the caller.
 *
 * Returned synchronously so a click handler can start a presentation — a goal
 * celebration, a duel reveal — knowing what the engine has *already* decided.
 * That is the direction the dependency has to run: presentation reacts to a
 * settled result, and never gets asked to produce one.
 */
export interface PlayOutcome {
  /** The board as it stood when the command was sent. */
  before: MatchState;
  /** The board the engine produced. Already current by the time you read this. */
  after: MatchState;
  /** True when the command put the ball in the net. */
  scored: boolean;
  /** Which side scored, when one did. */
  scorer: Team | null;
}

/** A match in progress, and the one way to move it forward. */
export interface MatchController {
  /** The current board. */
  state: MatchState;
  /** Every command played so far, in order. */
  log: readonly RecordedEvent[];
  /** What the last accepted command did. */
  lastEvent: MatchEvent | null;
  /** Why the last command was refused, if it was. Cleared by the next success. */
  rejection: string | null;
  /**
   * Send a command to the engine.
   *
   * Returns what happened, or null if the command was refused, so the caller can
   * react to a result that is already final.
   */
  play: (command: MatchCommand) => PlayOutcome | null;
  /** Start again from the same seed, discarding the log. */
  restart: () => void;
}

/**
 * Hold a match and step it forward.
 *
 * Everything about the game lives in the engine; this owns what React needs —
 * the current state, the match's seeded generator, and the log of what has been
 * played.
 *
 * The generator is the reason for the care here. `applyAction` advances it, so
 * it must be called **once per click and never during render**: React may render
 * a component twice in development, and a roll consumed by a discarded render
 * would silently desynchronise the match from its own seed. It therefore lives
 * in a ref alongside the state it belongs to, is read only inside the event
 * handler, and the state passed to the engine comes from a ref too so a fast
 * second click cannot act on a stale board.
 *
 * The log is kept for the same reason a match carries its own rules: so the
 * thing can be reproduced later by somebody who was not there.
 */
export function useMatch(options: MatchOptions): MatchController {
  const { seed, format, actionsPerTurn } = options;

  /*
   * Built once, and built *together*. The board and the generator that produced
   * it are a pair — a generator that has rolled a different number of dice from
   * the board beside it is a desynchronised match, which shows up much later as
   * "that replay does not match".
   *
   * A lazy `useState` rather than a ref filled in during render: React keeps
   * exactly one result of an initialiser even when it runs the render twice, so
   * the board, the log and the generator below cannot come from different
   * attempts at building the same match.
   */
  const [built] = useState<Built>(() => buildMatch(options));

  const [state, setState] = useState<MatchState>(built.state);
  const [log, setLog] = useState<readonly RecordedEvent[]>(built.log);
  const [lastEvent, setLastEvent] = useState<MatchEvent | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const stateRef = useRef<MatchState>(built.state);
  const logRef = useRef<RecordedEvent[]>(built.log);
  const rngRef = useRef<Rng>(built.rng);

  const play = useCallback((command: MatchCommand): PlayOutcome | null => {
    const before = stateRef.current;
    const result = applyAction(before, command, rngRef.current);

    if (!result.ok) {
      setRejection(result.reason);
      return null;
    }

    const homeScored = result.state.score.home !== before.score.home;
    const awayScored = result.state.score.away !== before.score.away;
    const scored = homeScored || awayScored;

    const recorded: RecordedEvent = {
      index: logRef.current.length,
      command,
      duel: result.duel,
      scored,
      turn: before.turn,
      team: before.activeTeam,
      score: result.state.score,
    };

    stateRef.current = result.state;
    logRef.current = [...logRef.current, recorded];

    setState(result.state);
    setLog(logRef.current);
    setRejection(null);
    setLastEvent({ command, duel: result.duel, scored });

    return {
      before,
      after: result.state,
      scored,
      scorer: homeScored ? "home" : awayScored ? "away" : null,
    };
  }, []);

  const restart = useCallback(() => {
    const fresh = buildMatch({ seed, format, actionsPerTurn });

    rngRef.current = fresh.rng;
    stateRef.current = fresh.state;
    logRef.current = fresh.log;

    setState(fresh.state);
    setLog(fresh.log);
    setLastEvent(null);
    setRejection(null);
  }, [seed, format, actionsPerTurn]);

  return { state, log, lastEvent, rejection, play, restart };
}
