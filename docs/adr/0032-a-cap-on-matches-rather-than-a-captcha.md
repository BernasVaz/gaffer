# 0032 — A cap on matches, rather than a CAPTCHA

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** nothing. Implements the first of the four mitigations
  `docs/SECURITY.md` gates on exposure.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Anonymous sign-in costs nothing and takes no time. That is the property that makes it good
onboarding (ADR 0030) and exactly the property an abuser wants. Until now it sat behind a
flag nobody could reach; from Wave 1 the endpoint is behind a public URL.

Supabase rate-limits anonymous sign-ins **per IP per hour** — 30 by default. That blunts a
naive script, does little about a distributed one, and nothing at all about a single
signed-in identity creating matches in a loop.

## Decision

**A cap on match creation, enforced in the database**, by a `before insert` trigger:

- **30 matches an hour** per player.
- **50 unfinished matches** at once per player.

In the database rather than the client, because a client-side cap is a suggestion to
anybody holding an access token and a REST client — which every player is.

**Deliberately loose.** These are meant to be invisible to a person playing and obvious to
a script. A tester who hits one has found a bug in the numbers, not in their own behaviour.
Finished matches stop counting against the concurrent cap, so somebody who plays a lot is
never squeezed by their own history.

**Per player, not global.** One abuser cannot lock everybody else out — there is a test for
exactly that, because a rate limit that turns into a denial of service is worse than none.

**CAPTCHA remains the escalation, not the starting point.** It is configuration plus a
client widget, it is ready when wanted, and it taxes every honest player to stop an attack
nobody has attempted. The trigger for adding it is **public linkability** — open
matchmaking, a public lobby, a link posted where anyone can find it — not a date and not a
hunch.

## Consequences

**The blast radius of a minted identity is storage and noise**, not other people's games.
Row-level security already confines it to matches it is a side of; this bounds how many of
those it can make.

**The numbers are in the schema as functions**, `matches_per_hour()` and
`matches_unfinished_cap()`, so changing one is a migration with a diff rather than a magic
number somewhere in a policy.

**No cleanup yet.** Anonymous identities and their matches accumulate, and an identity that
never created a match is deletable in principle. Nobody has written that, and pretending
otherwise would be worse than saying so.

**It is a bound, not a defence.** A determined abuser with many IPs can still make junk
matches at 30 an hour each. What this buys is that the cost of doing so is no longer zero
and the ceiling is knowable — which for an invited alpha is the proportionate answer.
