import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/Button";
import { CATEGORIES, CATEGORY_COPY, type Category } from "./notes";
import type { Captured } from "./useFeedback";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** The key that opens the note box. */
export const FLAG_HOTKEY = "f";

/** Whether a keystroke was meant for the page rather than for something being typed in. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export interface FlagMomentProps {
  /** Snapshot the board. Called the instant the box opens, never later. */
  capture: () => Captured;
  /** File the snapshot with what was written about it. */
  commit: (captured: Captured, category: Category, note: string) => void;
  /** How many moments have been flagged so far. */
  count: number;
  /** Called as the box opens and closes, so the match can hold still. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * The button that says "this, right here, is worth telling someone about".
 *
 * Two things it is built around.
 *
 * **The board is snapshotted when the box opens**, not when Save is pressed.
 * Somebody who flags a moment and then spends half a minute describing it is
 * still describing the thing that made them reach for the button — and in a
 * solo match the opponent is on a timer, so by the time they finish the board
 * genuinely is somewhere else.
 *
 * **There is a hotkey**, because the moments worth catching are the ones that
 * go past quickly, and a player whose hand is on the board should not have to
 * go looking for a button. It stands down while anything is being typed, so
 * writing the word "off" in a note does not open a second box.
 */
export function FlagMoment({ capture, commit, count, onOpenChange }: FlagMomentProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("confusing");
  const [note, setNote] = useState("");
  const capturedRef = useRef<Captured | null>(null);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  const start = () => {
    capturedRef.current = capture();
    setNote("");
    setCategory("confusing");
    setOpen(true);
  };

  const close = () => {
    capturedRef.current = null;
    setOpen(false);
  };

  const save = () => {
    const captured = capturedRef.current;
    if (captured) commit(captured, category, note);
    close();
  };

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

  /* Focus the writing, not the dialog: the player already knows what they want
     to say, and the fewer keystrokes between the thought and the text the more
     of the thought survives. */
  useEffect(() => {
    if (open) boxRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
        return;
      }

      if (open || isTyping(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== FLAG_HOTKEY) return;

      event.preventDefault();
      start();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <Button
        tone="quiet"
        onClick={start}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-2 px-3 py-1.5 text-sm whitespace-nowrap"
      >
        <span aria-hidden>⚑</span>
        Flag moment
        {count > 0 && (
          <span className="rounded-full bg-(--color-gold) px-1.5 text-[0.7rem] font-extrabold text-amber-950 tabular-nums">
            {count}
          </span>
        )}
        <kbd
          aria-hidden
          className="rounded border border-white/20 px-1 text-[0.6rem] font-bold text-white/50"
        >
          F
        </kbd>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="flag-heading"
            className="w-full max-w-md rounded-2xl bg-(--color-panel) p-4 ring-1 ring-(--color-edge)/50 shadow-2xl"
          >
            <h2 id="flag-heading" className="text-base font-bold">
              Flag this moment
            </h2>
            <p className="mt-0.5 mb-3 text-xs text-white/50">
              The board, the turn and the last few events are attached automatically.
            </p>

            <div
              role="group"
              aria-label="What kind of thing"
              className="mb-3 flex flex-wrap gap-1.5"
            >
              {CATEGORIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={category === option}
                  onClick={() => setCategory(option)}
                  title={CATEGORY_COPY[option].hint}
                  className={cx(
                    "cursor-pointer rounded-full px-3 py-1 text-xs font-bold ring-1",
                    category === option
                      ? "bg-(--color-gold) text-amber-950 ring-amber-200/60"
                      : "bg-black/30 text-white/65 ring-white/10 hover:text-white",
                  )}
                >
                  {CATEGORY_COPY[option].label}
                </button>
              ))}
            </div>

            <label htmlFor="flag-note" className="sr-only">
              What happened
            </label>
            <textarea
              id="flag-note"
              ref={boxRef}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What happened? (optional)"
              className="w-full resize-none rounded-xl bg-black/40 px-3 py-2 text-sm ring-1 ring-white/10 placeholder:text-white/30 focus:ring-2 focus:ring-(--color-gold) focus:outline-none"
            />

            <div className="mt-3 flex items-center gap-2">
              <Button tone="primary" onClick={save}>
                Save note
              </Button>
              <Button tone="quiet" onClick={close}>
                Cancel
              </Button>
              <span className="ml-auto text-[0.68rem] text-white/35">Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
