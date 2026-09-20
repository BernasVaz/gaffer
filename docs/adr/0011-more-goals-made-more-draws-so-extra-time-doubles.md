# 0011 — More goals made more draws, so extra time doubles

- **Status:** Accepted
- **Date:** 2026-09-20
- **Supersedes:** nothing. **Corrects two measurements reported in [ADR 0007](0007-a-wider-die-a-positional-keeper-and-four-more-turns.md)**, whose decision stands unchanged.
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Two things, and the second only came to light because of the first.

**A correction.** ADR 0007's evidence table reported that the balance change took matches
decided by football from 56% to 80%, and matches decided on penalties from 44% to 20%.
Those two cells are wrong. They were measured part-way through the branch, before a fix
to the opponent's tie-breaking landed in the same pull request — the fix that stopped it
preferring one end of the pitch. Every other figure in that table was measured after, and
reproduces exactly today.

Re-measured properly, over 150 matches each, with today's opponent on both sides:

|                      | v1.5 numbers | v1.6 numbers | ADR 0007 claimed |
| -------------------- | ------------ | ------------ | ---------------- |
| Goals per match      | 0.99         | **1.50**     | 0.60 → 1.50      |
| Shots per match      | 2.12         | **2.85**     | 1.90 → 2.85      |
| Shot conversion      | 46.9%        | **52.7%**    | 32% → 52.7%      |
| Goalless matches     | 30.0%        | **9.3%**     | 42% → 9.3%       |
| Decided by football  | 61.3%        | **64.6%**    | 56% → 80%        |
| Decided on penalties | 38.7%        | **35.3%**    | 44% → **20%**    |

**And the finding hiding inside the correction.** The change was a clear success at what
it was aimed at: half again as many goals, and goalless matches cut by two thirds. It
barely touched the shootout rate at all — three points.

That is not a failure of the change; it is a fact about the shape of the problem that
nobody had noticed. **More goals also produce more level scorelines.** Killing goalless
draws does not kill draws: 0–0 became 1–1 and 2–2, and a level match at the cap goes to
the same place a goalless one did. GDD §13's watch-item — "a tiebreaker that fires
constantly is a symptom, not the disease" — was being read as "score more and it will
stop firing", and that reading is wrong.

## Decision

**`EXTRA_TIME_TURNS` 4 → 8** (four turns a side, up from two).

GDD §10 set it at 4 with an explicit reason: _"because goals are scarce a longer extra
time mostly delays the shootout rather than avoiding it."_ That reasoning was correct at
0.6 goals a match. It is false at 1.5 — golden goal now actually fires.

Measured over 150 matches:

| Extra time  | Goals/match | Goalless | Golden goal | Penalties | Avg. turns |
| ----------- | ----------- | -------- | ----------- | --------- | ---------- |
| 4 turns     | 1.50        | 9.3%     | 5.3%        | **35.3%** | 25.5       |
| **8 turns** | **1.61**    | **6.7%** | **16.7%**   | **24.0%** | **26.7**   |
| 12 turns    | 1.69        | 4.7%     | 24.7%       | 16.0%     | 27.5       |

ADR 0007's three numbers — d4, keeper DEF 3, turn cap 24 — are **unchanged**.

## Rationale

- **A golden goal is football; a shootout is a coin flip the players did not influence.**
  Converting a third of the latter into the former is worth more than the raw goal count
  it also adds, because Pillar 2 is about results being traceable to decisions.
- **It is nearly free.** Extra time is only reached by matches that are level at the cap,
  so doubling it costs about one turn on the _average_ match. The tail gets longer; the
  median does not move.
- **8 rather than 12.** Twelve is better on every measure except the one GDD §11 actually
  constrains — a 36-turn ceiling starts to stretch the 3–5 minute target, and the marginal
  gain is half the size of the first step. Eight is where the curve bends.
- **Correcting rather than quietly restating.** The convention here is that an accepted
  ADR is never edited. It says nothing about what to do when an ADR reports a number
  wrongly, so: the decision stands where it is, and the correction lives here, in public,
  next to the thing it corrects. A decision record whose numbers cannot be trusted is
  worse than no record — and it was re-running the measurements for a final report, rather
  than any test, that caught this.

## Consequences

**Positive**

- Two thirds of matches are now settled by football and one in six by a golden goal, from
  one in twenty.
- Goalless matches fall again, to 6.7%.
- The balance record says what was actually measured.

**Negative / accepted costs**

- **Match length is more variable.** A tight match can now run 32 turns against 28. The
  average moves by one.
- **Penalties still decide about one match in four.** Reduced, not solved, and the
  watch-list now says so honestly rather than claiming a close. The remaining lever is the
  one this ADR just used — extra time again — and it has diminishing returns.
- **This is the second time the shootout rate has been mis-called**, once by measuring
  random play and once by measuring mid-branch. Any future claim about it should be
  re-measured on `main` before it is written down.

**Revisit if**

- One in four still feels like too many once a person has played twenty matches. Twelve
  turns of extra time takes it to one in six.
- Match length becomes the complaint instead, in which case this is the first thing to
  undo.
