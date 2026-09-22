import {
  FORMAT_PROFILES,
  opponentOf,
  ROLE_PROFILES,
  type Action,
  type MatchCommand,
  type MatchSetup,
  type MatchState,
  type Role,
} from "@gaffer/shared";
import { useCallback, useState } from "react";

import { useOrientation } from "../board/orientation";
import { Pitch } from "../board/Pitch";
import { Scoreboard } from "../board/Scoreboard";
import { kitFor } from "../board/squads";
import { StatusBar } from "../board/StatusBar";
import { isCommandable, NO_TARGETS, targetsFor, type Seat, type Target } from "../board/targets";
import { Button } from "../ui/Button";
import { Wordmark } from "../ui/Wordmark";
import { DownloadReport } from "../feedback/DownloadReport";
import { FlagMoment } from "../feedback/FlagMoment";
import { loadFeedback } from "../feedback/notes";
import { useFeedback } from "../feedback/useFeedback";
import { useGoalMoment } from "./useGoalMoment";
import { useMatch, type PlayOutcome } from "./useMatch";
import { useOpponent } from "./useOpponent";

/**
 * The squad actually on the pitch, by role.
 *
 * Read off the match rather than from a fixed list of five, because a game type
 * decides who turns up: an 11-a-side side has four defenders and two strikers,
 * and a sheet that always said "one of each" would be describing a different
 * match from the one being played.
 */
