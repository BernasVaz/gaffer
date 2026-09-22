# 0016 — Feedback stays on the device, and the archive is the door to it

- **Status:** Accepted
- **Date:** 2026-09-22
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

ADR-less until now, the feedback capture shipped in #28 stored a match's flagged moments
under a key built from the whole setup:

```
gaffer:feedback:<seed>:<mode>:<play>:<side>:<difficulty>:<actions>
```

One key per match, which is right: two matches cannot overwrite each other, and a refresh
finds its own. What was missing is that **nothing could find a key it was not already
holding**. The only control that reached a note was the "Download feedback" button inside
the match it belonged to. Flag three things, press "New match", and those three were still
on disk with nothing in the interface able to open them.

Bernardo hit exactly this: notes saved, no way back to them. The notes were never lost —
the door was.

A second, quieter problem: the report needs the finished board to describe a match, and a
saved entry holds only a setup, a log and some notes. Anything rebuilding a report for a
match nobody is playing has to replay it.

## Decision

**An archive that scans, rather than an index that is maintained.** `listSavedMatches()`
walks `localStorage` for the key prefix and parses what it finds. An index would be a
second thing to keep true, and the first time it disagreed with the keys somebody would
lose notes — which is the failure this is here to prevent. The keys already carry the
whole setup, and reading a handful of them on open is free.

**Always reachable, from both screens.** "My feedback" sits on the setup screen — the
front door, and where "New match" returns to — and in the match's own button row. Notes
outlive the match that produced them, so the way back to them cannot live inside one.

**Validation is item by item, and only the setup is fatal.** Storage is untrusted input:
hand-edited, written by an older build, half-written by a tab that was closed. The usual
"reject the entry" would throw away nine good notes to punish one malformed one. So each
note and each logged event is parsed on its own and the survivors are kept, the count of
what was dropped is shown, and the only thing that must parse outright is the setup —
because it is what replays the match and what builds the link.

**"Download raw data" exists as the escape hatch.** Whatever the validator decides, the
untouched JSON is one click away. No parsing decision of ours can put a tester's words
beyond reach.

**`savedAt` was added as optional, not as a version bump.** Bumping the schema version
would have made every existing entry unreadable — including the ones that prompted this
work. Entries without it sort last and say nothing about when they were taken, which is
a far better outcome than being discarded for tidiness.

**Deleting asks first, and only ever deletes one match.** There is no "clear everything".

**`buildMatch` moved out of `useMatch` into `match/replay.ts`.** Two things now turn a
seed and a list of commands into a match — the live match and the archive rebuilding a
report — and they must agree exactly. A report describing a different board from the one
a note was taken on would be worse than no report at all.

**Nothing is sent anywhere.** The file remains the handover, as #28 decided. The panel
says so in as many words, because "saved on this device only" is a thing a tester needs
to know _before_ they clear their site data, not after.

## Consequences

A tester who never finishes a match loses nothing. Everything on the device can be pulled
out in two clicks, as one Markdown file with every repro link intact, at any time.

Notes remain **per browser**. A different browser, a different device, a private window,
or cleared site data each look empty, and no amount of client work changes that. The
archive makes the window between "wrote a note" and "sent it" as short as we can make it;
it does not close it.

The client now depends on `zod` directly. It was already in the bundle through
`@gaffer/shared`, so the cost is zero bytes — but it is now an honest dependency rather
than a borrowed one, which is correct for a package that validates its own persisted
saves (CLAUDE.md, "Validation"). The whole change is +2 kB gzipped.

## On collecting feedback centrally

Asked, and the answer for the alpha is **no, not yet**.

A collector means a host, a schema, a write endpoint, abuse control on an endpoint that
accepts free text from the public internet, and a policy for personal data in notes — and
the client is a static site on GitHub Pages today, so all of that is new ground rather
than an addition. Against that: an alpha is a handful of testers, and the marginal cost of
"send me the file" is one message each.

The property that actually matters is already there. A report carries a seed, a setup and
the full command log, so any note in it reproduces exactly on someone else's machine. A
server would add convenience, not information.

**The trigger to revisit is M4.** A Colyseus server is already the next milestone, and a
feedback endpoint on infrastructure we already run is a small piece of work. Building a
collector now means standing up hosting twice.

If central collection is wanted before then, the cheap version is a prefilled GitHub issue
link rather than a backend — the repo is public, and a URL can carry the notes and the
repro links, though not the full log.

## Alternatives considered

**One key for everything.** Simpler to find, and it loses the per-match isolation that
stops a refresh in match B clobbering match A's notes. It would also need a migration over
data we specifically must not risk.

**An index key listing the others.** The thing scanning avoids. Two sources of truth about
which notes exist, and the one that goes stale takes notes with it.

**Uploading on match end.** Rejected on the same grounds as #28: nothing about a match
should leave the machine unless somebody chooses to send it, and an alpha tester flagging
"this is confusing" has not consented to publishing it.
