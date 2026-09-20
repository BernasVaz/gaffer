---
"@gaffer/shared": minor
---

Double extra time, 4 turns to 8, and correct the v1.6 balance record.

Re-measuring v1.6 for a final report showed two of its figures had been taken part-way
through the branch and were wrong: matches decided on penalties went 38.7% → 35.3%, not
44% → 20%. The goals were real — 0.99 → 1.50 — but they did not reduce draws, because
killing _goalless_ matches turns 0–0 into 1–1.

GDD §10 set extra time at 4 turns because "goals are scarce, so a longer extra time
mostly delays the shootout". True at 0.6 goals a match; false at 1.5. At 8 turns golden
goal decides one match in six rather than one in twenty, penalties fall to 24%, and the
average match grows by about one turn. See ADR 0011.
