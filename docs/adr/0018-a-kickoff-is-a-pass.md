# 0018 — A kickoff is a pass

- **Status:** Accepted
- **Date:** 2026-09-22
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Every match opened with whatever the kicking side fancied. Because the formations put
the two strikers adjacent to each other, the carrier is pressed at its origin from the
first frame — so its cheapest-looking options were all **dribbles**, contested duels
against the opponent standing next to it.

A test in `legal-actions.test.ts` had asserted this behaviour since M2 and carried a note
on it: _"Flagged for review: it means the side kicking off must pass, shoot, or accept a
duel."_ That flag sat there for four milestones. The answer football gives is that a
kickoff is a pass, and Gaffer had no way to say so.

It also made the guided introduction awkward in a way worth noticing: the first thing a
new player was shown was a menu of 0–6% dribbles.

## Decision

**The side restarting may only Pass with its first action.** At the opening whistle and
after every goal, `legalActions` returns the passes and nothing else.

**It is a field on the state, not something derived.** `kickoffPending: Team | null`.
"Is this a kickoff" cannot be read off a board: the formation reset after a goal produces
the same arrangement a fresh match does, and a side that has already taken its kickoff
still stands mostly in shape. Set by `createInitialState` and by the reset after a goal,
and cleared by the first action that side takes.

**Giving the turn away forfeits it.** Holding the obligation over would mean a side that
had already passed could be asked for a kickoff pass on some later turn, which is not a
rule anyone would expect.

**There is a safety valve.** If a kickoff formation offered no pass at all, the
restriction does not apply — a rule that can strand a player with nothing but `endTurn`
is worse than one with a documented exception. `packages/shared/tests/format.test.ts`
already asserts every shipped format _has_ a kickoff pass, and a new engine test asserts
the restriction holds at all three, so the valve guards against a future formation rather
than anything a current match can reach.

## Consequences

**Goals per match stay in their band.** Sixty self-play matches per format, against the
figures recorded in ADR 0015 for the same seeds:

| format | goals/match     | home win rate     |
| ------ | --------------- | ----------------- |
| 5v5    | 1.65 → **1.52** | 55.0% → **66.7%** |
| 7v7    | 1.47 → **1.80** | 61.7% → **48.3%** |
| 11v11  | 1.22 → **1.12** | 40.0% → **38.3%** |

The win-rate columns are **not** a paired comparison and should not be read as one: the
rule changes the very first action, so every match after it is a different match, and at
sixty samples ten points is about six results. What the goal column shows is that the
change does not move scoring out of the 1.1–1.8 range the formats already sat in.

**It rippled further than a one-rule change suggests.** Twenty-three tests across four
packages encoded "a match starts with a dribble available" as an assumption rather than
as a claim — and one of them, the AI's board-mirroring helper, was a genuine bug: it did
not mirror the new field, so the mirrored board demanded a kickoff pass from the side
that had already taken one. That is the test guarding against a side quietly winning 88%
of self-play (ADR 0008), so it was worth having.

**The guided introduction's pinned position had to be regenerated**, because its command
list began with a move. `tools/play/src/find-guide-position.ts` — thrown away after ADR
0017 and immediately needed again — is now committed for that reason. The replacement is
better: 12 commands instead of 24, and it teaches a 63% shot against an 81% one.

## Alternatives considered

**Leaving it and moving the strikers apart.** Would remove the dribble-into-contact
opening without a rule, but it changes every format's formation — which is tuned — to fix
something that is really about the restart, and it would not stop a kickoff being a shot
or a dribble somewhere else.

**Applying it only to the opening kickoff.** Simpler to implement and incoherent: a
restart after a goal is a kickoff by any reading, and having two kinds would be a rule
nobody could remember.

**A dedicated `kickoff` action type.** Considered and rejected — it resolves exactly as a
pass does, so a second verb would be a second thing to handle everywhere for no
behavioural difference. The restriction is about _which_ verbs are on offer, which is
enumeration's job.
