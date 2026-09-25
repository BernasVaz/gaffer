---
"@gaffer/shared": minor
"@gaffer/web": minor
---

Ready multiplayer for invited testers: a display name is checked before it is shown to an
opponent, match creation is capped in the database, and the invite has a one-tap share with
the turn state readable across a room. Realtime is now a true enhancement — the client also
re-reads when the tab comes back and on a slow timer, so a dropped socket on a phone
unsticks itself rather than leaving somebody waiting forever.

See ADR 0031 (display names), ADR 0032 (match cap) and ADR 0033 (invited exposure, and
batching engine-edition bumps to wave boundaries).
