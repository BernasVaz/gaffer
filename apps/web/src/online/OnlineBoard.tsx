import { useMemo } from "react";

import { Match } from "../match/Match";
import { useRemoteMatch } from "./useRemoteMatch";
import type { Blocked, RemoteMatch } from "./matches";

/** What a stopped match should say, in words somebody can act on. */
function stoppedBecause(blocked: Blocked): string {
  switch (blocked.kind) {
    case "edition":
      return `This match was played under rules edition ${blocked.stored} and this build is on ${blocked.ours}. It is sealed: you can look at it, but neither of you can play on. A rules change ends a match in flight rather than quietly turning it into a different one.`;
    case "desync":
      return `This match diverged at command ${blocked.index} — the engine refused it (${blocked.reason}). Nobody can play on from here, and that is the honest outcome rather than two people looking at different boards.`;
    case "hashMismatch":
      return `This match replays to a different board than the last player saw. It is stopped rather than continued — please send this to us, it is a bug in the game and not in anything you did.`;
  }
}

/** Props for {@link OnlineBoard}. */
export interface OnlineBoardProps {
  /** The match row, freshly read. */
  match: RemoteMatch;
  /** Who is looking at it. */
  userId: string;
  /** The invite, while the second seat is empty. */
  invite?: React.ReactNode;
  /** Leaving the match. */
  onLeave: () => void;
}

/**
 * A match against somebody else, on the ordinary match screen.
 *
 * There is no second board, no second scoreboard and no second full-time
 * report: this hands {@link Match} a controller that happens to be shared and
 * a few extras to draw above the pitch. Everything a player has in a solo match
 * — the portrait pitch, the odds toggle, the duel breakdown, the commentary,
 * flagging a moment, "how was that match?" — is there because it is the same
 * screen, not because it was built twice.
 */
export function OnlineBoard({
  match,
  userId,
  invite,
  onLeave,
}: OnlineBoardProps): React.JSX.Element {
  const controller = useRemoteMatch(match, userId);

  const banner = useMemo(() => {
    const waiting = controller.row.status === "awaiting_opponent";
    const label = waiting
      ? "Waiting for an opponent to join"
      : controller.blocked !== null
        ? "This match is stopped"
        : controller.sending
          ? "Sending your turn…"
          : controller.yours
            ? "Your turn"
            : "Waiting for your opponent";

    return (
      <p
        aria-live="polite"
        data-testid="turn-state"
        className={[
          "shrink-0 rounded-xl px-4 py-2 text-center text-base font-extrabold",
          controller.yours && controller.blocked === null && !waiting
            ? "bg-(--color-gold)/20 text-(--color-gold) ring-1 ring-(--color-gold)/50"
            : "bg-(--color-panel) text-white/75 ring-1 ring-(--color-edge)/35",
        ].join(" ")}
      >
        {label}
      </p>
    );
  }, [controller.row.status, controller.blocked, controller.yours, controller.sending]);

  return (
    <Match
      setup={controller.row.setup}
      onLeave={onLeave}
      online={{
        controller,
        side: controller.side,
        yours: controller.yours,
        stopped: controller.blocked === null ? null : stoppedBecause(controller.blocked),
        sending: controller.sending,
        error: controller.error,
        banner,
        invite,
      }}
    />
  );
}
