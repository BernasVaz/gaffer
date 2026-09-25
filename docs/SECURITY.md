# Security

What Gaffer's online layer assumes, what it enforces, and — the part worth reading — what
it deliberately does not.

This is a live document: each entry names the phase it is addressed in and the trigger for
addressing it. Nothing here is a finding to be quietly fixed later; they are known
positions with dates attached.

---

## The trust ladder

Async multiplayer climbs deliberately (`docs/plans/async-multiplayer.md`, ADR 0028):

- **Phase 1 — trust-based.** The server stores a command log and enforces _who_ may append
  and _when_. It does not run the engine, so it cannot tell a legal command from an illegal
  one. A per-turn **state hash** means it can detect that it was lied to, and say which
  command it diverged at.
- **Phase 2 — authoritative.** An edge function runs `applyAction` before accepting an
  append, and an illegal command is refused at the door.

**What Phase 1 is honest about:** a determined opponent can forge a legal-looking command
and get it stored. What they cannot do is win with it — the other client replays, disagrees,
and the match stops with a report. **A cheat can break a match; it cannot steal one.**

---

## Enforced today

|                                                   | How                                                            |
| ------------------------------------------------- | -------------------------------------------------------------- |
| A non-player cannot read a match                  | RLS `select` policy; verified in `supabase/tests/rls.test.sql` |
| A player cannot write out of turn                 | RLS `update` policy on `turn_owner`                            |
| History cannot be rewritten or truncated          | `matches_guard_update` trigger                                 |
| A match's seed, setup and rules edition are fixed | same trigger                                                   |
| A stale client cannot double-move                 | optimistic `log_version`, +1 exactly                           |
| A taken seat cannot be hijacked                   | same trigger                                                   |
| A finished or sealed match is read-only           | same trigger                                                   |

**RLS decides _who_; the trigger decides _what_.** A policy sees the new row but cannot
compare it against the old one, so RLS alone would let the side to move replace the entire
log, change the seed, or move the match to a different rules edition. None of those are
"an illegal command", so **Phase 2 would not catch them either** — it validates commands,
not rows.

Twenty-one policy tests cover these, negative cases included. They are a release gate: the
trigger is the only part of the system the TypeScript compiler cannot see, so it does not
get exercised by a player until it is tested.

---

## G2 — the alpha build carries no multiplayer

**Status:** enforced in CI, on every push.

### What went wrong

The online layer is gated on `ASYNC_MULTIPLAYER`, a build-time constant, on the promise
that the bundler removes everything behind it — so the code is **absent** from a tester's
build rather than merely unreachable in it.

For one commit that promise was false. The flag read
`import.meta.env["VITE_ASYNC_MULTIPLAYER"]`, and **Vite substitutes only the dot form at
build time**. The bracket form survives into the bundle as a runtime lookup, so nothing
behind it was dead code and nothing was tree-shaken. A flag-off build contained the whole
online layer: `signInAnonymously`, the invite copy, and 214 KB of Supabase client.

**Nothing about this was detectable by the tools we had.** The code type-checked. Every
unit test passed. Every other end-to-end test passed. The code was _correct_ — it was
simply also _present_. It was found by grepping the built file by hand.

Had that build been deployed with a `.env` on the machine, the project URL and the anon
key would have been inlined with it. Reintroducing the bug deliberately confirms exactly
that: the guard below reports `tptglnkxxajaylispgki` and `sb_publishable` among its hits.

### The control

`apps/web/e2e/bundle-isolation.spec.ts`, in the offline suite, which needs no Supabase and
no network. It reads the **built artifact** — not the source, because the artifact is what
a tester downloads and the build is where the mistake lives — and fails if any of these
appear:

`supabase` · `gotrue` · `VITE_SUPABASE` · `sb_publishable` · `sb_secret` · `service_role` ·
the project ref · `signInAnonymously` · `OnlineScreen` · `Invite link` · `clear this
browser`

Two further assertions stop the guard rotting: **no chunk** may be emitted for the online
screen (a lazily imported module still ships if anything references it), and the bundle it
read must actually be the app — a check that silently passes on an empty directory guards
nothing.

**The guard is verified to fail.** Reintroducing the bracket-notation bug makes it report
all eleven strings; restoring the fix makes it pass. A gate that has never failed is a
gate nobody has tested.

### Verified against what testers actually received

`alpha-freeze-2` (`e70451f`) was checked two independent ways, assuming nothing:

1. **The live artifact**, downloaded from GitHub Pages — `index.html`, `index.js`,
   `index.css`.
2. **A clean-room rebuild** of the tag in a fresh worktree with no `.env` present.

Both contain **zero** occurrences of every string above. No tester has received the
Supabase keys, the client library, or any online code.

---

## Exposure — where this actually is

**Invited alpha, from Wave 1** (ADR 0033). Phase 1 trust model, no Phase 2 referee. Public
matchmaking, open lobbies and anything ranked stay shut.

That is a deliberate step up from "dark", and it changes what the controls are for. The
honest summary: **an invited alpha's real access control is the invitation.** Every
technical control below is sized to bound accidents and casual mischief among people we
asked to play — not to stop an adversary, which is what Phase 2 is for.

### Rules changes wait for a wave boundary

An engine-edition bump **seals every match in flight** (ADR 0029) — a command log does not
survive a rules change, and replaying one under new rules is a different match that never
happened. Until multiplayer shipped, that cost was hypothetical. It is now somebody's
actual game.

So bumps are **batched to wave boundaries and never shipped mid-wave**. Rules work still
lands on `main` whenever it is ready; it reaches testers when a freeze is cut between
waves. The live site is pinned to an `alpha-freeze-*` tag rather than to `main`, so this is
enforced by how deployment works rather than by remembering.

