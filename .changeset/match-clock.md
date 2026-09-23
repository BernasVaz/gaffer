---
"@gaffer/web": patch
---

The scoreboard counts the phase the match is in: regulation to the turn cap, and extra
time as its own explicit state counting again from one. It had been showing the two caps
added together, so a match finishing on the cap looked as though it had stopped short.
See ADR 0020.
