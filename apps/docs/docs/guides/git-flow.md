---
title: Git Flow & Branch Protection
description: The branching and release workflow every @rtorcato repo follows — GitHub Flow, a protected main, required checks, and how semantic-release fits in.
---

This is the agreed branching and release workflow for all `@rtorcato/*` repos.

The model is **GitHub Flow**, not Git Flow: there is **one long-lived branch,
`main`**, and it is always releasable. Every change lands through a short-lived
branch and a reviewed pull request. `main` is protected so nothing reaches it
except a green, reviewed PR — and the release bot.

## The flow

1. Branch off `main` with a prefix: `feat/`, `fix/`, `docs/`, `chore/`, or
   `refactor/` (see `CONTRIBUTING.md`).
2. Open a PR into `main`. CI runs lint, typecheck, build, and tests.
3. Get it green, then **squash-merge**. One conventional commit per change keeps
   history linear and lets `semantic-release` compute the next version.
4. The push to `main` triggers `semantic-release`: it bumps the version, updates
   `CHANGELOG.md`, tags, publishes to npm, and creates the GitHub release.

That's the whole loop. `main` is the trunk and the release branch at once.

## Why there is no `dev` branch

A long-lived `dev`/`develop` branch is deliberately **not** used:

- `semantic-release` treats `main` as the release trunk — it analyzes commits on
  `main` and releases from it. A `dev → main` gate adds a second integration
  step and recurring merge conflicts (notably on `pnpm-lock.yaml`) with **no
  safety gain**. Safety comes from branch protection, not from an extra branch.
- Prereleases don't need a permanent branch. `release.config.mjs` already maps
  `next`, `beta`, and `alpha` (and `dev`) to **prerelease** channels. When you
  actually need to stage an unreleased line, create one of those branches on
  demand; it produces `-beta`/`-alpha` tags and is deleted when the line ships.

The risk of "everything goes to `main`" is real, but the fix is **protecting
`main`**, below — not maintaining a parallel branch.

## Branch protection on `main`

`main` requires a pull request and passing checks; direct pushes, force-pushes,
and deletion are blocked.

| Setting | Value |
| --- | --- |
| Require a pull request before merging | ✅ |
| Required approving reviews | `0` for solo maintenance (the gate is "no direct human pushes"); raise it once there are other maintainers |
| Require status checks to pass | ✅ — see contexts below |
| Require linear history | ✅ (matches squash-merge) |
| Allow force pushes | ❌ |
| Allow deletions | ❌ |

### Required status checks

The required contexts are exactly the jobs that run on **`pull_request → main`**:

- `lint`
- `typecheck`
- `build`
- `test (node 22)`
- `test (node 24)`

> **`commitlint` is intentionally not a required check.** It runs only on `push`
> events (`github.event_name == 'push'`), so it never reports a status on a PR.
> Marking it required would leave every PR waiting forever on a check that never
> arrives. Commit-message linting is still enforced — locally by the Husky
> `commit-msg` hook and on `main` by the push-triggered `commitlint` job.

## The semantic-release exception

After a PR merges, the `release` job runs on `main` and pushes a
`chore(release): … [skip ci]` commit **and a tag directly to `main`** — it does
not open a PR for the version bump. Because that commit carries `[skip ci]`, no
status checks run on it, so required-status-checks would otherwise **block** the
release push.

Branch protection must therefore let the release identity bypass the rules.
Use a repo **ruleset** for `main` mirroring the settings above and add the
release identity to its **bypass list**. (Alternatively, run the `release` job
under an admin's PAT / GitHub App token and leave "include administrators" off,
so that identity bypasses.) This bypass is for the release bot only — humans
always go through a PR.

## Single source of truth

- This standard, `CONTRIBUTING.md` (branch prefixes, the ≤67-char PR-title
  rule), and `reference/semantic-release.md` (what the release job does) together
  describe the full workflow.
- Issue-triggered automation has its own gating — see
  [Public-Repo Issue Safety](./public-repo-issue-safety.md).

## Rollout

1. Apply the branch-protection ruleset on `main` (settings above) with the
   release identity in the bypass list.
2. Verify: a red PR can't merge; a green PR squash-merges; a direct
   `git push origin main` is rejected; the next merge still releases.
3. Roll the same ruleset out to other public `@rtorcato` repos.
