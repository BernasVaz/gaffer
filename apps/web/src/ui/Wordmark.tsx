/**
 * The name, treated as a badge rather than as a heading.
 *
 * A game's title is the first thing that tells you whether you are looking at a
 * product or at somebody's weekend project, and a default-weight `h1` says the
 * second. The gradient and the hard drop shadow cost nothing and do most of that
 * work on their own.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={[
        "bg-gradient-to-b from-amber-100 via-(--color-gold) to-amber-600 bg-clip-text",
        "font-extrabold tracking-tight text-transparent",
        "drop-shadow-[0_2px_0_rgba(0,0,0,0.45)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      Gaffer
    </span>
  );
}
