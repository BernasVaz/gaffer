# 0013 — Two of the three game types ship as alpha, and say so

- **Status:** Accepted
- **Date:** 2026-09-21
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

5-a-side took two rounds of tuning and two ADRs to settle — a die, a keeper's stat, a
turn cap, an action economy, extra time — each one measured over a hundred or more
self-play matches, and one of them recorded wrongly the first time (ADR 0011). That is
what "balanced" cost for _one_ format.

7-a-side and 11-a-side arrive with a single pass of the same instrument, aimed at one
question: are they playable, and is anything obviously broken. They are not tuned. The
brief for them was explicit that they should not be — real players are how those get
tuned, and over-tuning against self-play would bake in the opponent's taste rather than
anyone's.

The risk of shipping them quietly alongside 5-a-side is that a tester reads a rough edge
at 11-a-side as a judgement about the game, and 5-a-side's two rounds of work get
discounted with it.

## Decision

**Every format carries a `status`** — `stable` or `alpha` — as data next to its numbers,
and the interface shows it. 5-a-side is `stable` and is the default; 7-a-side and
11-a-side are `alpha` and are marked on the setup tile, in the blurb under the selector,
and in the match header itself.

**Alpha means: playable, measured once, expect the numbers to move.** It does not mean
broken, and it does not mean untested — the engine, the opponent and the browser all play
full matches at all three.

Where they stand after one pass, over 100 self-play matches each at `pro`:

|                     | 5v5               | 7v7      | 11v11             |
| ------------------- | ----------------- | -------- | ----------------- |
| Status              | **stable**        | alpha    | alpha             |
| Goals per match     | 1.65              | ~1.5     | ~1.2              |
| Goalless            | ~5%               | ~12%     | ~16%              |
| Settled by football | ~78%              | ~75%     | ~80%              |
| Kicking side wins   | ~55%              | ~62%     | ~40%              |
| Confidence          | two tuning rounds | one pass | one pass, one fix |

## Rationale

- **The status is data, not a string in a component.** It sits beside the numbers it
  describes, so promoting a format is the same edit as retuning one, and a test asserts
  that exactly the formats marked `alpha` are the ones flagged in the interface. A label
  that can drift from the thing it labels is worse than none.
- **Marked in three places, because they answer different questions.** The tile answers
  "which should I pick"; the blurb answers "what am I picking"; the header answers "why
  did that feel odd" twenty minutes later.
- **5-a-side stays the default and stays unmarked.** It is the one thing here that has
  been argued over properly, and a tester who just presses Kick off should land on it.
- **One fix, not a tuning round.** 11-a-side handed the side that kicked off an 18% win
  rate — symmetric, reproducible, and far outside anything 5-a-side or 7-a-side shows.
  That is not roughness, it is a broken format, so it was fixed (see `FORMAT_PROFILES`).
  Everything else was left where one measurement put it.

## Consequences

**Positive**

- A tester knows which numbers to argue with, and which have already been argued over.
- Feedback about 7-a-side and 11-a-side arrives as "this felt like X" rather than as
  "your game is unbalanced", which is the difference between useful and not.
- Promoting a format later is a one-word data change plus the evidence to justify it.

**Negative / accepted costs**

- **The alpha numbers are one sample deep**, taken against an opponent rather than
  against people, and self-play measures what the opponent finds rather than what a human
  does. 5-a-side's history says these will move.
- **Kicking off is worth something different at every format** — an advantage at 5v5
  (~55%) and 7v7 (~62%), a disadvantage at 11v11 (~40%). Directionally inconsistent, and
  not yet understood. It is on the watch-list rather than papered over.
- **The word "alpha" appears in the interface**, which is honest and slightly ugly.

**Revisit if**

- A format collects enough real play to be tuned, at which point it is promoted and its
  numbers get an ADR of their own.
- The kickoff figures stay inconsistent across formats after real play, which would point
  at the kickoff position rather than at any one format.
