---
"@gaffer/shared": minor
"@gaffer/web": minor
---

Capture feedback in the moment, and hand the whole match over as one file.

A "Flag moment" control — button or the `F` key — opens a short note with a category,
and attaches the board automatically: the turn, the score, the side to move, the index
into the move log, and the last eight events in plain English. The board is snapshotted
when the box opens rather than when it is saved, and the match holds still while it is
open, so a note describes the moment somebody reached for the button.

The match now keeps a log of everything played. That makes two things possible: a
refresh comes back as the _same_ match rather than a fresh one — replayed from the seed
and the log, which the engine gives for nothing — and a note can say "action 13 of this
match" and mean something to somebody who was not there.

At the end, a downloadable Markdown report: a header naming the match, each note with
its category, words, a recap of the run-up and a repro line, and the whole move log. A
`?replayTo=` link winds a match back to a flagged action; it reads this browser's saved
log, so cross-machine replay still needs the log from the report — noted as a follow-up.

The engine is untouched. Flagging a moment reads a board and writes text.
