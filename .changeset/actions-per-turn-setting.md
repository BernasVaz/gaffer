---
"@gaffer/shared": minor
"@gaffer/engine": minor
"@gaffer/web": minor
---

Let a match choose its action economy before kickoff.

Actions per turn is the number that decides whether a game type works at all (ADR 0012),
so it is now a setup choice in the range 1–4, carried in the link as `actions=`. A link
that says nothing gets the game type's own number rather than 5-a-side's — otherwise a
bare `?mode=11v11` would be a different and much worse game than the selector produces.

`createInitialState` gains a `rules` option: numbers to play a format under, merged over
its own and validated, so an impossible set is refused at construction rather than
producing a quietly unfair match. `pnpm play`'s override flags now go through it instead
of patching the state afterwards.
