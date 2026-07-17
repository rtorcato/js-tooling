---
title: Dependabot Strategy
description: The standard Dependabot setup every @rtorcato repo follows — grouping, auto-merge, major-bump triage, and staleness policy.
---

This is the agreed dependency-update standard for all `@rtorcato/*` repos.
js-tooling ships the canonical `dependabot.yml` and auto-merge workflow and
scaffolds both into new projects, so every repo converges by re-running
`js-tooling fix`.

The goal: **safe updates land untouched, risky ones are batched and triaged on
a fixed cadence, and the backlog can never go stale.**

## Why this exists

Before this standard, ungrouped major bumps accumulated for weeks until they
went stale and conflicted on `pnpm-lock.yaml`, while auto-merge silently never
fired (it needs branch protection — see the branch-protection requirement
below). The result was a pile of un-mergeable PRs. This strategy removes both
failure modes.

## 1. Grouping — few PRs, not dozens

Dependabot opens roughly **3–4 PRs per cycle** instead of one per package:

| Group | Contents | Update types | Auto-merge |
| --- | --- | --- | --- |
| `production-minor` | runtime `dependencies` | minor, patch | ✅ on green |
| `dev-minor` | `devDependencies` | minor, patch | ✅ on green |
| `major-updates` | all packages | major | ❌ manual |
| `github-actions` | workflow actions | all | ✅ on green |

## 2. Auto-merge — safe tier only

Patch and minor updates (prod and dev) **merge themselves once CI is green** —
no human in the loop. Implemented by `.github/workflows/dependabot-automerge.yml`
using `dependabot/fetch-metadata` + `gh pr merge --auto --squash`, gated to
`version-update:semver-patch` and `version-update:semver-minor`.

> **Requires branch protection.** `gh pr merge --auto` only gates correctly when
> the repo has auto-merge enabled and `main` has required status checks
> (`lint`, `typecheck`, `build`, `test`). Without it, auto-merge never fires and
> safe updates pile up. This is a hard prerequisite of the strategy.
>
> **Needs a public repo or a paid plan.** Both auto-merge (`allow_auto_merge`)
> and classic branch protection are unavailable on **private repos on the free
> tier** — GitHub returns 403 for branch protection and silently ignores
> `allow_auto_merge`. On such repos `js-tooling fix github-settings` applies what
> it can (squash-merge, delete-branch-on-merge, workflow permissions) but leaves
> auto-merge and protection off, so `doctor` keeps reporting them as drift. Make
> the repo public or upgrade the plan to converge fully.

## 3. Major bumps — batched, triaged, never auto-merged

All majors arrive as a **single `major-updates` PR per ecosystem**, labeled
`major-update`, reviewed on the monthly cadence:

1. Rebase the PR, let CI run.
2. Merge what's green.
3. If one package in the batch breaks the build, exclude it (temporary `ignore`
   entry for that version) so the rest of the batch can land; revisit when the
   upstream issue is resolved.

Majors are never auto-merged — a major is a breaking change by definition and
deserves a human read.

## 4. Staleness policy

**Any Dependabot PR that is conflicting or red at the next cycle gets closed.**
Dependabot recreates it fresh and rebased against current `main`, with current
CI. Closing stale PRs is the normal, expected hygiene step — not a loss of work.

## 5. Cadence & ceiling

- **Monthly** version updates (batched → low noise). Security updates remain
  always-on and are not subject to the monthly schedule.
- `open-pull-requests-limit: 5` — grouping makes this ample and caps the backlog.
- Optional `cooldown: 7 days` so brand-new releases settle before a PR opens.

## 6. Single source of truth

- js-tooling ships the canonical `.github/dependabot.yml` **and**
  `.github/workflows/dependabot-automerge.yml`, and its generator scaffolds
  **both** into new projects.
- `js-tooling doctor` flags drift from the canonical config; `js-tooling fix`
  re-applies it. A strategy change propagates to every repo via `fix`.

## Canonical `dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: monthly
      day: 1
      time: "06:00"
      timezone: Etc/UTC
    open-pull-requests-limit: 5
    versioning-strategy: increase
    commit-message:
      prefix: chore
      include: scope
    groups:
      production-minor:
        dependency-type: production
        update-types:
          - minor
          - patch
      dev-minor:
        dependency-type: development
        update-types:
          - minor
          - patch
      major-updates:
        update-types:
          - major

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
      day: 1
    commit-message:
      prefix: ci
      include: scope
```

## Rollout

1. Apply branch protection on `main` (prerequisite for auto-merge).
2. Update js-tooling's own `dependabot.yml` + `dependabot-automerge.yml` to the
   above.
3. Update the generator and add a `doctor` / `fix dependabot` target.
4. Roll out to other repos via `js-tooling fix`.
