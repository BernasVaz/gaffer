# Plan — asynchronous multiplayer

**Status:** plan only. Nothing here is built, and nothing here should be built until
Wave 1 has been through the alpha and the rules have stopped moving.

**Revision, 2026-09-25:** reorganised around a **trust ladder** — Phase 1 trust-based,
Phase 2 authoritative — with a single-row command log replacing the two-table design, and
an explicit policy for what an engine-edition bump does to a match already in flight. What
changed and what it contradicts is listed at the end.

---

## What makes this unusually cheap

Gaffer's engine is deterministic, and a match is already reducible to two things:

```ts
{ setup: { mode, play, side, difficulty, actions, seed }, log: MatchCommand[] }
```

That is not a design for multiplayer — it is what the feedback archive already stores
and what a report already carries. `buildMatch` in `apps/web/src/match/replay.ts` turns
it back into a board today.

So the synced payload is **tiny**, and it is the only thing that has to be right:

|                                     | size                        |
| ----------------------------------- | --------------------------- |
| a setup                             | ~60 bytes as a query string |
| one command                         | ~50–80 bytes as JSON        |
| a full 5-a-side match (~55 actions) | **~4 KB**, uncompressed     |
| an 11-a-side match (~190 actions)   | ~14 KB                      |

A turn is one command appended to an array. There is no board state to reconcile, no
diffing, and no possibility of two clients disagreeing about what a log _means_ — that is
what determinism buys, and it is already paid for.

**In Phase 1 the server does not run the engine.** It stores an ordered list and enforces
who may append to it. This is a **deliberate simplification, not the architecture** — see
_The trust ladder_ below, which is where it gets paid back.

---

## What is actually missing

1. **Somewhere to put a match.** GitHub Pages is static; there is no request we can write
   to.
2. **Identity.** Enough to say "this half of the match is yours", which is not the same
   as accounts.
3. **A notification.** Or at least "it is your turn" when the page is opened.
4. **A lobby.** Create a match, get a link, see whose turn it is in the ones you are in.

Everything else — rules, replay, rendering, the link format — exists.

---

## The trust ladder

The question "can a client cheat?" has three answers, and picking one up front is how
this gets over-built. The honest sequence is to climb.

### Phase 1 — trust-based, with row-level security and desync detection

The server stores the log and enforces **who** may append and **when**. It does not
enforce **what**: it cannot tell a legal command from an illegal one, because it does not
run the engine.

What that does and does not leave open:

- **Row-level security stops the things that matter socially.** You cannot write to a
  match you are not a side of, cannot play out of turn, and cannot overwrite history.
  That covers every accident and most mischief.
- **A forged _legal-looking_ command gets through.** The opponent's client then replays
  the log, disagrees, and the match breaks rather than being stolen — the cheat cannot
  manufacture a win, only a dead match.
- **Desync detection is what turns that from a mystery into a report.** Each append
  carries a **state hash** of the board the appending client believed it was producing.
  The other client recomputes and compares. A mismatch stops play, names the command index
  it diverged at, and offers to file it — which is the same machinery the feedback archive
  already has, pointed at a different failure.

That hash is cheap and it is the thing that makes Phase 1 defensible: the system is not
"trusting and hoping", it is "trusting and checking".

**Good enough for:** an alpha among people who know each other, and for a long tail of
friendly play after that.

### Phase 2 — authoritative, via an edge function

An edge function runs `applyAction` before the append is accepted. An illegal command is
rejected at the door and the match never breaks.

