# 0010 — Real branch protection, now that the repository is public

- **Status:** Accepted
- **Date:** 2026-09-20
- **Supersedes:** [ADR 0002](0002-local-pre-push-gate-instead-of-branch-protection.md)
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

ADR 0002 wanted branch protection on `main` and could not have it: GitHub charges for it
on private repositories, and `gaffer` was private on a free account. The interim answer
was a Husky `pre-push` hook running the full suite before any push to `main` — which that
ADR was careful to describe as "a guardrail against accident, not a control against
intent", because `--no-verify` bypasses it and it only exists on machines that have run
`pnpm install`.

It also named the day this would change: _"the repository goes public — which Master Plan
M3 anticipates… real branch protection becomes free at that moment and should be enabled
the same day."_

That is today. The repository went public so that GitHub Pages could serve the client
(ADR 0009), and protection came free with it.

## Decision

Branch protection is enabled on `main`:

| Setting                            | Value                                              |
| ---------------------------------- | -------------------------------------------------- |
| Required status checks             | **both** CI jobs — the quality gate and Playwright |
| Branch must be up to date to merge | **yes** (`strict`)                                 |
| Linear history                     | **required**                                       |
| Force pushes                       | **blocked**                                        |
| Branch deletion                    | **blocked**                                        |
| Required reviews                   | **none**                                           |
| Applies to admins                  | **no**                                             |

The `pre-push` hook from ADR 0002 **stays**.

## Rationale

- **Both checks are required, not just the fast one.** The end-to-end job is the only one
  that can tell you the _built_ app works, which is the thing anyone with a link actually
  opens. A gate that passes while the deployed page is broken is not a gate.
- **`strict` — up to date before merging.** It means the combination that was tested is
  the combination that lands, rather than two independently-green branches that are red
  together. The cost is a rebase when `main` moves, which on a repository with one author
  working in sequence is close to zero.
- **No required reviews, deliberately.** There is one contributor, and GitHub does not let
  you approve your own pull request — turning this on would block every merge, which is a
  gate against working rather than against breaking. It becomes right the moment there is
  a second person, and that is a one-line change.
- **Admins are exempt, also deliberately.** With one author, enforcing it on admins means
  the only person who can fix a broken `main` is locked out of doing it quickly. The
  useful thing here is stopping a _mistake_, and a mistake does not come with an admin
  override — it comes from a merge button pressed while a check is still amber. This is
  the same "accident, not intent" reasoning ADR 0002 used, applied to a stronger
  mechanism.
- **Linear history and no force pushes** are what actually protect the record. Squash
  merges already give a linear history; requiring it means nobody can quietly rewrite one.
- **Keeping the hook** costs two seconds on a push to `main` and catches a red commit
  _before_ it is pushed rather than after CI reports. The two now overlap, and the overlap
  is the point: the hook is fast and local, protection is authoritative and remote.

## Consequences

**Positive**

- A red commit cannot reach `main` through the merge button, which is what "main always
  works" needed to become true rather than aspirational.
- `main` cannot be force-pushed or deleted, by anyone, including by accident.
- Master Plan §6's Phase 4 exit gate — "a broken PR is blocked by CI" — is now enforced
  rather than reported.

**Negative / accepted costs**

- **An admin can still override.** Recorded plainly rather than presented as airtight:
  this stops accidents, not determination.
- **`strict` means rebasing** when `main` moves under an open pull request. Fine now,
  mildly annoying with several branches in flight.
- **The repository is public**, which is a consequence of ADR 0009 rather than of this
  one, but it is the thing that made this possible and is worth stating in the same
  breath: the code, the design documents and the decision history are all readable by
  anyone now.

**Revisit if**

- A second contributor joins, at which point required reviews and `enforce_admins` both
  become correct.
- The repository ever goes private again, which would take protection away with it.
