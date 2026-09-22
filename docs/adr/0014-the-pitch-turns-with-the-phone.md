# 0014 — The pitch turns with the phone, and the engine never finds out

- **Status:** Accepted
- **Date:** 2026-09-22
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

The alpha testers are on phones. A phone held upright is about 375 CSS pixels across,
and the pitch is drawn with its long axis horizontal — so an 11-a-side board gets
375 ÷ 13 ≈ 28px cells. A 28px cell is not a touch target, the shirt number in it is a
smudge, and the surname is dropped entirely because it would be unreadable. The game was
technically playable on a phone and practically wasn't.

The pitch is also the one thing in the app with a strong shape: roughly 3:2 in the wrong
direction for a screen that is 1:2 the other way. Everything else on the page — the
scoreboard, the status line, the buttons — already reflows fine.

Turning the board a quarter turn puts its long axis where the room is. The same
11-a-side board becomes 9 cells across instead of 13: 37px cells, and the pitch gets the
whole height of the screen to run up.

The thing that could go wrong is coordinates. `x` runs goal to goal and `y` runs
touchline to touchline, and the entire game depends on those two numbers meaning the
same thing everywhere: the engine enumerates with them, the AI mirrors with them, the
replay log is a list of commands phrased in them, and a flagged moment quotes a cell by
name. A rotation that reached any of that would mean a match replayed differently
depending on how somebody was holding their phone, which is the one failure the whole
architecture is arranged to make impossible.

## Decision

**Orientation is a fact about the view, and lives entirely in `apps/web`.** One module,
`board/orientation.ts`, owns a `BoardLayout`: the drawn `cols` and `rows`, `toScreen`,
`toBoard`, and a `rotate` for direction vectors. Everything that draws or hit-tests the
board goes through it — the grid, the pieces, the markings, the pointer maths. Nothing
outside `apps/web` knows it exists, and the diff for this change touches no package
under `packages/`.

**Portrait is an anticlockwise quarter turn: the home goal at the foot of the screen,
home attacking upwards.** Attacking up the screen is what a phone game trains you to
expect, and `home` is the side a solo player takes by default, so the common case reads
correctly without anything being flipped per seat.

**Cells keep their names in the engine's coordinates at both orientations.** A cell is
"Column 3, row 2" whichever way the phone is held. That name is what a screen reader
speaks, what an E2E locator finds, and what a flagged moment quotes — a name that turned
with the device would give one cell two identities. The grid's `aria-rowindex` and
`aria-colindex` do describe the drawn layout, because they describe the DOM, and the DOM
is emitted in drawn order so that reading order and keyboard order are the visual ones.

**Which way round is decided by `(orientation: portrait)`,** subscribed live, not by a
width breakpoint or a device guess. The question genuinely is what shape the window is:
a phone turned on its side goes straight back to the wide board, and a tall narrow
desktop window gets the tall one. Both are what you would want, and neither is what a
device sniff would give.

**The markings are turned rather than redrawn,** with a single SVG transform on the
group. A second set of lines for the second orientation would be a second thing to keep
in step with `GOAL_MOUTH_HEIGHT`, and it would drift.

## Consequences

A phone now gets 68px cells at 5-a-side, 49px at 7-a-side and 37px at 11-a-side, against
53/41/28 before. Surnames are legible at 5 and 7 a side, where they were not; at
11-a-side a cell is still under the 46px threshold at which the label is dropped, so
shirt numbers carry the identification and the name stays in the cell's accessible
description. That is a real remaining limit of 11-a-side on a small phone, and the only
way past it is horizontal scrolling, which is worse.

There is now one more thing every board-drawing change has to be correct in two of. The
mitigation is that there is exactly one place to be correct — a component that positions
something by dividing by `board.width` instead of asking the layout is wrong in
portrait, and the drag hit-test has a test that fails precisely that way on purpose.

`preflight`-style caution about auto margins: the board is capped by viewport _height_
in portrait so the far goal cannot fall below the fold, and that cap needs an explicit
`width: 100%` beside it, because `margin-inline: auto` on a flex item stops it
stretching — which collapsed the board to nothing the first time.

## Alternatives considered

**A CSS `rotate(90deg)` on the whole board.** One line, and wrong: every shirt number,
surname and odds badge would come out on its side, each needing a counter-rotation, and
the pointer maths would need the inverse transform anyway. The work does not go away, it
just gets harder to see.

**Rotating the engine's coordinates instead.** Never seriously: it would put a
presentation concern inside the one thing that has to be identical everywhere, and break
every saved log.

**Flipping per seat, so you always attack upwards.** Tempting, and rejected for now —
landscape has always drawn home on the left whichever side you take, and having portrait
alone be seat-dependent is a second rule where there was one. Noted as a possible
follow-up rather than built.
