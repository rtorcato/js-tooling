---
title: Semantic Release
description: Automated versioning and publishing configuration.
---

## Usage

```javascript
// release.config.js
import config from '@rtorcato/js-tooling/semantic-release/github'
export default config
```

## Available presets

| Export | Use case |
|---|---|
| `semantic-release/github` | npm publish + GitHub release |
| `semantic-release/docker` | Docker image + GitHub release |

## Required secrets

| Secret | Purpose |
|---|---|
| `NPM_TOKEN` | Publish to npm registry |
| `GITHUB_TOKEN` | Create GitHub releases (auto-provided) |

## What it does on merge to `main`

1. Analyses commit messages since the last release
2. Determines the next semver version (`patch` / `minor` / `major`)
3. Updates `CHANGELOG.md`
4. Bumps `package.json` version
5. Publishes to npm
6. Creates a GitHub release with notes
