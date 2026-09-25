import { supabase } from "./client";

/** Who you are online: a uuid nobody chose and a name you did. */
export interface Identity {
  /** The stable id every match row refers to. */
  id: string;
  /** What the other player sees. */
  displayName: string;
}

/** Where the "we have warned you about this" flag lives. */
const WARNED_KEY = "gaffer:online:warned";

/**
 * Whether the player has been told their identity cannot be recovered.
 *
 * Kept per-device because that is the scope of the problem it describes: the
 * identity lives in this browser's storage and nowhere else, so this is exactly
 * the device that would lose it.
 */
export function hasBeenWarned(): boolean {
  try {
    return localStorage.getItem(WARNED_KEY) === "1";
  } catch {
    /* Private browsing, blocked storage — warn again rather than assume. */
    return false;
  }
}

/** Remember that the warning has been shown and accepted. */
export function rememberWarned(): void {
  try {
    localStorage.setItem(WARNED_KEY, "1");
  } catch {
    /* Nothing to do: the warning simply shows again next time, which is safe. */
  }
}

/**
 * Sign in anonymously and make sure a profile exists.
 *
 * No email and no password (ADR 0030), so there is nothing to type and nothing
 * to remember — and nothing to recover with, which is why
 * {@link hasBeenWarned} exists and why the first-match screen says so.
 *
 * Idempotent: an existing session is reused rather than replaced, because
 * replacing it would silently strand every match that session owns.
 */
export async function signIn(displayName: string): Promise<Identity> {
  const db = supabase();
  if (db === null) throw new Error("online play is not configured in this build");

  const existing = await db.auth.getSession();
  let userId = existing.data.session?.user.id ?? null;

  if (userId === null) {
    const { data, error } = await db.auth.signInAnonymously();
    if (error !== null) throw new Error(`could not sign in: ${error.message}`);
    userId = data.user?.id ?? null;
  }

  if (userId === null) throw new Error("signed in without a user");

  const { error } = await db
    .from("profiles")
    .upsert({ id: userId, display_name: displayName }, { onConflict: "id" });
  if (error !== null) throw new Error(`could not save your name: ${error.message}`);

  return { id: userId, displayName };
}

/** The signed-in identity, or null when nobody is signed in on this device. */
export async function currentIdentity(): Promise<Identity | null> {
  const db = supabase();
  if (db === null) return null;

  const { data } = await db.auth.getSession();
  const user = data.session?.user;
  if (user === undefined) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return { id: user.id, displayName: (profile?.display_name as string | undefined) ?? "Player" };
}
