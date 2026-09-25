---
"@gaffer/web": patch
---

Make the multiplayer bundle isolation a CI gate. The flag-off build is grepped for the
Supabase client, the environment variable names, the project ref, the keys, the online
chunk and two strings only the online screen has — and CI fails if any appear.

The leak this guards against type-checked and passed every test, because the code was
correct and merely present: `import.meta.env["VITE_X"]` behaves identically to the dot
form at runtime, but only the dot form is substituted at build time, so nothing behind it
is ever tree-shaken. A bundle assertion is the only thing that catches it.
