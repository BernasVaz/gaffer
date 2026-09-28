import { useCallback, useState } from "react";

import { contextOf, submit } from "./submit";
import type { MatchSetup } from "@gaffer/shared";

/** Props for {@link HowWasThat}. */
export interface HowWasThatProps {
  /** The match that just finished. */
  setup: MatchSetup;
  /** The final turn, for context. */
  turn: number;
  /** The final score, as `home–away`. */
  score: string;
  /** The online match this was, if it was one. */
  matchId?: string | null;
}

const FACES = [
  { rating: 1, face: "😖", label: "Bad" },
  { rating: 2, face: "🙁", label: "Poor" },
  { rating: 3, face: "😐", label: "Fine" },
  { rating: 4, face: "🙂", label: "Good" },
  { rating: 5, face: "😀", label: "Great" },
] as const;

/**
 * "How was that match?" — one tap, and a sentence only if they want to.
 *
 * The end of a match is the one moment a tester has an opinion and nothing to
 * do, which makes it the only place a rating costs them nothing. Everything
 * else about the match is captured for them.
 *
 * Deliberately not a form. A required text box at the end of a game is how you
 * get no answers; a row of faces is how you get most of them.
 */
export function HowWasThat({ setup, turn, score, matchId }: HowWasThatProps): React.JSX.Element {
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const send = useCallback(
    (chosen: number, body: string) => {
      setRating(chosen);
      setSent(true);
      void submit({
        kind: "match",
        body,
        rating: chosen,
        meta: contextOf({ setup, turn, score, matchId }),
      });
    },
    [setup, turn, score, matchId],
  );

  if (sent && note === "") {
    return (
      <section
        aria-label="How was that match"
        className="shrink-0 rounded-xl bg-(--color-panel) p-3 text-sm ring-1 ring-(--color-edge)/35"
      >
        <p className="font-semibold">Thanks — that helps.</p>
        <label className="mt-2 flex flex-col gap-1">
          <span className="text-xs text-white/60">Anything you want to add?</span>
          <textarea
            aria-label="Anything you want to add"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (note.trim() !== "" && rating !== null) send(rating, note.trim());
            }}
            rows={2}
            className="rounded-lg bg-(--color-night-soft) px-3 py-2 text-white ring-1 ring-(--color-edge)/40"
          />
        </label>
      </section>
    );
  }

  return (
    <section
      aria-label="How was that match"
      className="shrink-0 rounded-xl bg-(--color-panel) p-3 ring-1 ring-(--color-edge)/35"
    >
      <p className="text-sm font-extrabold">How was that match?</p>

      <div className="mt-2 flex justify-between gap-1">
        {FACES.map((option) => (
          <button
            key={option.rating}
            type="button"
            aria-label={option.label}
            aria-pressed={rating === option.rating}
            onClick={() => send(option.rating, note.trim())}
            className={[
              "chunky flex-1 rounded-lg py-2 text-xl",
              rating === option.rating
                ? "bg-(--color-gold)/25 ring-1 ring-(--color-gold)/60"
                : "bg-(--color-night-soft) ring-1 ring-(--color-edge)/30",
            ].join(" ")}
          >
            <span aria-hidden>{option.face}</span>
          </button>
        ))}
      </div>

      {/*
        Said where it is sent, not in a help page. A tester should know their
        notes leave the device at the moment they are choosing to write one
        (docs/SECURITY.md).
      */}
      <p className="mt-2 text-[0.68rem] leading-snug text-white/50">
        Your feedback and match details are sent to us to help improve the game — anonymous, no
        email.
      </p>
    </section>
  );
}
