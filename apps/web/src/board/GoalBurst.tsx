import type { Team } from "@gaffer/shared";
import { motion, useReducedMotion } from "motion/react";

import { GOAL, POP_SPRING } from "../feel";

/**
 * Where each spark flies.
 *
 * Fixed rather than random: a burst should look the same every time it fires, so
 * it reads as a designed moment rather than as noise, and nothing here depends on
 * a random source the rest of the app has been careful to avoid. The offsets are
 * arithmetic dressed up as scatter — an even fan, nudged by index so it does not
 * look like a clock face.
 */
const SPARKS = Array.from({ length: GOAL.particles }, (_unused, index) => {
  const angle = (index / GOAL.particles) * Math.PI * 2 + ((index % 3) - 1) * 0.17;
  const reach = 0.58 + (((index * 37) % 43) / 43) * 0.5;
  return {
    dx: Math.cos(angle) * reach * GOAL.particleReach * 100,
    dy: Math.sin(angle) * reach * GOAL.particleReach * 100,
    size: index % 4 === 0 ? 9 : index % 3 === 0 ? 6 : 4,
    delay: (index % 5) * 0.022,
    spin: index % 2 === 0 ? 140 : -160,
  };
});

/**
 * The moment a goal goes in — the loudest thing on the board, on purpose.
 *
 * A wash of the scoring side's colour, a word that slams in and settles, and a
 * burst of sparks thrown outward on a spring. It sits above the pieces and is
 * inert to the mouse; input is suspended for its duration by the board, not by
 * this, which stays purely something to look at.
 *
 * Under `prefers-reduced-motion` the sparks and the slam are dropped, but the
 * word and the colour remain: a goal is information, and this is the one moment
 * the board must not under-report.
 */
export function GoalBurst({ team }: { team: Team }) {
  const still = useReducedMotion() ?? false;
  const isHome = team === "home";

  return (
    <div
      data-goal-burst={team}
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-xl"
      style={{ animation: `goal-burst ${GOAL.hold}ms ease-out both` }}
    >
      <div
        className={
          isHome
            ? "absolute inset-0 bg-gradient-to-t from-white/30 via-white/12 to-transparent"
            : "absolute inset-0 bg-gradient-to-b from-zinc-900/50 via-zinc-900/22 to-transparent"
        }
      />

      {/* A ring of light punching outward from the middle. */}
      {!still && (
        <motion.div
          className="absolute h-[22%] w-[22%] rounded-full ring-4 ring-amber-200/70"
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 5.2, opacity: 0 }}
          transition={{ duration: 0.72, ease: "easeOut" }}
        />
      )}

      {!still &&
        SPARKS.map((spark, index) => (
          <motion.span
            key={index}
            className="absolute rounded-full bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.9)]"
            style={{ width: spark.size, height: spark.size }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
            animate={{
              x: `${spark.dx}%`,
              y: [`0%`, `${spark.dy * 0.72}%`, `${spark.dy}%`],
              scale: [0, 1.15, 0.6, 0],
              opacity: [0, 1, 1, 0],
              rotate: spark.spin,
            }}
            transition={{
              duration: GOAL.particleLife,
              delay: spark.delay,
              ease: "easeOut",
              times: [0, 0.22, 0.6, 1],
            }}
          />
        ))}

      <motion.p
        className="relative flex flex-col items-center gap-1"
        initial={still ? false : { scale: 0.35, opacity: 0, rotate: -7 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={still ? { duration: 0 } : { ...POP_SPRING, stiffness: 520, damping: 14 }}
      >
        <span
          className={[
            "text-[min(15vw,5rem)] leading-none font-black tracking-tighter",
            "drop-shadow-[0_3px_18px_rgba(0,0,0,0.6)]",
            isHome ? "text-white" : "text-zinc-100",
          ].join(" ")}
        >
          GOAL!
        </span>
        <span
          className={[
            "rounded-full px-3 py-0.5 text-xs font-bold tracking-[0.24em] uppercase",
            isHome ? "bg-white text-emerald-950" : "bg-zinc-900 text-white",
          ].join(" ")}
        >
          {team}
        </span>
      </motion.p>
    </div>
  );
}
