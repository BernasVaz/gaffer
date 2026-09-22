# Plan — asynchronous multiplayer

**Status:** plan only. Nothing here is built, and nothing here should be built until the
alpha's rules questions are settled.

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
diffing, and no possibility of two clients disagreeing about what a log means — that is
what determinism buys, and it is already paid for.

**The server never has to run the engine** for async play. It stores an ordered list and
enforces who may append to it. Validating moves server-side is a separate, later
decision (see _Cheating_ below).

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

## Option A — Supabase

Postgres, row-level security, anonymous auth, Realtime subscriptions, a generous free
tier.

**Shape.** Two tables:

```sql
matches (id uuid pk, setup jsonb, home uuid, away uuid, created_at, last_move_at)
moves   (match_id uuid, index int, command jsonb, by uuid, at timestamptz,
         primary key (match_id, index))
```

The `(match_id, index)` primary key is the whole concurrency story: appending move _n_
twice is a duplicate-key error, so a double-tap or two tabs cannot both play a turn.
Row-level security does the rest — you may insert a move only into a match you are a
side of, and only when `index` is the next one.

**Identity.** `signInAnonymously()` gives a stable uuid in local storage. No email, no
password, no account screen. Claiming the second seat is "open the link while signed in
anonymously and the `away` column is null".

**Turn notification.** Realtime on `moves` gives live updates when both players happen to
be looking. For genuinely async, an email or push needs more — see _What this does not
solve_.

**Effort:** ~2–3 days for a working async match: schema, policies, a `useRemoteMatch`
hook alongside the existing `useMatch`, a lobby screen, and the link format.

**Cost:** free tier covers an alpha comfortably (500 MB database, 50k monthly active
users). A match is ~4 KB; ten thousand matches is 40 MB.

**Risk:** a real dependency, a real dashboard, and secrets to keep out of the client
bundle — though with RLS the anon key _is_ public by design, which is the usual
misunderstanding.

---

## Option B — Cloudflare Workers + KV or D1

A worker in front of KV (or D1, which is SQLite).

**Shape.** Three endpoints: `POST /match`, `GET /match/:id`, `POST /match/:id/move`.
Append-only, with the same "index must be the next one" check done in the worker.

**Effort:** ~2 days, but _more_ of it is ours — there is no auth, no row security and no
realtime, so all three get hand-rolled or skipped.

**Cost:** free tier is generous; D1 free tier is 5 GB.

**Risk:** less to learn, more to own. Worth it only if we specifically do not want
Supabase's opinions.

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

## Recommendation

**Option A, and not yet.**

Supabase, because the two things it gives away — anonymous identity and row-level
security — are precisely the two things this needs and the two that are tedious to build.
Option B is the same work with more of it ours; Option C is a clever trick that solves
the transport and none of the product.

**Not yet**, because async multiplayer multiplies the cost of every rules change. Today a
rule changes and every match is regenerated from its seed. Once matches are stored,
a rules change either invalidates stored logs or requires the engine to be versioned per
match — `state.rules` already travels with a match for exactly this reason, but the
_verbs_ do not, and ADR 0018 has just demonstrated how a one-rule change ripples.

The sequencing that follows from that:

1. settle the rules questions in the propose-first lane;
2. **version the engine** — a `rulesVersion` on the stored setup, and a refusal to replay
   a log written by a version we no longer implement;
3. then build this.

**A cheap intermediate worth considering now:** Option C's encoder, on its own. It makes
"send someone your position" work with no infrastructure, it is a day, and the bit-packed
log format it forces us to define is the same format Option A would want to store. It is
not wasted work if we do A later.

---

## What this does not solve, and should be said out loud

**Push notification.** "It is your turn" arriving on a phone that does not have the page
open needs either email (Supabase can, via a database webhook and a mail provider) or web
push (a service worker, VAPID keys, and permission the player has to grant). Neither is
included in the estimates above. For an alpha, "you see it when you open the link" is
probably enough, and it is worth deciding that deliberately rather than discovering it.

**Cheating.** An append-only log with a server that does not run the engine will accept
an illegal move; the _other_ client will then refuse to replay it, so the match breaks
rather than being stolen. Running `applyAction` in an edge function closes it properly and
is maybe half a day on top of Option A — the engine is already pure, framework-free and
ESM, which is exactly what a Deno edge function wants. Worth doing before anything is
competitive, not worth doing for an alpha among friends.

**Abandonment.** Most async matches are never finished. A `last_move_at` and a rule for
what happens after a fortnight is a product decision, not a technical one, but it needs
making before matches accumulate.

**The solo opponent.** `@gaffer/ai` is deterministic, so an async match against it is
possible and pointless — it would play instantly. Worth noting only so nobody builds it.
