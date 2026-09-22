import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/Button";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export interface ActionBarProps {
  /** Hand the turn over. The one control that has to be under a thumb. */
  onEndTurn: () => void;
  /** Whether ending the turn is currently allowed. */
  canEndTurn: boolean;
  /** Flagging a moment — kept in reach, because the moments worth catching pass quickly. */
  flag: React.ReactNode;
  /** Everything else, behind the overflow. */
  more: React.ReactNode;
}

/**
 * One row, whatever the screen.
 *
 * The match screen is a fixed-height column in which the pitch takes whatever
 * is left over (ADR 0019), so every pixel the controls spend is a pixel off the
 * board. Six buttons wrapping onto two rows cost about 50px, which on a 568px
 * phone was the difference between a 12px cell and a playable one.
 *
 * So: the two things you reach for *during* a turn stay out here, and
 * everything you reach for between turns goes behind one button. That is also
 * simply the better arrangement — "New match" next to "End turn" is a misclick
 * waiting to happen.
 */
export function ActionBar({ onEndTurn, canEndTurn, flag, more }: ActionBarProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  /* Close on anything that is not it — a click elsewhere, or Escape. */
  useEffect(() => {
    if (!open) return;

    const away = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);

    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        tone="primary"
        onClick={onEndTurn}
        disabled={!canEndTurn}
        className="px-3 py-1.5 text-sm whitespace-nowrap"
      >
        End turn
      </Button>

      {flag}

      <div ref={wrap} className="relative ml-auto">
        <Button
          tone="quiet"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="More"
          className="px-3 py-1.5 text-sm whitespace-nowrap"
        >
          <span aria-hidden>More</span>
        </Button>

        {open && (
          <div
            role="menu"
            aria-label="More"
            /*
             * Deliberately does *not* close on click. Some of these buttons own
             * a dialog — "My feedback", "How to play" — and closing the menu
             * unmounts the button *and the dialog it just opened*, so the thing
             * you asked for flashes and vanishes. Click-away and Escape close
             * it instead, which is what a popover should do anyway.
             */
            className={cx(
              "absolute right-0 bottom-full z-30 mb-2 flex w-52 flex-col items-stretch gap-1.5",
              "rounded-xl bg-(--color-panel-raised) p-2 shadow-2xl ring-1 ring-(--color-edge)/50",
              "[&>*]:w-full [&>*]:justify-center",
            )}
          >
            {more}
          </div>
        )}
      </div>
    </div>
  );
}
