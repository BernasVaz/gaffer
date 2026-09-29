import type { MatchState, Team } from "@gaffer/shared";

import { Crest } from "../art/Crest";
import { matchClock } from "./clock";
import { useOrientation } from "./orientation";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/**
 * The actions left this turn, as pips.
 *
 * Two of anything is quicker to count than to read, and this is the number a
 * player checks most often. The sentence beside it stays for anyone who is
 * listening rather than looking — the pips are marked hidden so a screen reader
 * hears "2 actions left" once rather than a row of unexplained dots.
 */
function Pips({ left, of }: { left: number; of: number }) {
  return (
    <span aria-hidden className="flex gap-1">
      {Array.from({ length: of }, (_unused, index) => (
        <span
          key={index}
          className={cx(
            "h-2.5 w-2.5 rounded-full ring-1",
            index < left ? "bg-(--color-gold) ring-amber-200/60" : "bg-transparent ring-white/25",
          )}
        />
      ))}
    </span>
  );
}

/**
 * One side of the scoreline: crest, name, which way they attack, and whether it
 * is their move.
 *
 * The arrow lives here rather than in a note beside the pitch because it is a
 * fact about the *team*, and because it has to follow the board: "attacks
 * right" is a lie on an upright pitch, where play runs up and down — and
 * "home attacks up" is a lie on the away player's phone, where the board is
 * turned around so that their own team is the one at the bottom.
 */
function Side({
  team,
  label,
  up,
  active,
  mirrored = false,
}: {
  team: Team;
  /** What to call this side to *this* reader. */
  label: string;
  /** Whether they attack away from this reader, up the board as drawn. */
  up: boolean;
  active: boolean;
  mirrored?: boolean;
}) {
  const upright = useOrientation() === "portrait";
  const arrow = upright ? (up ? "↑" : "↓") : up ? "→" : "←";
  const way = upright ? (up ? "up" : "down") : up ? "right" : "left";
  /* "you attacks up" is not a sentence, and this is read aloud. */
  const says = label === "you" ? `you attack ${way}` : `${label} attacks ${way}`;

  return (
    <span className={cx("flex min-w-0 items-center gap-2", mirrored && "flex-row-reverse")}>
      <Crest team={team} className={cx("h-7 w-6 shrink-0", !active && "opacity-70")} />
      <span
        className={cx(
          "truncate text-sm font-bold tracking-wide uppercase",
          active ? "text-white" : "text-white/55",
        )}
      >
        {label}
      </span>
      <span className="shrink-0 text-xs text-white/40" title={says}>
        <span aria-hidden>{arrow}</span>
        <span className="sr-only">{says}</span>
      </span>
    </span>
  );
}

/**
 * Score, clock and whose move it is — the broadcast strip above the pitch.
 *
 * Every figure is read from the state rather than tracked separately, so the
 * strip cannot drift out of step with the board beside it. The clock and action
 * count are written as sentences as well as drawn, because a lone digit beside
 * a pitch full of shirt numbers is ambiguous to a reader and to a screen reader
 * alike — the pips are the quick version, the sentence is the true one.
 */
export function Scoreboard({
  state,
  scoredBy = null,
  viewpoint = null,
  status = null,
}: {
  state: MatchState;
  /** The side that has just scored, so the new number lands rather than appears. */
  scoredBy?: Team | null;
  /**
   * The team the person reading this is playing, when exactly one of them is.
   *
   * Online, each player's board is drawn with their own team at the bottom
   * attacking up, so a strip labelled home-then-away contradicts one of the two
   * screens it is on. Given a viewpoint the strip is written from it: **you** on
   * the left attacking up, your opponent on the right, and the score in that
   * order. Left null for hotseat and solo, where one screen serves both sides
   * and home-then-away is the only honest way to write it.
   */
  viewpoint?: Team | null;
  /**
   * What to say in place of "home to play", when something truer is known.
   *
   * Online this is whose move it is *to the reader* — "Your turn", "Waiting for
   * your opponent" — which used to be a gold bar of its own above the pitch.
   * The bar said what this line already said, and cost the board twenty-two
   * pixels of height on every phone it was drawn on (ADR 0036). `urgent` is the
   * emphasis it carried, kept: a player glancing at a phone needs to know in one
   * look whether it is on them.
   */
  status?: { label: string; urgent: boolean } | null;
}) {
  /* Regulation counts to the cap and extra time counts itself — see
     `matchClock`. A denominator that included extra time made every match look
     as though it had stopped short of a phase most of them never enter. */
  const clock = matchClock(state.turn, state.rules);

  /* Whoever is nearest the reader goes on the left, and attacks up: their own
     team online, and home on a shared screen, which is the side the board is
     drawn from when nobody has claimed it. */
  const near: Team = viewpoint ?? "home";
  const far: Team = near === "home" ? "away" : "home";
  const inExtraTime = clock.phase === "extraTime";
  const over = state.result !== null;

  return (
    <div
      aria-label="Scoreboard"
      className="overflow-hidden rounded-2xl bg-(--color-panel) ring-1 ring-(--color-edge)/40"
    >
      <div className="flex items-center justify-between gap-3 bg-gradient-to-b from-white/8 to-transparent px-3 py-2">
        <Side
          team={near}
          label={viewpoint === null ? near : "you"}
          up
          active={!over && state.activeTeam === near}
        />

        <span
          data-score
          className={cx(
            "shrink-0 rounded-xl bg-black/45 px-4 py-1 text-3xl leading-none font-extrabold tabular-nums ring-1 ring-white/10",
            scoredBy ? "text-(--color-gold)" : "text-white",
          )}
          style={scoredBy ? { animation: "score-tick 420ms ease-out" } : undefined}
        >
          {state.score[near]}&ndash;{state.score[far]}
        </span>

        <Side
          team={far}
          label={viewpoint === null ? far : "opponent"}
          up={false}
          active={!over && state.activeTeam === far}
          mirrored
        />
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-white/8 px-3 py-1.5 text-xs text-white/70">
        {inExtraTime && (
          <span className="rounded-full bg-(--color-gold)/20 px-2 py-0.5 text-[0.65rem] font-bold tracking-wider text-(--color-gold) uppercase">
            extra time
          </span>
        )}
        <span className="tabular-nums">
          Turn {clock.turn} of {clock.of}
        </span>
        <span aria-hidden className="text-white/20">
          |
        </span>
        <span
          data-testid={status ? "turn-state" : undefined}
          aria-live={status ? "polite" : undefined}
          className={cx(
            "font-bold",
            status?.urgent === true ? "text-(--color-gold)" : "text-white",
          )}
        >
          {status ? status.label : over ? "match over" : `${state.activeTeam} to play`}
        </span>
        {!over && (
          <>
            <span aria-hidden className="text-white/20">
              |
            </span>
            <Pips left={state.actionsRemaining} of={state.rules.actionsPerTurn} />
            <span className="tabular-nums">
              {state.actionsRemaining} action{state.actionsRemaining === 1 ? "" : "s"} left
            </span>
          </>
        )}
      </p>
    </div>
  );
}
