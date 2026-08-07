import type { MatchState } from "@gaffer/shared";

import type { MatchEvent } from "../match/useMatch";
import { SQUADS } from "./squads";
import type { Target } from "./targets";

const pct = (chance: number) => `${Math.round(chance * 100)}%`;

/** How a player is named in prose, from an id the engine gave us. */
function nameOf(state: MatchState, playerId: string): string {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return playerId;
  const kit = SQUADS[player.team][player.role];
  return `${kit.number} ${kit.name}`;
}

/** The fuller breakdown for whatever target is hovered or focused. */
function Breakdown({ target, state }: { target: Target; state: MatchState }) {
  const { action, duel } = target;

  const verb =
    action.type === "shoot" ? "Shot" : action.type[0]!.toUpperCase() + action.type.slice(1);

  if (!duel) {
    return (
      <span className="text-emerald-100/70">
        {verb} &middot; <span className="text-emerald-200">uncontested</span>
      </span>
    );
  }

  const score = (side: typeof duel.attacker) =>
    side.modifier === 0 ? `${side.stat}` : `${side.stat}+${side.modifier}`;

  return (
    <span className="text-emerald-50">
      <span className="font-semibold">{verb}</span>
      <span className="mx-2 text-emerald-300/40">|</span>
      <span className="tabular-nums">
        {nameOf(state, duel.attacker.playerId)} {score(duel.attacker)} v{" "}
        {nameOf(state, duel.defender.playerId)} {score(duel.defender)}
      </span>
      {duel.coveringPlayerIds.length > 0 && (
        <span className="ml-2 text-emerald-200/60">({duel.coveringPlayerIds.length} covering)</span>
      )}
      <span className="mx-2 text-emerald-300/40">|</span>
      <span className="font-bold text-amber-300 tabular-nums">{pct(duel.winChance)}</span>
    </span>
  );
}

/** What the last committed command actually did. */
function LastEvent({ event, state }: { event: MatchEvent; state: MatchState }) {
  const { command, duel, scored } = event;

  if (command.type === "endTurn") {
    return <span className="text-emerald-100/70">{command.team} ended the turn.</span>;
  }

  const who = nameOf(state, command.playerId);
  const verb = command.type;

  return (
    <span className="text-emerald-50">
      <span className="font-semibold">{who}</span> {verb}
      {duel && (
        <>
          <span className="mx-2 text-emerald-300/40">|</span>
          <span className="tabular-nums">
            {pct(duel.winChance)} &middot; rolled {duel.attackerRoll}&ndash;{duel.defenderRoll}
          </span>
          <span
            className={
              duel.attackerWon
                ? "ml-2 font-semibold text-emerald-300"
                : "ml-2 font-semibold text-rose-300"
            }
          >
            {duel.attackerWon ? "won" : "lost"}
          </span>
        </>
      )}
      {scored && <span className="ml-2 font-bold text-amber-300">GOAL</span>}
    </span>
  );
}

export interface StatusBarProps {
  /** The current board. */
  state: MatchState;
  /** The target under the cursor or keyboard focus, if any. */
  focused: Target | null;
  /** What the last accepted command did. */
  lastEvent: MatchEvent | null;
  /** Why the last command was refused, if it was. */
  rejection: string | null;
}

/**
 * One line under the board explaining what is about to happen, or what just did.
 *
 * The hovered target wins, because that is the question being asked right now;
 * with nothing hovered it falls back to reporting the last command. Keeping both
 * in one line is deliberate — GDD §9 wants the odds visible before committing,
 * not a second panel to look for them in.
 */
export function StatusBar({ state, focused, lastEvent, rejection }: StatusBarProps) {
  return (
    <p
      aria-live="polite"
      aria-label="Match status"
      className="min-h-9 rounded-lg bg-emerald-950/60 px-4 py-2 text-xs ring-1 ring-emerald-300/15"
    >
      {rejection ? (
        <span className="text-rose-300">Refused: {rejection}</span>
      ) : focused ? (
        <Breakdown target={focused} state={state} />
      ) : lastEvent ? (
        <LastEvent event={lastEvent} state={state} />
      ) : (
        <span className="text-emerald-200/50">
          Click one of your players to see where it can go.
        </span>
      )}
    </p>
  );
}
