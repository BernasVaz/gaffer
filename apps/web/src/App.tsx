import { createInitialState } from "@gaffer/engine";
import { ROLE_PROFILES, ROLES } from "@gaffer/shared";
import { useMemo } from "react";

import { Pitch } from "./board/Pitch";
import { Scoreboard } from "./board/Scoreboard";
import { SQUADS } from "./board/squads";

/** Who wears which number, and what the shirt is worth in a duel. */
function TeamSheet() {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-xs text-emerald-100/70 sm:grid-cols-2">
      {ROLES.map((role) => {
        const { stats, moveRange } = ROLE_PROFILES[role];
        const home = SQUADS.home[role];
        const away = SQUADS.away[role];
        return (
          <div key={role} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-right font-semibold text-white tabular-nums">
              {home.number}
            </span>
            <dt className="capitalize">{role}</dt>
            <dd className="ml-auto flex items-center gap-3 tabular-nums">
              <span className="text-emerald-100/50">
                {home.name} / {away.name}
              </span>
              <span>
                {stats.atk}/{stats.def}/{stats.pas} · {moveRange}
              </span>
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
            Team sheet &middot; home / away &middot; ATK/DEF/PAS &middot; move
          </h2>
          <TeamSheet />
          <p className="mt-3 text-xs text-emerald-100/50">
            Home play in white, away in black. The amber disc marks whoever has the ball.
          </p>
        </section>
      </div>
    </main>
  );
}
