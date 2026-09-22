import { Button, type ButtonTone } from "../ui/Button";

export interface HowToPlayProps {
  /** Start the guide. */
  onStart: () => void;
  /** How loud the button should be. */
  tone?: ButtonTone;
  /** Extra classes, for placing it in a row. */
  className?: string;
}

/**
 * The way in to the guide, at any time.
 *
 * On demand and never uninvited. A tutorial that starts before anybody has
 * asked for one is the thing people complain about, and an alpha tester
 * arriving through a shared link is in the middle of a conversation about a
 * specific match — taking them away from it to teach them the basics is the
 * wrong trade. The switch for running it unasked exists and is off; see
 * `AUTORUN_ON_FIRST_VISIT`.
 *
 * It sits wherever "My feedback" sits, for the same reason: the things you
 * might want that are not *playing* belong together and in a place that is
 * always reachable.
 */
export function HowToPlay({ onStart, tone = "quiet", className }: HowToPlayProps) {
  return (
    <Button tone={tone} onClick={onStart} className={className}>
      How to play
    </Button>
  );
}
