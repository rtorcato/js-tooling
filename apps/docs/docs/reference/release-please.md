---
title: Release Please
description: Google's changelog/PR-driven release tool — a third option alongside semantic-release and Changesets.
---

[Release Please](https://github.com/googleapis/release-please) automates
releases by opening a "release PR" that collects Conventional Commits into a
changelog and version bump; merging that PR tags the release. It runs entirely
as a **GitHub Action** — there are no npm devDependencies to install — which
makes it popular in OSS.

It's the third release-tool option alongside the
[semantic-release](./semantic-release) and [Changesets](./changesets) presets.
Pick **one**; `doctor` flags a repo that configures more than one.

## Usage

```bash
npx @rtorcato/js-tooling fix release-please
```

`setup` also offers it in the release-tool list for library projects. The fixer
is **safe-add** — it never overwrites an existing config, manifest, or workflow.

## Generated files

`release-please-config.json` — single package at the repo root, Node release
type:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "changelog-path": "CHANGELOG.md"
    }
  }
}
```

`.release-please-manifest.json` — the last released version per package (Release
Please updates it on each release PR):

```json
{
  ".": "0.0.0"
}
```

`.github/workflows/release-please.yml` — runs the action on every push to
`main`.

## Protected branches

The workflow uses the default `GITHUB_TOKEN`, which opens the release PR. If
`main` is protected against the default token, supply an admin PAT via a
`RELEASE_TOKEN` secret and set the action's `token:` input to it — the scaffolded
workflow has a commented line showing where.

## Monorepos

Add more entries under `packages` (and matching keys in the manifest), one per
workspace you release.
