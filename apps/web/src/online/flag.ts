/**
 * Whether asynchronous multiplayer is reachable in this build.
 *
 * **Off for the alpha**, and off unless a build explicitly asks for it.
 *
 * Read from `import.meta.env` rather than hard-coded, because the end-to-end
 * suite has to be able to build a version with it *on* — but read into a module
 * constant so the property that matters is kept: Vite substitutes
 * `import.meta.env` at build time, so with the variable unset this is the
 * literal `false`, every branch behind it is dead code, and the online layer is
 * **absent from the alpha bundle** rather than merely unreachable in it.
 *
 * Nothing behind this may be reachable from the setup screen, the match screen
 * or a URL while it is false. A tester who stumbles into a half-built lobby is
 * a wasted wave.
 */
export const ASYNC_MULTIPLAYER = import.meta.env.VITE_ASYNC_MULTIPLAYER === "true";
