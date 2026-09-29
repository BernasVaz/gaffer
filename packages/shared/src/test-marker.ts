/**
 * How a row written by a test says so.
 *
 * The cloud end-to-end suite writes to the **real project** — that is the point
 * of it, since a local copy cannot tell you whether the hosted auth service and
 * the real publication behave. The cost is that test matches, test identities
 * and test feedback land beside real ones, and once a wave of testers starts
 * there is no way to tell which is which after the fact.
 *
 * So every row a test creates carries this, and a purge can find exactly those
 * and nothing else. Marking at write time rather than guessing later is the
 * only version of this that is safe to run against production.
 */
export const TEST_MARKER = "gaffer-e2e";

/** A display name that announces itself as a test identity. */
export function testDisplayName(label: string): string {
  return `${TEST_MARKER}:${label}`;
}

/** Whether a display name belongs to a test identity. */
export function isTestDisplayName(name: string): boolean {
  return name.startsWith(`${TEST_MARKER}:`);
}
