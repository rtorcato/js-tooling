---
title: publint
description: Lint your package for common publishing mistakes before you ship it.
---

[publint](https://publint.dev) checks a package's `package.json` and built
output for the mistakes that break consumers after publish — wrong `main`,
missing `exports`, absent type declarations, ESM/CJS mismatches, and files that
point at paths that aren't shipped. It pairs naturally with
[are-the-types-wrong](https://github.com/arethetypeswrong/arethetypeswrong.github.io):
publint validates the package shape, attw validates the type resolution.

## Setup

`setup --preset library` asks whether to add publint (default **yes** for
libraries). To add it to an existing project:

```bash
npx @rtorcato/js-tooling fix publint
```

This installs `publint`, adds a `publint --strict` script, and appends
`pnpm publint` to your `verify` chain. It's scoped to publishable libraries —
private packages and apps skip it.

## What it produces

```json
{
  "scripts": {
    "publint": "publint --strict"
  },
  "devDependencies": {
    "publint": "^0.3.0"
  }
}
```

`--strict` treats warnings (not just errors) as failures, so a problem fails
`verify` and CI rather than slipping into a release.

## CI

When publint is enabled, the generated GitHub Actions workflow runs
`pnpm publint` in the build job **after** the build step — the built `dist/`
must exist for publint to resolve `exports` and `main`.

## Doctor

`doctor` reports publint's status for publishable libraries:

- **ok** — `publint` installed and wired into a script
- **drift** — installed but no script runs it
- **not configured** — not installed (run `fix publint`)

On private packages or those with no published exports, the check is reported
as not applicable.
