# 0036 — Nothing takes height from the pitch

- **Status:** Accepted
- **Date:** 2026-09-29
- **Extends:** ADR 0019 (the board fits the screen) and ADR 0035 (one match screen).
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

The match screen is a fixed-height column. Everything that is not the pitch takes the
height it asks for, and the pitch takes what is left (ADR 0019). That is what keeps the
whole field visible at every size without scrolling, and it has a consequence that is easy
to forget when adding something: **the pitch is what pays for it.** Not the page, which
does not grow. The board.

It was forgotten. Online play put the invite — a heading, a share button, the raw link and
a paragraph explaining that the link is a bearer capability — in that column, on the
creator's screen only. Measured on a 390-pixel phone, on the live alpha:

|                                  | pitch     | share of the width |
| -------------------------------- | --------- | ------------------ |
| the player who created the match | 238 × 347 | **61 %**           |
| the player who joined it         | 352 × 511 | **90 %**           |

The same match, at the same moment, one player looking at a board two-thirds the size of
the other's. It was not a layout bug in the sense of something being mispositioned;
everything was exactly where it had been put. The cost simply landed somewhere nobody was
looking, because the thing that gives way is the thing nobody added.

A second, smaller instance of the same mistake was in the shared screen: online drew a
turn banner above the pitch that said what the scoreboard line already said — twenty-two
pixels of height, on both phones, to repeat _"your turn"_.

## Decision

**Nothing is allowed to take height from the pitch.**

Anything the match screen needs beyond the board, the scoreboard and the action bar goes
in one of three places:

1. **A compact control in a row that exists anyway** — a word in the scoreboard line, a
   button positioned out of the flow so the row does not grow around it.
2. **A sheet drawn over the screen**, for something needed once and then not again. The
   invite is the case that prompted this: it matters for about fifteen seconds.
3. **The "More" menu**, for something rarely wanted but occasionally needed. Re-opening
   the invite while the seat is still empty lives there.

And the rule that makes the first two honest: **what is added must cost the same on every
player's screen.** A panel one player has and the other does not is the failure above,
whatever its height.

## Consequences

**It is measured, not remembered.** `apps/web/e2e-online/pitch-parity.spec.ts` takes two
phone viewports, creates a match on one and joins from the other, and asserts two things
that fail for different reasons:

- the two phones render the pitch to the same pixel, before and after the second seat is
  taken and in both turn states;
- the pitch fills at least 90 % of the width — because parity alone is satisfied by two
  equally squashed boards.

Both were red against `alpha-freeze-8` before the fix, at 58 % and 61 %.

**Online now costs the pitch nothing at all.** With the invite in a sheet and the banner
folded into the scoreboard, an online match renders the same 360 × 523 pitch on a 390-pixel
phone as a hotseat match does. That is the standard the rule is aiming at: online is the
same screen, so it should be the same size.

**The turn state lost its emphasis as a separate bar** and keeps it as colour in the
scoreboard line. A player glancing at a phone still sees in one look whether it is on them.

**This constrains what can be added later.** A chat, a move history, a rematch prompt: none
of them may be a panel in the column. That is the point, and the test is where the argument
will happen.
