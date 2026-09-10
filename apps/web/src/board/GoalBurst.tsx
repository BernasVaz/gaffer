import type { Team } from "@gaffer/shared";

import { GOAL_MOMENT_MS } from "../match/useGoalMoment";

/**
 * The moment a goal goes in.
 *
 * One overlay over the pitch, coloured for whoever scored, animating in, holding,
 * and fading out across a single keyframe run — the sequencing is in the
 * keyframes rather than in a chain of timers, so there is nothing to fall out of
 * step with itself.
 *
 * It sits above the pieces and is inert to the mouse. Input is suspended for its
 * duration by the board, not by this, which stays purely something to look at.
 *
 * Announced politely rather than assertively: the goal is already in the status
 * line and the score has already changed, so a screen reader has been told what
 * happened without waiting for an effect it cannot see.
 */
export function GoalBurst({ team }: { team: Team }) {
  const isHome = team === "home";

  return (
    <div
      data-goal-burst={team}
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-xl"
      style={{ animation: `goal-burst ${GOAL_MOMENT_MS}ms ease-out both` }}
    >
      {/* A wash of the scoring side's colour, so you know who did it at a glance. */}
      <div
        className={
          isHome
            ? "absolute inset-0 bg-gradient-to-t from-white/25 via-white/10 to-transparent"
            : "absolute inset-0 bg-gradient-to-b from-zinc-900/45 via-zinc-900/20 to-transparent"
        }
      />

      <p className="relative flex flex-col items-center gap-1">
        <span
          className={[
            "text-[min(13vw,4.25rem)] leading-none font-black tracking-tight",
            "drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]",
            isHome ? "text-white" : "text-zinc-100",
          ].join(" ")}
        >
          GOAL!
        </span>
        <span
          className={[
            "rounded-full px-3 py-0.5 text-xs font-bold tracking-[0.2em] uppercase",
            isHome ? "bg-white text-emerald-950" : "bg-zinc-900 text-white",
          ].join(" ")}
        >
          {team}
        </span>
      </p>
    </div>
  );
}
