import { totalTurns, type MatchState, type Player } from "@gaffer/shared";
import { useState } from "react";

import { kitFor } from "../board/squads";
import { commentary, diceOf } from "./commentary";
import type { RecordedEvent } from "./replay";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** Which panel is showing. */
type Tab = "player" | "stats" | "duels" | "commentary";

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "player", label: "Player" },
  { id: "stats", label: "Stats" },
  { id: "duels", label: "Duels" },
  { id: "commentary", label: "Commentary" },
];

/** One stat, drawn as a number and as a bar. */
function Stat({ label, value, of = 6 }: { label: string; value: number; of?: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-[0.62rem] font-bold tracking-wider text-white/45 uppercase">
        {label}
      </span>
      <span className="w-4 shrink-0 text-right text-sm font-extrabold tabular-nums">{value}</span>
      <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <span
          className="block h-full rounded-full bg-(--color-gold)"
          style={{ width: `${Math.min(100, (value / of) * 100)}%` }}
        />
      </span>
    </div>
  );
}

/** What a single player is, in numbers. */
function PlayerCard({ player, state }: { player: Player; state: MatchState }) {
  const kit = kitFor(player, state);
  const carrying = state.ball.carrierId === player.id;

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-lg font-extrabold">
          {kit.number} {kit.name}
        </span>
        <span className="text-xs text-white/50 capitalize">
          {player.team} {player.role}
        </span>
        {carrying && (
          <span className="rounded-full bg-(--color-gold)/20 px-2 text-[0.62rem] font-extrabold text-(--color-gold) uppercase">
            on the ball
          </span>
        )}
      </p>

      <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 sm:gap-x-5">
        <Stat label="ATK" value={player.stats.atk} />
        <Stat label="DEF" value={player.stats.def} />
        <Stat label="PAS" value={player.stats.pas} />
        <Stat label="MOVE" value={player.moveRange} />
      </div>

      <p className="mt-2.5 text-[0.7rem] leading-snug text-white/45">
        {DESCRIBE[player.role]} Standing on column {player.position.x}, row {player.position.y}.
      </p>
    </div>
  );
}

/** What each role is for, in a sentence. */
const DESCRIBE: Readonly<Record<Player["role"], string>> = {
  goalkeeper:
    "Defends a shot only while standing in the goal mouth — draw it out and the net is open.",
  defender: "Built to win the ball back: the best DEF on the pitch and very little else.",
  midfielder: "The passer. Even numbers everywhere, and the range to find somebody.",
  winger: "Quick and wide. The longest legs on the pitch, and not much use in a tackle.",
  striker: "There to score. ATK that nothing else matches, and no interest in defending.",
};