This is cheap **because the engine was built for it**: `@gaffer/engine` is pure,
framework-free, ESM, and has no Node built-ins, no DOM, no clock and no unseeded
randomness (CLAUDE.md's first architectural rule). That is precisely the shape a Deno edge
function wants. It is roughly half a day on top of Phase 1, and it is the same engine
build the client runs — not a reimplementation.

**Needed when:** anything is competitive, ranked, or played between strangers. Also the
moment desync reports stop being rare, whatever the cause.

### Why climb rather than start at the top

Phase 2's edge function needs a deployment pipeline, a version-pinning story between the
function's engine and the client's, and a cold-start budget on every move. Phase 1 needs
none of that and is a working game. Building Phase 2 first means debugging both the
product and the referee at once, with no evidence yet that the referee is needed.

The ladder is only honest if the rungs are real, which is why the state hash is in
Phase 1 rather than deferred with it: **Phase 1 must be able to tell you it failed.**

---

## Option A — Supabase

Postgres, row-level security, anonymous auth, Realtime subscriptions, a generous free
tier.

### Shape — one row per match

The log lives **in the match row** as `jsonb`, not in a `moves` table:

```sql
matches (
  id            uuid primary key,
  setup         jsonb        not null,   -- mode, play, side, difficulty, actions, seed
  log           jsonb        not null,   -- MatchCommand[], append-only in practice
  log_version   int          not null,   -- optimistic lock; bumped on every append
  rules_version int          not null,   -- the engine edition it is being played under
  state_hash    text,                    -- the appending client's view of the board
  home          uuid,
  away          uuid,
  created_at    timestamptz  not null,
  last_move_at  timestamptz
)
```

_Illustrative, not a migration._

**Concurrency is `log_version`, optimistically.** An append is a conditional update: write
`log = log || $command` and `log_version = $seen + 1` **where** `log_version = $seen`. Zero
rows updated means somebody else moved first, and the client refetches and re-decides. A
double-tap or two open tabs cannot both play a turn.

This replaces the earlier two-table design, where a `(match_id, index)` primary key did
the same job by making a duplicate append a key collision. Both work. The single row wins
on three counts:

- **A match is one read.** No join, no ordering by index, no partial log while a page
  paints — which matters because the client's replay wants the whole log anyway.
- **Optimistic locking generalises.** `log_version` guards _any_ change to the row, not
  just an append — claiming the second seat, sealing a match at an edition bump, recording
  a resignation. A `moves` table only ever guarded moves.
- **The row is the unit everything else already speaks.** `{ setup, log }` is what the
  archive stores and what a report carries; splitting the log across rows meant
  reassembling it at both ends.

The honest cost: a 14 KB `jsonb` is rewritten on every append at 11-a-side. At this size
that is nothing, and if it ever stops being nothing the `moves` table is still there to go
back to.

**Identity.** `signInAnonymously()` gives a stable uuid in local storage. No email, no
password, no account screen. Claiming the second seat is "open the link while signed in
anonymously and the `away` column is null" — itself a `log_version`-guarded update, so two
people opening the link at once cannot both take it.

**Turn notification.** Realtime on `matches` gives live updates when both players happen
to be looking. For genuinely async, an email or push needs more — see _What this does not
solve_.

**Effort:** ~2–3 days for a working Phase-1 async match: schema, policies, a
`useRemoteMatch` hook alongside the existing `useMatch`, a lobby screen, and the link
format. Phase 2 is roughly another half day on top.

**Cost:** free tier covers an alpha comfortably (500 MB database, 50k monthly active
users). A match is ~4 KB; ten thousand matches is 40 MB.

**Risk:** a real dependency, a real dashboard, and secrets to keep out of the client
bundle — though with RLS the anon key _is_ public by design, which is the usual
misunderstanding.

---

## Option B — Cloudflare Workers + KV or D1

A worker in front of KV (or D1, which is SQLite).

**Shape.** Three endpoints: `POST /match`, `GET /match/:id`, `POST /match/:id/move`.
Append-only, with the same optimistic-version check done in the worker.

**Effort:** ~2 days, but _more_ of it is ours — there is no auth, no row security and no
realtime, so all three get hand-rolled or skipped.

**Cost:** free tier is generous; D1 free tier is 5 GB.

**Risk:** less to learn, more to own. Worth it only if we specifically do not want
Supabase's opinions.

**Note on the ladder:** a worker is already code we run on every move, so Phase 1 and
Phase 2 collapse into one — running `applyAction` there is a few lines rather than a new
deployment target. That is Option B's one genuine advantage, and it is not enough to
outweigh hand-rolling identity.

---

## Option C — no backend at all: the log _is_ the link

Encode the whole match into the URL and pass it back and forth by any means the players
already have — message, email, whatever.

A 5-a-side match is ~4 KB of JSON, which is ~1.4 KB gzipped and base64url-encoded. That
fits in a URL for most of a match and then does not. Commands compress far better than
JSON suggests — a move is a player index and a cell, which packs into two bytes — so a
bit-packed log would keep a whole 5-a-side match under 500 characters.

**Effort:** ~1 day for the encoder, the decoder and a "copy your reply" button.

**Cost:** nothing, ever. No account, no server, no privacy policy, no uptime.

**Against:** the players do the syncing. No lobby, no notification, no "which matches am
I in", and a lost message loses the match. It is correct and it is charmless.

---

## Engine editions, and matches caught in flight

A stored match is a seed plus a command log, and it reproduces a match **only against the
rules that produced it** — which is what `RULES_VERSION` and ADR 0022 exist to say out
loud. The edition is on **4** and has moved four times in a fortnight.

Local storage made that survivable: a stale saved match is one person's archive, and
marking it "older" is enough. A _live_ match between two people is not survivable the same
way, because the two clients can be on different editions at the same moment.

**The policy:**

1. **Every match records `rules_version` when it is created**, and it never changes.
2. **A client may only append when its own `RULES_VERSION` matches the row's.** A client
   on a newer edition refuses, says so plainly, and offers to read the match rather than
   continue it.
3. **An edition bump seals every in-flight match. It does not migrate them.** There is no
   safe rewrite of a command log across a rules change: ADR 0021's dribble and ADR 0025's
   passing both changed what a command _produces_ or whether it is legal at all, so a
   replay under new rules is a different match that never happened. Sealing is honest;
   migrating is the silent corruption the edition field was added to prevent.
4. **A sealed match stays readable.** It replays under the edition it was played at if
   that engine build is still available, and is otherwise shown as a result plus a log,
   marked unplayable. It is never deleted for being old.

**The consequence, stated plainly: shipping a rules change ends every match in flight.**
That is a product cost, not a technical one, and it is the strongest argument in this
document for not building any of this during an alpha whose whole purpose is to produce
rules changes.

Two things that soften it, neither free:

- **A grace window.** Announce the bump, let in-flight matches finish for a few days on
  the old edition, refuse new ones. Needs the old engine build to stay deployed and
  selectable by the client — real work, and the first thing here that makes the client
  carry two engines.
- **Rules-edition lobbies.** Matches only pair players on the same edition. Simpler, and
  it silently splits an already-small player base.

> **This policy was inferred rather than handed down.** It follows from ADR 0022 and the
> existing `rulesStanding` / `replaysFaithfully` helpers, but the _product_ choice —
> sealing over a grace window — has not been made by anybody yet. Flagged for a decision
> before this is built, not before it is planned.

---

## Recommendation

**Option A, Phase 1 first, and not yet.**

Supabase, because the two things it gives away — anonymous identity and row-level security
— are precisely the two things this needs and the two that are tedious to build. Option B
is the same work with more of it ours; Option C is a clever trick that solves the transport
and none of the product.

**Phase 1 first**, because a trust-based log with RLS and a state hash is a working game,
and Phase 2 is half a day on top of it whenever the evidence says it is needed.

**Not yet**, because async multiplayer multiplies the cost of every rules change. Today a
rule changes and every match is regenerated from its seed. Once matches are stored and
shared, a rules change **ends them**.

The sequencing that follows:

1. ~~**Version the engine.**~~ **Done** — `RULES_VERSION`, ADR 0022, currently edition 4,
   stamped on every stored match and every feedback report. This was the blocking
   precondition and it is no longer blocking.
2. **Get Wave 1 through the alpha**, and let the rules stop moving. Every open question in
   `post-alpha.md` is a potential edition bump, and each one would end every live match.
3. **Decide the in-flight policy** above — sealing, grace window, or edition lobbies.
4. **Then build Phase 1.**
5. **Climb to Phase 2** when play stops being between friends, or when desync reports stop
   being rare.

**A cheap intermediate worth considering now:** Option C's encoder, on its own. It makes
"send someone your position" work with no infrastructure, it is a day, and it is not
wasted work if Phase 1 follows — though note that a **bit-packed** log and the **jsonb**
log above are not the same artefact, so the encoder is a shared _idea_ rather than shared
code.

---

## What this does not solve, and should be said out loud

**Push notification.** "It is your turn" arriving on a phone that does not have the page
open needs either email (Supabase can, via a database webhook and a mail provider) or web
push (a service worker, VAPID keys, and permission the player has to grant). Neither is
included in the estimates above. For an alpha, "you see it when you open the link" is
probably enough, and it is worth deciding that deliberately rather than discovering it.

**Cheating, in Phase 1.** Covered by the ladder rather than left open: RLS stops the
social failures, the state hash catches the rest and names where it happened, and Phase 2
closes it properly. What Phase 1 genuinely cannot do is stop a determined opponent from
_breaking_ a match — only from stealing one.

**Abandonment.** Most async matches are never finished. A `last_move_at` and a rule for
what happens after a fortnight is a product decision, not a technical one, but it needs
making before matches accumulate — and it interacts with sealing above, since an abandoned
match and a sealed one look identical from the lobby and should not read the same.

**The solo opponent.** `@gaffer/ai` is deterministic, so an async match against it is
possible and pointless — it would play instantly. Worth noting only so nobody builds it.
