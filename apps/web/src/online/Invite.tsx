import { useCallback, useState } from "react";

/** The invite link for a match, in the shape the app already reads. */
export function inviteLink(matchId: string): string {
  const url = new URL(window.location.href);
  url.search = `?online=1&match=${matchId}`;
  return url.toString();
}

/** Props for {@link InviteSheet}. */
export interface InviteSheetProps {
  /** The match whose seat is still empty. */
  matchId: string;
  /** Put the sheet away. */
  onClose: () => void;
}

/**
 * Sending the link, as a sheet **over** the board rather than a panel above it.
 *
 * It used to stack — a heading, a button, the raw link and a paragraph — in the
 * column that the pitch takes what is left of, so the person who created the
 * match played on a board two-thirds the size of their opponent's. Nothing is
 * allowed to take height from the pitch (ADR 0036), and an invite is the
 * clearest case for the rule: it is needed once, for about fifteen seconds, and
 * then never again.
 *
 * It opens by itself on a new match, because sending the link is the only thing
 * there is to do until somebody joins, and closes to a compact **Share** button
 * in the turn banner.
 *
 * `navigator.share` opens the sheet somebody already sends things with, which on
 * a phone is the difference between an invite being sent and a long URL being
 * squinted at. It does not exist on most desktop browsers, so copying is the
 * fallback and the raw link is always on screen — a tester who can get neither
 * to work can still select it by hand.
 */
export function InviteSheet({ matchId, onClose }: InviteSheetProps): React.JSX.Element {
  const link = inviteLink(matchId);
  const [copied, setCopied] = useState(false);

  const share = useCallback(async () => {
    const sheet = navigator.share?.bind(navigator);
    if (sheet !== undefined) {
      try {
        await sheet({ title: "Gaffer", text: "Your move.", url: link });
        return;
      } catch {
        /* Dismissed, or refused. Fall through to copying. */
      }
    }

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* No clipboard permission: the link is on screen to be copied by hand. */
    }
  }, [link]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 p-3">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Invite"
        className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/50"
      >
        <h2 className="text-sm font-extrabold text-white">Send this to your opponent</h2>

        <button
          type="button"
          onClick={() => void share()}
          className="chunky rounded-xl bg-(--color-gold) px-4 py-3 font-extrabold text-black"
        >
          {copied ? "Copied" : "Share the link"}
        </button>

        <input
          readOnly
          aria-label="Invite link"
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-white/80 ring-1 ring-(--color-edge)/40"
        />

        {/*
          The link is a bearer capability and the copy has to say so: there is no
          per-invite token in Phase 1, so whoever opens it first takes the seat
          (docs/SECURITY.md). It stays in the sheet, beside the button that sends
          it, which is the moment it is worth reading.
        */}
        <p className="text-xs text-white/60">
          Anyone who opens this link takes the second seat — the first person to open it is your
          opponent. Send it to one person.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white/70 ring-1 ring-(--color-edge)/40"
        >
          Done
        </button>
      </section>
    </div>
  );
}
