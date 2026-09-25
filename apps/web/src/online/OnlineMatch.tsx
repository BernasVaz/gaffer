import { applyAction, createRng, legalActions } from "@gaffer/engine";
import { FORMAT_PROFILES, type Action, type MatchCommand, type MatchState } from "@gaffer/shared";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Pitch } from "../board/Pitch";
import { NO_TARGETS, targetsFor } from "../board/targets";
import {
  fetchMatch,
  reconstruct,
  submitTurn,
  watchMatch,
  type Blocked,
  type RemoteMatch,
} from "./matches";

/** What a blocked match should say, in words a player can act on. */
function blockedMessage(blocked: Blocked): string {
  switch (blocked.kind) {
    case "edition":
      return `This match was played under rules edition ${blocked.stored} and this build is on ${blocked.ours}. It is sealed: you can look at it, but neither of you can play on. A rules change ends a match in flight rather than quietly turning it into a different one.`;
    case "desync":
      return `This match diverged at command ${blocked.index} — the engine refused it (${blocked.reason}). Nobody can play on from here, and that is the honest outcome rather than two people looking at different boards.`;
    case "hashMismatch":
      return `This match replays to a different board than the last player saw (expected ${blocked.expected}, got ${blocked.actual}). It is stopped rather than continued.`;
  }
}

/** Props for {@link OnlineMatch}. */
export interface OnlineMatchProps {
  /** The match row, freshly read. */
  match: RemoteMatch;
  /** Who is looking at it. */
  userId: string;
}

/**
 * One online match, played a turn at a time.
 *
 * The engine runs **here**, locally, exactly as it does in a hotseat match — the
 * server holds a command log and decides who may append to it (ADR 0028). What
 * this adds over a local match is that a turn is *submitted* rather than simply
 * taken: actions accumulate locally, and the whole turn goes up in one write
 * when it ends.
 *
 * A turn rather than an action, because appending action by action would leave
 * the row in states no engine ever produced — half a turn, the pool part spent,
 * the turn still ours — and every one of those is a board the opponent could
 * load.
 */
export function OnlineMatch({ match, userId }: OnlineMatchProps): React.JSX.Element {
  const [row, setRow] = useState(match);
  const [pending, setPending] = useState<MatchCommand[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * The other side's moves arrive here. Realtime is a **notification, not a
   * source of truth**: the row it carries is reconstructed and checked like any
   * other read, and anything it misses has to be recoverable without it.
   *
   * Hence the read straight after subscribing. There is a gap between this
   * component rendering and the channel reaching SUBSCRIBED, and an opponent
   * quick enough to move inside it would otherwise leave this player waiting
   * for a board that had already changed — which is precisely how this was
   * found, as a flake that reproduced about half the time.
   */
  useEffect(() => {
    const accept = (next: RemoteMatch) => {
      setRow((current) => (next.logVersion >= current.logVersion ? next : current));
      setPending([]);
      setSelectedId(null);
    };

    const refresh = () => {
      void fetchMatch(match.id).then((fresh) => {
        if (fresh !== null) accept(fresh);
      });
    };

    const stop = watchMatch(match.id, accept);
    refresh();

    /*
     * Realtime is an enhancement, and it has to survive being treated as one.
     * A dropped event in a game where a missed message means "wait forever" is
     * not a glitch, it is a stuck match — and a phone backgrounding the tab
     * will drop the socket as a matter of routine.
     *
     * So: read again whenever the tab comes back, and slowly on a timer. The
     * timer is deliberately lazy, because it exists to unstick a match rather
     * than to deliver moves.
     */
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(refresh, 20_000);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [match.id]);

  const { state: confirmed, blocked } = useMemo(() => reconstruct(row), [row]);

  /* The board as it looks with this turn's un-sent actions played onto it. */
  const local = useMemo(() => {
    const profile = FORMAT_PROFILES[row.setup.mode];
    let board: MatchState = confirmed;
    const rng = createRng(row.setup.seed + row.commandLog.length);
    void profile;

    for (const command of pending) {
      const played = applyAction(board, command, rng);
      if (!played.ok) break;
      board = played.state;
    }
    return board;
  }, [confirmed, pending, row]);

  const yours = row.turnOwner === userId && blocked === null && row.status === "in_play";
  const side = row.homeUser === userId ? "home" : "away";
  const targets = useMemo(
    () => (yours && selectedId !== null ? targetsFor(local, selectedId) : NO_TARGETS),
    [yours, selectedId, local],
  );

  const commit = useCallback((action: Action) => {
    setPending((queued) => [...queued, action as MatchCommand]);
    setSelectedId(null);
  }, []);

  const endTurn = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      const commands: MatchCommand[] = [...pending, { type: "endTurn", team: side }];

      /* Replay them to find the board we are claiming, so the hash we send is
         the hash of what we actually produced. */
      let board = confirmed;
      const rng = createRng(row.setup.seed + row.commandLog.length);
      for (const command of commands) {
        const played = applyAction(board, command, rng);
        if (!played.ok) throw new Error(`the engine refused ${command.type}: ${played.reason}`);
        board = played.state;
      }

      const opponent = side === "home" ? row.awayUser : row.homeUser;
      const next = await submitTurn(row, commands, board, opponent ?? userId);
      setRow(next);
      setPending([]);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "something went wrong");
    } finally {
      setSending(false);
    }
  }, [confirmed, pending, row, side, userId]);

  const actionsLeft = legalActions(local).length;

  return (
    <section aria-label="Online match" className="flex flex-col gap-3 text-white">
      {/*
        The one thing a player opening a link wants to know, said loudly enough
        to be read across a room and marked live so a screen reader announces it
        when the opponent's move arrives rather than staying silent.
      */}
      <p
        aria-live="polite"
        data-testid="turn-state"
        className={[
          "rounded-xl px-4 py-3 text-center text-lg font-extrabold",
          blocked !== null
            ? "bg-(--color-gold)/15 text-(--color-gold) ring-1 ring-(--color-gold)/40"
            : yours
              ? "bg-(--color-gold)/20 text-(--color-gold) ring-1 ring-(--color-gold)/50"
              : "bg-(--color-panel) text-white/75 ring-1 ring-(--color-edge)/35",
        ].join(" ")}
      >
        {blocked !== null
          ? "This match is stopped"
          : row.status === "awaiting_opponent"
            ? "Waiting for an opponent to join"
            : yours
              ? "Your turn"
              : "Waiting for your opponent"}
      </p>

      {blocked !== null && (
        <p
          role="alert"
          className="rounded-lg bg-(--color-gold)/15 p-3 text-sm text-white ring-1 ring-(--color-gold)/40"
        >
          {blockedMessage(blocked)}
        </p>
      )}

      {error !== null && (
        <p
          role="alert"
          className="rounded-lg bg-(--color-gold-deep)/25 p-3 text-sm text-white ring-1 ring-(--color-gold-deep)/60"
        >
          {error}
        </p>
      )}

      <div className="pitch-slot">
        <Pitch
          state={local}
          seat={side}
          selectedId={yours ? selectedId : null}
          targets={targets}
          onSelect={setSelectedId}
          onCommit={commit}
          onFocusTarget={() => {}}
          frozen={!yours || sending}
        />
      </div>

      <button
        type="button"
        onClick={() => void endTurn()}
        disabled={!yours || sending || actionsLeft === 0}
        className="chunky rounded-xl bg-(--color-gold) px-4 py-3 font-extrabold text-black disabled:opacity-40"
      >
        {sending ? "Sending…" : `End turn${pending.length > 0 ? ` (${pending.length})` : ""}`}
      </button>
    </section>
  );
}
