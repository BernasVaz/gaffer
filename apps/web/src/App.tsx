import { MAX_SEED, parseReplayTo, parseSetup, setupToQuery, type MatchSetup } from "@gaffer/shared";
import { domAnimation, LazyMotion } from "motion/react";
import { lazy, Suspense, useCallback, useState } from "react";

import { Guide } from "./guide/Guide";
import { shouldAutorun } from "./guide/seen";
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

/**
 * A seed nobody chose.
 *
 * Every fresh visit gets its own match. Before this the setup screen always
 * opened on the same default seed, so the first match anybody played was the
 * same match everybody played — and "shuffle" was a button you had to know to
 * press. A link that *carries* a seed still wins, because that link is a
 * specific match somebody meant to share (ADR 0019).
 */
const freshSeed = () => Math.floor(Math.random() * (MAX_SEED + 1));

/** Put the setup in the address bar, so the link is always the match on screen. */
function publish(setup: MatchSetup) {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  window.history.replaceState(null, "", setupToQuery(setup) + window.location.hash);
}

/**
 * The client: a setup screen, a match, and the guide over either.
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
/**
 * The online screen, loaded only by a build that has online play.
 *
 * A module-level ternary on a build-time constant: with `ASYNC_MULTIPLAYER`
 * folded to `false`, the `import()` is removed along with the branch, so the
 * Supabase library never enters the alpha bundle's module graph at all. A
 * static import would have kept it — dead code can be dropped, but an imported
 * module with side effects cannot.
 *
 * The first cut of this shipped `signInAnonymously` and 214 KB of client
 * library into the alpha bundle. It was found by grepping the built file, which
 * is now a test.
 */
const OnlineScreen =
  import.meta.env.VITE_ASYNC_MULTIPLAYER === "true"
    ? lazy(() => import("./online/OnlineScreen"))
    : null;

/**
 * Which app this is.
 *
 * Online play, when a build has it. `ASYNC_MULTIPLAYER` is a build-time
 * constant, so in the alpha bundle this branch — and `OnlineScreen` with it —
 * is dead code the bundler removes: absent rather than merely unreachable,
 * which is the property that lets multiplayer be built during a freeze
 * (ADR 0028).
 *
 * A wrapper rather than an early return inside {@link LocalApp}, because a
 * component that returns before its hooks is a component whose hooks run in a
 * different order on the next render.
 */
export function App() {
  if (OnlineScreen !== null && new URLSearchParams(search()).get("online") === "1") {
    return (
      <Suspense fallback={null}>
        <OnlineScreen />
      </Suspense>
    );
  }

  return <LocalApp />;
}

/** A match played on this device: hotseat, or against the machine. */
function LocalApp() {
  const [initial] = useState<MatchSetup>(() => {
    const parsed = parseSetup(search());
    return wasSentAMatch() ? parsed : { ...parsed, seed: freshSeed() };
  });
  /*
   * Read once, from the link this page was opened with. It is a place to stand
   * inside a match rather than part of which match it is, so it survives
   * neither a restart nor a new setup — both of which are new matches.
   */
  const [replayTo] = useState<number | undefined>(() => parseReplayTo(search()));
  const [setup, setSetup] = useState<MatchSetup | null>(() =>
    wasSentAMatch() ? parseSetup(search()) : null,
  );

  /*
   * Off unless somebody asks. `shouldAutorun` reads one constant, currently
   * false, so running it unasked on a first visit is a switch rather than a
   * rewrite — see `guide/seen.ts`.
   */
  const [guiding, setGuiding] = useState<boolean>(() => shouldAutorun());

  /** Bumped whenever the player comes back for another game. */
  const [fresh, setFresh] = useState<number | null>(null);

  const start = useCallback((chosen: MatchSetup) => {
    publish(chosen);
    setSetup(chosen);
  }, []);

  /* Leaving a match goes back to the setup screen on a *new* seed, so "New
     match" means a new match rather than the same one again. */
  const leave = useCallback(() => {
    setFresh(freshSeed());
    setSetup(null);
  }, []);

  const teach = useCallback(() => setGuiding(true), []);

  /* The guide ends by handing over whatever was chosen along the way, so it
     finishes in a real match rather than back where it began. */
  const taught = useCallback((chosen: MatchSetup) => {
    setGuiding(false);
    publish(chosen);
    setSetup(chosen);
  }, []);

  return (
    /*
     * `strict` is the point of this as much as the size is: it makes the plain
     * `motion.*` components throw, so there is no way to quietly reintroduce the
     * full bundle by importing the obvious thing in a new component. `domAnimation`
     * covers animation, gestures and exit — everything the board uses. Layout
     * animation and drag are the parts left behind, and nothing here wants them.
     */
    <LazyMotion features={domAnimation} strict>
      {guiding ? (
        <Guide initial={setup ?? initial} onFinish={taught} onSkip={() => setGuiding(false)} />
      ) : setup === null ? (
        <SetupScreen
          initial={fresh === null ? initial : { ...initial, seed: fresh }}
          onStart={start}
          onHowToPlay={teach}
        />
      ) : (
        <Match
          key={setupToQuery(setup)}
          setup={setup}
          replayTo={replayTo}
          onLeave={leave}
          onHowToPlay={teach}
        />
      )}
    </LazyMotion>
  );
}
