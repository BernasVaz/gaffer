import { ROLE_PROFILES, ROLES, type Action, type MatchCommand } from "@gaffer/shared";
import { useState } from "react";

import { Pitch } from "./board/Pitch";
import { Scoreboard } from "./board/Scoreboard";
import { SQUADS } from "./board/squads";
import { StatusBar } from "./board/StatusBar";
import { isCommandable, targetsFor, type Target } from "./board/targets";
import { useMatch } from "./match/useMatch";

/** Read `?seed=` so a match can be reproduced from its link. Defaults to 1. */
function seedFromUrl(): number {
  const raw = new URLSearchParams(window.location.search).get("seed");
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : 1;
}

/** Who wears which number, and what the shirt is worth in a duel. */
function TeamSheet() {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-xs text-emerald-100/70 sm:grid-cols-2">
      {ROLES.map((role) => {
        const { stats, moveRange } = ROLE_PROFILES[role];
        return (
          <div key={role} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-right font-semibold text-white tabular-nums">
              {SQUADS.home[role].number}
            </span>
            <dt className="capitalize">{role}</dt>
            <dd className="ml-auto flex items-center gap-3 tabular-nums">
              <span className="text-emerald-100/50">
                {SQUADS.home[role].name} / {SQUADS.away[role].name}
              </span>
              <span>
                {stats.atk}/{stats.def}/{stats.pas} &middot; {moveRange}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * The client.
 *
 * Hotseat: two people, one screen, whoever is to move is whoever is playing.
 * It owns the selection and nothing else — every rule comes from the engine, and
 * every move goes back through it.
 */
export function App() {
  const [seed] = useState(seedFromUrl);
  const { state, lastEvent, rejection, play, restart } = useMatch(seed);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focused, setFocused] = useState<Target | null>(null);

  /*
   * Derived rather than synced. A selection belonging to the side that is no
   * longer to move — after a turn passes, or once the match is decided — is
   * simply not a selection any more, so it is filtered out on the way to the
   * board instead of being cleared by an effect chasing the state.
   */
  const selection = selectedId !== null && isCommandable(state, selectedId) ? selectedId : null;
  const targets = targetsFor(state, selection);
  const over = state.result !== null;

  /** Every command clears the selection: whoever it named has now acted. */
  const send = (command: MatchCommand) => {
    play(command);
    setSelectedId(null);
    setFocused(null);
  };

  const commit = (action: Action) => send(action);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-emerald-950 to-emerald-900 px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gaffer</h1>
            <p className="text-sm text-emerald-200/70">
              Hotseat &middot; two players, one screen &middot; seed {seed}
            </p>
          </div>
          <p className="text-right text-xs text-emerald-200/50">
            Home attacks &rarr;
            <br />
            Away attacks &larr;
          </p>
        </header>

        <Scoreboard state={state} />

        {over && state.result && (
          <p className="rounded-xl bg-amber-300/15 px-5 py-3 text-sm ring-1 ring-amber-300/40">
            <span className="font-bold text-amber-200 capitalize">{state.result.winner} win</span>
            <span className="mx-2 text-amber-200/40">|</span>
            <span className="text-amber-100/80">decided by {state.result.decidedBy}</span>
            {state.result.shootout && (
              <span className="text-amber-100/80">
                {" "}
                &middot; penalties {state.result.shootout.home}&ndash;{state.result.shootout.away}
              </span>
            )}
          </p>
        )}

        <Pitch
          state={state}
          selectedId={selection}
          targets={targets}
          onSelect={setSelectedId}
          onCommit={commit}
          onFocusTarget={setFocused}
        />

        <StatusBar state={state} focused={focused} lastEvent={lastEvent} rejection={rejection} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => send({ type: "endTurn", team: state.activeTeam })}
            disabled={over}
            className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium ring-1 ring-emerald-300/25 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            End turn
          </button>
          <button
            type="button"
            onClick={() => {
              restart();
              setSelectedId(null);
              setFocused(null);
            }}
            className="rounded-lg bg-emerald-950/60 px-4 py-2 text-sm font-medium text-emerald-100/80 ring-1 ring-emerald-300/15 hover:bg-emerald-950"
          >
            New match
          </button>
        </div>

        <section aria-label="Team sheet" className="rounded-xl bg-emerald-950/40 px-5 py-4">
          <h2 className="mb-3 text-[0.65rem] tracking-widest text-emerald-200/70 uppercase">
            Team sheet &middot; home / away &middot; ATK/DEF/PAS &middot; move
          </h2>
          <TeamSheet />
        </section>
      </div>
    </main>
  );
}
