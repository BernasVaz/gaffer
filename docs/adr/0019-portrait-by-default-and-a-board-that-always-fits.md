# 0019 — Portrait by default, and a board that always fits

- **Status:** Accepted
- **Date:** 2026-09-22
- **Supersedes:** part of ADR 0014 (how orientation is _decided_; the rotation itself stands)

## Context

ADR 0014 taught the board to draw itself upright and picked which way round by
media query: `(orientation: portrait)`. The reasoning was that the question is
genuinely about the shape of the window.

The alpha said otherwise. The upright board is simply the better one to play on —
it is the shape the pitch already is, it fills a phone, and on a desktop it leaves
the width free for everything that is not the board. Deciding it by window shape
meant a desktop player never saw it, and a phone player could not choose.

Two other things were wrong at the same time, and they turn out to be the same
problem. The board was sized by width alone, so on a short screen the far goal
could sit below the fold — the pitch was _drawable_ but not _visible_. And a match
screen that grew downwards meant every control added to it came out of the board.

## Decision

**Portrait everywhere, by default, at every size.** The orientation is a
remembered preference rather than a measurement, with a toggle in the match
header. Kept out of the URL deliberately: the link is the _match_, and two people
opening it must get the same match — whether one of them likes the board sideways
is about them.

**The board fits the space it is given, in both axes.** The match screen is a
fixed-height flex column: everything that is not the pitch takes the height it
needs, and the pitch takes what is left.

`aspect-ratio` alone cannot do this. Given a ratio and a `max-height`, the browser
clamps the height and leaves the width alone, so the board comes out distorted —
or, in a flex row where neither axis is definite, collapses to nothing, which is
what it did on the first attempt. The slot is a **size container** instead, which
makes its height readable as `100cqh`, and the board's width is then
`min(100%, 100cqh × cols / rows)`. That is the whole mechanism.

**Controls that cost board height get out of the way.** Two rows of buttons were
worth about 50px, which on a 568px phone was the difference between a 12px cell
and a playable one. "End turn" and "Flag moment" stay out; everything reached for
_between_ turns went behind one **More** button. Information panels are a drawer
rather than a column, and opening one shrinks the pitch instead of growing the
page.

**Every new game gets a fresh seed.** Before this the setup screen always opened
on the same default, so the first match everybody played was the same match, and
"shuffle" was a button you had to know to press. A link that _carries_ a seed
still wins, because that link is a specific match somebody meant to share.

**Four information panels, all derived.** Player (tap anybody, including theirs),
Stats, Duels, and a commentary ticker. Every figure is read from the state and the
log, so no panel can disagree with the board above it.

**The dice are shown in full.** `D4 3+2 v 3+1` — the die, then each side's score
and what it rolled. A total alone hides the thing a player actually wants after a
surprise, which is whether they were beaten by the stat or by the die.

**The odds can be hidden.** Off by default-on. This is not a retreat from GDD §9:
the numbers are still in every target's accessible name, in the status line and in
the duel panel. It changes what is _drawn_, not what is knowable.

## Consequences

Measured on the built app, 11-a-side — the tightest case:

| screen    | cell before                          | cell after |
| --------- | ------------------------------------ | ---------- |
| 320 × 568 | 12.4px (and the goal below the fold) | **21.6px** |
| 375 × 667 | —                                    | **30.6px** |
| 390 × 844 | 37px                                 | **40.7px** |

No vertical or horizontal scroll at any of them, and the full field visible — now
asserted by E2E at three phone sizes for two formats, plus one test that opens a
panel and checks the pitch gives way rather than the page growing.

**Three real bugs surfaced on the way**, all of the same family — a layout that
looked right in jsdom and was wrong in a browser:

- the pieces layer had no height once the grid stopped deriving its own from
  square cells, so the board drew as an empty green rectangle;
- `white-space: nowrap` on the shared button class fixed the match bar and broke
  the _setup_ screen, which then overflowed sideways by 220px;
- the overflow menu closed on click, which unmounted the very dialog the click had
  just opened — "My feedback" flashed and vanished.

**Cost:** +2.75 kB gzipped (135.71 vs 132.96).

## Alternatives considered

**Keeping the media query and adding an override.** Two sources of truth about
the same thing, and the first time they disagreed somebody would have to reason
about which won. A default plus a toggle says the same thing with one rule.

**Measuring the slot in JavaScript** with a `ResizeObserver` and setting the width
directly. Reliable, and it puts layout on the render path for something CSS can do
in one line — and it would have to run again on every resize, orientation change
and panel toggle.

**A side column for the panels on wide screens.** Tempting, and deferred: it means
two layouts to keep correct rather than one, and the drawer is not worse on a
desktop — it is merely less impressive.
