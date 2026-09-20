import { totalTurns, type MatchState, type Team } from "@gaffer/shared";

import { Crest } from "../art/Crest";

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

/** One side of the scoreline: crest, name, and whether it is their move. */
function Side({ team, active }: { team: Team; active: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Crest team={team} className={cx("h-7 w-6 shrink-0", !active && "opacity-70")} />
      <span
        className={cx(
          "truncate text-sm font-bold tracking-wide uppercase",
          active ? "text-white" : "text-white/55",
        )}
      >
        {team}
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
}: {
  state: MatchState;
  /** The side that has just scored, so the new number lands rather than appears. */
  scoredBy?: Team | null;
}) {
  const inExtraTime = state.turn > state.rules.turnCap;
  const over = state.result !== null;

  return (
    <div
      aria-label="Scoreboard"
      className="overflow-hidden rounded-2xl bg-(--color-panel) ring-1 ring-(--color-edge)/40"
    >
      <div className="flex items-center justify-between gap-3 bg-gradient-to-b from-white/8 to-transparent px-4 py-3">
        <Side team="home" active={!over && state.activeTeam === "home"} />

        <span
          data-score
          className={cx(
            "shrink-0 rounded-xl bg-black/45 px-4 py-1 text-3xl leading-none font-extrabold tabular-nums ring-1 ring-white/10",
            scoredBy ? "text-(--color-gold)" : "text-white",
          )}
          style={scoredBy ? { animation: "score-tick 420ms ease-out" } : undefined}
        >
          {state.score.home}&ndash;{state.score.away}
        </span>

        <span className="flex min-w-0 flex-row-reverse items-center gap-2">
          <Crest
            team="away"
            className={cx(
              "h-7 w-6 shrink-0",
              !(!over && state.activeTeam === "away") && "opacity-70",
            )}
          />
          <span
            className={cx(
              "truncate text-sm font-bold tracking-wide uppercase",
              !over && state.activeTeam === "away" ? "text-white" : "text-white/55",
            )}
          >
            away
          </span>
        </span>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/8 px-4 py-2 text-xs text-white/70">
        <span className="tabular-nums">
          Turn {state.turn} of {totalTurns(state.rules)}
        </span>
        {inExtraTime && (
          <span className="rounded-full bg-(--color-gold)/20 px-2 py-0.5 text-[0.65rem] font-bold tracking-wider text-(--color-gold) uppercase">
            extra time
          </span>
        )}
        <span aria-hidden className="text-white/20">
          |
        </span>
        <span className="font-bold text-white">
          {over ? "match over" : `${state.activeTeam} to play`}
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
