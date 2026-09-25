/// <reference types="vite/client" />

/**
 * The environment variables this client reads.
 *
 * Declared so they can be accessed as `import.meta.env.VITE_THING` rather than
 * `import.meta.env["VITE_THING"]` — which is not pedantry. **Vite only
 * substitutes the dot form at build time.** The bracket form survives into the
 * bundle as a runtime lookup, so every branch behind it stays reachable and
 * nothing behind a build-time flag can be tree-shaken away.
 *
 * That difference is load-bearing here: it is what makes the online layer
 * *absent* from the alpha bundle rather than merely unreachable in it. It was
 * found by grepping the built bundle for `signInAnonymously`, not by reading
 * the code.
 */
interface ImportMetaEnv {
  /** `"true"` in a build that should expose online play. Unset everywhere else. */
  readonly VITE_ASYNC_MULTIPLAYER?: string;
  /** The Supabase project this build talks to. */
  readonly VITE_SUPABASE_URL?: string;
  /** The project's anon key — public by design; see `docs/SECURITY.md`. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
