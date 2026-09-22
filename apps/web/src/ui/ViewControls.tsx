import { turnBoard, useOrientation } from "../board/orientation";
import { preference, usePreference } from "./preference";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/**
 * Whether the win-chance badges are drawn on the board.
 *
 * On by default, because perfect information is a locked pillar and the odds
 * being visible *before* you commit is the promise the whole duel model rests
 * on (GDD §9). Being able to turn them off is not a retreat from that: the
 * numbers are still one tap away in the status line and the duel panel, and
 * some players would rather read the board than read the board's arithmetic.
 */
export const showOddsPreference = preference<"on" | "off">("gaffer:odds", "on", ["on", "off"]);

/** Whether to draw the odds on the board right now. */
export function useShowOdds(): boolean {
  return usePreference(showOddsPreference, "on") === "on";
}

/** A small square toggle, the size of a thumb. */
function Toggle({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cx(
        "flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        pressed
          ? "bg-(--color-panel-raised) text-white"
          : "bg-(--color-panel) text-white/45 hover:text-white/80",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The two things about the view a player might want to change mid-match.
 *
 * Deliberately not in a settings screen. Both are things you reach for *while*
 * looking at the board — "turn it round" and "stop showing me numbers" — and a
 * control you have to leave the match to find is a control nobody uses.
 */
export function ViewControls({ className }: { className?: string }) {
  const orientation = useOrientation();
  const odds = useShowOdds();
  const upright = orientation === "portrait";

  return (
    <div className={cx("flex items-center gap-1.5", className)}>
      <Toggle
        pressed={!upright}
        onClick={turnBoard}
        label={upright ? "Turn the board sideways" : "Stand the board upright"}
      >
        <span aria-hidden className="text-sm leading-none">
          {upright ? "▯" : "▭"}
        </span>
        <span aria-hidden>{upright ? "Wide" : "Tall"}</span>
      </Toggle>

      <Toggle
        pressed={odds}
        onClick={() => showOddsPreference.set(odds ? "off" : "on")}
        label={odds ? "Hide the odds on the board" : "Show the odds on the board"}
      >
        <span aria-hidden>%</span>
      </Toggle>
    </div>
  );
}
