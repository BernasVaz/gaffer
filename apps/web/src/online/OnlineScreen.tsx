import { DEFAULT_SETUP, type MatchSetup } from "@gaffer/shared";
import { useCallback, useEffect, useState } from "react";

import { currentIdentity, hasBeenWarned, rememberWarned, signIn, type Identity } from "./identity";
import { createMatch, fetchMatch, joinMatch, type RemoteMatch } from "./matches";
import { OnlineMatch } from "./OnlineMatch";

/** The invite link for a match, in the shape the app already reads. */
export function inviteLink(matchId: string): string {
  const url = new URL(window.location.href);
  url.search = `?online=1&match=${matchId}`;
  return url.toString();
}

/**
 * Online play: sign in, start a match, send the link, take your turns.
 *
 * Deliberately plain. This is behind `ASYNC_MULTIPLAYER` and exists to prove the
 * round trip; the lobby somebody would actually live in comes later.
 */
export default function OnlineScreen(): React.JSX.Element {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [name, setName] = useState("");
  const [warned, setWarned] = useState(hasBeenWarned);
  const [match, setMatch] = useState<RemoteMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const wanted = new URLSearchParams(window.location.search).get("match");

  useEffect(() => {
    void currentIdentity().then((found) => {
      if (found !== null) setIdentity(found);
    });
  }, []);

  /* An invite in the address bar is loaded as soon as there is somebody to load
     it as — joining needs a signed-in id to put in the seat. */
  useEffect(() => {
    if (identity === null || wanted === null || match !== null) return;

    void (async () => {
      try {
        const found = await fetchMatch(wanted);
        if (found === null) {
          setError("That match could not be found, or it is not yours to see.");
          return;
        }
        const joined =
          found.awayUser === null && found.homeUser !== identity.id
            ? await joinMatch(found, identity.id)
            : found;
        setMatch(joined);
      } catch (thrown) {
        setError(thrown instanceof Error ? thrown.message : "could not open that match");
      }
    })();
  }, [identity, wanted, match]);

  const start = useCallback(async () => {
    if (identity === null) return;
    setBusy(true);
    setError(null);
    try {
      const setup: MatchSetup = {
        ...DEFAULT_SETUP,
        play: "hotseat",
        seed: Math.floor(Math.random() * 1_000_000_000),
      };
      const started = await createMatch(setup, identity.id);

      /* Put the match in the address bar. Without it a reload lands back on the
         lobby with the match still running and no way back to it — the link is
         how a match is addressed, for its owner as much as for the invitee. */
      window.history.replaceState(null, "", `?online=1&match=${started.id}`);
      setMatch(started);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "could not start a match");
    } finally {
      setBusy(false);
    }
  }, [identity]);

  const enter = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      rememberWarned();
      setWarned(true);
      setIdentity(await signIn(name.trim() === "" ? "Player" : name.trim()));
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : "could not sign in");
    } finally {
      setBusy(false);
    }
  }, [name]);

  if (match !== null && identity !== null) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        <h1 className="text-lg font-extrabold">Online match</h1>
        {match.awayUser === null && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Send this to your opponent</span>
            <input
              readOnly
              aria-label="Invite link"
              value={inviteLink(match.id)}
              className="rounded-lg bg-black/30 px-3 py-2 font-mono text-xs ring-1 ring-white/15"
            />
            {/*
              The link is a bearer capability and the copy has to say so: there
              is no per-invite token in Phase 1, so whoever opens it first takes
              the seat (docs/SECURITY.md).
            */}
            <span className="text-xs text-white/60">
              Anyone who opens this link takes the second seat — the first person to open it is your
              opponent. Send it to one person.
            </span>
          </label>
        )}
        <OnlineMatch match={match} userId={identity.id} />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <h1 className="text-lg font-extrabold">Play someone else</h1>

      {error !== null && (
        <p role="alert" className="rounded-lg bg-red-500/15 p-3 text-sm ring-1 ring-red-400/40">
          {error}
        </p>
      )}

      {identity === null ? (
        <>
          {/*
            Said before the first match, not buried in a help page. An anonymous
            identity lives in this browser and nowhere else, so the failure mode
            is silent and total (ADR 0030).
          */}
          <section
            aria-label="About your identity"
            className="rounded-xl bg-amber-500/10 p-3 text-sm ring-1 ring-amber-400/40"
          >
            <p className="font-bold text-amber-200">Your matches live in this browser</p>
            <p className="mt-1 text-white/80">
              There is no email and no password — just a name. That means nothing to sign up for,
              and nothing to recover with:{" "}
              <strong>
                clear this browser&apos;s storage and you lose your identity and every match with
                it.
              </strong>
            </p>
            <p className="mt-1 text-white/60">
              You will be able to attach an email later to keep the same matches.
            </p>
          </section>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">What should your opponent call you?</span>
            <input
              aria-label="Display name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={40}
              className="rounded-lg bg-black/30 px-3 py-2 ring-1 ring-white/15"
            />
          </label>

          <button
            type="button"
            onClick={() => void enter()}
            disabled={busy}
            className="chunky rounded-xl bg-(--color-gold) px-4 py-3 font-extrabold text-black disabled:opacity-40"
          >
            {warned ? "Continue" : "I understand — continue"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-white/70">
            Signed in as <strong>{identity.displayName}</strong>.
          </p>
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="chunky rounded-xl bg-(--color-gold) px-4 py-3 font-extrabold text-black disabled:opacity-40"
          >
            Start a match
          </button>
        </>
      )}
    </main>
  );
}
