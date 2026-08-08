---
title: Commitlint
description: Conventional commit message linting configuration.
---

## Usage

```javascript
// commitlint.config.js
import config from '@rtorcato/repo-tooling/commitlint/config'
export default config
```

The preset enforces [Conventional Commits](https://www.conventionalcommits.org/) with stricter subject-line length limits.

## Skipped commits

Two kinds of commit are ignored outright:

- anything containing `[skip ci]` (semantic-release's own release commits)
- bot commits, matched on a `Signed-off-by: …[bot]` trailer — Dependabot and
  Renovate bodies are machine-written blocks that never wrap at 72 characters

## With Husky

The `setup` wizard wires Husky + lint-staged + commitlint automatically. To add it manually:

```bash
npx husky init
echo "npx commitlint --edit \$1" > .husky/commit-msg
```
