import {
  DIFFICULTIES,
  FORMAT_PROFILES,
  FORMATS,
  KICKING_OFF,
  MAX_ACTIONS_PER_TURN,
  MAX_SEED,
  MIN_ACTIONS_PER_TURN,
  PLAY_MODES,
  squadSize,
  TEAMS,
  type Difficulty,
  type MatchFormat,
  type MatchSetup,
  type PlayMode,
  type Team,
} from "@gaffer/shared";
import { useState } from "react";

import { Crest } from "../art/Crest";
import { Footballer } from "../art/Footballer";
import { FeedbackArchive } from "../feedback/FeedbackArchive";
import { useOrientation } from "../board/orientation";
import { HowToPlay } from "../guide/HowToPlay";
import { Button } from "../ui/Button";
import { Wordmark } from "../ui/Wordmark";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** What each play mode is, in the fewest words that are still true. */
const PLAY_COPY: Record<PlayMode, { title: string; blurb: string }> = {
  solo: { title: "Solo", blurb: "You against the machine" },
  hotseat: { title: "Hotseat", blurb: "Two players, one screen" },
};

/**
 * What each setting plays like.
 *
 * Written as behaviour rather than as a number, because "elite" tells a player
 * nothing and "reads your reply before it moves" tells them what they are in
 * for. The descriptions are honest: they describe what the search actually does
 * (see `PROFILES` in `@gaffer/ai`).
 */
const LEVEL_COPY: Record<Difficulty, { title: string; blurb: string }> = {
  casual: { title: "Casual", blurb: "Goes for goal, never sees it coming" },
  pro: { title: "Pro", blurb: "Plans a whole turn. The one to beat" },
  elite: { title: "Elite", blurb: "Reads your reply before it moves" },
};

/** A pickable tile. Chunky on purpose — these are the only choices on the screen. */
function Choice({
  selected,
  onClick,
  title,
  blurb,
  tag,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  blurb?: string;
  /** A short flag, for an option whose numbers are not settled. */
  tag?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      /*
       * Spelled out rather than left to the concatenated text content, which
       * would read "11v11Alpha4-4-2 · 13×9" — technically a name containing the
       * word, and useless to listen to.
       */
      aria-label={tag ? `${title}, ${tag}${blurb ? `. ${blurb}` : ""}` : undefined}
      className={cx(
        /* `min-w-0` so a flex child may shrink below its content: without it a
           three-across row of game types, each now carrying an Alpha pill,
           pushes the setup screen sideways on a 320px phone (ADR 0019). The
           title and its badge wrap rather than the row overflowing. */
        "chunky flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-3 text-center",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        selected
          ? "bg-(--color-panel-raised) text-white"
          : "bg-(--color-panel) text-white/60 hover:text-white/85",
      )}
      style={{ ["--btn-edge" as string]: selected ? "#07200f" : "#04120a" }}
    >
      {children}
      <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-sm font-semibold">
        {title}
        {tag && (
          <span className="rounded-full bg-(--color-gold)/20 px-1.5 text-[0.55rem] font-extrabold tracking-[0.14em] text-(--color-gold) uppercase">
            {tag}
          </span>
        )}
      </span>
      {blurb && (
        <span className="text-[0.68rem] leading-tight break-words opacity-70">{blurb}</span>
      )}
    </button>
  );
}

/**
 * A side, shown rather than named.
 *
 * The crest and an actual player in the kit, because "home" and "away" are the
 * two least memorable words in football and what a player will actually
 * recognise on the pitch is the colour.
 */
function SidePreview({ team }: { team: Team }) {
  return (
    <span aria-hidden className="mb-1 flex items-center gap-1">
      <Crest team={team} className="h-9 w-8" />
      <span className="h-12 w-10">
        <Footballer
          id={`preview-${team}`}
          team={team}
          role="striker"
          number={9}
          gaze={{ x: 0, y: 0 }}
        />
      </span>
    </span>
  );
}

export interface SetupScreenProps {
  /** What the controls start on — usually whatever the link carried. */
  initial: MatchSetup;
  /** Called with the finished setup when the player kicks off. */
  onStart: (setup: MatchSetup) => void;
  /**
   * Start the guided introduction, when there is somewhere to start it from.
   *
   * Optional because the guide itself renders this screen: inside it there is
   * nothing to offer.
   */
  onHowToPlay?: () => void;
}