A wave boundary therefore means **telling people to finish their matches**, not just
tagging a commit.

---

## Known and accepted

### Anonymous sign-in is a spam vector

**Status:** accepted for a private alpha. **Mitigation gated on public exposure.**

Phase 1 identity is `signInAnonymously()` plus a display name (ADR 0030). The property
that makes it good — an identity costs nothing and takes no time — is exactly the property
an abuser wants. Nothing stops a script minting thousands of users, each of which is a real
row in `auth.users`, and each of which may create matches.

**What limits it now:**

- Supabase rate-limits anonymous sign-ins **per IP per hour** (`auth.rate_limit.anonymous_users`,
  30 by default, set in `supabase/config.toml`). That blunts a naive script and does
  nothing against a distributed one.
- RLS means a minted identity can still only read and write **its own** matches. The blast
  radius is storage and noise, not other people's games.
- The alpha is not publicly linkable: there is no lobby, no matchmaking, and no discovery.
  A match is reachable only by a link somebody was sent.
- **Match creation is capped in the database** — 30 an hour and 50 unfinished per player
  (ADR 0032). Per player rather than globally, so one abuser cannot lock anybody else out.

**What must land before anything is publicly linkable** — open matchmaking, a public lobby,
a link posted anywhere anyone can find it:

1. **CAPTCHA on sign-in.** Supabase supports hCaptcha and Turnstile natively; it is
   configuration plus a client widget, not a build.
2. **Tighten `anonymous_users`** well below the default, and alert on the rate.
3. ~~**A per-user match-creation cap**~~ — **done** (ADR 0032), ahead of exposure rather
   than after it.
4. **Reap unused identities** — an anonymous user with no match and no activity after some
   window is deletable, and `auth.users` will otherwise grow forever.
5. **Move the display-name check server-side** (ADR 0031). It is enforced in the client
   today, which is the right ceiling while every player was invited by name and the wrong
   one the moment they were not.

**The trigger for doing this is exposure, not a date.** A private alpha among invited
testers does not need it; the first public link does.

### The invite link is a bearer capability

**Status:** accepted for an invited alpha. **Per-invite tokens are Phase 2 hardening.**

A match is invited by sending its link. There is no per-invite token and no addressee:
**whoever opens the link first takes the away seat.** Forward it to two people and the
faster one is your opponent; paste it anywhere public and a stranger is.

**What bounds it:**

- The seat is claimed **once**. The `matches_guard_update` trigger refuses to trade an
  occupied seat, so the second opener is told the seat is taken rather than silently
  displacing anyone. There is no race in which two people both become the away player —
  the optimistic `log_version` makes the second claim match zero rows.
- The exposure is **one match**, not an account. A link leaks the match it names and
  nothing else: not the creator's other matches, not their identity beyond a display name.
- Match ids are v4 uuids, so they cannot be guessed or enumerated.

**The UI is required to say so**, and does: the invite field carries _"Anyone who opens
this link takes the second seat — the first person to open it is your opponent. Send it to
one person."_ That copy is asserted by the end-to-end suite, so it cannot quietly go
missing.

**Phase 2 hardening:** a per-invite token, single-use and revocable, so an invite can be
addressed to one person, withdrawn after sending, and expired if unused. That is the right
shape once matches are made between strangers; it is over-built for an alpha where every
link is sent to a friend by hand.

### Anonymous identity is unrecoverable

**Status:** accepted, and must be said in the UI.

No email and no password means nothing to recover _to_. Clearing browser storage loses the
identity and every match with it. This is a product cost of zero-friction sign-in, not a
bug, and the client is required to say so where somebody creates their first match rather
than burying it in a help page.

Supabase can link an anonymous user to an email later **in place**, keeping the uuid — so
this is recoverable as a product decision without orphaning matches or migrating a schema.

### The anon key is in the client bundle

**Status:** by design, and frequently misunderstood.

Anything prefixed `VITE_` is compiled into the public bundle and readable by anyone who
opens the page. The Supabase anon/publishable key is **meant** to be public: it identifies
the project, and row-level security — not secrecy — is what stops one player writing to
another player's match.

**The service-role key is different and must never appear in the client**, in a `VITE_`
variable, or in the repository. It bypasses RLS entirely. It belongs in Phase 2's edge
function secrets. `.env` is gitignored (`.env.example` carries names only), and no key has
been committed.

### Derived columns can drift

**Status:** accepted, bounded by design.

`turn_number`, `result` and `winner` are cached on the match row so a lobby can list
matches without replaying each one. They are **never read back into gameplay** — the
command log is the truth. A client that trusted them could be shown a wrong winner in a
list; it cannot be made to play a wrong match.

---

## Not a security boundary

- **The feature flag.** `ASYNC_MULTIPLAYER = false` keeps unfinished work out of the alpha
  build. It is a build-time constant, so the code is genuinely absent rather than hidden —
  but it is a product guard, not a defence.
- **The client's rules checks.** The client refuses illegal moves because it is playing the
  game, not because it is policing it. Phase 1 trusts it and checks the result; Phase 2
  stops trusting it.
- **The state hash.** FNV-1a over a canonical rendering of the board: fast, stable, and
  enough that accidental divergence cannot go unnoticed. It is **not** collision-resistant
  against somebody deliberately constructing a board to match a hash. It is an integrity
  check, and Phase 2's referee is the answer to the adversarial version of the question.

---

## Reporting something

This is a pre-alpha game with no accounts, no payments and no personal data beyond a
display name somebody chose. If you find something, open an issue — there is nothing here
that warrants a private channel yet, and that sentence is itself worth revisiting the day
it stops being true.
