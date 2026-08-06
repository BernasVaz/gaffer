import { z } from "zod";

/**
 * A match seed — the single number that makes a game reproducible.
 *
 * Every source of chance in the engine derives from this value, so two clients
 * given the same seed and the same move log must reach an identical final state.
 * That property is what lets us share a match as a URL, replay it for debugging,
 * and let the server re-verify a client's moves without trusting them.
 *
 * Constrained to an unsigned 32-bit integer because the engine's RNG operates on
 * 32-bit words; a wider value would silently lose precision and break replays.
 */
export const SeedSchema = z
  .number()
  .int()
  .min(0)
  .max(0xffffffff)
  .describe("Unsigned 32-bit match seed");

/** A validated match seed. Obtain one via {@link parseSeed}, never by casting. */
export type Seed = z.infer<typeof SeedSchema>;

/**
 * Parse an untrusted value (URL parameter, network message, saved match) into a
 * {@link Seed}.
 *
 * @throws {z.ZodError} if the value is not a valid unsigned 32-bit integer.
 */
export function parseSeed(value: unknown): Seed {
  return SeedSchema.parse(value);
}