/**
 * The screen before the match: who is playing, which side, and against what.
 *
 * Four decisions and a button. Everything here ends up in the match link, so
 * this screen and a shared URL are two views of the same thing — which is why
 * it reads its initial values from the link rather than from a default.
 *
 * It says out loud that home kicks off. That is not a detail: self-play puts the
 * kickoff at roughly 62% of matches (ADR 0007), so it is the most consequential
 * choice on the screen, and a game about visible odds should not hide its
 * biggest one in a footnote.
 */
export function SetupScreen({ initial, onStart, onHowToPlay }: SetupScreenProps) {
  const [mode, setMode] = useState<MatchFormat>(initial.mode);
  const [play, setPlay] = useState<PlayMode>(initial.play);
  const [actions, setActions] = useState<number>(initial.actions);
  const [side, setSide] = useState<Team>(initial.side);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const [seed, setSeed] = useState<number>(initial.seed);

  const solo = play === "solo";
  /* "Attacks right" is a lie on a phone held upright, where the pitch runs up
     and down — and this screen is the first thing the guide teaches from, so a
     wrong word here is a wrong word taught. */
  const upright = useOrientation() === "portrait";
  const chosen = FORMAT_PROFILES[mode];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-(--color-night) bg-[radial-gradient(120%_70%_at_50%_0%,var(--color-night-soft),var(--color-night))] px-4 py-10 text-white">
      <div className="flex w-full max-w-md flex-col gap-4">
        <header className="text-center">
          <h1 className="text-5xl leading-none">
            <Wordmark />
          </h1>
          <p className="mt-2 text-sm text-white/55">
            A turn-based football duel. Every risk is a number you can see.
          </p>
        </header>

        <section
          aria-labelledby="format-heading"
          className="rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/30"
        >
          <h2
            id="format-heading"
            className="mb-2 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase"
          >
            Game type
          </h2>
          <div className="flex gap-2">
            {FORMATS.map((option) => {
              const profile = FORMAT_PROFILES[option];
              return (
                <Choice
                  key={option}
                  selected={mode === option}
                  onClick={() => {
                    setMode(option);
                    /* The action economy is the number that decides whether a
                       game type works at all (ADR 0012), so switching type
                       brings its own along rather than carrying the last one
                       over — 11-a-side on two actions is a different game, and
                       not a good one. Change it again afterwards if you like. */
                    setActions(FORMAT_PROFILES[option].rules.actionsPerTurn);
                  }}
                  title={option}
                  blurb={`${profile.shape} · ${profile.board.width}×${profile.board.height}`}
                  /* Every game type carries it, including the settled one. The
                     badge is about the build, not about which numbers have been
                     measured — a tester picking 5-a-side is in the same alpha as
                     one picking 11 (ADR 0027). Which formats have provisional
                     *numbers* is still `profile.status`, and the note under the
                     buttons is where that lives. */
                  tag="Alpha"
                />
              );
            })}
          </div>
          <p className="mt-2 text-[0.68rem] leading-snug text-white/40">
            {chosen.status === "alpha" ? (
              <>
                <span className="font-bold text-(--color-gold)">Alpha.</span> {chosen.label} is
                playable but its numbers are provisional — {squadSize(mode)} a side on a{" "}
                {chosen.board.width}×{chosen.board.height} pitch, {chosen.rules.actionsPerTurn}{" "}
                actions a turn. Expect it to move.
              </>
            ) : (
              <>
                <span className="font-bold text-(--color-gold)">Alpha,</span> like everything here —
                but the <span className="font-bold">settled</span> game type: {squadSize(mode)} a
                side on a {chosen.board.width}×{chosen.board.height} pitch,{" "}
                {chosen.rules.actionsPerTurn} actions a turn. Its numbers are the ones the balance
                was measured against.
              </>
            )}
          </p>
        </section>

        <section
          aria-labelledby="play-heading"
          className="rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/30"
        >
          <h2
            id="play-heading"
            className="mb-2 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase"
          >
            Who is playing
          </h2>
          <div className="flex gap-2">
            {PLAY_MODES.map((option) => (
              <Choice
                key={option}
                selected={play === option}
                onClick={() => setPlay(option)}
                title={PLAY_COPY[option].title}
                blurb={PLAY_COPY[option].blurb}
              />
            ))}
          </div>
        </section>

        {solo && (
          <>
            <section
              aria-labelledby="side-heading"
              className="rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/30"
            >
              <h2
                id="side-heading"
                className="mb-2 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase"
              >
                Your side
              </h2>
              <div className="flex gap-2">
                {TEAMS.map((team) => (
                  <Choice
                    key={team}
                    selected={side === team}
                    onClick={() => setSide(team)}
                    title={team === "home" ? "Home" : "Away"}
                    blurb={
                      team === KICKING_OFF
                        ? `Kicks off · attacks ${upright ? "up" : "right"}`
                        : `Attacks ${upright ? "down" : "left"}`
                    }
                  >
                    <SidePreview team={team} />
                  </Choice>
                ))}
              </div>
              <p className="mt-2 text-[0.68rem] leading-snug text-white/40">
                Kicking off is worth about six matches in ten — you get the ball, and the first
                attack to come off usually wins.
              </p>
            </section>

            <section
              aria-labelledby="level-heading"
              className="rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/30"
            >
              <h2
                id="level-heading"
                className="mb-2 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase"
              >
                Opponent
              </h2>
              <div className="flex gap-2">
                {DIFFICULTIES.map((level) => (
                  <Choice
                    key={level}
                    selected={difficulty === level}
                    onClick={() => setDifficulty(level)}
                    title={LEVEL_COPY[level].title}
                    blurb={LEVEL_COPY[level].blurb}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        <section
          aria-labelledby="actions-heading"
          className="rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/30"
        >
          <h2
            id="actions-heading"
            className="mb-2 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase"
          >
            Actions per turn
          </h2>
          <div className="flex gap-2">
            {Array.from(
              { length: MAX_ACTIONS_PER_TURN - MIN_ACTIONS_PER_TURN + 1 },
              (_unused, offset) => MIN_ACTIONS_PER_TURN + offset,
            ).map((count) => (
              <Choice
                key={count}
                selected={actions === count}
                onClick={() => setActions(count)}
                title={String(count)}
                blurb={count === chosen.rules.actionsPerTurn ? "default" : undefined}
              />
            ))}
          </div>
          <p className="mt-2 text-[0.68rem] leading-snug text-white/40">
            How much you get done before the turn passes — the number that decides whether a game
            type works at all. Fewer is a tighter, more deliberate match; more lets an attack
            actually arrive on a big pitch.
          </p>
        </section>
        <section
          aria-labelledby="seed-heading"
          className="rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/30"
        >
          <h2
            id="seed-heading"
            className="mb-2 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase"
          >
            Seed
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              aria-label="Match seed"
              value={seed}
              min={0}
              max={MAX_SEED}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isInteger(next) && next >= 0 && next <= MAX_SEED) setSeed(next);
              }}
              className="w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm font-bold tabular-nums ring-1 ring-white/10 focus:ring-2 focus:ring-(--color-gold) focus:outline-none"
            />
            <Button onClick={() => setSeed(Math.floor(Math.random() * (MAX_SEED + 1)))}>
              Shuffle
            </Button>
          </div>
          <p className="mt-2 text-[0.68rem] leading-snug text-white/40">
            Every die in the match comes from this number. Share the link and your opponent gets the
            same match, dice and all.
          </p>
        </section>

        <Button
          tone="primary"
          /* The guide points at this button, and a class name is not a promise.
             One attribute is cheaper than a brittle selector and says why it
             is here. */
          data-guide="kick-off"
          onClick={() => onStart({ mode, play, side, difficulty, actions, seed })}
          className="mt-1 py-4 text-lg"
        >
          Kick off
        </Button>

        {/* Notes outlive the match they were taken in, so the way back to them
            has to live somewhere that is not inside a match. This screen is the
            front door and the place "New match" returns to. */}
        <div className="flex justify-center gap-2">
          {/* Absent while the guide is running, because the guide renders this
              very screen and offering to start itself would be a loop. */}
          {onHowToPlay && <HowToPlay onStart={onHowToPlay} />}
          <FeedbackArchive onOpen={onStart} />
        </div>
      </div>
    </main>
  );
}
