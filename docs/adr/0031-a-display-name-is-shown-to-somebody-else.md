# 0031 — A display name is shown to somebody else

- **Status:** Accepted
- **Date:** 2026-09-25
- **Supersedes:** nothing.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Phase 1 identity is anonymous plus a display name (ADR 0030). Until multiplayer went
live that name was a label somebody chose for themselves and nobody else ever saw.

It is now printed on another person's screen, beside a match they are playing. That is a
different thing entirely: a field nobody else sees can contain anything, and a field
somebody else sees cannot.

## Decision

**A name is checked before it is saved**, in `@gaffer/shared` so the rule has one home:

- **Length** — 40 characters, matched by a database constraint so the limit is a rule
  rather than a suggestion the client happens to make.
- **Renderability** — C0/C1 control characters, the combining marks a "zalgo" name is
  built from, and the zero-width and bidirectional characters used to make two players
  look like one another. Checked by **code point rather than by a regular-expression
  character class**, because such a class is exactly what it looks like — a range of
  invisible characters — and both the linter and the next reader are right to distrust one.
- **A short list of words**, matched against whole words and words that _begin_ with one.

**The word list is deliberately short and deliberately the obvious ones.** A long list is
a maintenance burden that catches marginally more and starts rejecting innocent names.
Matching on word starts rather than substrings is what keeps **Scunthorpe United**,
**Penistone** and anyone called **Assumpta** playable — and there is a test for each,
because a filter that fails a real person is worse than one that misses a rude name. The
person it fails is trying to play.

**Common substitutions are folded first** — `sh1t`, `f4ggot` — because a filter that any
twelve-year-old defeats in one keystroke is decoration.

**A one-line privacy note sits with the field**, not in a help page: _"Your opponent sees
this name. Nothing else about you is stored — no email, no password, no account."_ It is
said where somebody is deciding what to type, which is the only place it changes what they
type.

## Consequences

**This is a speed bump, not moderation.** It is enforced in the client, so it is
bypassable by anyone willing to use a REST client — and for an invited alpha that is the
right ceiling, because the real control is that every player was invited by name. When
matches are made between strangers this needs to move server-side and grow teeth; that is
noted in `docs/SECURITY.md` with the exposure trigger rather than left implied.

**The database enforces length and nothing else.** Length is cheap and objective. A word
list in Postgres is a list to maintain in a second place and a migration every time it
changes.

**Eleven words are in the repository**, which is unpleasant to read in a diff and the
point. Keeping the list in source rather than a config file means it is reviewed like
code, which is what a list that decides who may play should get.
