---
title: GitHub Actions
description: The CI workflow scaffolded by setup, plus optional deploy workflows you can add with fix.
---

Every scaffold gets a `ci.yml` (lint / typecheck / test / build, and release for
libraries) out of the box. Beyond that, js-tooling ships **optional deploy
workflows** you add on demand — they're too deploy-target-specific to scaffold
by default, so the setup wizard never prompts for them.

## Optional deploy workflows

Add any of these to an existing repo with `fix`:

```bash
npx @rtorcato/js-tooling fix docker-publish
npx @rtorcato/js-tooling fix vercel-deploy
npx @rtorcato/js-tooling fix cloudflare-pages
npx @rtorcato/js-tooling fix preview-deployments
```

Each is **safe-add** — it writes `.github/workflows/<name>.yml` only if that
file doesn't already exist, so it never clobbers a workflow you've customized.

| Target | Workflow | Trigger | Secrets |
|---|---|---|---|
| `docker-publish` | Build + push a Docker image to GHCR | tag push (`v*`) | none (uses `GITHUB_TOKEN`) |
| `vercel-deploy` | Production deploy to Vercel | push to `main` | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| `cloudflare-pages` | Deploy a static build to Cloudflare Pages | push to `main` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| `preview-deployments` | Per-PR preview deploy + URL comment | `pull_request` | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |

Each workflow ships with least-privilege `permissions:` and references its
secrets via `${{ secrets.* }}` — add them under **Settings → Secrets and
variables → Actions** in your repo. A couple carry a placeholder to fill in
(the Cloudflare Pages `--project-name`, for example).
