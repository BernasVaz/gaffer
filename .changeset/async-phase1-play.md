---
"@gaffer/engine": minor
"@gaffer/web": minor
---

Asynchronous multiplayer, Phase 1: two people can start a match, send a link, join, take
turns and be told when it is their turn. Behind `ASYNC_MULTIPLAYER`, absent from the alpha
bundle.

The engine gains `stateHash`, a canonical fingerprint of a board. Phase 1 does not run the
engine on the server, so it cannot tell a legal command from an illegal one — what it can
do is notice that the two players are no longer looking at the same match and say which
command it diverged at.

A match on another rules edition is sealed and view-only rather than silently replayed
into a different game. Realtime carries "your turn", and a read on subscribe covers what
Realtime misses.
