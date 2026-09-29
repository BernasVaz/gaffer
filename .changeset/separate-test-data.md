---
"@gaffer/shared": minor
---

Mark every row the cloud end-to-end suite writes, and add a purge that removes only marked
rows. The suite runs against the real project on purpose; the cost was test identities
sitting beside real ones with no way to tell them apart afterwards. Marking at write time
is the only version of this safe to run against production — a purge that infers what is
disposable eventually throws away somebody's feedback.
