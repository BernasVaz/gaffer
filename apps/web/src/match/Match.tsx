import {
  FORMAT_PROFILES,
  opponentOf,
  type Action,
  type MatchCommand,
  type MatchSetup,
  type Player,
} from "@gaffer/shared";
import { useCallback, useState } from "react";

import { useOrientation } from "../board/orientation";
import { ActionBar } from "./ActionBar";
import { InfoPanels } from "./InfoPanels";
import { ViewControls, useShowOdds } from "../ui/ViewControls";
import { Pitch } from "../board/Pitch";
import { ShootoutScreen } from "./Shootout";
import { Scoreboard } from "../board/Scoreboard";
import { kitFor } from "../board/squads";
import { StatusBar } from "../board/StatusBar";
import { isCommandable, NO_TARGETS, targetsFor, type Seat, type Target } from "../board/targets";
import { Button } from "../ui/Button";
import { Wordmark } from "../ui/Wordmark";
import { DownloadReport } from "../feedback/DownloadReport";
import { FeedbackArchive } from "../feedback/FeedbackArchive";
import { HowToPlay } from "../guide/HowToPlay";
import { FlagMoment } from "../feedback/FlagMoment";
import { loadFeedback } from "../feedback/notes";
import { useFeedback } from "../feedback/useFeedback";
import { useGoalMoment } from "./useGoalMoment";
import { useMatch, type PlayOutcome } from "./useMatch";
import { useOpponent } from "./useOpponent";

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
  /** Start the guided introduction. */
  onHowToPlay?: () => void;
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
const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export function Match({ setup, replayTo, onLeave, onHowToPlay }: MatchProps) {
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
  const showOdds = useShowOdds();

  /* Whoever was last tapped, so a panel can say what they are. Held here
     rather than in the panel because the tap happens on the board. */
  const [inspected, setInspected] = useState<Player | undefined>(undefined);

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
   * The shootout, taken rather than tallied.
   *
   * The engine has already resolved every kick — this is only how many of them
   * the players have chosen to look at (ADR 0026). It starts at zero the moment
   * a match ends level, so the result is not spoiled before the penalties are
   * taken, and `settled` is what lets the full-time banner appear.
   */
  const shootout = state.result?.shootout ?? null;
  const [revealed, setRevealed] = useState(0);
  const [settled, setSettled] = useState(false);
  const takingPenalties = shootout !== null && !settled;

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
    /*
     * One screen, and it does not scroll.
     *
     * A fixed-height flex column: everything that is not the pitch takes the
     * height it needs, and the pitch takes what is left. The board then fits
     * itself into that space keeping its own shape, so the full field is
     * always visible at every size and in either orientation (ADR 0019) —
     * opening an information panel shrinks the pitch rather than pushing it
     * off the bottom.
     */
    <main
      className={cx(
        "flex h-dvh flex-col overflow-hidden px-3 py-2 text-white",
        "bg-(--color-night) bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-night-soft),var(--color-night))]",
      )}
    >
      <div
        className={cx(
          "mx-auto flex h-full w-full min-h-0 flex-col gap-2",
          portrait ? "max-w-md" : "max-w-5xl",
        )}
      >
        <header className="flex shrink-0 items-center gap-2">
          <h1 className="text-lg leading-none">
            <Wordmark />
          </h1>
          <p className="min-w-0 flex-1 truncate text-[0.7rem] text-white/50">
            <span className="font-bold text-white/70">{profile.label}</span>
            {profile.status === "alpha" && <AlphaTag className="ml-1.5" />}
            <span className="ml-1.5">
              {solo ? `you are ${setup.side}` : "hotseat"} &middot; seed {setup.seed}
            </span>
          </p>
          <ViewControls className="shrink-0" />
        </header>

        <Scoreboard state={state} scoredBy={moment?.team ?? null} />

        {over && state.result && !takingPenalties && (
          <p className="shrink-0 rounded-xl bg-gradient-to-b from-(--color-gold)/25 to-(--color-gold)/10 px-4 py-2 text-sm ring-1 ring-(--color-gold)/45">
            <span className="font-extrabold text-(--color-gold) capitalize">
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

        {takingPenalties && shootout ? (
          <ShootoutScreen
            state={state}
            kicks={shootout.kicks}
            revealed={revealed}
            onTake={() => setRevealed((shown) => shown + 1)}
            onFinish={() => setSettled(true)}
            seat={solo ? setup.side : null}
          />
        ) : null}

        {/* The one element allowed to give up its height. */}
        <div className={takingPenalties ? "hidden" : "pitch-slot"}>
          <Pitch
            state={board}
            seat={seat}
            selectedId={moment ? null : selection}
            targets={targets}
            onSelect={setSelectedId}
            onCommit={commit}
            onFocusTarget={setFocused}
            focused={focused}
            onInspect={setInspected}
            showOdds={showOdds}
            frozen={moment !== null || !yourMove}
            goalFor={moment?.team ?? null}
            orientation={orientation}
          />
        </div>

        <StatusBar
          state={state}
          focused={focused}
          lastEvent={lastEvent}
          rejection={rejection}
          thinking={thinking ? opponentName : null}
        />

        <ActionBar
          onEndTurn={() => send({ type: "endTurn", team: state.activeTeam })}
          canEndTurn={yourMove}
          flag={
            <FlagMoment
              capture={feedback.capture}
              commit={feedback.commit}
              count={feedback.notes.length}
              onOpenChange={setFlagging}
            />
          }
          more={
            <>
              <Button
                tone="quiet"
                aria-label="Replay this match"
                disabled={moment !== null}
                className="px-3 py-1.5 text-sm"
                onClick={() => {
                  restart();
                  feedback.reset();
                  setSelectedId(null);
                  setFocused(null);
                }}
              >
                Replay this match
              </Button>

              {(over || feedback.notes.length > 0) && (
                <DownloadReport
                  setup={setup}
                  state={state}
                  log={log}
                  notes={feedback.notes}
                  tone={over ? "primary" : "quiet"}
                />
              )}

              {onHowToPlay && <HowToPlay onStart={onHowToPlay} className="px-3 py-1.5 text-sm" />}
              <FeedbackArchive />
              <Button
                tone="quiet"
                aria-label="New match"
                className="px-3 py-1.5 text-sm"
                onClick={onLeave}
              >
                New match
              </Button>
            </>
          }
        />

        {rewound && (
          <p className="shrink-0 rounded-lg bg-(--color-gold)/15 px-3 py-1.5 text-[0.7rem] text-(--color-gold)">
            Wound back to action {replayTo}. Nothing played from here is saved.
          </p>
        )}

        <InfoPanels state={state} log={log} inspected={inspected} />
      </div>
    </main>
  );
}
