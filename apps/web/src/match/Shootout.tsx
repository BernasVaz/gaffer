import {
  DUEL_DIE_SIDES,
  SHOOTOUT_KICKS,
  type MatchState,
  type ShootoutKick,
  type Team,
} from "@gaffer/shared";

import { kitFor } from "../board/squads";

/** How a kick reads once it has been taken. */
function commentaryFor(kick: ShootoutKick, taker: string, keeper: string): string {
  if (kick.scored) {
    return kick.attackerTotal - kick.defenderTotal >= 3
      ? `${taker} buries it. ${keeper} was never getting near that.`
      : `${taker} scores. ${keeper} guessed right and it was not enough.`;
  }
  return kick.attackerTotal === kick.defenderTotal
    ? `${keeper} saves it — level on the dice, and a tie goes to the keeper.`
    : `${keeper} keeps it out. ${taker} will not want to watch that back.`;
}

/** One side's line: who they are, how many they have scored, and each kick. */
function ShootoutRow({
  team,
  shown,
  yours,
}: {
  team: Team;
  shown: readonly ShootoutKick[];
  yours: boolean;
}): React.JSX.Element {
  const theirs = shown.filter((kick) => kick.team === team);
  const regulation = theirs.filter((kick) => !kick.suddenDeath);
  const sudden = theirs.filter((kick) => kick.suddenDeath);
  const scored = theirs.filter((kick) => kick.scored).length;

  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-extrabold tracking-wide uppercase">
        {team}
        {yours && <span className="ml-1 text-(--color-gold)">you</span>}
      </span>
      <span className="w-8 shrink-0 text-2xl font-extrabold tabular-nums">{scored}</span>
      <span className="flex gap-1">
        {Array.from({ length: SHOOTOUT_KICKS }, (_unused, index) => {
          const kick = regulation[index];
          return (
            <span
              key={index}
              aria-hidden
              className={[
                "size-3 rounded-full ring-1",
                kick === undefined
                  ? "bg-white/5 ring-white/20"
                  : kick.scored
                    ? "bg-(--color-gold) ring-(--color-gold)"
                    : "bg-transparent ring-white/40",
              ].join(" ")}
            />
          );
        })}
        {sudden.map((kick, index) => (
          <span
            key={`sudden-${index}`}
            aria-hidden
            className={[
              "size-3 rounded-sm ring-1",
              kick.scored
                ? "bg-(--color-gold) ring-(--color-gold)"
                : "bg-transparent ring-white/40",
            ].join(" ")}
          />
        ))}
      </span>
    </div>
  );
}

/** Props for {@link ShootoutScreen}. */
export interface ShootoutScreenProps {
  /** The finished match, for squads and board. */
  state: MatchState;
  /** The kicks, already resolved by the engine. */
  kicks: readonly ShootoutKick[];
  /** How many have been shown so far. */
  revealed: number;
  /** Take the next kick. */
  onTake: () => void;
  /** Leave the shootout and look at the final result. */
  onFinish: () => void;
  /** Which side the person is playing, or null in hotseat. */
  seat: Team | null;
}

/**
 * The shootout, taken one kick at a time.
 *
 * **This decides nothing.** The engine resolved every kick the moment the match
 * finished level, deterministically and from the match's own seed (ADR 0026);
 * this walks that list. Pressing does not roll a die — the die is already
 * rolled, and what the press buys is the right to see it. Which is why a
 * shootout replays identically with no UI attached, and why self-play runs the
 * same penalties this screen shows.
 *
 * The odds come off the kick rather than being recomputed here, so the number
 * shown before the press is provably the number the dice were compared against
 * (GDD §9).
 */
export function ShootoutScreen({
  state,
  kicks,
  revealed,
  onTake,
  onFinish,
  seat,
}: ShootoutScreenProps): React.JSX.Element {
  const shown = kicks.slice(0, revealed);
  const next = kicks[revealed];
  const done = next === undefined;

  const nameOf = (id: string) => {
    const player = state.players.find((candidate) => candidate.id === id);
    return player ? kitFor(player, state).name : "the taker";
  };

  const last = shown[shown.length - 1];

  return (
    <section
      aria-label="Penalty shootout"
      className="flex min-h-0 flex-1 flex-col gap-4 rounded-xl bg-black/30 p-4 ring-1 ring-white/10"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">Penalties</h2>
        <p className="text-xs text-white/60">
          {next?.suddenDeath || last?.suddenDeath ? "sudden death" : `best of ${SHOOTOUT_KICKS}`}
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <ShootoutRow team="home" shown={shown} yours={seat === "home"} />
        <ShootoutRow team="away" shown={shown} yours={seat === "away"} />
      </div>

      {/* What just happened, and what is about to. */}
      <div
        aria-live="polite"
        className="min-h-16 rounded-lg bg-black/30 px-3 py-2 text-sm ring-1 ring-white/10"
      >
        {last === undefined ? (
          <p className="text-white/70">Level after extra time. It goes to penalties.</p>
        ) : (
          <>
            <p className="font-semibold">
              {commentaryFor(last, nameOf(last.takerId), nameOf(last.keeperId))}
            </p>
            <p className="mt-1 text-xs text-white/60 tabular-nums">
              {/* Stat plus die, both sides, the same way open play shows a duel. */}
              {`D${DUEL_DIE_SIDES} ${last.attackerTotal - last.attackerRoll}+${last.attackerRoll}`}
              {` v ${last.defenderTotal - last.defenderRoll}+${last.defenderRoll}`} &middot;{" "}
              {Math.round(last.winChance * 100)}% chance
            </p>
          </>
        )}
      </div>

      {done ? (
        <button
          type="button"
          onClick={onFinish}
          className="chunky w-full rounded-xl bg-(--color-gold) px-4 py-3 font-extrabold text-black"
        >
          See the result
        </button>
      ) : (
        <button
          type="button"
          onClick={onTake}
          className="chunky w-full rounded-xl bg-(--color-gold) px-4 py-3 font-extrabold text-black"
          aria-label={`Take the kick: ${nameOf(next.takerId)} for ${next.team}, ${Math.round(
            next.winChance * 100,
          )}% chance`}
        >
          <span className="block text-base">
            {nameOf(next.takerId)} steps up for {next.team}
          </span>
          <span className="block text-sm font-bold opacity-80">
            Take the kick &middot; {Math.round(next.winChance * 100)}% chance
          </span>
        </button>
      )}
    </section>
  );
}
