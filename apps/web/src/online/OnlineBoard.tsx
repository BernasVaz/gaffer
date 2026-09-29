import { useMemo, useState } from "react";

import { Button } from "../ui/Button";
import { Match } from "../match/Match";
import { InviteSheet } from "./Invite";
import { useOpponentName } from "./opponent";
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
export function OnlineBoard({ match, userId, onLeave }: OnlineBoardProps): React.JSX.Element {
  const controller = useRemoteMatch(match, userId);
  const opponent = useOpponentName(controller.row, userId);

  /*
   * Whether the seat is still empty is asked of the **live** row, not of the one
   * the lobby read before handing the match over. That row never hears about the
   * join, so the invite outlived it: two people played a whole match with a dead
   * link and a paragraph about it wedged above one of their boards.
   */
  const open = controller.row.awayUser === null;

  /* Derived, not stored: the sheet is gone the moment the seat is taken,
     because there is no state that could still say otherwise. */
  const [dismissed, setDismissed] = useState(false);
  const sheet = open && !dismissed;

  /*
   * Whose move it is, in the reader's words. It goes into the scoreboard line
   * that already answers the question, rather than a bar of its own above the
   * pitch — see ADR 0036 and {@link Scoreboard}.
   */
  const status = useMemo(() => {
    const waiting = controller.row.status === "awaiting_opponent";
    const yours = controller.yours && controller.blocked === null && !waiting;

    const label = waiting
      ? "Waiting for an opponent"
      : controller.blocked !== null
        ? "This match is stopped"
        : controller.state.result !== null
          ? "Match over"
          : controller.sending
            ? "Sending your turn\u2026"
            : controller.yours
              ? "Your turn"
              : "Waiting for your opponent";

    return { label, urgent: yours };
  }, [
    controller.row.status,
    controller.blocked,
    controller.yours,
    controller.sending,
    controller.state.result,
  ]);

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
        status,
        opponent,
        invite: sheet ? (
          <InviteSheet matchId={controller.row.id} onClose={() => setDismissed(true)} />
        ) : undefined,
        /* Getting the sheet back is a rare thing to want and a permanent thing
           to have on screen, so it lives where rare controls live. */
        more: open ? (
          <Button tone="quiet" className="px-3 py-1.5 text-sm" onClick={() => setDismissed(false)}>
            Share invite
          </Button>
        ) : undefined,
      }}
    />
  );
}
