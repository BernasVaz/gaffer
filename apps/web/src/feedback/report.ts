import { FORMAT_PROFILES, setupToQuery, type MatchSetup, type MatchState } from "@gaffer/shared";

import { describeEvent } from "../match/describe";
import type { RecordedEvent } from "../match/useMatch";
import { CATEGORY_COPY, type FeedbackNote } from "./notes";

/** What a report needs to know about the match it is describing. */
export interface ReportInput {
  /** The setup, which is also the link. */
  setup: MatchSetup;
  /** The finished (or abandoned) board. */
  state: MatchState;
  /** Everything played. */
  log: readonly RecordedEvent[];
  /** The flagged moments, in the order they were taken. */
  notes: readonly FeedbackNote[];
  /** Where the match can be reopened — the page's own address, without a query. */
  origin: string;
}

/** A link that reopens this match, optionally wound to a given action. */
export function replayLink(setup: MatchSetup, origin: string, actionIndex?: number): string {
  const query = setupToQuery(setup);
  return `${origin}${query}${actionIndex === undefined ? "" : `&replayTo=${actionIndex}`}`;
}

/** How the match ended, in a phrase. */
function outcome(state: MatchState): string {
  const { result } = state;
  if (result === null) return "abandoned before the end";

  const shootout = result.shootout
    ? ` (penalties ${result.shootout.home}–${result.shootout.away})`
    : "";
  return `${result.winner} win, decided by ${result.decidedBy}${shootout}`;
}

/**
 * Turn a match and its flagged moments into something a person can act on.
 *
 * Markdown rather than JSON, because the audience is a reader first: the notes
 * are prose, the run-up to each one is prose, and the machine-readable part —
 * the move log — sits at the bottom where it does not get in the way.
 *
 * Every note carries the three things needed to reproduce it: the seed, the
 * setup, and an index into the log. The engine is deterministic, so those three
 * name an exact board. The log is included in full for the same reason; a
 * pointer into a history nobody has is not a pointer.
 */
export function buildReport({ setup, state, log, notes, origin }: ReportInput): string {
  const profile = FORMAT_PROFILES[setup.mode];
  const lines: string[] = [];

  const push = (...text: string[]) => lines.push(...text);

  push(`# Gaffer feedback — ${profile.label}, seed ${setup.seed}`, "");

  push(
    "| | |",
    "| --- | --- |",
    `| Game type | ${profile.label} (${profile.board.width}×${profile.board.height}, ${profile.shape})${
      profile.status === "alpha" ? " — **alpha**" : ""
    } |`,
    `| Playing | ${
      setup.play === "solo"
        ? `Solo, as ${setup.side}, against the ${setup.difficulty} opponent`
        : "Hotseat"
    } |`,
    `| Actions per turn | ${setup.actions}${
      setup.actions === profile.rules.actionsPerTurn ? " (the default)" : " (changed)"
    } |`,
    `| Seed | \`${setup.seed}\` |`,
    `| Final score | ${state.score.home}–${state.score.away} |`,
    `| Outcome | ${outcome(state)} |`,
    `| Length | turn ${state.turn} · ${log.length} actions |`,
    `| Match link | ${replayLink(setup, origin)} |`,
    "",
  );

  if (notes.length === 0) {
    push("No moments were flagged during this match.", "");
  } else {
    push(`**${notes.length} flagged moment${notes.length === 1 ? "" : "s"}.**`, "", "---", "");
  }

  notes.forEach((note, position) => {
    const { label } = CATEGORY_COPY[note.category];

    push(
      `## ${position + 1} · ${label} — turn ${note.turn}, action ${note.actionIndex}`,
      "",
      `Score ${note.score}, ${note.activeTeam} to play.`,
      "",
    );

    push(
      note.note.trim().length === 0
        ? "_Flagged without a note._"
        : note.note
            .trim()
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
      "",
    );

    push("**What had just happened**", "");
    if (note.recap.length === 0) {
      push("_Nothing yet — this was flagged before the first action._", "");
    } else {
      push(...note.recap.map((event) => `- ${describeEvent(event, state)}`), "");
    }

    push(
      "**Repro**",
      "",
      `- Seed \`${setup.seed}\`, ${setup.mode}, ${setup.actions} actions a turn, ` +
        `play \`${setup.play}\`` +
        (setup.play === "solo" ? `, as ${setup.side} against ${setup.difficulty}` : ""),
      `- Replay to action \`${note.actionIndex}\` of ${log.length}`,
      `- ${replayLink(setup, origin, note.actionIndex)}`,
      "",
      "---",
      "",
    );
  });

  push(
    "## The move log",
    "",
    "Every command, in order. A seed and this list replay the match exactly — the",
    "engine is deterministic, so action `N` above is this list's first `N` entries.",
    "",
    "```json",
    JSON.stringify(
      log.map((event) => event.command),
      null,
      0,
    ),
    "```",
    "",
  );

  return lines.join("\n");
}

/** A filename that sorts sensibly and says what it is. */
export function reportFilename(setup: MatchSetup): string {
  return `gaffer-feedback-${setup.mode}-seed${setup.seed}.md`;
}
