/**
 * Whether the guide has ever been run on this device.
 *
 * Kept only so that auto-running it on a first visit is a switch rather than a
 * rewrite — see {@link AUTORUN_ON_FIRST_VISIT}.
 */
const SEEN_KEY = "gaffer:guide:seen";

/**
 * Whether a first visit starts the guide by itself.
 *
 * **Off**, deliberately. A tutorial that begins before anyone has asked for one
 * is the thing people complain about, and the alpha testers arriving through a
 * shared link are mid-conversation about a specific match — being taken away
 * from it to be taught the basics is the wrong trade.
 *
 * Everything needed to turn it on is already here and already tested: flipping
 * this to `true` makes a first visit run the guide once, and the "How to play"
 * control keeps working exactly as it does now. It is one constant precisely so
 * that the decision can be revisited without anybody having to rebuild the
 * mechanism to try it.
 */
export const AUTORUN_ON_FIRST_VISIT = false;

/** Whether this browser has been through the guide before. */
export function hasSeenGuide(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    /* A private window has seen nothing, which is the safe answer either way. */
    return false;
  }
}

/** Remember that it has been run, whether it was finished or skipped. */
export function markGuideSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    /* Storage refused. The guide still ran; it will simply offer itself again. */
  }
}

/**
 * Whether to start the guide unasked, right now.
 *
 * Reads the switch **and** the flag, so turning the switch on cannot re-teach
 * somebody who has already been through it.
 */
export function shouldAutorun(): boolean {
  return AUTORUN_ON_FIRST_VISIT && !hasSeenGuide();
}
