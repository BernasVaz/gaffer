import { parseSeed } from "@gaffer/shared";
import { describe, expect, it } from "vitest";

import { createRng } from "../src/index.js";

describe("createRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng(parseSeed(1234));
    const b = createRng(parseSeed(1234));

    const drawsA = Array.from({ length: 100 }, () => a.next());
    const drawsB = Array.from({ length: 100 }, () => b.next());

    expect(drawsA).toEqual(drawsB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(parseSeed(1));
    const b = createRng(parseSeed(2));

    expect(a.next()).not.toBe(b.next());
  });

  it("stays within the half-open interval [0, 1)", () => {
    const rng = createRng(parseSeed(99));

    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  describe("int", () => {
    it("stays within the inclusive range", () => {
      const rng = createRng(parseSeed(7));

      for (let i = 0; i < 1000; i += 1) {
        const value = rng.int(1, 6);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it("eventually returns every value in the range", () => {
      const rng = createRng(parseSeed(7));
      const seen = new Set<number>();

      for (let i = 0; i < 1000; i += 1) {
        seen.add(rng.int(1, 6));
      }

      expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("handles a single-value range", () => {
      const rng = createRng(parseSeed(7));
      expect(rng.int(3, 3)).toBe(3);
    });

    it("rejects an inverted range rather than returning nonsense", () => {
      const rng = createRng(parseSeed(7));
      expect(() => rng.int(6, 1)).toThrow(RangeError);
    });
  });

  describe("determinism guarantee", () => {
    /*
     * The mandatory determinism test from Master Plan §7, in miniature.
     * Once the engine has real state and actions this grows into a full
     * seed + move-log replay. The shape of the guarantee is the same:
     * resuming from a snapshot must not diverge from never having stopped.
     */
    it("resumes from a snapshotted state without diverging", () => {
      const original = createRng(parseSeed(42));
      const firstTen = Array.from({ length: 10 }, () => original.next());
      const snapshot = original.state();
      const continuation = Array.from({ length: 10 }, () => original.next());

      const resumed = createRng(parseSeed(snapshot));
      const replayed = Array.from({ length: 10 }, () => resumed.next());

      expect(replayed).toEqual(continuation);
      expect(firstTen).not.toEqual(continuation);
    });

    it("is stable across runs, not just within one", () => {
      // Hard-coded expected output. If a refactor changes the algorithm, this
      // fails loudly — every previously shared match URL would otherwise break.
      const rng = createRng(parseSeed(2026));
      const draws = Array.from({ length: 3 }, () => rng.int(1, 6));

      expect(draws).toEqual([3, 2, 4]);
    });
  });
});
