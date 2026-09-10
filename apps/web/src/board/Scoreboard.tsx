import { TOTAL_TURNS, TURN_CAP, type MatchState, type Team } from "@gaffer/shared";

/**
 * Score, clock and whose move it is.
 *
 * Every figure is read from the state rather than tracked separately, so the
 * strip cannot drift out of step with the board beside it. The clock and action
 * count are written as sentences rather than bare digits — "2 actions left"
 * rather than a lone `2` — because a lone digit beside a pitch full of shirt
 * numbers is ambiguous to a reader and to a screen reader alike.
 */
export function Scoreboard({
  state,
  scoredBy = null,
}: {
  state: MatchState;
  /** The side that has just scored, so the new number lands rather than appears. */
  scoredBy?: Team | null;
}) {
  const inExtraTime = state.turn > TURN_CAP;

  return (
    <div
      aria-label="Scoreboard"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl bg-emerald-950/60 px-5 py-3 ring-1 ring-emerald-400/20"
    >
      <p className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-emerald-100/80">Home</span>
        <span
          data-score
          className={[
            "text-2xl font-bold tabular-nums",
            scoredBy ? "text-amber-300" : "text-white",
          ].join(" ")}
          style={scoredBy ? { animation: "score-tick 420ms ease-out" } : undefined}
        >
          {state.score.home}&ndash;{state.score.away}
        </span>
        <span className="text-sm font-medium text-emerald-100/80">Away</span>
      </p>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-100/75">
        <span className="tabular-nums">
          Turn {state.turn} of {TOTAL_TURNS}
          {inExtraTime && <span className="ml-1 font-semibold text-amber-300">extra time</span>}
        </span>
        <span aria-hidden className="text-emerald-300/30">
          |
        </span>
        <span className="font-semibold text-white">
          {state.result ? "match over" : `${state.activeTeam} to play`}
        </span>
        {!state.result && (
          <>
            <span aria-hidden className="text-emerald-300/30">
              |
            </span>
            <span className="tabular-nums">
              {state.actionsRemaining} action{state.actionsRemaining === 1 ? "" : "s"} left
            </span>
          </>
        )}
      </p>
    </div>
  );
}
