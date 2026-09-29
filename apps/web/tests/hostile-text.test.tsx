import { DEFAULT_SETUP } from "@gaffer/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HowWasThat } from "../src/feedback/HowWasThat";

/**
 * Text somebody else wrote is drawn as text.
 *
 * Feedback bodies and display names are the two strings in this application
 * that a stranger controls, and both end up on a screen. React escapes what it
 * renders, so the guarantee is really "nothing bypasses React" — which is a
 * property of the whole codebase rather than of one component, and is asserted
 * here as such.
 */
const HOSTILE = [
  "<script>alert('xss')</script>",
  '<img src=x onerror="alert(1)">',
  "<svg/onload=alert(1)>",
  "javascript:alert(1)",
] as const;

describe("hostile text is text", () => {
  it("has no raw-HTML sink anywhere in the client", async () => {
    /*
     * The real guarantee. React escapes its output, so an injected script can
     * only run if something hands the DOM a string directly — and the way to
     * check that is to look, rather than to test one component and hope.
     */
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });

    const offenders = walk("src")
      .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return (
          source.includes("dangerouslySetInnerHTML") ||
          /\.innerHTML\s*=/.test(source) ||
          /\.outerHTML\s*=/.test(source) ||
          source.includes("insertAdjacentHTML") ||
          source.includes("document.write")
        );
      });

    expect(offenders, "these hand the DOM a string directly").toEqual([]);
  });

  it("renders a script tag in a match rating as words", () => {
    render(
      <HowWasThat
        setup={{ ...DEFAULT_SETUP, seed: 1 }}
        turn={24}
        score={HOSTILE[0]}
        matchId={null}
      />,
    );

    const panel = screen.getByRole("region", { name: "How was that match" });
    expect(panel.querySelector("script"), "a script element was created").toBeNull();
    expect(panel.querySelector("img"), "an image element was created").toBeNull();
  });

  it("keeps every hostile string out of the element tree", () => {
    for (const hostile of HOSTILE) {
      const { container, unmount } = render(
        <HowWasThat
          setup={{ ...DEFAULT_SETUP, seed: 1 }}
          turn={1}
          score={hostile}
          matchId={null}
        />,
      );

      expect(container.querySelector("script")).toBeNull();
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("svg[onload]")).toBeNull();
      unmount();
    }
  });
});
