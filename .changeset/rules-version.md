---
"@gaffer/shared": minor
"@gaffer/web": minor
---

A stored match records which edition of the rules it was played under. A seed and a
command log only reproduce a match against the rules that produced them, and the
dangerous failure is silent — a log written before a resolution change replays end to end
to a match that never happened. Matches saved before this existed keep loading and are
marked as unplaceable rather than discarded. See ADR 0022.
