import { useEffect, useState } from "react";

import { supabase } from "./client";
import type { RemoteMatch } from "./matches";

/**
 * The other player's name, once there is another player.
 *
 * A match against "your opponent" is a match against nobody in particular, and
 * the name is the one thing that makes an asynchronous game feel like it has a
 * person on the other end of it.
 *
 * Readable because row-level security says so: a profile is visible to whoever
 * shares a match with it and to nobody else (`20260929000001_harden.sql`). This
 * asks for exactly the row it is entitled to and gives up quietly when the
 * answer is no — a missing name is a cosmetic loss, not a reason to interrupt
 * somebody's match.
 *
 * What comes back is **somebody else's text**: it is rendered as text like any
 * other untrusted string, never as markup.
 */
export function useOpponentName(match: RemoteMatch, userId: string): string | null {
  const opponentId = match.homeUser === userId ? match.awayUser : match.homeUser;

  /* Stored with the id it belongs to, so a name for a previous opponent is
     never shown for this one — and so nothing has to be cleared in an effect. */
  const [found, setFound] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (opponentId === null) return;

    const db = supabase();
    if (db === null) return;

    let live = true;
    void db
      .from("profiles")
      .select("display_name")
      .eq("id", opponentId)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name;
        if (live && typeof name === "string" && name !== "") setFound({ id: opponentId, name });
      });

    return () => {
      live = false;
    };
  }, [opponentId]);

  return found !== null && found.id === opponentId ? found.name : null;
}
