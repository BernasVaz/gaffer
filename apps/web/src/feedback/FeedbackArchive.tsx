import { FORMAT_PROFILES, type MatchSetup } from "@gaffer/shared";
import { useCallback, useState } from "react";

import { Button } from "../ui/Button";
import {
  forgetSavedMatch,
  listSavedMatches,
  replaySavedMatch,
  rawArchive,
  type SavedMatch,
} from "./archive";
import { downloadFile, pageOrigin } from "./download";
import {
  archiveFilename,
  buildArchiveReport,
  buildReport,
  replayLink,
  reportFilename,
  type ArchiveEntry,
} from "./report";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** How a saved match's date reads, or nothing when the entry predates the field. */
function when(savedAt: number | undefined): string | null {
  if (savedAt === undefined) return null;

  try {
    return new Date(savedAt).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

/** Turn a saved match into something {@link buildReport} can describe. */
const toEntry = (saved: SavedMatch): ArchiveEntry => ({
  setup: saved.setup,
  state: replaySavedMatch(saved).state,
  log: saved.log,
  notes: saved.notes,
});

/** One saved match, and everything that can be done with it. */
function SavedRow({
  saved,
  onOpen,
  onForget,
}: {
  saved: SavedMatch;
  onOpen?: (setup: MatchSetup) => void;
  onForget: (key: string) => void;
}) {
  const profile = FORMAT_PROFILES[saved.setup.mode];
  const [confirming, setConfirming] = useState(false);
  const date = when(saved.savedAt);

  const download = () =>
    downloadFile(
      reportFilename(saved.setup),
      buildReport({ ...toEntry(saved), origin: pageOrigin() }),
      "text/markdown;charset=utf-8",
    );

  return (
    <li className="rounded-xl bg-(--color-panel-raised) p-3 ring-1 ring-(--color-edge)/30">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-bold">{profile.label}</span>
        <span className="rounded-full bg-(--color-gold)/20 px-2 text-[0.7rem] font-extrabold text-(--color-gold) tabular-nums">
          {saved.notes.length} flagged
        </span>
        <span className="text-xs text-white/45 tabular-nums">
          seed {saved.setup.seed} &middot; {saved.log.length} actions
          {date !== null && <> &middot; {date}</>}
        </span>
      </div>

      {saved.notes.length > 0 && (
        <p className="mt-1.5 truncate text-xs text-white/60">
          {saved.notes
            .map((note) => (note.note.trim().length > 0 ? note.note.trim() : "(no words)"))
            .join(" · ")}
        </p>
      )}

      {saved.dropped > 0 && (
        <p className="mt-1.5 text-[0.7rem] text-amber-300/80">
          {saved.dropped} stored item{saved.dropped === 1 ? "" : "s"} could not be read and{" "}
          {saved.dropped === 1 ? "was" : "were"} left out. Use &ldquo;Download raw data&rdquo; to
          keep everything.
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button tone="quiet" className="px-3 py-1.5 text-xs" onClick={download}>
          Report
        </Button>
        {onOpen && (
          <Button tone="quiet" className="px-3 py-1.5 text-xs" onClick={() => onOpen(saved.setup)}>
            Open match
          </Button>
        )}
        <a
          href={replayLink(saved.setup, pageOrigin())}
          className="rounded px-1 text-xs text-white/45 underline underline-offset-2 hover:text-white/75"
        >
          Link
        </a>

        {confirming ? (
          <span className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-white/60">Delete for good?</span>
            <button
              type="button"
              onClick={() => onForget(saved.key)}
              className="rounded bg-rose-500/25 px-2 py-1 font-semibold text-rose-100 ring-1 ring-rose-300/40"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded px-2 py-1 text-white/55"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ml-auto rounded px-2 py-1 text-xs text-white/35 hover:text-rose-200"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

export interface FeedbackArchiveProps {
  /** Reopen a saved match. Omitted where there is nowhere to open it into. */
  onOpen?: (setup: MatchSetup) => void;
  /** How loud the button should be. */
  tone?: "primary" | "quiet";
  /** Extra classes for the button, for placing it in a row. */
  className?: string;
}

/**
 * Every note this device has ever saved, and the way to get them out.
 *
 * The gap this closes: notes are stored per match, under a key built from the
 * whole setup, and until now the only thing that could reach one was the match
 * it belonged to. Flag three things, start a new match, and the first three
 * were still on disk with nothing in the interface able to open them. A tester
 * who does not finish a match loses nothing now, and never did — what they
 * lost was the door.
 *
 * It is a scan rather than an index because an index is a second thing to keep
 * true. The keys already carry the whole setup, and reading them back is cheap
 * enough to do on open.
 *
 * Everything here is local. Nothing is sent anywhere; the file is the handover.
 */
export function FeedbackArchive({ onOpen, tone = "quiet", className }: FeedbackArchiveProps) {
  const [open, setOpen] = useState(false);
  /* Read when the panel opens rather than on mount, so it cannot show a list
     that went stale while somebody played four more matches behind it. */
  const [saved, setSaved] = useState<SavedMatch[]>([]);

  const refresh = useCallback(() => setSaved(listSavedMatches()), []);

  const show = () => {
    refresh();
    setOpen(true);
  };

  const forget = (key: string) => {
    forgetSavedMatch(key);
    refresh();
  };

  const downloadEverything = () =>
    downloadFile(
      archiveFilename(),
      buildArchiveReport(saved.map(toEntry), pageOrigin()),
      "text/markdown;charset=utf-8",
    );

  const downloadRaw = () =>
    downloadFile(
      `gaffer-feedback-raw-${new Date().toISOString().slice(0, 10)}.json`,
      rawArchive(),
      "application/json",
    );

  const total = saved.reduce((sum, match) => sum + match.notes.length, 0);

  return (
    <>
      <Button
        tone={tone}
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cx("flex items-center gap-2", className)}
      >
        My feedback
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-heading"
            className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-2xl bg-(--color-panel) p-4 shadow-2xl ring-1 ring-(--color-edge)/50"
          >
            <h2 id="archive-heading" className="text-base font-bold">
              My feedback
            </h2>
            <p className="mt-0.5 mb-3 text-xs text-white/50">
              {saved.length === 0
                ? "Saved on this device only — nothing is sent anywhere."
                : `${total} flagged moment${total === 1 ? "" : "s"} across ${saved.length} match${
                    saved.length === 1 ? "" : "es"
                  }. Saved on this device only.`}
            </p>

            {saved.length === 0 ? (
              <p className="rounded-xl bg-(--color-panel-raised) p-4 text-sm text-white/60">
                Nothing saved yet. Flag a moment during a match &mdash; the button, or the{" "}
                <kbd className="rounded border border-white/20 px-1 text-[0.7rem] font-bold">F</kbd>{" "}
                key &mdash; and it will show up here.
                <br />
                <span className="mt-2 block text-xs text-white/40">
                  Notes live in this browser. A different browser, a private window, or cleared site
                  data will each look empty.
                </span>
              </p>
            ) : (
              <ul className="-mx-1 flex flex-col gap-2 overflow-y-auto px-1">
                {saved.map((match) => (
                  <SavedRow key={match.key} saved={match} onOpen={onOpen} onForget={forget} />
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
              {saved.length > 0 && (
                <>
                  <Button tone="primary" onClick={downloadEverything}>
                    Download everything
                  </Button>
                  <Button tone="quiet" onClick={downloadRaw}>
                    Download raw data
                  </Button>
                </>
              )}
              <Button tone="quiet" className="ml-auto" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
