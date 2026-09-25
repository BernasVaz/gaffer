import { expect, test } from "@playwright/test";

import { measureContrast } from "./contrast";

/**
 * The online screens are legible, whatever the phone's theme is.
 *
 * Gaffer is one theme — a night match — and every screen paints that surface
 * itself, because there is no body-level background. The online screens were
 * built without painting one, so on a **light-mode phone** they inherited the
 * browser's white page and drew white text on it. Unreadable, and invisible to
 * every test we had, because nothing asserted on a colour.
 *
 * This runs with `colorScheme: "light"` deliberately: dark mode hides the bug.
 * It needs no Supabase — the sign-in screen is the first thing a tester sees
 * and it renders before anything is fetched.
 */
test.describe("the online screens in light mode", () => {
  test.use({ colorScheme: "light" });

  test("paints its own surface rather than inheriting a white page", async ({ page }) => {
    await page.goto("./?online=1");
    await expect(page.getByRole("button", { name: /I understand/ })).toBeVisible();

    const surface = await page.evaluate(() => {
      const main = document.querySelector("main");
      return main === null ? null : getComputedStyle(main).backgroundColor;
    });

    expect(surface, "the online screen has no background of its own").not.toBeNull();

    /* Dark, and opaque. A transparent background is the bug however good it
       looks on the machine it was written on. */
    const [r, g, b, a] = (surface ?? "").match(/[\d.]+/g)?.map(Number) ?? [];
    expect(a ?? 1, "the surface is translucent, so the page shows through").toBe(1);
    expect(
      0.2126 * (r ?? 255) + 0.7152 * (g ?? 255) + 0.0722 * (b ?? 255),
      "the surface is not dark",
    ).toBeLessThan(80);
  });

  test("every word on the sign-in screen has real contrast", async ({ page }) => {
    await page.goto("./?online=1");
    await expect(page.getByRole("button", { name: /I understand/ })).toBeVisible();

    const measured = await measureContrast(page, "main *");
    expect(measured.length, "nothing was measured").toBeGreaterThan(5);

    /* 4.5:1 is WCAG AA for body text. The failure this guards against scores
       about 1.1, so the threshold is not the interesting part — having one is. */
    const poor = measured.filter((item) => item.ratio < 4.5);

    expect(
      poor.map((item) => `${item.ratio}:1 — "${item.label}" (${item.color} on ${item.background})`),
      "text on the online sign-in screen is unreadable",
    ).toEqual([]);
  });

  test("reads at phone width too", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("./?online=1");
    await expect(page.getByRole("button", { name: /I understand/ })).toBeVisible();

    const poor = (await measureContrast(page, "main *")).filter((item) => item.ratio < 4.5);
    expect(poor.map((item) => `${item.ratio}:1 — "${item.label}"`)).toEqual([]);
  });
});
