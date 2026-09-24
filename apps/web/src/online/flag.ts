/**
 * Whether asynchronous multiplayer is reachable in this build.
 *
 * **Off, and it stays off for the alpha.** Phase 1 develops in the open on
 * `main` rather than on a long-lived branch — the alternative is a fortnight of
 * divergence and a merge nobody can review — so the flag is what keeps it out
 * of the build testers are actually playing.
 *
 * Nothing behind this may be reachable from the setup screen, the match screen
 * or a URL while it is false. A tester who stumbles into a half-built lobby is
 * a wasted wave.
 *
 * Deliberately a `const` rather than an env var: a build-time constant lets the
 * bundler drop everything behind it, so the online code is not merely hidden in
 * the alpha bundle, it is **absent** from it. Same pattern as
 * `AUTORUN_ON_FIRST_VISIT` in `guide/seen.ts`.
 */
export const ASYNC_MULTIPLAYER = false;
