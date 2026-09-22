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
export interface Built {
  /** The board after any replay. */
  state: MatchState;
  /** The generator, advanced past every replayed command. */
  rng: Rng;
  /** The history that produced it. */
  log: RecordedEvent[];
}

/**
 * Build a match, replaying `replay` through it if there is any.
 *
 * Deliberately outside the hook that made it. Two things need to turn a seed
 * and a list of commands back into a match — the live match, and the feedback
 * archive rebuilding a report for a match nobody is playing — and they must
 * agree exactly, because a report that describes a different board from the one
 * the note was taken on is worse than no report.
 *
 * Pure, and free of React, so the archive can call it without standing up a
 * component and a test can call it without rendering anything.
 */
export function buildMatch({ seed, format, actionsPerTurn, replay }: MatchOptions): Built {
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
