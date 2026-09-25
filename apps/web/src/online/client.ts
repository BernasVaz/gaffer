import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase client, made once.
 *
 * Returns `null` when the project is not configured, which is the ordinary case
 * for a build with multiplayer off — asking for a client should not be the thing
 * that throws in a bundle that will never use one.
 *
 * The anon key is compiled into the bundle and that is by design: it identifies
 * the project, and row-level security rather than secrecy is what stops one
 * player writing to another player's match (`docs/SECURITY.md`). The
 * service-role key must never appear here.
 */
let client: SupabaseClient | null | undefined;

/** The configured client, or `null` when there is no project to talk to. */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  client =
    typeof url === "string" && typeof key === "string" && url !== "" && key !== ""
      ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
      : null;

  return client;
}
