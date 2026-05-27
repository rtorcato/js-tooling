---
title: Commitlint
description: Conventional commit message linting configuration.
---

## Usage

```javascript
// commitlint.config.js
import config from '@rtorcato/js-tooling/commitlint/config'
export default config
```

The preset enforces [Conventional Commits](https://www.conventionalcommits.org/) with stricter subject-line length limits.

## With Husky

The `setup` wizard wires Husky + lint-staged + commitlint automatically. To add it manually:

```bash
npx husky init
echo "npx commitlint --edit \$1" > .husky/commit-msg
```
