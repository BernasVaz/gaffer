# 0030 — Phase 1 identity is anonymous, plus a name

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** nothing. The async plan listed magic-link as the default with anon as
  acceptable; this decides between them on evidence from the live project.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Phase 1 needs enough identity to say "this half of the match is yours". That is not the
same as accounts, and the alpha's whole shape — a link you send a friend — argues against
anything that stands between opening a link and playing.

Two options were live: **magic-link** email, or **anonymous sign-in plus a display name**.

Probing the live project settled it:

```
{"error_code":"anonymous_provider_disabled"}      -- a toggle
"mailer_autoconfirm": false, "email": true        -- and an SMTP problem
```

Magic-link is not one switch. Supabase's built-in mailer is rate-limited to a couple of
messages an hour and, on a free project, deliverable only to project members. Fifteen to
thirty testers means signing up for an SMTP provider, configuring it, setting a redirect
that survives GitHub Pages' path-based hosting, and debugging deliverability — **before
one person can log in**.

## Decision

**Anonymous sign-in, plus a display name in `public.profiles`.**

`signInAnonymously()` gives a stable uuid held in local storage. No email, no password, no
account screen, no round-trip through an inbox. The name is what the other player sees;
nothing else is collected.

**The honest cost, stated where a user will meet it:** clear your browser storage and your
identity is gone, and the matches go with it. There is no recovery, because there is
nothing to recover _to_ — no email, no password. The client must say this plainly at the
point somebody creates their first match rather than burying it.

**This is a Phase 1 decision, not a permanent one.** Supabase can link an anonymous user to
an email later, in place, keeping the same uuid — so upgrading to magic-link or a real
account does not orphan a single match and does not need a schema change. That is the
property that makes starting here cheap rather than reckless.

## Consequences

**Zero friction, which is the point.** Open link → name yourself → play. For an alpha
measured in "did they finish a match", every screen before the pitch is attrition.

**It opens a spam vector**, because free identities are free to mint. Documented in
`docs/SECURITY.md` with its mitigation, and gated: CAPTCHA and tightened rate limits go in
**before** anything is publicly linkable, not before an alpha among people we invited.

**Every anonymous user is a real row in `auth.users`**, and they accumulate. Cleaning up
identities that never created a match is housekeeping nobody has written yet; it is on the
Phase 2 list rather than pretended away.

**Local and cloud configuration must agree.** `supabase/config.toml` sets
`enable_anonymous_sign_ins = true` so the local stack matches the project — a policy tested
against a differently configured database is a test of nothing.
