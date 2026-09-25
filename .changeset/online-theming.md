---
"@gaffer/web": patch
---

Fix the online screens in light mode. They painted no page surface of their own, so on a
light-mode phone they inherited the browser's white page and drew white text on it —
unreadable, and invisible to every test, because nothing asserted on a colour.

The surface every full screen sits on is now one shared class built from the palette
rather than a line of utilities copied per screen, and the online screens use the game's
own tokens throughout. A light-mode contrast suite runs in CI.
