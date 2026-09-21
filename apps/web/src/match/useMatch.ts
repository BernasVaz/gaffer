import { applyAction, createInitialState, createRng, type Rng } from "@gaffer/engine";
import {
  parseSeed,
  type Duel,
  type MatchCommand,
  type MatchFormat,
  type MatchState,
  type Score,
  type Team,
} from "@gaffer/shared";
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

/**
 * One command, and everything about the moment it was played.
 *
 * The match's own history. It exists for two reasons that turn out to be the
 * same reason: a flagged moment has to be able to say *what had just happened*,
 * and a seed plus this list replays the match exactly — which is what makes a
 * flagged moment reproducible by somebody who was not there.
 */
export interface RecordedEvent extends MatchEvent {
  /** Position in the log, counting from zero. This is the replay pointer. */
  index: number;
  /** The turn it was played on. */
  turn: number;
  /** The side that played it. */
  team: Team;
  /** The scoreline once it had resolved. */
  score: Score;
}

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

/** What a match is: a seed, a game type, an economy, and a history. */
export interface MatchOptions {
  /** The match seed. Every die comes from it. */
  seed: number;
  /** Which game type. */
  format: MatchFormat;
  /** Actions a turn grants. */
  actionsPerTurn: number;
  /**
   * Commands to replay before handing the match over.
   *
   * This is how a refresh keeps its place and how a replay pointer works: the
   * engine is deterministic, so a seed and a list of commands reconstitute a
   * match exactly, including every die that was rolled along the way.
   *
   * A command the engine refuses stops the replay rather than failing it. A
   * stored log can outlive the rules that produced it, and half a match is a
   * better answer than a blank page.
   */
  replay?: readonly MatchCommand[];
}

/** Everything a freshly built or replayed match needs to carry. */
interface Built {
  /** The board after any replay. */
  state: MatchState;
  /** The generator, advanced past every replayed command. */
  rng: Rng;
  /** The history that produced it. */
  log: RecordedEvent[];
}

/** Build a match, replaying `replay` through it if there is any. */
function buildMatch({ seed, format, actionsPerTurn, replay }: MatchOptions): Built {
  const rng = createRng(parseSeed(seed));
  let state = createInitialState({ format, rules: { actionsPerTurn } });
  const log: RecordedEvent[] = [];

  for (const command of replay ?? []) {
    const result = applyAction(state, command, rng);
    if (!result.ok) break;

    const scored =
      result.state.score.home !== state.score.home || result.state.score.away !== state.score.away;

    log.push({
      index: log.length,
      command,
      duel: result.duel,
      scored,
      turn: state.turn,
      team: state.activeTeam,
      score: result.state.score,
    });
    state = result.state;
  }

  return { state, rng, log };
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
