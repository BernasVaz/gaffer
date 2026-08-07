import { createInitialState } from "@gaffer/engine";
import { ROLE_PROFILES, ROLES } from "@gaffer/shared";
import { useMemo } from "react";

import { Pitch } from "./board/Pitch";
import { Scoreboard } from "./board/Scoreboard";

const ROLE_INITIAL: Record<string, string> = {
  goalkeeper: "G",
  defender: "D",
  midfielder: "M",
  winger: "W",
  striker: "S",
};

/** What the letters on the tokens mean, with the stat line behind each one. */
function Legend() {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-emerald-100/70 sm:grid-cols-3">
      {ROLES.map((role) => {
        const { stats, moveRange } = ROLE_PROFILES[role];
        return (
          <div key={role} className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[0.6rem] font-bold text-emerald-950">
              {ROLE_INITIAL[role]}
            </span>
            <dt className="capitalize">{role}</dt>
            <dd className="ml-auto tabular-nums">
              {stats.atk}/{stats.def}/{stats.pas} · {moveRange}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * The whole client, for now.
 *
 * It builds one match state from the engine and draws it. Nothing here decides
 * anything about the game — GDD §15's split is that the engine holds the rules
 * and this only renders them, so the same board can later be driven by a local
 * opponent or an authoritative server without the drawing code changing.
 */
export function App() {
  // Deterministic and side-effect free, so one call is all a read-only view needs.
  const state = useMemo(() => createInitialState(), []);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-emerald-950 to-emerald-900 px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gaffer</h1>
            <p className="text-sm text-emerald-200/70">
              Starting position &middot; read-only preview
            </p>
          </div>
          <p className="text-right text-xs text-emerald-200/50">
            Home attacks &rarr;
            <br />
            Away attacks &larr;
          </p>
        </header>

        <Scoreboard state={state} />
        <Pitch state={state} />

        <section aria-label="Key" className="rounded-xl bg-emerald-950/40 px-5 py-4">
          <h2 className="mb-3 text-[0.65rem] tracking-widest text-emerald-200/70 uppercase">
            Key &middot; ATK/DEF/PAS &middot; move
          </h2>
          <Legend />
          <p className="mt-3 text-xs text-emerald-100/50">
            White tokens are the home side, dark tokens the away side. The amber dot marks whoever
            has the ball.
          </p>
        </section>
      </div>
    </main>
  );
}
