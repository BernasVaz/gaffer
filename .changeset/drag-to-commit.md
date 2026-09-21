---
"@gaffer/web": minor
---

Add drag-to-commit as a second way into the same move.

Press a player, drag, release on what you want it to do. It ends at the same `onCommit`
the click path ends at and asks the same `targetAt` question about the cell, so the two
cannot come to different conclusions — the failure a parallel input invites.

It takes over only once the pointer has travelled six pixels. Below that nothing happens
at all and the click handler runs exactly as it did, so the existing flow is untouched
rather than reimplemented. Pointer events cover mouse, touch and pen with one path, and
`touch-action` is suppressed only on the cells a drag can start from, so a phone can
still scroll the page from open grass.
