const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(" ");

/** How loud a button is. */
export type ButtonTone = "primary" | "standard" | "quiet";

const TONE: Record<ButtonTone, { className: string; edge: string }> = {
  primary: {
    className: "bg-(--color-gold) text-amber-950 hover:bg-amber-300",
    edge: "#a16207",
  },
  standard: {
    className: "bg-(--color-panel-raised) text-white hover:bg-emerald-800",
    edge: "#07200f",
  },
  quiet: {
    className: "bg-(--color-panel) text-white/80 hover:bg-(--color-panel-raised)",
    edge: "#05150b",
  },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** How loud it is. Defaults to `standard`. */
  tone?: ButtonTone;
}

/**
 * A button you can feel.
 *
 * The whole effect is a lit top edge and a hard bottom edge: that is what makes
 * something look pressable rather than printed. Pressing removes the bottom edge
 * and drops the button into the gap it leaves, so the motion is the shadow
 * disappearing rather than the button moving away from the finger.
 *
 * It is done with `box-shadow` rather than borders so the element never changes
 * size — nothing around it shifts when it is pressed — and the whole treatment
 * lives in one CSS class (`.chunky`), including the reduced-motion version,
 * which is stronger than a rule every component has to remember.
 */
export function Button({ tone = "standard", className, style, ...rest }: ButtonProps) {
  const chosen = TONE[tone];

  return (
    <button
      type="button"
      {...rest}
      style={{ ...style, ["--btn-edge" as string]: chosen.edge }}
      className={cx(
        "chunky cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold",
        "focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40",
        chosen.className,
        className,
      )}
    />
  );
}
