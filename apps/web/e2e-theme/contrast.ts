import type { Page } from "@playwright/test";

/**
 * The contrast ratio between an element's text and the surface behind it.
 *
 * Measured in the browser from *computed* styles, because that is the only
 * place the answer lives: a class name cannot tell you what colour something
 * ended up, and this whole class of bug is "the colour is not what the author
 * assumed".
 *
 * Walks up for the first ancestor with a non-transparent background, which is
 * what the eye does — an element with no background of its own is sitting on
 * whatever is behind it, and that is what its text has to be legible against.
 * A page that never paints one lands on the browser's default, which in light
 * mode is white, which is the bug this exists to catch.
 */
export interface Contrast {
  /** Accessible name or text, for a failure message worth reading. */
  label: string;
  /** Text colour, as the browser computed it. */
  color: string;
  /** The surface found behind it. */
  background: string;
  /** WCAG contrast ratio, 1 to 21. */
  ratio: number;
}

/** Measure every element matching `selector` that has text of its own. */
export async function measureContrast(page: Page, selector: string): Promise<Contrast[]> {
  return page.evaluate((sel) => {
    /*
     * Resolve any colour the browser might hand back to plain sRGB.
     *
     * Not a regular expression over the string. Tailwind v4 computes
     * `text-white/80` to `oklab(0.999994 … / 0.8)`, and reading those three
     * numbers as red, green and blue turns white into near-black — which is
     * how the first version of this guard reported 1.07:1 for text that was
     * perfectly legible. A canvas converts whatever the syntax is, because it
     * has to paint it.
     */
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const parse = (value: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r ?? 0, g ?? 0, b ?? 0, (a ?? 255) / 255];
    };

    const channel = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };

    const luminance = ([r, g, b]: number[]) =>
      0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);

    /** Composite a possibly translucent colour over what is behind it. */
    const over = (top: number[], bottom: number[]): number[] => {
      const alpha = top[3] ?? 1;
      return [0, 1, 2].map((i) => (top[i] ?? 0) * alpha + (bottom[i] ?? 0) * (1 - alpha));
    };

    /** The effective surface behind an element, composited up the tree. */
    const surfaceOf = (node: Element): number[] => {
      const stack: number[][] = [];
      let current: Element | null = node;

      while (current !== null) {
        const colour = parse(getComputedStyle(current).backgroundColor);
        if ((colour[3] ?? 0) > 0) {
          stack.push(colour);
          if (colour[3] === 1) break;
        }
        current = current.parentElement;
      }

      /* Nothing opaque anywhere up the tree means the page itself was never
         painted, and the browser's own default is what shows through. */
      let base = [255, 255, 255, 1];
      for (const layer of stack.reverse()) base = [...over(layer, base), 1];
      return base;
    };

    const results: Contrast[] = [];

    for (const node of Array.from(document.querySelectorAll(sel))) {
      const own = Array.from(node.childNodes).some(
        (child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim() !== "",
      );
      if (!own) continue;

      const style = getComputedStyle(node);
      if (style.visibility === "hidden" || style.display === "none") continue;

      const text = over(parse(style.color), surfaceOf(node));
      const background = surfaceOf(node);

      const lighter = Math.max(luminance(text), luminance(background));
      const darker = Math.min(luminance(text), luminance(background));

      results.push({
        label: (node.textContent ?? "").trim().slice(0, 60),
        color: style.color,
        background: `rgb(${background.slice(0, 3).map(Math.round).join(", ")})`,
        ratio: Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2)),
      });
    }

    return results;
  }, selector);
}