function TeamSheet({ state }: { state: MatchState }) {
  const home = state.players.filter((player) => player.team === "home");
  const roles = [...new Set(home.map((player) => player.role))] as Role[];

  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-xs text-white/65 sm:grid-cols-2">
      {roles.map((role) => {
        const { stats, moveRange } = ROLE_PROFILES[role];
        const count = home.filter((player) => player.role === role).length;
        const first = home.find((player) => player.role === role)!;
        const kit = kitFor(first, state);

        return (
          <div key={role} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-right font-semibold text-white tabular-nums">
              {kit.number}
            </span>
            <dt className="capitalize">
              {role}
              {count > 1 && <span className="ml-1 text-white/40">&times;{count}</span>}
            </dt>
            <dd className="ml-auto flex items-center gap-3 tabular-nums">
              <span>
                {stats.atk}/{stats.def}/{stats.pas} &middot; {moveRange}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A quiet flag on anything whose numbers are still moving. */
export function AlphaTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`rounded-full bg-(--color-gold)/20 px-2 py-0.5 text-[0.6rem] font-extrabold tracking-[0.18em] text-(--color-gold) uppercase ${className}`}
    >
      Alpha
    </span>
  );
}

export interface MatchProps {
  /** Everything chosen before kickoff. Fixed for the life of this match. */
  setup: MatchSetup;
  /**
   * Wind the match to this point in its own log before handing it over.
   *
   * How a flagged moment is reopened. The log comes from this browser's saved
   * feedback, so a link carrying a pointer only lands somewhere on the machine
   * that took the note — the report carries the log for everybody else.
   */
  replayTo?: number;
  /** Called when the player wants to go back and set up a different match. */
  onLeave: () => void;
}

/**
 * One match, from kickoff to result.
 *
 * It owns the selection and nothing else — every rule comes from the engine, and
 * every move goes back through it, whether a person or the opponent chose it.
 *
 * Hotseat and solo differ here in exactly two places: which players the board
 * offers as yours ({@link isCommandable} and the seat), and whether anything is
 * driving the other side. The rest of the screen cannot tell the difference,
 * which is the point — the opponent is a player, not a mode.
 */
export function Match({ setup, replayTo, onLeave }: MatchProps) {
  /*
   * A match that has flagged moments against it has to come back as *that*
   * match after a refresh, or every note's action index points at a board that
   * never existed. `restored` is the log from last time; replaying it puts the
   * board exactly where it was, which the engine gives for nothing.
   */
  const rewound = replayTo !== undefined;

  const [replay] = useState<readonly MatchCommand[]>(() => {
    const kept = (loadFeedback(setup)?.log ?? []).map((event) => event.command);
    return rewound ? kept.slice(0, replayTo) : kept;
  });

  const { state, log, lastEvent, rejection, play, restart } = useMatch({
    seed: setup.seed,
    format: setup.mode,
    actionsPerTurn: setup.actions,
    replay,
  });

  const { moment, celebrate } = useGoalMoment();
  const feedback = useFeedback({ setup, state, log, persist: !rewound });
  const [flagging, setFlagging] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focused, setFocused] = useState<Target | null>(null);

  const orientation = useOrientation();
  const portrait = orientation === "portrait";

  const profile = FORMAT_PROFILES[setup.mode];
  const solo = setup.play === "solo";
  const seat: Seat = solo ? setup.side : "both";
  const opponentTeam = solo ? opponentOf(setup.side) : null;

  const celebrateOutcome = useCallback(
    (outcome: PlayOutcome) => {
      if (outcome.scored && outcome.scorer) celebrate(outcome.before, outcome.scorer);
    },
    [celebrate],
  );

  const { thinking } = useOpponent({
    state,
    team: opponentTeam,
    difficulty: setup.difficulty,
    seed: setup.seed,
    /* The opponent holds still while a moment is being written up, so the board
       a note describes is the board still on screen when it is saved. */
    paused: moment !== null || flagging,
    play,
    onPlayed: celebrateOutcome,
  });

  /*
   * Derived rather than synced. A selection belonging to the side that is no
   * longer to move — after a turn passes, or once the match is decided — is
   * simply not a selection any more, so it is filtered out on the way to the
   * board instead of being cleared by an effect chasing the state.
   */
  const selection =
    selectedId !== null && isCommandable(state, selectedId, seat) ? selectedId : null;
  const over = state.result !== null;

  /*
   * Presentation lags the engine, never the reverse. While a goal is being
   * celebrated the pitch shows where everyone stood when the ball went in, even
   * though the engine has already reset them to the kickoff. Everything that is
   * *read* rather than looked at — the score, the turn, the status line, the
   * accessible description of every cell — stays live throughout.
   */
  const board = moment?.board ?? state;
  const targets = moment ? NO_TARGETS : targetsFor(state, selection);

  /** Whether the person at the keyboard may act at all right now. */
  const yourMove =
    !over && moment === null && !flagging && (seat === "both" || state.activeTeam === seat);

  /** Every command clears the selection: whoever it named has now acted. */
  const send = (command: MatchCommand) => {
    const outcome = play(command);
    setSelectedId(null);
    setFocused(null);
    if (outcome) celebrateOutcome(outcome);
  };

  const commit = (action: Action) => send(action);

  /* Whoever the opponent is about to move is anyone's guess, so the status line
     borrows its striker's name — the one player every format fields. */
  const opponentStriker = opponentTeam
    ? state.players.find((player) => player.team === opponentTeam && player.role === "striker")
    : undefined;
  const opponentName = opponentStriker ? kitFor(opponentStriker, state).name : "";

  return (
    <main className="min-h-dvh bg-(--color-night) bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-night-soft),var(--color-night))] px-4 py-6 text-white">
      <div
        className={`mx-auto flex w-full flex-col gap-3 ${
          portrait
            ? "max-w-md"
            : profile.board.width > 9
              ? "max-w-4xl"
              : profile.board.width > 7
                ? "max-w-3xl"
                : "max-w-2xl"
        }`}
      >
        <header className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl leading-none">
              <Wordmark />
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-white/55">
              <span className="font-bold text-white/75">{profile.label}</span>
              {profile.status === "alpha" && <AlphaTag />}
              <span aria-hidden className="text-white/20">
                |
              </span>
              <span className="truncate">
                {solo ? (
                  <>
                    You are {setup.side} &middot; {setup.difficulty} opponent
                  </>
                ) : (
                  <>Hotseat &middot; two players, one screen</>
                )}{" "}
                &middot; seed {setup.seed}
              </span>
            </p>
          </div>
          <p className="shrink-0 text-right text-[0.7rem] leading-tight text-white/40">
            Home attacks {portrait ? <>&uarr;</> : <>&rarr;</>}
            <br />
            Away attacks {portrait ? <>&darr;</> : <>&larr;</>}
          </p>
        </header>

        <Scoreboard state={state} scoredBy={moment?.team ?? null} />

        {over && state.result && (
          <p className="rounded-2xl bg-gradient-to-b from-(--color-gold)/25 to-(--color-gold)/10 px-5 py-3 text-sm ring-1 ring-(--color-gold)/45">
            <span className="text-base font-extrabold text-(--color-gold) capitalize">
              {state.result.winner} win
            </span>
            <span className="mx-2 text-white/25">|</span>
            <span className="text-white/75">decided by {state.result.decidedBy}</span>
            {state.result.shootout && (
              <span className="text-white/75">
                {" "}
                &middot; penalties {state.result.shootout.home}&ndash;{state.result.shootout.away}
              </span>
            )}
          </p>
        )}

        <Pitch
          state={board}
          seat={seat}
          selectedId={moment ? null : selection}
          targets={targets}
          onSelect={setSelectedId}
          onCommit={commit}
          onFocusTarget={setFocused}
          frozen={moment !== null || !yourMove}
          goalFor={moment?.team ?? null}
          orientation={orientation}
        />

        <StatusBar
          state={state}
          focused={focused}
          lastEvent={lastEvent}
          rejection={rejection}
          thinking={thinking ? opponentName : null}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            tone="primary"
            onClick={() => send({ type: "endTurn", team: state.activeTeam })}
            disabled={!yourMove}
          >
            End turn
          </Button>
          <Button
            tone="quiet"
            disabled={moment !== null}
            onClick={() => {
              restart();
              feedback.reset();
              setSelectedId(null);
              setFocused(null);
            }}
          >
            Replay this match
          </Button>
          <FlagMoment
            capture={feedback.capture}
            commit={feedback.commit}
            count={feedback.notes.length}
            onOpenChange={setFlagging}
          />

          {(over || feedback.notes.length > 0) && (
            <DownloadReport
              setup={setup}
              state={state}
              log={log}
              notes={feedback.notes}
              tone={over ? "primary" : "quiet"}
            />
          )}

          <Button tone="quiet" className="ml-auto" onClick={onLeave}>
            New match
          </Button>
        </div>

        {rewound && (
          <p className="rounded-xl bg-(--color-gold)/15 px-4 py-2 text-xs text-(--color-gold) ring-1 ring-(--color-gold)/30">
            Wound back to action {replayTo} of this match&apos;s saved log. Nothing played from here
            is saved over the notes that produced it.
          </p>
        )}

        <section
          aria-label="Team sheet"
          className="rounded-2xl bg-(--color-panel) px-5 py-4 ring-1 ring-(--color-edge)/30"
        >
          <h2 className="mb-3 text-[0.65rem] tracking-widest text-white/50 uppercase">
            Team sheet &middot; {profile.shape} &middot; ATK/DEF/PAS &middot; move
          </h2>
          <TeamSheet state={state} />
        </section>
      </div>
    </main>
  );
}
