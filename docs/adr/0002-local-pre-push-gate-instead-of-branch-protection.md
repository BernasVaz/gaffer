# 0002 — A local pre-push hook instead of GitHub branch protection

- **Status:** Accepted (interim — see _Revisit if_)
- **Date:** 2026-08-07
- **Supersedes:** nothing
- **Deciders:** Bernardo (product), CTO (architecture)

## Context

Master Plan §6 calls for branch protection on `main` requiring CI to be green before
a merge. This is the server-side half of "main always works": CI reporting a failure
is useless if a red commit can land anyway.

Attempting to configure it revealed a hard limit. Both of GitHub's mechanisms —
classic branch protection and the newer rulesets — return HTTP 403 on this
repository:

> Upgrade to GitHub Pro or make this repository public to enable this feature.

`gaffer` is private (Master Plan §3.1: "private to start") on a free GitHub account.
Branch protection for private repositories requires a paid plan.

Four options were considered:

1. Upgrade to GitHub Pro (~$4/month).
2. Make the repository public now.
3. A local `pre-push` git hook running the same gates.
4. Do nothing; rely on CI reporting after the fact.

## Decision

Adopt option 3 for now: a Husky `pre-push` hook that runs `pnpm check` and
`pnpm run docs` before any push **to `main`**, and blocks the push if either fails.
Pushes to other branches are not gated.

## Rationale

- It addresses the actual failure mode for a solo developer working directly on
  `main`: pushing something broken by accident. It does not need to defend against a
  second person, because there isn't one yet.
- It is free and available immediately, where the alternatives cost money or change
  who can read the repository — neither of which should be forced by a tooling
  decision.
- Gating only `main` keeps feature branches cheap to push. Pushing work-in-progress
  to a branch and letting CI look at it is a workflow we want to encourage, not tax.
- Doing nothing (option 4) was rejected: CI that reports without preventing is a
  notification, not a gate.

## Consequences

**Positive**

- A red `main` push is stopped in about two seconds, locally, before it reaches
  GitHub. Turborepo's cache makes the repeat cost near zero.
- The same commands run locally and in CI, so a local pass is a strong predictor of
  a CI pass.

**Negative / accepted costs**

- **It is local, not server-side.** It exists only on machines that have run
  `pnpm install`. A fresh clone elsewhere has no protection until then.
- **It is bypassable** with `git push --no-verify`. This is a guardrail against
  accident, not a control against intent. That distinction is acceptable while the
  repository has exactly one author, and stops being acceptable the moment it does
  not.
- It duplicates CI's work locally, costing a few seconds per push to `main`.

**Revisit if**

- The repository goes public — which Master Plan M3 anticipates, in order to share
  the prototype. Real branch protection becomes free at that moment and should be
  enabled the same day.
- A second contributor joins. A bypassable local hook is no longer sufficient once
  more than one person can push.
- The project moves to GitHub Pro for any other reason.
