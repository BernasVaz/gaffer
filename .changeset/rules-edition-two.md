---
"@gaffer/shared": minor
---

Step the rules edition to 2. Taking the man on (ADR 0021) and a won dribble carrying on
(ADR 0023) both change what a dribble produces, so a command log written under edition 1
replays silently to a board that never happened — which is the failure the field exists
to catch. Matches saved under edition 1 still load, and now say they are older.
