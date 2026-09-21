import type { MatchSetup } from "@gaffer/shared";

import type { RecordedEvent } from "../match/useMatch";

/** The kinds of thing a flagged moment can be. */
export const CATEGORIES = ["bug", "confusing", "balance", "ux", "idea"] as const;

/** A validated category. See {@link CATEGORIES}. */
export type Category = (typeof CATEGORIES)[number];

/** How each category is offered, and what it is for. */
export const CATEGORY_COPY: Readonly<Record<Category, { label: string; hint: string }>> = {
  bug: { label: "Bug", hint: "It did something wrong" },
  confusing: { label: "Confusing", hint: "I could not tell what was going on" },
  balance: { label: "Balance", hint: "It worked, but it felt off" },
  ux: { label: "UX", hint: "Awkward to do" },
  idea: { label: "Idea", hint: "Something it should do" },
};

/** How many events of run-up a note carries with it. */
export const RECAP_LENGTH = 8;

/**
 * A flagged moment: what somebody said, and exactly where they said it.
 *
 * The note is the easy half. The rest is the half that makes it actionable —
 * a complaint about a match nobody can reconstruct is an anecdote, and a
 * complaint with a seed and an action index is a bug report.
 */
export interface FeedbackNote {
  /** Stable id, so a note can be listed and removed without ambiguity. */
  id: string;
  /** What kind of thing it is. */
  category: Category;
  /** What the player wrote. May be empty — flagging alone is still a signal. */
  note: string;
  /**
   * Where in the log it happened, counting from zero.
   *
   * The whole point: a seed plus this number names an exact board, because the
   * engine replays deterministically from a seed and a list of commands.
   */
  actionIndex: number;
  /** The turn showing at the time. */
  turn: number;
  /** The scoreline at the time, as `home–away`. */
  score: string;
  /** The side to move at the time. */
  activeTeam: string;
  /** The last few events before it, for the recap. */
  recap: RecordedEvent[];
}

/** Everything kept for one match between page loads. */
export interface StoredFeedback {
  /** Schema version, so a stored shape that has moved on can be discarded. */
  version: 1;
  /** The match these notes belong to. */
  setup: MatchSetup;
  /** Every command played, which is what makes the notes reproducible. */
  log: RecordedEvent[];
  /** The notes themselves. */
  notes: FeedbackNote[];
}

/**
 * Where a match's feedback lives.
 *
 * Keyed by the setup rather than by a session, so a refresh finds its own match
 * and two matches cannot overwrite each other's notes. Everything that changes
 * what is played is in the key, which is the same reason it is all in the link.
 */
export function storageKey(setup: MatchSetup): string {
  return `gaffer:feedback:${setup.seed}:${setup.mode}:${setup.play}:${setup.side}:${setup.difficulty}:${setup.actions}`;
}

/**
 * Read a match's feedback back.
 *
 * Returns null for anything it does not recognise rather than throwing. Local
 * storage is untrusted input like any other — it can be edited by hand, written
 * by an older version of this code, or simply unavailable in a private window —
 * and none of those is worth losing a match over.
 */
export function loadFeedback(setup: MatchSetup): StoredFeedback | null {
  try {
    const raw = window.localStorage.getItem(storageKey(setup));
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const stored = parsed as Partial<StoredFeedback>;
    if (stored.version !== 1) return null;
    if (!Array.isArray(stored.log) || !Array.isArray(stored.notes)) return null;

    return { version: 1, setup, log: stored.log, notes: stored.notes };
  } catch {
    return null;
  }
}

/** Write a match's feedback, quietly doing nothing if storage refuses. */
export function saveFeedback(stored: StoredFeedback): void {
  try {
    window.localStorage.setItem(storageKey(stored.setup), JSON.stringify(stored));
  } catch {
    /* Private windows, blocked storage, a full quota. A note that cannot be
       saved is still on screen and still makes it into the report; losing the
       match to an exception would be the worse outcome by far. */
  }
}

/** Forget a match's feedback — used when a match is restarted from scratch. */
export function clearFeedback(setup: MatchSetup): void {
  try {
    window.localStorage.removeItem(storageKey(setup));
  } catch {
    /* As above. */
  }
}
