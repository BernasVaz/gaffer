# 0027 — A bare link opens on 11-a-side, and every game type says alpha

- **Status:** Accepted
- **Date:** 2026-09-24
- **Supersedes:** nothing. ADR 0013's marking of 7- and 11-a-side as alpha still stands;
  this widens the badge rather than changing what it measures.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Two things a tester meets before they meet the game, both of which were set for our
convenience rather than theirs.

**A link with no parameters opened on 5-a-side**, because that is the game type whose
balance is settled and the one every measurement in this repo is taken on. That is a good
reason for a balance run and a poor reason to decide what somebody sees first. Football is
eleven a side. A person handed a link and told "it's a football game" and shown a 7×5
pitch with five players has to be told why before they can start.

**Only 7- and 11-a-side carried an Alpha badge**, because `profile.status` records which
formats have provisional _numbers_. True, and not what a tester needs to know. All of it
is alpha — the rules moved four times in the last fortnight, and the edition counter is on
four. Somebody picking 5-a-side is in exactly the same unfinished game as somebody picking
11; badging two of three implies the third is finished.

## Decision

**A link that says nothing opens on 11-a-side, solo, casual.**

**Every game type carries an Alpha badge**, in the visible pill and in the accessible name.

### Only the no-parameter default moved

A link that names a game type still gets that game type. What is shared stays what was
sent — that is the whole promise of the link format.

**Including the old ones.** A link written before game types existed says `?mode=solo` or
`?mode=hotseat`, where `mode` meant something else entirely. Those already resolve their
play mode by value rather than falling through to a default — and they now resolve their
_game type_ to **5-a-side** explicitly, because that is what they meant when they were
written: 5-a-side was the only game type there was. Left alone, every one of them would
have been quietly reinterpreted onto a different pitch with a different squad.

### `DEFAULT_FORMAT` did not move

There are two different questions and they had one answer between them:

- **`DEFAULT_FORMAT`** is the _engine's_ default — what `createInitialState()` builds when
  nothing says otherwise, and what the test helpers pin rules against. It stays
  **5-a-side**: the smallest board a rule can be expressed on is the right one to express
  it on, and several hundred tests are written that way on purpose.
- **`DEFAULT_SETUP.mode`** is what a person who opened a bare link is looking at. That is
  now **11-a-side**.

Conflating them would have made this a change to the engine, which it is not.

### The badge says "build", the note says "numbers"

`profile.status` still distinguishes which formats have settled numbers, and the line under
the buttons still says so — 5-a-side reads as the settled game type whose numbers the
balance was measured against. The badge above it is about the build everyone is in.

## Consequences

**No engine change, so the rules edition does not move and determinism is untouched.** A
match plays exactly as it did; this is which match you are offered first.

**Three buttons in a row each grew a pill, and that broke the layout** — 23px of horizontal
overflow at 320px, caught by an end-to-end test at phone width rather than by eye. The
mode buttons now shrink below their content (`min-w-0`) and the title wraps under its
badge. ADR 0019 promised the setup screen fits every phone; adding an Alpha to 5-a-side
was enough to break that promise, which is worth recording as how little it takes.

**A first-time player now meets a harder game type on the gentler difficulty.** 11-a-side is
the format furthest from the goals target and the one with the weakest opponent, and it is
now the first thing a tester plays — which is either the most useful place to point Wave 1
or the worst, and self-play cannot tell us which. It is worth watching in the feedback.

**Several tests were leaning on the app's default as a convenient 5-a-side fixture**, and
started running on an 11-a-side board with 5-a-side's assertions. They now pin the format
_and its action economy_ — pinning one without the other leaves a 5-a-side pitch running
four actions a turn, which is a different game (ADR 0012).