/** Running totals, read off the state rather than kept separately. */
function Stats({ state, log }: { state: MatchState; log: readonly RecordedEvent[] }) {
  const counted = (type: string, team: "home" | "away") =>
    log.filter((event) => event.command.type === type && event.team === team).length;

  const rows: ReadonlyArray<{ label: string; home: number; away: number }> = [
    { label: "Goals", home: state.score.home, away: state.score.away },
    {
      label: "Shots",
      home: state.stats.shotsAttempted.home,
      away: state.stats.shotsAttempted.away,
    },
    { label: "Duels won", home: state.stats.duelsWon.home, away: state.stats.duelsWon.away },
    { label: "Passes", home: counted("pass", "home"), away: counted("pass", "away") },
    { label: "Dribbles", home: counted("dribble", "home"), away: counted("dribble", "away") },
    { label: "Tackles", home: counted("tackle", "home"), away: counted("tackle", "away") },
    { label: "Long balls", home: counted("launch", "home"), away: counted("launch", "away") },
  ];

  return (
    <table className="w-full text-sm">
      <caption className="mb-2 text-left text-[0.62rem] tracking-widest text-white/40 uppercase">
        Turn {state.turn} of {totalTurns(state.rules)} &middot; {log.length} actions
      </caption>
      <thead>
        <tr className="text-[0.62rem] tracking-wider text-white/40 uppercase">
          <th className="w-10 text-right font-bold">Home</th>
          <th className="px-3 text-center font-bold" />
          <th className="w-10 text-left font-bold">Away</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td
              className={cx(
                "text-right tabular-nums",
                row.home > row.away ? "font-extrabold text-white" : "text-white/60",
              )}
            >
              {row.home}
            </td>
            <td className="px-3 text-center text-xs whitespace-nowrap text-white/45">
              {row.label}
            </td>
            <td
              className={cx(
                "text-left tabular-nums",
                row.away > row.home ? "font-extrabold text-white" : "text-white/60",
              )}
            >
              {row.away}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Every duel the match has rolled, newest first. */
function Duels({ state, log }: { state: MatchState; log: readonly RecordedEvent[] }) {
  const fought = log
    .filter((event) => event.duel !== null)
    .slice(-30)
    .reverse();

  if (fought.length === 0) {
    return <p className="text-sm text-white/50">Nothing has been contested yet.</p>;
  }

  const nameOf = (id: string) => {
    const player = state.players.find((candidate) => candidate.id === id);
    return player ? kitFor(player, state).name : id;
  };

  return (
    <ol className="flex flex-col gap-1.5">
      {fought.map((event) => {
        const duel = event.duel!;
        const won = duel.attackerWon;

        return (
          <li
            key={event.index}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs"
          >
            <span className="font-bold capitalize">{event.command.type}</span>
            <span className="text-white/55">
              {nameOf(duel.attacker.playerId)} v {nameOf(duel.defender.playerId)}
            </span>
            <span className="ml-auto font-mono text-[0.7rem] tabular-nums text-white/70">
              {diceOf(duel)}
            </span>
            <span
              className={cx(
                "w-12 text-right font-extrabold",
                won ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {won ? "won" : "lost"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The ticker. */
function Commentary({ state, log }: { state: MatchState; log: readonly RecordedEvent[] }) {
  const lines = commentary(log, state);

  if (lines.length === 0) {
    return <p className="text-sm text-white/50">Kick-off.</p>;
  }

  return (
    <ol className="flex flex-col gap-1">
      {lines.map((line) => (
        <li
          key={line.index}
          className={cx(
            "flex flex-wrap items-baseline gap-x-2 rounded-lg px-2.5 py-1.5 text-sm",
            line.loud ? "bg-(--color-gold)/10 text-white" : "text-white/60",
          )}
        >
          <span className={cx(line.loud && "font-bold")}>{line.says}</span>
          {line.dice && (
            <span className="ml-auto font-mono text-[0.7rem] tabular-nums text-white/45">
              {line.dice}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export interface InfoPanelsProps {
  /** The live board. */
  state: MatchState;
  /** Everything played. */
  log: readonly RecordedEvent[];
  /** The player being looked at, if any. */
  inspected: Player | undefined;
}

/**
 * Everything about the match that is not the match.
 *
 * A drawer rather than a column beside the board: the board has to stay whole
 * and unscrolled at every size (ADR 0019), so anything else competing for the
 * same height has to be something the player opens rather than something that
 * is always there. Opening one shrinks the pitch to fit rather than pushing it
 * off the screen — which is why this sits in the same flex column.
 *
 * All of it is derived from the state and the log. Nothing here is tracked
 * separately, so no panel can disagree with the board above it.
 */
export function InfoPanels({ state, log, inspected }: InfoPanelsProps) {
  const [open, setOpen] = useState<Tab | null>(null);

  return (
    <section className="shrink-0" aria-label="Match information">
      <div role="tablist" aria-label="Match information" className="flex gap-1.5">
        {TABS.map((tab) => {
          const showing = open === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={showing}
              aria-controls={showing ? "info-panel" : undefined}
              onClick={() => setOpen(showing ? null : tab.id)}
              className={cx(
                "flex-1 rounded-t-xl px-2 py-1.5 text-xs font-bold",
                "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
                showing
                  ? "bg-(--color-panel) text-white"
                  : "bg-(--color-panel)/50 text-white/50 hover:text-white/80",
              )}
            >
              {tab.label}
              {tab.id === "player" && inspected && (
                <span className="ml-1 text-(--color-gold)">{kitFor(inspected, state).number}</span>
              )}
            </button>
          );
        })}
      </div>

      {open !== null && (
        <div
          id="info-panel"
          role="tabpanel"
          /* Capped and scrollable *inside* itself, so a long match cannot push
             the pitch off the screen however much commentary piles up. */
          className="max-h-[30dvh] overflow-y-auto rounded-b-xl bg-(--color-panel) px-3.5 py-3"
        >
          {open === "player" &&
            (inspected ? (
              <PlayerCard player={inspected} state={state} />
            ) : (
              <p className="text-sm text-white/50">
                Tap anybody on the pitch &mdash; yours or theirs &mdash; to see what they are.
              </p>
            ))}
          {open === "stats" && <Stats state={state} log={log} />}
          {open === "duels" && <Duels state={state} log={log} />}
          {open === "commentary" && <Commentary state={state} log={log} />}
        </div>
      )}
    </section>
  );
}
