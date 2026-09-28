import type { MatchSetup } from "@gaffer/shared";
import { RULES_VERSION } from "@gaffer/shared";

/** What a piece of feedback is about. */
export type FeedbackKind = "note" | "match" | "bug";

/** One piece of feedback, waiting to be sent or already on its way. */
export interface Submission {
  /** Ours, so a queued item can be de-duplicated across flushes. */
  id: string;
  kind: FeedbackKind;
  /** What the tester wrote. Often empty, which is still signal. */
  body: string;
  /** One tap, when they gave one. */
  rating?: number;
  /** Everything they should not have to type. */
  meta: Record<string, unknown>;
}

/** Where unsent feedback waits. */
const QUEUE_KEY = "gaffer:feedback:outbox";

/**
 * The build this is, as the deploy stamps it.
 *
 * A tester's report is worth much less without it: "the board was invisible" is
 * a different conversation depending on whether they were on the freeze that
 * had that bug. Falls back to `dev` so a local build says so rather than
 * claiming to be a release.
 */
export const BUILD_TAG = import.meta.env.VITE_BUILD_TAG ?? "dev";

/**
 * Everything about the moment that the page already knows.
 *
 * The whole design of this is that a tester types at most a sentence. Asking
 * somebody mid-match which seed they are on, what edition the rules are, and
 * which build they downloaded is asking them to do the computer's job — and
 * what you get back is a sentence with none of it.
 */
export function contextOf(options: {
  setup: MatchSetup;
  turn?: number;
  score?: string;
  actionIndex?: number;
  matchId?: string | null;
}): Record<string, unknown> {
  const { setup, turn, score, actionIndex, matchId } = options;

  return {
    seed: setup.seed,
    mode: setup.mode,
    play: setup.play,
    side: setup.side,
    level: setup.difficulty,
    actions: setup.actions,
    rulesVersion: RULES_VERSION,
    build: BUILD_TAG,
    ...(matchId != null ? { matchId } : {}),
    ...(turn !== undefined ? { turn } : {}),
    ...(score !== undefined ? { score } : {}),
    ...(actionIndex !== undefined ? { actionIndex } : {}),
    ...device(),
  };
}

/** The device and how it is set up, as far as the page can tell. */
function device(): Record<string, unknown> {
  try {
    return {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      theme: window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
      language: navigator.language,
    };
  } catch {
    /* A headless or hardened browser can refuse any of these. Feedback without
       a user agent is still feedback. */
    return {};
  }
}

/** Read the outbox, tolerating anything that is not an outbox. */
function readQueue(): Submission[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Submission[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: readonly Submission[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* Storage full or blocked. The note is still in the match's own saved
       feedback and still in the report a tester can download, so nothing is
       lost that was not already lost. */
  }
}

/** How many pieces of feedback are waiting to be sent. */
export function queued(): number {
  return readQueue().length;
}

/**
 * Send one piece of feedback, or keep it until it can be sent.
 *
 * Returns whether it went. **A `false` is not a failure to handle** — it means
 * the item is in the outbox and will go on the next flush, which is what makes
 * a tunnel or a flaky café network a non-event rather than lost feedback.
 *
 * A build without multiplayer has no Supabase client at all, so nothing is sent
 * and everything queues; the Markdown download remains the way feedback leaves
 * such a build, exactly as before.
 */
export async function submit(item: Omit<Submission, "id">): Promise<boolean> {
  const entry: Submission = { ...item, id: crypto.randomUUID() };
  const sent = await send([entry]);
  if (!sent) writeQueue([...readQueue(), entry]);
  return sent;
}

/**
 * Try the outbox.
 *
 * Called when the page loads and whenever the browser says it is back online.
 * Silent either way: a tester who has moved on should not be told about the
 * plumbing behind a note they wrote twenty minutes ago.
 */
export async function flush(): Promise<number> {
  const waiting = readQueue();
  if (waiting.length === 0) return 0;

  const sent = await send(waiting);
  if (sent) writeQueue([]);
  return sent ? waiting.length : 0;
}

/** Start flushing: once now, and again whenever the network comes back. */
export function watchForConnection(): () => void {
  void flush();
  const onOnline = () => void flush();
  window.addEventListener("online", onOnline);
  return () => window.removeEventListener("online", onOnline);
}

/**
 * Put rows in the table, if this build can.
 *
 * The Supabase client is reached through a **dynamic import behind the
 * build-time flag**, which is not a style choice: a static import would pull
 * the client into the main bundle of a build with multiplayer off, and the
 * bundle-isolation gate (docs/SECURITY.md, G2) would fail — correctly, because
 * that is exactly the leak it exists to catch.
 */
async function send(items: readonly Submission[]): Promise<boolean> {
  if (import.meta.env.VITE_ASYNC_MULTIPLAYER !== "true") return false;

  try {
    const { supabase } = await import("../online/client");
    const db = supabase();
    if (db === null) return false;

    /* Feedback needs an identity because the row is keyed to one, and an
       anonymous one is free — the same session multiplayer uses, so a tester
       who has played online is already signed in. */
    const existing = await db.auth.getSession();
    let author = existing.data.session?.user.id ?? null;

    if (author === null) {
      const { data, error } = await db.auth.signInAnonymously();
      if (error !== null) return false;
      author = data.user?.id ?? null;
    }
    if (author === null) return false;

    const { error } = await db.from("feedback").insert(
      items.map((item) => ({
        author,
        kind: item.kind,
        body: item.body.slice(0, 4000),
        rating: item.rating ?? null,
        meta: item.meta,
      })),
    );

    return error === null;
  } catch {
    /* Offline, blocked, or the project is unreachable. The caller queues. */
    return false;
  }
}
