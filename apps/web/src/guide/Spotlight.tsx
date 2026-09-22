import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** A rectangle in viewport coordinates. */
interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** How much room to leave around whatever is being pointed at. */
const PADDING = 6;

/** The union of several rectangles, so one spotlight can cover a cluster. */
function union(rects: readonly DOMRect[]): Rect | null {
  if (rects.length === 0) return null;

  const top = Math.min(...rects.map((r) => r.top));
  const left = Math.min(...rects.map((r) => r.left));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const right = Math.max(...rects.map((r) => r.right));

  return {
    top: top - PADDING,
    left: left - PADDING,
    width: right - left + PADDING * 2,
    height: bottom - top + PADDING * 2,
  };
}

/** Measure every anchor that is actually on the page. */
function measure(anchors: readonly string[]): Rect | null {
  const rects = anchors
    .map((selector) => document.querySelector(selector))
    .filter((element): element is Element => element !== null)
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

  return union(rects);
}

export interface SpotlightProps {
  /**
   * What to light up, as CSS selectors.
   *
   * Several are allowed and the spotlight is their union — which is how you
   * light "this player and everywhere it can go" without lighting the whole
   * board and losing the point. Anchors that are not on the page are ignored,
   * so a step about a section that only exists in solo play simply lights
   * whatever else it named.
   */
  anchors: readonly string[];
  /** How far down the page the card reaches, so the anchor can be scrolled clear of it. */
  cardTop: number;
  /** Re-measure when this changes — the step, in practice. */
  generation: number;
}

/**
 * The dimmed page with a hole in it.
 *
 * The hole is genuinely transparent: one element with an enormous outward
 * `box-shadow`, so everything outside it is darkened and the real control shows
 * through **unaltered** underneath. Redrawing a copy of the thing being taught
 * would be a second version of the interface to keep in step with the first,
 * and the first time they disagreed the guide would be teaching a lie.
 *
 * Geometry is measured, never assumed. That is what makes it correct in both
 * orientations for free: a board cell is found by its accessible name, which
 * ADR 0014 fixed as the engine's own coordinates at every orientation, and
 * where that cell happens to be drawn is then simply read off the element.
 */
export function Spotlight({ anchors, cardTop, generation }: SpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const settled = useRef(false);

  /*
   * Laid out before paint, so a step never appears with its spotlight in the
   * previous step's place. The scroll and the second measure are the fiddly
   * part: the card is pinned to the bottom, so an anchor low on the page has to
   * be brought up into the room above it — and moving the page invalidates the
   * measurement that decided to move it.
   */
  useLayoutEffect(() => {
    settled.current = false;

    const place = () => {
      const first = measure(anchors);
      if (first === null) {
        setRect(null);
        return;
      }

      const ceiling = 12;
      const floor = cardTop - 14;
      const overshoot = first.top + first.height - floor;
      const undershoot = ceiling - first.top;
      const shift = overshoot > 0 ? overshoot : undershoot > 0 ? -undershoot : 0;

      if (Math.abs(shift) > 1 && !settled.current) {
        settled.current = true;
        window.scrollBy({ top: shift, behavior: "instant" });
        requestAnimationFrame(place);
        return;
      }

      setRect(first);
    };

    place();
  }, [anchors, cardTop, generation]);

  /* The page can move under it: a rotated phone, a soft keyboard, a resize. */
  useEffect(() => {
    const again = () => setRect(measure(anchors));

    window.addEventListener("resize", again);
    window.addEventListener("orientationchange", again);
    window.addEventListener("scroll", again, { passive: true });

    return () => {
      window.removeEventListener("resize", again);
      window.removeEventListener("orientationchange", again);
      window.removeEventListener("scroll", again);
    };
  }, [anchors]);

  if (rect === null) {
    // Nothing to point at — dim the page anyway, so the card still reads as
    // an overlay rather than as a panel that has appeared in the layout.
    return <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-black/70" />;
  }

  return (
    <div
      aria-hidden
      /*
       * Inert to the mouse, or it swallows the click it is asking for. The
       * element is only the size of the hole and paints the dimming with an
       * outward shadow, so without this the one control a step wants pressed
       * is the one control covered by the thing pointing at it. Found by an
       * end-to-end test; every unit test passed, because jsdom does no
       * hit-testing at all.
       */
      className="guide-spotlight pointer-events-none fixed z-40 rounded-xl"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    />
  );
}
