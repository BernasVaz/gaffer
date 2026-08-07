import { TOTAL_TURNS, TURN_CAP, type MatchState } from "@gaffer/shared";

/** One labelled figure in the scoreboard strip. */
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[0.65rem] tracking-widest text-emerald-200/70 uppercase">{label}</span>
      <span className="text-sm font-semibold text-white tabular-nums">{children}</span>
    </div>
  );
}

/**
 * Score, clock and whose move it is.
 *
 * Every figure is read from the state rather than tracked separately, so the
 * strip cannot drift out of step with the board beside it.
 */
export function Scoreboard({ state }: { state: MatchState }) {
  const inExtraTime = state.turn > TURN_CAP;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-emerald-950/60 px-5 py-3 ring-1 ring-emerald-400/20">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-medium text-emerald-100/80">Home</span>
        <span className="text-2xl font-bold text-white tabular-nums">
          {state.score.home}&ndash;{state.score.away}
        </span>
        <span className="text-sm font-medium text-emerald-100/80">Away</span>
      </div>

      <div className="flex items-center gap-5">
        <Stat label="Turn">
          {state.turn}/{TOTAL_TURNS}
          {inExtraTime && <span className="ml-1 text-amber-300">ET</span>}
        </Stat>
        <Stat label="To play">{state.activeTeam}</Stat>
        <Stat label="Actions">{state.actionsRemaining}</Stat>
      </div>
    </div>
  );
}
