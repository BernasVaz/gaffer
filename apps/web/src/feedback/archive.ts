import {
  DuelSchema,
  MatchCommandSchema,
  MatchSetupSchema,
  ScoreSchema,
  TeamSchema,
} from "@gaffer/shared";
import { z } from "zod";

import { buildMatch, type RecordedEvent } from "../match/replay";
import { CATEGORIES, FEEDBACK_KEY_PREFIX, type FeedbackNote, type StoredFeedback } from "./notes";

/** One event of a stored log, validated. */
const RecordedEventSchema = z.object({
  index: z.number().int().min(0),
  command: MatchCommandSchema,
  duel: DuelSchema.nullable(),
  scored: z.boolean(),
  turn: z.number().int().min(0),
  team: TeamSchema,
  score: ScoreSchema,
});

/** One flagged moment, validated. */
const FeedbackNoteSchema = z.object({
  id: z.string(),
  category: z.enum(CATEGORIES),
  note: z.string(),
  actionIndex: z.number().int().min(0),
  turn: z.number().int().min(0),
  score: z.string(),
  activeTeam: z.string(),
  recap: z.array(RecordedEventSchema),
});

/** A match's saved feedback, as the archive hands it out. */
export interface SavedMatch {
  /** The `localStorage` key it came from — the handle for deleting it. */
  key: string;
  /** Which match it was. Enough to reopen it, and enough to replay it. */
  setup: StoredFeedback["setup"];
  /** The commands played, so the match can be rebuilt exactly. */
  log: RecordedEvent[];
  /** The flagged moments. */
  notes: FeedbackNote[];
  /** When it was last written, if the entry is new enough to say. */
  savedAt: number | undefined;
  /** How many stored items were unreadable and left out. */
  dropped: number;
}

/** Whichever elements of an array pass, rather than none of them. */
function keepValid<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
): { kept: z.infer<S>[]; dropped: number } {
  if (!Array.isArray(raw)) return { kept: [], dropped: 0 };

  const kept: z.infer<S>[] = [];
  let dropped = 0;

  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (parsed.success) kept.push(parsed.data);
    else dropped += 1;
  }

  return { kept, dropped };
}

/**
 * Read one stored entry, or null if it is not feedback we can use.
 *
 * Validates item by item rather than all or nothing, and this is the whole
 * design. Storage is untrusted input — hand-edited, written by an older build,
 * half-written by a tab that was closed — and the usual answer of "reject the
 * lot" would mean one malformed note silently throwing away nine good ones.
 * The only thing that must parse outright is the setup, because it is what
 * replays the match and what builds the link.
 */
export function readSavedMatch(key: string, raw: string): SavedMatch | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;

  const setup = MatchSetupSchema.safeParse(record.setup);
  if (!setup.success) return null;

  const log = keepValid(RecordedEventSchema, record.log);
  const notes = keepValid(FeedbackNoteSchema, record.notes);

  return {
    key,
    setup: setup.data,
    log: log.kept,
    notes: notes.kept,
    savedAt: typeof record.savedAt === "number" ? record.savedAt : undefined,
    dropped: log.dropped + notes.dropped,
  };
}

/**
 * Every match on this device that has feedback saved against it.
 *
 * Found by scanning for {@link FEEDBACK_KEY_PREFIX}, because the keys carry the
 * whole setup and there is no index to consult. Newest first, with entries too
 * old to carry a timestamp after them — a list that mostly matches the order
 * they were taken in is worth far more than a strict one that hides the old ones.
 *
 * Never throws. A device with storage blocked has no saved feedback, which is a
 * true and useful answer, not an error.
 */
export function listSavedMatches(): SavedMatch[] {
  const found: SavedMatch[] = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key === null || !key.startsWith(FEEDBACK_KEY_PREFIX)) continue;

      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;

      const entry = readSavedMatch(key, raw);
      if (entry !== null) found.push(entry);
    }
  } catch {
    return found;
  }

  return found.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
}

/** Forget one saved match. Used only when somebody asks for it explicitly. */
export function forgetSavedMatch(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Nothing to do, and nothing worth breaking the page over. */
  }
}

/**
 * The board a saved match ended on, rebuilt from its seed and its commands.
 *
 * The engine is deterministic, so this is the same board the notes were taken
 * against rather than an approximation of it — and it comes from the same
 * {@link buildMatch} the live match uses, so the two cannot drift into
 * describing different games.
 */
export function replaySavedMatch(saved: SavedMatch) {
  return buildMatch({
    seed: saved.setup.seed,
    format: saved.setup.mode,
    actionsPerTurn: saved.setup.actions,
    replay: saved.log.map((event) => event.command),
  });
}

/** Everything in the archive, exactly as it sits in storage. */
export function rawArchive(): string {
  const dump: Record<string, unknown> = {};

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key === null || !key.startsWith(FEEDBACK_KEY_PREFIX)) continue;

      const raw = window.localStorage.getItem(key);
      if (raw === null) continue;

      try {
        dump[key] = JSON.parse(raw);
      } catch {
        // Keep it as text rather than losing it: unreadable to us is not
        // unreadable to the person who has to work out what went wrong.
        dump[key] = raw;
      }
    }
  } catch {
    /* Fall through to whatever was collected. */
  }

  return JSON.stringify(dump, null, 2);
}
