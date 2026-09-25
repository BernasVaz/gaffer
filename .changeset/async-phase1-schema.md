---
"@gaffer/web": minor
---

Groundwork for asynchronous multiplayer, Phase 1 — behind `ASYNC_MULTIPLAYER = false`, a
build-time constant so the online code is absent from the alpha bundle rather than merely
hidden in it. No engine change, no rules edition bump: multiplayer changes no rule.

Adds the checked-in Supabase schema — one row per match holding the command log as jsonb
with an optimistic `log_version`, row-level security deciding who may append, and a trigger
deciding what an append may change. `buildMatch` now reports where a replay stopped short
instead of breaking quietly, which is what turns a desync into "diverged at command N".

See ADR 0028 (Supabase rather than Colyseus) and ADR 0029 (the match row).
