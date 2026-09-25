---
"@gaffer/web": patch
---

Give an online match a visible board. The pitch is a size container and takes its height
from the column above it; the online view gave it only a minimum, so it had nothing to
measure and collapsed to zero — a match screen with no pitch on it, and every test passing.
Guarded by measuring the board rather than merely finding it, because a 0×0 element is
still in the document.
