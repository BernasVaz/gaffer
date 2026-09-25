import type { MatchState } from "@gaffer/shared";

/**
 * A canonical rendering of any JSON-shaped value.
 *
 * `JSON.stringify` is not canonical: two objects with the same contents in a
 * different insertion order produce different strings. That is harmless when
 * you are writing a file and fatal when two machines are comparing hashes to
 * decide whether they are playing the same match — the whole point is that a
 * *disagreement* means something, so an agreement must not be able to look like
 * one.
 *
 * Keys are sorted; arrays keep their order, because in a board an array's order
 * is information.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

/** FNV-1a, 64-bit, in BigInt so it is exact rather than nearly right. */
function fnv1a64(input: string): string {
  const prime = 1099511628211n;
  const mask = 0xffffffffffffffffn;
  let hash = 14695981039346656037n;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash ^ BigInt(input.charCodeAt(index))) & mask;
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, "0");
}

/**
 * A fingerprint of a board, for two clients to compare.
 *
 * Asynchronous multiplayer's Phase 1 does not run the engine on the server, so
 * it cannot tell a legal command from an illegal one (ADR 0028). What it *can*
 * do is notice that the two players are no longer looking at the same match:
 * each side stamps the board it believes it produced, and the other recomputes
 * and compares. A mismatch names the command it happened at rather than leaving
 * somebody staring at a board that is quietly wrong.
 *
 * **Sorted by player id before hashing**, because the order players happen to
 * sit in an array is not part of the position — two clients that agree about
 * the football must agree about the hash.
 *
 * **This is an integrity check, not a security primitive.** FNV-1a is fast and
 * stable and makes accidental divergence essentially impossible to miss; it
 * would not stop somebody determined to forge a colliding board. That is
 * Phase 2's job, and `docs/SECURITY.md` says so out loud.
 *
 * @param state - The board to fingerprint. Not modified.
 * @returns Sixteen hex characters.
 *
 * @example
 * ```ts
 * stateHash(before) === stateHash(after); // false once anything has moved
 * ```
 */
export function stateHash(state: MatchState): string {
  const players = [...state.players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return fnv1a64(canonical({ ...state, players }));
}
