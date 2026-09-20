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

import { SQUADS } from "../board/squads";

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
        "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl px-3 py-3 text-center",
        "ring-1 transition-colors",
        selected
          ? "bg-emerald-700 text-white ring-emerald-300/60"
          : "bg-emerald-950/50 text-emerald-100/70 ring-emerald-300/15 hover:bg-emerald-900/60",
      )}
    >
      {children}
      <span className="text-sm font-semibold">{title}</span>
      {blurb && <span className="text-[0.68rem] leading-tight opacity-70">{blurb}</span>}
    </button>
  );
}

/** A plain shirt swatch, so picking a side shows you what you will be looking at. */
function Swatch({ team }: { team: Team }) {
  return (
    <span
      aria-hidden
      className={cx(
        "mb-0.5 flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ring-1",
        team === "home"
          ? "bg-white text-emerald-950 ring-emerald-950/20"
          : "bg-zinc-900 text-white ring-white/25",
      )}
    >
      {SQUADS[team].striker.number}
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
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-emerald-950 to-emerald-900 px-4 py-10 text-white">
      <div className="flex w-full max-w-md flex-col gap-6">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight">Gaffer</h1>
          <p className="mt-1 text-sm text-emerald-200/70">
            A turn-based football duel. Every risk is a number you can see.
          </p>
        </header>

        <section
          aria-labelledby="mode-heading"
          className="rounded-2xl bg-emerald-950/40 p-4 ring-1 ring-emerald-300/15"
        >
          <h2
            id="mode-heading"
            className="mb-2 text-[0.65rem] tracking-widest text-emerald-200/70 uppercase"
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
              className="rounded-2xl bg-emerald-950/40 p-4 ring-1 ring-emerald-300/15"
            >
              <h2
                id="side-heading"
                className="mb-2 text-[0.65rem] tracking-widest text-emerald-200/70 uppercase"
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
                    <Swatch team={team} />
                  </Choice>
                ))}
              </div>
              <p className="mt-2 text-[0.68rem] leading-snug text-emerald-200/50">
                Kicking off is worth about six matches in ten — you get the ball, and the first
                attack to come off usually wins.
              </p>
            </section>

            <section
              aria-labelledby="level-heading"
              className="rounded-2xl bg-emerald-950/40 p-4 ring-1 ring-emerald-300/15"
            >
              <h2
                id="level-heading"
                className="mb-2 text-[0.65rem] tracking-widest text-emerald-200/70 uppercase"
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
          className="rounded-2xl bg-emerald-950/40 p-4 ring-1 ring-emerald-300/15"
        >
          <h2
            id="seed-heading"
            className="mb-2 text-[0.65rem] tracking-widest text-emerald-200/70 uppercase"
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
              className="w-full rounded-lg bg-emerald-950/70 px-3 py-2 font-mono text-sm tabular-nums ring-1 ring-emerald-300/20 focus:ring-2 focus:ring-emerald-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSeed(Math.floor(Math.random() * (MAX_SEED + 1)))}
              className="cursor-pointer rounded-lg bg-emerald-800 px-3 py-2 text-sm font-medium ring-1 ring-emerald-300/25 hover:bg-emerald-700"
            >
              Shuffle
            </button>
          </div>
          <p className="mt-2 text-[0.68rem] leading-snug text-emerald-200/50">
            Every die in the match comes from this number. Share the link and your opponent gets the
            same match, dice and all.
          </p>
        </section>

        <button
          type="button"
          onClick={() => onStart({ mode, side, difficulty, seed })}
          className="cursor-pointer rounded-xl bg-amber-400 px-6 py-3.5 text-lg font-bold text-amber-950 ring-1 ring-amber-200/60 transition-colors hover:bg-amber-300"
        >
          Kick off
        </button>
      </div>
    </main>
  );
}
