import type { Seed } from "@gaffer/shared";

/**
 * A deterministic source of randomness.
 *
 * The engine never reaches for `Math.random()` — an {@link Rng} is passed in, so
 * the same seed always produces the same sequence. This is the mechanism behind
 * replays, shareable match URLs, and a server that can re-verify a client's moves.
 */
export interface Rng {
  /** The next value in the sequence, in the half-open interval `[0, 1)`. */
  next(): number;

  /**
   * A uniformly distributed integer in the inclusive range `[min, max]`.
   *
   * @throws {RangeError} if `max` is less than `min`.
   */
  int(min: number, max: number): number;

  /**
   * The RNG's current internal position.
   *
   * Snapshotting this alongside match state lets a game be saved and resumed
   * mid-match without diverging from the original sequence.
   */
  state(): number;
}

/**
 * Create a seeded random number generator (the `mulberry32` algorithm).
 *
 * Chosen because it is tiny, has no dependencies, passes basic statistical tests,
 * and — crucially — is fully specified by a single 32-bit word of state, so a
 * match can be serialised and resumed exactly.
 *
 * This is intentionally **not** cryptographically secure. It decides dice rolls,
 * never anything security-sensitive.
 *
 * @param seed - The match seed. See `@gaffer/shared`'s `parseSeed`.
 * @returns An {@link Rng} positioned at the start of the sequence.
 *
 * @example
 * ```ts
 * const a = createRng(1234);
 * const b = createRng(1234);
 * a.next() === b.next(); // always true — this is the whole point
 * ```
 */
export function createRng(seed: Seed): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };

  return {
    next,

    int(min: number, max: number): number {
      if (max < min) {
        throw new RangeError(`Invalid range: max (${max}) is less than min (${min})`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },

    state(): number {
      return state;
    },
  };
}
