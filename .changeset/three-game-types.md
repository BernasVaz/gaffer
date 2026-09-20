---
"@gaffer/shared": minor
"@gaffer/engine": minor
"@gaffer/ai": minor
"@gaffer/web": minor
---

Add 7-a-side and 11-a-side as selectable game types, marked alpha.

A game type is now a row of data in `@gaffer/shared` — a board, a line-up and the four
numbers that scale with them — and `createInitialState({ format })` is the only thing
that reads it. **No rule in the engine changed**: it was already written against a board
and a squad rather than against seven columns and five players.

The scale-sensitive numbers moved onto the match as `state.rules`, because a constant
cannot be two values at once and a page may hold a 5-a-side and an 11-a-side at once.
The one that decides whether a format works turned out to be **actions per turn** — 2, 3
and 4 — not the turn cap: at 2 everywhere, the bigger formats produced 0.65 goals a match
with 40–50% goalless.

The game type travels in the link as `mode=`, so a shared match is the same game as well
as the same dice. Links written before game types existed still work.

See ADR 0012 and ADR 0013.
