# 0015 — The keeper gets a long ball, and the measurement says it is rarely on

- **Status:** Accepted
- **Date:** 2026-09-22
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

A goalkeeper with the ball had exactly one thing it could do with it: pass, two cells, to
whoever happened to be standing next to it. That is not what a keeper is for. Football's
keeper has a second option — hit it long, over the press, and start something — and
Gaffer had no verb for it.

The brief was specific: a long ball **to a team-mate along a clear lane**, range scaled
per format, and a trade-off so it is not free. It also said, explicitly, that if a
"launch into open space / loose ball" model turned out to be clearly better, flag it
rather than build it.

## Decision

**Launch is a sixth verb, not a longer pass.** Goalkeepers only, only while carrying.
Same eight rays as a pass, same first-body-blocks rule, and only to a team-mate **beyond**
the kicker's own PAS — so a pass and a launch are never offered for the same team-mate,
and nobody is asked to choose between a safe ball and a worse version of it.

It is its own verb because it has its own odds, its own wording and its own colour on the
board. Folding it into `pass` would have meant one action type whose risk silently
depended on how far it happened to be going.

**`launchRange` is a per-format rule: 4, 5 and 7.** Roughly half the board's length, so a
keeper on its own line can always reach the opposition half when the lane is clear —
which is the property, not the number.

**`LAUNCH_INTERCEPT_BONUS` is +1 to the defence.** The price of the range: a ball that
long is a ball you can see coming. One rather than the covering rate of two, because on a
d4 with single-digit stats a +2 makes every contested launch a certainty for the defence,
which does not make the verb risky — it deletes it.

Against a keeper's PAS of 2, with nobody covering:

| beside the lane    | as a pass | as a launch |
| ------------------ | --------- | ----------- |
| striker (DEF 1)    | 62.5%     | **37.5%**   |
| winger (DEF 2)     | 37.5%     | **18.8%**   |
| midfielder (DEF 3) | 18.8%     | **6.3%**    |
| defender (DEF 4)   | 6.3%      | **0%**      |

A clear lane is uncontested and free, exactly like a pass. That is deliberate and is the
whole shape of the mechanic: the skill is finding the lane that is genuinely clear, and
the difficulty is that a long lane rarely is.

## Consequences

**It changes nothing measurable, because it is rare.** Sixty self-play matches per format,
with the verb on and off:

| format | goals/match off → on | home win rate off → on | launches/match |
| ------ | -------------------- | ---------------------- | -------------- |
| 5v5    | 1.65 → 1.65          | 55.0% → 53.3%          | 0.05           |
| 7v7    | 1.47 → 1.45          | 61.7% → 61.7%          | 0.03           |
| 11v11  | 1.22 → —             | 40.0% → —              | 0.03           |

Three hundred matches at 5-a-side agree: 0.04 launches a match, every one of them down a
clear lane, none intercepted. So the +1 above is a designed number that self-play has not
yet exercised — the odds table is arithmetic, not measurement.

**Why it is rare is the finding worth keeping.** A census of the keeper's rays over 60
matches a format:

|                                         | 5v5       | 7v7       | 11v11     |
| --------------------------------------- | --------- | --------- | --------- |
| keeper on the ball, moments/match       | 3.38      | 3.20      | 1.02      |
| a launch was legal                      | 9.9%      | 9.9%      | 42.6%     |
| rays ending in **nobody at all**        | **71.1%** | **67.4%** | **69.1%** |
| rays reaching a distant team-mate       | 1.2%      | 1.4%      | 6.1%      |
| rays blocked by the keeper's own player | 18.6%     | 20.5%     | 14.5%     |
| rays blocked by an opponent             | 9.1%      | 10.7%     | 10.2%     |

The limit is **not** the range, and it is **not** the blocking. Seven rays in ten end in
empty grass: there is simply nobody out there to aim at. We checked the obvious remedy —
letting a launch fly over its own players, which is both intuitive and what a real long
ball does — and it moves availability from 9.9% to 10.3% at 5-a-side. It is not the
constraint.

**That is the case for the model we were told to flag rather than build.** A launch that
could be aimed at _open space_, leaving a loose ball for whoever gets there first, would
turn those 71% of empty rays from nothing into the mechanic's main line. It is also a much
bigger change — a loose-ball state, a rule for who collects it, and a new thing for the
opponent to evaluate — so it goes to Bernardo as a decision rather than into this branch.

**The sharpest edge of +1** is that launching past a centre-half reads 0%. The board shows
the number, and a permanently dead option is a different thing from a situationally dead
one. Dropping the bonus to 0 would make it 6.3% and lean entirely on lane length for the
trade-off; that is a one-constant change if the brief's "higher risk than a short pass"
is better served by "steeper with distance" than by a flat penalty.

## Alternatives considered

**A longer `pass` for keepers only.** One fewer action type, and it hides the thing that
matters: a player would see "Pass" and get two different risk profiles depending on
distance. The board is supposed to tell you what you are about to do.

**Scaling the penalty with distance** rather than a flat +1. Defensible, and rejected for
now on legibility — the covering rule already makes long lanes riskier by putting more
bodies beside them, and two distance-dependent terms is one more than anyone can hold in
their head while choosing.

**Launching into open space.** The measurement above says it is probably the better
mechanic. It is not this ADR's to take.
