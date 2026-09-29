---
"@gaffer/shared": minor
"@gaffer/web": patch
---

Harden what the alpha stores about people. A display name was readable by anyone who
minted an anonymous session; it is now visible only to its owner and their opponent.
Feedback bodies are capped in the database, neither feedback nor names are broadcast, and
`csvCell` neutralises spreadsheet formulas and invisible characters on the way into any
export. Adds a Content-Security-Policy naming the exact project the build talks to, and a
backup export, because the free Supabase tier has none.
