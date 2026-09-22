import { useEffect, useRef } from "react";

import { Button } from "../ui/Button";

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

export interface StepCardProps {
  /** The label above the title. */
  chapter: string;
  /** Which step this is, counting from zero. */
  index: number;
  /** How many there are. */
  total: number;
  /** The heading. */
  title: string;
  /** The explanation. */
  body: string;
  /** What the player has to do, when the step is waiting on them. */
  prompt?: string;
  /** Go back a step. Absent on the first. */
  onBack?: () => void;
  /** Go on. Absent while the step is waiting for something to be done. */
  onNext?: () => void;
  /** The label for the forward button. */
  nextLabel: string;
  /** Leave the guide. */
  onSkip: () => void;
  /** Measured by the guide, so the spotlight can keep clear of the card. */
  onMeasure: (top: number) => void;
}

/**
 * The card that does the talking.
 *
 * A sheet pinned to the bottom rather than a bubble beside whatever it is
 * pointing at. On a phone a spotlight on the board leaves nowhere for a bubble
 * to go, and the first mock of this put the card squarely on top of the thing
 * it was describing. Pinning it, and scrolling the anchor into the room above,
 * means the two can never collide at any size.
 *
 * It is a real modal dialog: focus moves into it when the step changes, so
 * somebody on a keyboard is reading the step rather than hunting for it, and
 * Escape leaves.
 */
export function StepCard({
  chapter,
  index,
  total,
  title,
  body,
  prompt,
  onBack,
  onNext,
  nextLabel,
  onSkip,
  onMeasure,
}: StepCardProps) {
  const card = useRef<HTMLDivElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);

  /* Announce the step by moving focus to its heading. A live region would read
     it too, but focus also *takes* the reader there, which is what somebody
     tabbing around actually needs. */
  useEffect(() => {
    heading.current?.focus();
  }, [index]);

  useEffect(() => {
    const measure = () => {
      if (card.current) onMeasure(card.current.getBoundingClientRect().top);
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [onMeasure, index, body, prompt]);

  return (
    <div
      ref={card}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      aria-describedby="guide-body"
      className={cx(
        "fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl bg-(--color-panel-raised) p-4",
        "shadow-[0_18px_40px_-12px_rgba(0,0,0,0.75)] ring-1 ring-(--color-edge)/50",
      )}
    >
      <p className="text-[0.62rem] font-extrabold tracking-[0.18em] text-(--color-gold) uppercase">
        {chapter} &middot; {index + 1} of {total}
      </p>

      <h2
        id="guide-title"
        ref={heading}
        tabIndex={-1}
        className="mt-1 mb-1.5 text-lg leading-tight font-extrabold focus:outline-none"
      >
        {title}
      </h2>

      <p id="guide-body" className="text-sm leading-snug text-white/75">
        {body}
      </p>

      {prompt && (
        <p className="mt-2.5 flex items-center gap-2 text-xs font-bold text-(--color-gold)">
          <span aria-hidden className="guide-prompt-dot size-2 rounded-full bg-(--color-gold)" />
          {prompt}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button tone="quiet" onClick={onSkip} className="px-3 py-1.5 text-xs">
          Skip
        </Button>

        <ol aria-hidden className="mr-auto ml-1 flex gap-1.5">
          {Array.from({ length: total }, (_unused, step) => (
            <li
              key={step}
              className={cx(
                "size-1.5 rounded-full",
                step === index ? "bg-(--color-gold)" : "bg-white/25",
              )}
            />
          ))}
        </ol>

        {onBack && (
          <Button tone="quiet" onClick={onBack} className="px-3 py-1.5 text-sm">
            Back
          </Button>
        )}

        {onNext && (
          <Button tone="primary" onClick={onNext} className="px-4 py-1.5 text-sm">
            {nextLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
