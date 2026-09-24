---
"@gaffer/shared": minor
"@gaffer/engine": minor
"@gaffer/web": minor
---

The penalty shootout is taken rather than tallied. The player presses for each kick and
sees the odds, then the dice, then the result, with a running scoreboard and commentary.
Nothing about how a penalty resolves changed — the same taker ATK against keeper DEF, the
same die, the same tie to the keeper — and the engine still resolves the whole shootout in
one deterministic step, so it replays byte-identically from a seed with no UI attached and
self-play takes the same kicks. Best of five a side rather than three, stopping once one
side cannot be caught, with takers in ATK order rotating through sudden death. The rules
edition steps to 4. A first-time solo player now meets `casual` rather than `pro`; every
level stays selectable. See ADR 0026.
