import {
  DIFFICULTIES,
  KICKING_OFF,
  MATCH_MODES,
  MAX_SEED,
  TEAMS,
  type Difficulty,
  type MatchMode,
  type MatchSetup,
  type Team,
} from "@gaffer/shared";
import { useState } from "react";

import { Crest } from "../art/Crest";
import { Footballer } from "../art/Footballer";
import { Button } from "../ui/Button";
import { Wordmark } from "../ui/Wordmark";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** What each mode is, in the fewest words that are still true. */
const MODE_COPY: Record<MatchMode, { title: string; blurb: string }> = {
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
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  blurb?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        "chunky flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl px-3 py-3 text-center",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        selected
          ? "bg-(--color-panel-raised) text-white"
          : "bg-(--color-panel) text-white/60 hover:text-white/85",
      )}
      style={{ ["--btn-edge" as string]: selected ? "#07200f" : "#04120a" }}
    >
      {children}
      <span className="text-sm font-semibold">{title}</span>
      {blurb && <span className="text-[0.68rem] leading-tight opacity-70">{blurb}</span>}
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
export function SetupScreen({ initial, onStart }: SetupScreenProps) {
  const [mode, setMode] = useState<MatchMode>(initial.mode);
  const [side, setSide] = useState<Team>(initial.side);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty);
  const [seed, setSeed] = useState<number>(initial.seed);

  const solo = mode === "solo";

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
          aria-labelledby="mode-heading"
          className="rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/30"
        >
          <h2
            id="mode-heading"
            className="mb-2 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase"
          >
            Who is playing
          </h2>
          <div className="flex gap-2">
            {MATCH_MODES.map((option) => (
              <Choice
                key={option}
                selected={mode === option}
                onClick={() => setMode(option)}
                title={MODE_COPY[option].title}
                blurb={MODE_COPY[option].blurb}
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
                    blurb={team === KICKING_OFF ? "Kicks off · attacks right" : "Attacks left"}
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
          onClick={() => onStart({ mode, side, difficulty, seed })}
          className="mt-1 py-4 text-lg"
        >
          Kick off
        </Button>
      </div>
    </main>
  );
}
