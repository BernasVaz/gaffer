import type { MatchSetup, MatchState } from "@gaffer/shared";
import { useCallback, useEffect, useState } from "react";

import type { RecordedEvent } from "../match/useMatch";
import {
  clearFeedback,
  loadFeedback,
  RECAP_LENGTH,
  saveFeedback,
  type Category,
  type FeedbackNote,
} from "./notes";

/** The board as it stood when somebody reached for the button. */
export type Captured = Omit<FeedbackNote, "id" | "category" | "note">;

/** What {@link useFeedback} needs to know. */
export interface FeedbackOptions {
  /** The match being played — also the storage key and the link. */
  setup: MatchSetup;
  /** The live board, read only when a moment is flagged. */
  state: MatchState;
  /** The match history, which is what makes a note reproducible. */
  log: readonly RecordedEvent[];
  /**
   * Whether to write anything back.
   *
   * False while a match has been wound back to an earlier action. That match's
   * log diverges from the one on disk the moment anything is played, so saving
   * it would leave every note from the real session pointing at an action that
   * no longer exists. A rewind is a place to look, not a session to continue —
   * the notes are still readable and still go into a report, they just do not
   * overwrite the ones that produced them.
   */
  persist?: boolean;
}

/** Flagged moments, and the ways to add to them. */
export interface FeedbackController {
  /** Every note taken this match, oldest first. */
  notes: readonly FeedbackNote[];
  /**
   * Take a snapshot of the board right now.
   *
   * Separate from {@link FeedbackController.commit} on purpose. Somebody who
   * presses the button and then spends thirty seconds writing is describing the
   * thing that made them reach for it, not whatever the board has drifted to by
   * the time they finish — and in a solo match it *will* have drifted, because
   * the opponent is on a timer.
   */
  capture: () => Captured;
  /** File a snapshot, with what was written about it. */
  commit: (captured: Captured, category: Category, note: string) => void;
  /** Remove one, for a note taken by accident. */
  discard: (id: string) => void;
  /** Throw the lot away — used when a match is restarted from scratch. */
  reset: () => void;
  /**
   * Commands restored from a previous visit, or undefined if there were none.
   *
   * Read once, at mount. A match that has notes against it has to come back as
   * *that* match, or every note's action index points at a board that never
   * existed.
   */
  restored: readonly RecordedEvent[] | undefined;
}

/** Ids only have to be unique within one report, and readable helps. */
let counter = 0;
const nextId = () => `note-${(counter += 1)}`;

/**
 * Keep the flagged moments for a match, and keep them across a refresh.
 *
 * The persistence is the interesting part. Notes alone are not enough: a note
 * says "action 13 of this match", so if a refresh started a fresh match the
 * note would point at a board that never existed. The log is therefore stored
 * with them, and `restored` hands it back so the match can be replayed into
 * exactly the position it was in — which the engine supports for free, being
 * deterministic from a seed and a list of commands.
 *
 * Nothing here touches the engine, and nothing here can change a result. It
 * reads a board and writes text.
 */
export function useFeedback({
  setup,
  state,
  log,
  persist = true,
}: FeedbackOptions): FeedbackController {
  /* Read once, at mount. A lazy initialiser rather than a ref: this runs during
     render, and a ref written during render is a ref that can disagree with the
     state beside it. */
  const [stored] = useState(() => loadFeedback(setup));
  const [notes, setNotes] = useState<readonly FeedbackNote[]>(stored?.notes ?? []);

  /*
   * Written whenever there is something worth keeping, and not before. A match
   * nobody has flagged anything in does not need to touch storage at all, which
   * keeps the common case free of a write per action.
   */
  useEffect(() => {
    if (!persist || notes.length === 0) return;
    saveFeedback({ version: 1, setup, log: [...log], notes: [...notes] });
  }, [notes, log, setup, persist]);

  /* Depends on the live board and log rather than reading them through refs.
     It is only ever called from a click or a keystroke, so being rebuilt each
     render costs nothing and removes a way for it to read a stale board. */
  const capture = useCallback(
    (): Captured => ({
      actionIndex: log.length,
      turn: state.turn,
      score: `${state.score.home}–${state.score.away}`,
      activeTeam: state.activeTeam,
      recap: log.slice(-RECAP_LENGTH),
    }),
    [state, log],
  );

  const commit = useCallback((captured: Captured, category: Category, note: string) => {
    setNotes((current) => [...current, { ...captured, id: nextId(), category, note }]);
  }, []);

  const discard = useCallback((id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id));
  }, []);

  const reset = useCallback(() => {
    setNotes([]);
    clearFeedback(setup);
  }, [setup]);

  return { notes, capture, commit, discard, reset, restored: stored?.log };
}
