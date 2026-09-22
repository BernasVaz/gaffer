# 0017 — The guide teaches the real interface, on a position we chose

- **Status:** Accepted
- **Date:** 2026-09-22
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Gaffer explains none of itself. A first-time player gets a setup screen with six panels
of jargon and then a grid of footballers, and has to work out from nothing that tapping a
player lights its options, that a number on a target is the chance of it coming off, and
that no number means it cannot fail. The alpha testers are being asked for judgements
about balance by people who had to guess the rules first.

Three approaches were put up (a passive tour on the live app, a hybrid on a scripted
position, a fully interactive tutorial match) and the hybrid was chosen.

## Decision

**It is on demand and never uninvited.** A "How to play" control sits beside "My
feedback" on the setup screen and in the match button row. It does **not** run on a first
visit. `AUTORUN_ON_FIRST_VISIT` is a single constant, currently `false`, and
`shouldAutorun()` is that constant AND "this device has not seen it" — so turning it on
later is a one-line change that cannot re-teach anybody who has already been through it.
A test asserts it is off, because "default off" is the requirement, not an accident.

**It teaches the real interface, not a picture of one.** The three setup steps are the
_actual_ setup screen with a hole cut in a dimmed page over it, and the four board steps
are the real `Pitch` reading a real `MatchState`. There is no second copy of anything,
which is the failure mode that makes most tutorials worse than nothing: a guide that has
its own drawing of the interface starts lying the first time the interface moves.

**The copy is derived, not written down.** Step bodies are functions of the live board.
"38% from here" and "shooting at 63% instead" are asked of `previewDuel` at the moment
the step is shown. A retune moves the numbers in the guide because it moves the numbers
in the game.

**Anchors are CSS selectors, and a test asserts every one resolves.** The setup steps
point at `section[aria-labelledby="…"]`, which already existed. The board steps point at
`[role="gridcell"][aria-label^="Column X, row Y:"]` — the engine's own coordinates, which
ADR 0014 fixed as **orientation-independent**. So the spotlight lands correctly in
portrait and landscape with no orientation logic in the guide at all; it measures where
the cell happens to be drawn and puts the hole there.

**It waits only on things that cannot fail.** Two board steps are hands-on: choosing a
player, and an **uncontested** pass. Anything else the player tries is simply not taken —
the board keeps its shape and the step keeps asking. A step that waited on a contested
action would teach "and then you lose the ball" six times in ten, and a guide that can be
walked into a position its next step cannot describe is a guide with a dead end in it.

**The practice position is content, reached by replaying legal commands.** It is a seed,
a format, an action count and a list of 24 commands, folded through the same `buildMatch`
the live match and the feedback archive use. The engine gains nothing, is told nothing,
and cannot tell it is being used for a tutorial.

Every command in that list is a `move` or an **uncontested** pass, so the replay rolls no
dice: the position is fixed rather than something that might come out differently, and it
is the same board from any seed. Tests assert both.

**What the position had to show, and does:**

|                               |                                                   |
| ----------------------------- | ------------------------------------------------- |
| carrier pressed, up the pitch | home midfielder on (4, 1), two opponents adjacent |
| targets with numbers          | dribbles at 0–6%, a shot at **38%**               |
| a target without one          | an uncontested pass                               |
| …to somebody better placed    | the winger, shooting at **63%**                   |

That last row is the whole game in one move — _move the ball to where the number is
better_ — which is worth far more than a sentence saying so.

**It ends in a real match**, with whatever was chosen on the setup screen along the way,
published to the address bar like any other match.

## Consequences

The guide is 7 steps, hand-rolled, and costs **+3.2 kB gzipped** (132.96 kB against
129.74). No dependency was taken: `driver.js` is the only licence-viable option of the
obvious four — Shepherd.js and intro.js are both AGPL-3.0 — and at 8.2 kB gzipped it is
more than twice the cost of writing it, while still leaving the board-cell anchoring and
the bottom-sheet placement to be written by hand anyway.

**The pinned position is content that can go stale.** If 5-a-side's formation or its
numbers are retuned, the command list may no longer reach the same board, or the pass may
stop improving the shot. Six tests assert exactly those properties, so that fails in CI
rather than in a tester's hands — but it is a maintenance cost, and it is the price of
being able to promise what the lesson shows.

**Two bugs the build surfaced in existing code**, both fixed here:

- the setup screen said a side "attacks right", which is wrong on a phone held upright.
  It now reads the orientation. The guide is only useful if the thing it teaches from is
  true.
- the card is pinned to the bottom, and the page could not always scroll its anchor clear
  of it — "Kick off", the one button a step asks to be pressed, ended up underneath the
  step asking for it. A spacer at the foot of the page gives it room.

**A measurement gotcha worth writing down:** the spotlight slides between steps, so a
single `getBoundingClientRect` catches it in flight and compares the hole against where it
is _going_. It fooled a screenshot twice and an E2E assertion once. Anything asserting on
the spotlight's position has to poll for it to settle.

## Alternatives considered

**A passive tour on the player's own first match.** A day's work instead of three, and it
cannot promise the lessons: what is on the board depends on the seed, so there may be no
contested target to point at and no shot to explain, and in solo the opponent moves while
you read.

**A fully interactive tutorial match.** Best retention and genuinely fragile. Every step
waiting on a contested action needs a failure branch, and recovering a diverged board
means either forcing an outcome — which would put a thumb on the engine, the one thing
that must never happen — or re-scripting halfway through.

**Auto-running on a first visit.** Deferred rather than rejected; the switch is in.
A tutorial that starts before anyone asks is the thing people complain about, and an
alpha tester arriving through a shared link is mid-conversation about a specific match.
