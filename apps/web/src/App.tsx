import { parseReplayTo, parseSetup, setupToQuery, type MatchSetup } from "@gaffer/shared";
import { domAnimation, LazyMotion } from "motion/react";
import { useCallback, useState } from "react";

import { Match } from "./match/Match";
import { SetupScreen } from "./setup/SetupScreen";

/** The query string this page was opened with, or an empty one under a test. */
const search = () => (typeof window === "undefined" ? "" : window.location.search);

/**
 * Whether the link named a match.
 *
 * A bare visit means somebody arrived to play and should choose how; a link with
 * a seed in it means somebody was *sent* a specific match, and the friendliest
 * thing to do with that is start it. They can still change their mind — "New
 * match" comes back here.
 */
const wasSentAMatch = () => /(^|[?&])seed=/.test(search());

/** Put the setup in the address bar, so the link is always the match on screen. */
function publish(setup: MatchSetup) {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  window.history.replaceState(null, "", setupToQuery(setup) + window.location.hash);
}

/**
 * The client: a setup screen, and a match.
 *
 * There is no router and no need for one — there are two screens and the URL
 * describes the match rather than the page. What the address bar holds is always
 * the match currently on screen, so "copy the link" needs no button and cannot
 * go stale.
 *
 * The match is keyed by its setup, so starting a new one discards every scrap of
 * the last: the board, the selection, the seeded generator. A stale die surviving
 * a restart is the kind of bug that only shows up as "that replay doesn't match"
 * three weeks later.
 */
export function App() {
  const [initial] = useState<MatchSetup>(() => parseSetup(search()));
  /*
   * Read once, from the link this page was opened with. It is a place to stand
   * inside a match rather than part of which match it is, so it survives
   * neither a restart nor a new setup — both of which are new matches.
   */
  const [replayTo] = useState<number | undefined>(() => parseReplayTo(search()));
  const [setup, setSetup] = useState<MatchSetup | null>(() =>
    wasSentAMatch() ? parseSetup(search()) : null,
  );

  const start = useCallback((chosen: MatchSetup) => {
    publish(chosen);
    setSetup(chosen);
  }, []);

  const leave = useCallback(() => setSetup(null), []);

  return (
    /*
     * `strict` is the point of this as much as the size is: it makes the plain
     * `motion.*` components throw, so there is no way to quietly reintroduce the
     * full bundle by importing the obvious thing in a new component. `domAnimation`
     * covers animation, gestures and exit — everything the board uses. Layout
     * animation and drag are the parts left behind, and nothing here wants them.
     */
    <LazyMotion features={domAnimation} strict>
      {setup === null ? (
        <SetupScreen initial={initial} onStart={start} />
      ) : (
        <Match key={setupToQuery(setup)} setup={setup} replayTo={replayTo} onLeave={leave} />
      )}
    </LazyMotion>
  );
}
